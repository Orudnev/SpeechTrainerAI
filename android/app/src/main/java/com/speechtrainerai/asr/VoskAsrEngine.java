package com.speechtrainerai.asr;

import android.util.Log;
import com.speechtrainerai.rn_java_connector.RnJavaConnectorModule;

/**
 * Реализация ASR движка на базе Vosk.
 *
 * Vosk НЕ управляет микрофоном сам → needsExternalAudio() = true
 */
public class VoskAsrEngine implements AsrEngine {

    private final String id;

    public VoskAsrEngine(String id) {
        this.id = id;
    }

    @Override
    public String getId() {
        return id;
    }

    @Override
    public boolean needsExternalAudio() {
        return true;
    }

    @Override
    public boolean init() {
        Log.i("VoskAsrEngine", "init()");
        return RnJavaConnectorModule.nativeInit();
    }

    @Override
    public boolean loadModel(String path) {
        Log.i("VoskAsrEngine", "loadModel(): " + path);
        return RnJavaConnectorModule.nativeLoadModel(path);
    }

    @Override
    public boolean startRecognition() {
        Log.i("VoskAsrEngine", "startRecognition()");
        return RnJavaConnectorModule.nativeStartRecognition();
    }

    @Override
    public void stopRecognition() {
        Log.i("VoskAsrEngine", "stopRecognition()");
        RnJavaConnectorModule.nativeStopRecognition();
    }

    @Override
    public void shutdown() {
        Log.i("VoskAsrEngine", "shutdown()");
        RnJavaConnectorModule.nativeShutdown();
    }
}
