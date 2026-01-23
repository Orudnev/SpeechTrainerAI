package com.speechtrainerai.rn_java_connector;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class RnJavaConnectorModule extends ReactContextBaseJavaModule {

    static {
        System.loadLibrary("speechtrainer_jni");
    }

    public RnJavaConnectorModule(com.facebook.react.bridge.ReactApplicationContext ctx) {
        super(ctx);
    }

    @Override
    public String getName() {
        return "RnJavaConnector";
    }

    private static native boolean nativeInit();
    private static native void nativeShutdown();
    private static native boolean nativeIsInitialized();
    private static native boolean nativeLoadModel(String path);
    private static native boolean nativeStartRecognition();
    private static native void nativeStopRecognition();
    private static native String nativeGetEngineState();

    @ReactMethod
    public void init(Promise p) {
        p.resolve(nativeInit());
    }

    @ReactMethod
    public void shutdown(Promise p) {
        nativeShutdown();
        p.resolve(null);
    }

    @ReactMethod
    public void isInitialized(Promise p) {
        p.resolve(nativeIsInitialized());
    }

    @ReactMethod
    public void loadModel(String path, Promise p) {
        p.resolve(nativeLoadModel(path));
    }

    @ReactMethod
    public void startRecognition(Promise p) {
        p.resolve(nativeStartRecognition());
    }

    @ReactMethod
    public void stopRecognition(Promise p) {
        nativeStopRecognition();
        p.resolve(null);
    }

    @ReactMethod
    public void getEngineState(Promise p) {
        p.resolve(nativeGetEngineState());
    }
}
