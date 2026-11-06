# HuaPlay Mobile (Android APK)

## 1. Build do APK
- **Modo:** `npm run build:mobile` (gera bundle otimizado em `dist-mobile` sem VitePWA).
- **Sincronização:** `npx cap sync android`
- **Gradle:** `assembleDebug` ou `assembleRelease` via `gradlew.bat`.

## 2. Contrato de Atualização Leve (Native Android)
- **Endpoint:** `https://huaplay.playdb.info/mobile/version.json`
- **Formato do Contrato:**
  ```json
  {
    "versionCode": 1,
    "versionName": "1.0",
    "apkUrl": "https://huaplay.playdb.info/downloads/huaplay/HuaPlay-1.0.apk",
    "releaseNotes": [
      "Descrição das melhorias da versão"
    ]
  }
  ```
- **Regras de Validação e Execução:**
  - `versionCode`: comparado estritamente como número inteiro (`App.getInfo().build`).
  - `apkUrl`: obrigatoriamente HTTPS, mesmo origin (`https://huaplay.playdb.info`), sem credenciais/portas customizadas, iniciando em `/downloads/huaplay/` e terminando em `.apk`.
  - Disparadores: abertura do app e retorno ao primeiro plano (`appStateChange`), com throttle de 5 minutos por sessão.
  - Timeout de 8 segundos com `AbortController`. Falhas de rede, 404 ou JSON inválido não bloqueiam o app.
  - Se adiado ("Agora não"), a mesma versão não volta a ser solicitada na sessão atual.
  - Ao clicar em "Atualizar agora", a URL validada é aberta externamente via `@capacitor/browser` para download limpo.

## 3. Autenticação Google no APK
- O WebView do Android bloqueia `signInWithPopup`.
- No APK nativo, o login com Google utiliza `@capacitor-firebase/authentication` com `skipNativeAuth: true`.
- O plugin obtém o `idToken` da credencial Google e o repassa ao SDK Web do Firebase via `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))`.
- No logout, `FirebaseAuthentication.signOut()` é chamado no ambiente nativo para limpeza de credenciais, sem interferir no fluxo web tradicional.
