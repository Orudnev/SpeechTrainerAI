package com.speechtrainerai.rn_java_connector;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import android.util.Log;

public class RnJavaConnectorModule extends ReactContextBaseJavaModule {

    private static final String TAG = "SpeechTrainerJNI";

    static {
        try {
            Log.i(TAG, "Loading native library: speechtrainer_jni");
            System.loadLibrary("speechtrainer_jni");
            Log.i(TAG, "Native library loaded OK");
        } catch (Throwable t) {
            Log.e(TAG, "Failed to load native library", t);
            throw t;
        }
    }

    public RnJavaConnectorModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "RnJavaConnector";
    }

    private static native String nativeHello();

    @ReactMethod
    public void hello(Promise promise) {
        try {
            String result = nativeHello();
            promise.resolve(result);
        } catch (Throwable t) {
            promise.reject("JNI_ERROR", t);
        }
    }
}

