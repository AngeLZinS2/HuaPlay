package com.huaplay.app;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.regex.Pattern;

public final class NativeUpdatePolicy {

    public static final String EXPECTED_HOST = "huaplay.playdb.info";
    public static final String EXPECTED_PATH_PREFIX = "/downloads/huaplay/";
    public static final String EXPECTED_EXTENSION = ".apk";

    public static final long MAX_FILE_SIZE = 64L * 1024L * 1024L; // 64 MB
    public static final long MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE;

    public static final int CONNECT_TIMEOUT_MS = 15_000; // 15 seconds
    public static final int READ_TIMEOUT_MS = 30_000;    // 30 seconds

    public static final int STREAM_BUFFER_SIZE = 32 * 1024; // 32 KB
    public static final int BUFFER_SIZE_BYTES = STREAM_BUFFER_SIZE;

    public static final long PROGRESS_THROTTLE_INTERVAL_MS = 200L; // ~200ms
    public static final long PROGRESS_THROTTLE_MS = PROGRESS_THROTTLE_INTERVAL_MS;

    private static final Pattern SHA256_PATTERN = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final Pattern FILENAME_SAFE_PATTERN = Pattern.compile("^[a-zA-Z0-9_.-]+$");

    private NativeUpdatePolicy() {
        // Utility class
    }

    public static boolean isValidDownloadUrl(String urlStr) {
        if (urlStr == null) {
            return false;
        }
        String trimmed = urlStr.trim();
        if (trimmed.isEmpty()) {
            return false;
        }

        try {
            URI uri = URI.create(trimmed);
            URL url = uri.toURL();

            // HTTPS protocol only
            if (!"https".equalsIgnoreCase(url.getProtocol())) {
                return false;
            }

            // Strict host match
            String host = url.getHost();
            if (host == null || !EXPECTED_HOST.equalsIgnoreCase(host)) {
                return false;
            }

            // No credentials / userInfo allowed
            if (url.getUserInfo() != null && !url.getUserInfo().isEmpty()) {
                return false;
            }

            // Standard port only (-1 or 443)
            int port = url.getPort();
            if (port != -1 && port != 443) {
                return false;
            }

            // Disallow fragments
            if (url.getRef() != null && !url.getRef().isEmpty()) {
                return false;
            }

            // Strict path prefix and extension
            String path = url.getPath();
            if (path == null || !path.startsWith(EXPECTED_PATH_PREFIX) || !path.endsWith(EXPECTED_EXTENSION)) {
                return false;
            }

            // No path traversal in path
            if (path.contains("..") || path.contains("//") || path.contains("\\")) {
                return false;
            }

            // Validate filename portion
            String filename = path.substring(EXPECTED_PATH_PREFIX.length());
            if (filename.isEmpty() || !filename.endsWith(EXPECTED_EXTENSION)) {
                return false;
            }
            if (!FILENAME_SAFE_PATTERN.matcher(filename).matches()) {
                return false;
            }

            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static String extractApkFilename(String urlStr) {
        if (!isValidDownloadUrl(urlStr)) {
            return null;
        }
        try {
            URI uri = URI.create(urlStr.trim());
            String path = uri.toURL().getPath();
            return path.substring(EXPECTED_PATH_PREFIX.length());
        } catch (Exception e) {
            return null;
        }
    }

    public static boolean isValidSha256(String sha256) {
        if (sha256 == null) {
            return false;
        }
        return SHA256_PATTERN.matcher(sha256.trim()).matches();
    }

    public static String normalizeSha256(String sha256) {
        if (sha256 == null) {
            return null;
        }
        return sha256.trim().toLowerCase(Locale.US);
    }

    public static boolean isValidVersionCode(long targetVersionCode, long currentVersionCode) {
        return targetVersionCode > 0
                && targetVersionCode <= Integer.MAX_VALUE
                && targetVersionCode > currentVersionCode;
    }

    public static Long parseVersionCode(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Integer) {
            int val = (Integer) raw;
            if (val > 0) {
                return (long) val;
            }
            return null;
        }
        if (raw instanceof Long) {
            long val = (Long) raw;
            if (val > 0 && val <= Integer.MAX_VALUE) {
                return val;
            }
            return null;
        }
        return null;
    }

    public static boolean isContentLengthAcceptable(long contentLength) {
        if (contentLength < 0) {
            // Unknown content length, stream will verify byte count
            return true;
        }
        return contentLength <= MAX_FILE_SIZE;
    }

    public static boolean isRedirect(int statusCode) {
        return statusCode == 301
                || statusCode == 302
                || statusCode == 303
                || statusCode == 307
                || statusCode == 308;
    }

    public static String bytesToHex(byte[] bytes) {
        if (bytes == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format(Locale.US, "%02x", b));
        }
        return sb.toString();
    }

    public static boolean hashesMatch(String hashA, String hashB) {
        if (hashA == null || hashB == null) {
            return false;
        }
        return hashA.trim().equalsIgnoreCase(hashB.trim());
    }

    public static String computeFileSha256(File file) throws IOException, NoSuchAlgorithmException {
        if (file == null || !file.exists() || !file.isFile()) {
            throw new IOException("Arquivo inexistente para cálculo de hash");
        }
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[STREAM_BUFFER_SIZE];
            int read;
            while ((read = fis.read(buffer)) != -1) {
                md.update(buffer, 0, read);
            }
        }
        return bytesToHex(md.digest());
    }
}
