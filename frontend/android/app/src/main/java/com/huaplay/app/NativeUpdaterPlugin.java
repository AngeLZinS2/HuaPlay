package com.huaplay.app;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "NativeUpdater")
public class NativeUpdaterPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean isDownloading = new AtomicBoolean(false);
    private final AtomicBoolean isInstalling = new AtomicBoolean(false);
    private final AtomicBoolean isCancelled = new AtomicBoolean(false);

    private volatile HttpURLConnection activeConnection = null;
    private volatile PluginCall activeDownloadCall = null;
    private volatile File activePartFile = null;

    private volatile File verifiedApkFile = null;
    private volatile long verifiedVersionCode = -1;
    private volatile String verifiedSha256 = null;

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        String url = call.getString("url");
        Long rawVersionCode = call.getLong("versionCode");
        String sha256 = call.getString("sha256");

        if (url == null || !NativeUpdatePolicy.isValidDownloadUrl(url)) {
            call.reject("URL de download inválida ou não permitida");
            return;
        }

        if (sha256 == null || !NativeUpdatePolicy.isValidSha256(sha256)) {
            call.reject("SHA-256 do manifesto ausente ou inválido");
            return;
        }

        if (rawVersionCode == null) {
            call.reject("VersionCode ausente");
            return;
        }

        long currentVersionCode = getCurrentAppVersionCode();
        if (!NativeUpdatePolicy.isValidVersionCode(rawVersionCode, currentVersionCode)) {
            call.reject("VersionCode inválido ou não é superior à versão atual (" + currentVersionCode + ")");
            return;
        }

        if (isInstalling.get()) {
            call.reject("Instalação em andamento. Não é possível iniciar novo download.");
            return;
        }

        if (!isDownloading.compareAndSet(false, true)) {
            call.reject("Já existe um download em andamento");
            return;
        }

        // Limpa metadados de instalação prévia antes de iniciar o novo download
        verifiedApkFile = null;
        verifiedVersionCode = -1;
        verifiedSha256 = null;

        isCancelled.set(false);
        activeDownloadCall = call;
        final long expectedVersionCode = rawVersionCode;
        final String expectedSha256 = NativeUpdatePolicy.normalizeSha256(sha256);

        try {
            executor.execute(() -> runDownload(url, expectedVersionCode, expectedSha256, call));
        } catch (RejectedExecutionException e) {
            isDownloading.set(false);
            activeDownloadCall = null;
            call.reject("Falha ao enfileirar download: serviço em finalização");
        }
    }

    private void runDownload(String urlString, long expectedVersionCode, String expectedSha256, PluginCall call) {
        File updatesDir = new File(getContext().getCacheDir(), "updates");
        if (!updatesDir.exists() && !updatesDir.mkdirs()) {
            isDownloading.set(false);
            activeDownloadCall = null;
            call.reject("Falha ao criar diretório privado de atualizações");
            return;
        }

        String filename = NativeUpdatePolicy.extractApkFilename(urlString);
        File partFile = new File(updatesDir, filename + ".part");
        File finalFile = new File(updatesDir, filename);

        activePartFile = partFile;
        if (partFile.exists()) {
            partFile.delete();
        }

        HttpURLConnection connection = null;
        InputStream inputStream = null;
        FileOutputStream outputStream = null;
        boolean renamedToFinal = false;

        JSObject pendingResult = null;
        String pendingErrorMessage = null;
        long totalVerifiedBytes = 0;

        try {
            URL url = new URL(urlString);
            connection = (HttpURLConnection) url.openConnection();
            activeConnection = connection;

            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(NativeUpdatePolicy.CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(NativeUpdatePolicy.READ_TIMEOUT_MS);
            connection.setRequestProperty("User-Agent", "HuaPlay-NativeUpdater/" + getCurrentAppVersionCode());
            connection.connect();

            int responseCode = connection.getResponseCode();
            if (NativeUpdatePolicy.isRedirect(responseCode)) {
                throw new IOException("Redirecionamento não permitido pelo servidor (HTTP " + responseCode + ")");
            }
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("Resposta do servidor não foi OK (HTTP " + responseCode + ")");
            }

            long contentLength = connection.getContentLengthLong();
            if (!NativeUpdatePolicy.isContentLengthAcceptable(contentLength)) {
                throw new IOException("Arquivo excede limite de 64MB: " + contentLength + " bytes");
            }

            inputStream = connection.getInputStream();
            outputStream = new FileOutputStream(partFile);
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");

            byte[] buffer = new byte[NativeUpdatePolicy.BUFFER_SIZE_BYTES];
            long bytesRead = 0;
            long lastProgressReportTime = 0;

            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                if (isCancelled.get() || Thread.currentThread().isInterrupted()) {
                    throw new InterruptedException("Download cancelado");
                }

                outputStream.write(buffer, 0, read);
                messageDigest.update(buffer, 0, read);
                bytesRead += read;

                if (bytesRead > NativeUpdatePolicy.MAX_FILE_SIZE_BYTES) {
                    throw new IOException("Tamanho baixado ultrapassou limite de 64MB");
                }

                long now = System.currentTimeMillis();
                if (now - lastProgressReportTime >= NativeUpdatePolicy.PROGRESS_THROTTLE_MS) {
                    lastProgressReportTime = now;
                    int progress = contentLength > 0
                            ? (int) Math.min(99, Math.max(0, (bytesRead * 100) / contentLength))
                            : -1;
                    emitProgress(progress, bytesRead, contentLength);
                }
            }

            outputStream.flush();
            outputStream.close();
            outputStream = null;

            if (contentLength > 0 && bytesRead != contentLength) {
                throw new IOException("Arquivo incompleto: recebidos " + bytesRead + " de " + contentLength);
            }

            // Integridade SHA-256 do arquivo baixado
            String actualSha256 = NativeUpdatePolicy.bytesToHex(messageDigest.digest());
            if (!NativeUpdatePolicy.hashesMatch(expectedSha256, actualSha256)) {
                throw new SecurityException("Hash SHA-256 não confere (esperado: " + expectedSha256 + ", obtido: " + actualSha256 + ")");
            }

            if (isCancelled.get() || Thread.currentThread().isInterrupted()) {
                throw new InterruptedException("Download cancelado antes de salvar arquivo final");
            }

            // Renomeia para o arquivo final .apk
            if (finalFile.exists()) {
                finalFile.delete();
            }
            if (!partFile.renameTo(finalFile)) {
                throw new IOException("Falha ao salvar APK verificado em cache privado");
            }
            renamedToFinal = true;
            activePartFile = null;

            if (isCancelled.get() || Thread.currentThread().isInterrupted()) {
                deleteFileQuietly(finalFile);
                throw new InterruptedException("Download cancelado antes da validação do APK");
            }

            // Valida integridade e certificados do APK baixado contra o app instalado
            validateApkArchive(finalFile, expectedVersionCode);

            if (isCancelled.get() || Thread.currentThread().isInterrupted()) {
                deleteFileQuietly(finalFile);
                throw new InterruptedException("Download cancelado");
            }

            // Grava estado validado interno
            verifiedApkFile = finalFile;
            verifiedVersionCode = expectedVersionCode;
            verifiedSha256 = actualSha256;
            totalVerifiedBytes = bytesRead;

            JSObject result = new JSObject();
            result.put("status", "download_complete");
            result.put("versionCode", expectedVersionCode);
            result.put("sha256", actualSha256);
            pendingResult = result;

        } catch (InterruptedException e) {
            deleteFileQuietly(partFile);
            if (renamedToFinal) {
                deleteFileQuietly(finalFile);
            }
            pendingErrorMessage = "Download cancelado";
        } catch (SecurityException e) {
            deleteFileQuietly(partFile);
            if (renamedToFinal) {
                deleteFileQuietly(finalFile);
            }
            pendingErrorMessage = "Falha de segurança e integridade: " + e.getMessage();
        } catch (Exception e) {
            deleteFileQuietly(partFile);
            if (renamedToFinal) {
                deleteFileQuietly(finalFile);
            }
            pendingErrorMessage = "Erro durante download da atualização: " + e.getMessage();
        } finally {
            if (outputStream != null) {
                try {
                    outputStream.close();
                } catch (IOException ignored) {}
            }
            if (inputStream != null) {
                try {
                    inputStream.close();
                } catch (IOException ignored) {}
            }
            if (connection != null) {
                connection.disconnect();
            }
            activeConnection = null;
            activePartFile = null;
            activeDownloadCall = null;
            isDownloading.set(false);
        }

        // Ao sair do try/finally: cleanup e busy resetados uma única vez ANTES de resolver/rejeitar
        if (pendingResult != null) {
            emitProgress(100, totalVerifiedBytes, totalVerifiedBytes);
            call.resolve(pendingResult);
        } else {
            call.reject(pendingErrorMessage != null ? pendingErrorMessage : "Falha desconhecida no download");
        }
    }

    private void validateApkArchive(File apkFile, long expectedVersionCode) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        int flags = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;

        PackageInfo archiveInfo = pm.getPackageArchiveInfo(apkFile.getAbsolutePath(), flags);
        if (archiveInfo == null) {
            throw new SecurityException("APK corrompido ou ilegível pelo sistema");
        }

        // 1. PackageName == app
        String currentPackage = getContext().getPackageName();
        if (!currentPackage.equals(archiveInfo.packageName)) {
            throw new SecurityException("Identificador do pacote incompatível (" + archiveInfo.packageName + " != " + currentPackage + ")");
        }

        // 2. VersionCode == esperado e > atual
        long archiveVersionCode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            archiveVersionCode = archiveInfo.getLongVersionCode();
        } else {
            archiveVersionCode = archiveInfo.versionCode;
        }

        if (archiveVersionCode != expectedVersionCode) {
            throw new SecurityException("VersionCode do APK (" + archiveVersionCode + ") difere do manifesto (" + expectedVersionCode + ")");
        }

        long currentVersionCode = getCurrentAppVersionCode();
        if (archiveVersionCode <= currentVersionCode) {
            throw new SecurityException("Versão do APK (" + archiveVersionCode + ") não é superior à versão atual (" + currentVersionCode + ")");
        }

        // 3. Conjunto completo de certificados de assinatura confere exatamente com o instalado
        PackageInfo installedInfo = pm.getPackageInfo(currentPackage, flags);
        Set<String> installedCerts = getSignaturesSha256(installedInfo);
        Set<String> archiveCerts = getSignaturesSha256(archiveInfo);

        if (installedCerts.isEmpty() || archiveCerts.isEmpty() || !installedCerts.equals(archiveCerts)) {
            throw new SecurityException("Assinatura do APK não confere com o aplicativo instalado");
        }
    }

    private Set<String> getSignaturesSha256(PackageInfo packageInfo) throws NoSuchAlgorithmException {
        if (packageInfo == null) {
            return Collections.emptySet();
        }
        Signature[] signatures = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (packageInfo.signingInfo != null) {
                signatures = packageInfo.signingInfo.getApkContentsSigners();
                if (signatures == null || signatures.length == 0) {
                    signatures = packageInfo.signingInfo.getSigningCertificateHistory();
                }
            }
        } else {
            signatures = packageInfo.signatures;
        }

        if (signatures == null || signatures.length == 0) {
            return Collections.emptySet();
        }

        Set<String> set = new HashSet<>();
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        for (Signature sig : signatures) {
            byte[] digest = md.digest(sig.toByteArray());
            set.add(NativeUpdatePolicy.bytesToHex(digest));
            md.reset();
        }
        return set;
    }

    private long getCurrentAppVersionCode() {
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo packageInfo = pm.getPackageInfo(getContext().getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return packageInfo.getLongVersionCode();
            } else {
                return packageInfo.versionCode;
            }
        } catch (PackageManager.NameNotFoundException e) {
            return 0;
        }
    }

    private void emitProgress(int progress, long bytesRead, long totalBytes) {
        JSObject data = new JSObject();
        data.put("progress", progress);
        data.put("bytesRead", bytesRead);
        data.put("totalBytes", totalBytes);
        notifyListeners("progress", data);
        notifyListeners("downloadProgress", data);
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        if (!isDownloading.get()) {
            JSObject res = new JSObject();
            res.put("status", "idle");
            call.resolve(res);
            return;
        }

        isCancelled.set(true);
        HttpURLConnection conn = activeConnection;
        if (conn != null) {
            new Thread(() -> {
                try {
                    conn.disconnect();
                } catch (Exception ignored) {}
            }).start();
        }

        deleteFileQuietly(activePartFile);

        JSObject res = new JSObject();
        res.put("status", "cancelled");
        call.resolve(res);
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        if (isDownloading.get()) {
            call.reject("Download em andamento. Aguarde a conclusão antes de instalar.");
            return;
        }

        if (verifiedApkFile == null || !verifiedApkFile.exists() || verifiedSha256 == null) {
            call.reject("Nenhum APK verificado disponível para instalação");
            return;
        }

        if (!isInstalling.compareAndSet(false, true)) {
            call.reject("Instalação já em andamento");
            return;
        }

        try {
            executor.execute(() -> performInstallChecks(call));
        } catch (RejectedExecutionException e) {
            isInstalling.set(false);
            call.reject("Falha ao agendar instalação: serviço em finalização");
        }
    }

    private void performInstallChecks(PluginCall call) {
        try {
            File apkFile = verifiedApkFile;
            String expectedHash = verifiedSha256;
            long expectedCode = verifiedVersionCode;

            if (apkFile == null || !apkFile.exists() || expectedHash == null) {
                throw new SecurityException("Arquivo APK ausente no momento da instalação");
            }

            File updatesDir = new File(getContext().getCacheDir(), "updates");
            if (!apkFile.getCanonicalPath().startsWith(updatesDir.getCanonicalPath())) {
                throw new SecurityException("Caminho do arquivo APK fora do diretório autorizado");
            }

            // Recalcula SHA-256 do arquivo em disco antes de prosseguir
            String diskFileHash = NativeUpdatePolicy.computeFileSha256(apkFile);
            if (!NativeUpdatePolicy.hashesMatch(expectedHash, diskFileHash)) {
                throw new SecurityException("Integridade do arquivo APK comprometida antes da instalação");
            }

            // Revalida manifesto e assinaturas
            validateApkArchive(apkFile, expectedCode);

            // Em Android 8.0+ (API 26), verificar se o app tem permissão para instalar fontes desconhecidas
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!getContext().getPackageManager().canRequestPackageInstalls()) {
                    if (getActivity() == null) {
                        isInstalling.set(false);
                        call.reject("Activity indisponível para solicitar permissão");
                        return;
                    }

                    getActivity().runOnUiThread(() -> {
                        try {
                            Intent manageIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                            manageIntent.setData(Uri.parse("package:" + getContext().getPackageName()));
                            startActivityForResult(call, manageIntent, "manageUnknownAppSourcesCallback");
                        } catch (ActivityNotFoundException | SecurityException e) {
                            isInstalling.set(false);
                            call.reject("Falha ao abrir configurações de fontes desconhecidas: " + e.getMessage());
                        } catch (Exception e) {
                            isInstalling.set(false);
                            call.reject("Erro inesperado ao requisitar autorização: " + e.getMessage());
                        }
                    });
                    return;
                }
            }

            launchInstaller(call);

        } catch (Exception e) {
            isInstalling.set(false);
            call.reject("Falha na validação do pacote para instalação: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void manageUnknownAppSourcesCallback(PluginCall call, ActivityResult result) {
        if (call == null) {
            isInstalling.set(false);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (getContext().getPackageManager().canRequestPackageInstalls()) {
                try {
                    executor.execute(() -> performInstallChecks(call));
                } catch (RejectedExecutionException e) {
                    isInstalling.set(false);
                    call.reject("Falha ao agendar instalação: serviço em finalização");
                }
                return;
            }
        }

        // Usuário negou ou cancelou
        isInstalling.set(false);
        JSObject res = new JSObject();
        res.put("status", "permission_required");
        call.resolve(res);
    }

    private void launchInstaller(PluginCall call) {
        if (getActivity() == null) {
            isInstalling.set(false);
            call.reject("Activity indisponível para iniciar instalador");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                Context context = getContext();
                Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        verifiedApkFile
                );

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                intent.setClipData(ClipData.newRawUri("HuaPlay Update", contentUri));

                getActivity().startActivity(intent);

                isInstalling.set(false);
                JSObject res = new JSObject();
                res.put("status", "installer_opened");
                call.resolve(res);
            } catch (ActivityNotFoundException e) {
                isInstalling.set(false);
                call.reject("Nenhum aplicativo instalador de pacotes disponível: " + e.getMessage());
            } catch (SecurityException e) {
                isInstalling.set(false);
                call.reject("Permissão de instalação recusada pelo sistema: " + e.getMessage());
            } catch (Exception e) {
                isInstalling.set(false);
                call.reject("Falha ao abrir instalador do Android: " + e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        isCancelled.set(true);
        HttpURLConnection conn = activeConnection;
        if (conn != null) {
            try {
                conn.disconnect();
            } catch (Exception ignored) {}
        }
        deleteFileQuietly(activePartFile);
        executor.shutdownNow();
    }

    private static void deleteFileQuietly(File file) {
        if (file != null && file.exists()) {
            try {
                file.delete();
            } catch (Exception ignored) {}
        }
    }
}
