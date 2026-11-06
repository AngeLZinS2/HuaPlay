# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Capacitor Bridge and Plugin rules
-keepattributes *Annotation*,AnnotationDefault

-keep @interface com.getcapacitor.annotation.CapacitorPlugin {
    *;
}
-keep @interface com.getcapacitor.annotation.Permission {
    *;
}
-keep @interface com.getcapacitor.annotation.PermissionCallback {
    *;
}
-keep @interface com.getcapacitor.annotation.ActivityCallback {
    *;
}
-keep class com.getcapacitor.annotation.** {
    *;
}

-keep class com.getcapacitor.PluginHandle {
    *;
}
-keepclassmembers class com.getcapacitor.PluginHandle {
    private <fields>;
}

-keep public class * extends com.getcapacitor.Plugin {
    public *;
}
-keep public class com.getcapacitor.Bridge {
    public *;
}
-keep public class com.getcapacitor.BridgeActivity {
    public *;
}
-keep public class com.getcapacitor.PluginMethod {
    public *;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Provedor Facebook não configurado/não incluído no projeto (apenas Google Auth utilizado)
-dontwarn com.facebook.CallbackManager$Factory
-dontwarn com.facebook.CallbackManager
-dontwarn com.facebook.FacebookCallback
-dontwarn com.facebook.login.LoginManager
