package com.speechtrainerai.rn_java_connector;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.ReactApplicationContext;

import android.util.Log;
import android.media.AudioRecord;
import android.media.AudioFormat;
import android.media.MediaRecorder;

import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import androidx.core.app.ActivityCompat;

import com.facebook.react.modules.core.PermissionAwareActivity;
import com.facebook.react.modules.core.PermissionListener;
import android.app.Activity;

import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.Locale;
import java.util.UUID;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

import com.speechtrainerai.asr.AsrEngine;
import com.speechtrainerai.asr.AsrEngineManager;

public class RnJavaConnectorModule extends ReactContextBaseJavaModule {

    static {
        System.loadLibrary("speechtrainer_jni");
    }

    // ============================================================
    // Native JNI methods
    // ============================================================

    public static native boolean nativeInit();
    public static native void nativeShutdown();

    public static native void nativeFullReset();
    public static native boolean nativeIsInitialized();
    public static native boolean nativeLoadModel(String path);
    public static native boolean nativeStartRecognition();
    public static native void nativeStopRecognition();
    public static native String nativeGetEngineState();
    public static native void nativePushAudio(short[] data, int frames);

    // ============================================================
    // React context
    // ============================================================

    private static ReactApplicationContext reactContext;

    // ============================================================
    // Engines
    // ============================================================

    private final AsrEngineManager asrManager = new AsrEngineManager();
    private AsrEngine currentEngine = null;
    private String currentModelPath = null;

    // ============================================================
    // AudioRecord
    // ============================================================

    private AudioRecord audioRecord;
    private Thread audioThread;
    private volatile boolean audioRunning = false;

    private static final int SAMPLE_RATE = 16000;
    private int audioBufferSize = 0;

    // ============================================================
    // Permissions
    // ============================================================

    private Promise permissionPromise;
    private PermissionListener permissionListener;

    // ============================================================
    // TTS
    // ============================================================

    private TextToSpeech tts;
    private boolean ttsReady = false;

    private final Locale localeEn = Locale.US;
    private final Locale localeRu = new Locale("ru", "RU");

    // ============================================================
    // Constructor
    // ============================================================

    public RnJavaConnectorModule(ReactApplicationContext ctx) {
        super(ctx);
        reactContext = ctx;

        Log.i("TTS", "Initializing TextToSpeech...");

        tts = new TextToSpeech(ctx, status -> {

            if (status == TextToSpeech.SUCCESS) {

                Log.i("TTS", "TTS engine ready");

                tts.setLanguage(localeEn);

                tts.setOnUtteranceProgressListener(
                        new UtteranceProgressListener() {

                            @Override
                            public void onStart(String utteranceId) {
                                Log.i("TTS", "Speech started: " + utteranceId);
                            }

                            @Override
                            public void onDone(String utteranceId) {

                                WritableMap map = Arguments.createMap();
                                map.putString("utteranceId", utteranceId);

                                reactContext
                                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                        .emit("TtsFinished", map);
                            }

                            @Override
                            public void onError(String utteranceId) {

                                WritableMap map = Arguments.createMap();
                                map.putString("utteranceId", utteranceId);

                                reactContext
                                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                        .emit("TtsError", map);
                            }
                        });

                ttsReady = true;

                WritableMap map = Arguments.createMap();
                map.putBoolean("ready", true);

                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("TtsReady", map);

            } else {

                Log.e("TTS", "TTS init failed");
                ttsReady = false;
            }
        });
    }

    @Override
    public String getName() {
        return "RnJavaConnector";
    }

    // ============================================================
    // Utils
    // ============================================================

    private Locale detectLanguage(String text) {

        for (int i = 0; i < text.length(); i++) {

            char c = text.charAt(i);

            if (c >= 0x0400 && c <= 0x04FF) {
                return localeRu;
            }
        }

        return localeEn;
    }

    // ============================================================
    // BASIC INIT / SHUTDOWN
    // ============================================================

    @ReactMethod
    public void init(Promise p) {
        Log.i("RnJavaConnector", "JS -> init()");
        p.resolve(nativeInit());
    }

    @ReactMethod
    public void shutdown(Promise p) {
        Log.i("RnJavaConnector", "JS -> shutdown()");
        nativeShutdown();
        p.resolve(null);
    }

    @ReactMethod
    public void isInitialized(Promise p) {
        p.resolve(nativeIsInitialized());
    }

    // ============================================================
    // MODEL
    // ============================================================

    @ReactMethod
    public void prepareModel(Promise p) {

        try {
            String installedPath =
                    ModelInstaller.installModelIfNeeded(
                            getReactApplicationContext(),
                            "vosk-model-small-en-us-0.15"
                    );

            p.resolve(installedPath);

        } catch (Exception ex) {
            p.reject("MODEL_INSTALL_ERROR", ex);
        }
    }

    @ReactMethod
    public void loadModel(String path, Promise p) {

        currentModelPath = path;

        if (currentEngine != null) {
            currentEngine.loadModel(path);
        } else {
            nativeLoadModel(path);
        }

        p.resolve(true);
    }

    // ============================================================
    // PERMISSIONS
    // ============================================================

    @ReactMethod
    public void hasAudioPermission(Promise p) {

        boolean granted =
                ContextCompat.checkSelfPermission(
                        getReactApplicationContext(),
                        Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED;

        p.resolve(granted);
    }

    @ReactMethod
    public void requestAudioPermission(Promise p) {

        Activity activity = getCurrentActivity();

        if (!(activity instanceof PermissionAwareActivity)) {
            p.reject("NO_ACTIVITY", "Activity is not PermissionAware");
            return;
        }

        if (ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED) {

            p.resolve(true);
            return;
        }

        permissionPromise = p;

        permissionListener = (requestCode, permissions, grantResults) -> {

            if (requestCode == 12345 && permissionPromise != null) {

                boolean granted =
                        grantResults.length > 0 &&
                                grantResults[0] == PackageManager.PERMISSION_GRANTED;

                permissionPromise.resolve(granted);

                permissionPromise = null;
                permissionListener = null;

                return true;
            }

            return false;
        };

        ((PermissionAwareActivity) activity).requestPermissions(
                new String[]{Manifest.permission.RECORD_AUDIO},
                12345,
                permissionListener
        );
    }

    // ============================================================
    // ENGINE SWITCH (FULL RESET)
    // ============================================================

    @ReactMethod
    public void setCurrentEngine(String engineId, Promise p) {

        AsrEngine next = asrManager.getEngine(engineId);

        if (next == null) {
            p.reject("ENGINE_NOT_FOUND", "Unknown engine: " + engineId);
            return;
        }

        Log.i("RnJavaConnector", "🔄 Switching engine to: " + engineId);

        try {

            // ============================================================
            // 1) Полностью остановить AudioRecord + thread
            // ============================================================
            fullStopAndRelease();

            // ============================================================
            // 2) Полностью остановить и уничтожить старый движок
            // ============================================================
            if (currentEngine != null) {
                Log.i("RnJavaConnector", "Shutting down previous engine: "
                        + currentEngine.getId());

                currentEngine.stopRecognition();
                currentEngine.shutdown();
            }

            // ============================================================
            // 3) Активируем новый движок
            // ============================================================
            currentEngine = next;

            // ============================================================
            // 4) Полная инициализация движка заново
            // ============================================================
            Log.i("RnJavaConnector", "Init engine: " + engineId);

            boolean ok = currentEngine.init();

            if (!ok) {
                p.reject("ENGINE_INIT_FAILED", "Init failed: " + engineId);
                return;
            }

            // ============================================================
            // 5) Если модель уже установлена → загружаем заново
            // ============================================================
            if (currentModelPath != null) {

                Log.i("RnJavaConnector", "Reloading model: " + currentModelPath);

                boolean modelOk = currentEngine.loadModel(currentModelPath);

                if (!modelOk) {
                    p.reject("MODEL_LOAD_FAILED",
                            "Model load failed: " + currentModelPath);
                    return;
                }
            }

            // ============================================================
            // ✅ 6) ВАЖНО: Полный reset состояния Vosk (C++ layer)
            // ============================================================
            Log.i("RnJavaConnector", "Performing native FULL RESET");

            nativeFullReset();

            // ============================================================
            // 7) Готово
            // ============================================================
            Log.i("RnJavaConnector", "✅ Engine switched successfully: " + engineId);

            p.resolve(true);

        } catch (Exception ex) {

            Log.e("RnJavaConnector", "ENGINE_SWITCH_FAILED", ex);

            p.reject("ENGINE_SWITCH_FAILED", ex.toString());
        }
    }


    // ============================================================
    // START / STOP RECOGNITION
    // ============================================================

    @ReactMethod
    public void startRecognition(String engineId, Promise p) {

        if (currentEngine == null) {
            p.reject("NO_ENGINE", "Call setCurrentEngine() first");
            return;
        }

        if (!currentEngine.getId().equals(engineId)) {
            p.reject("ENGINE_MISMATCH", "Engine not active");
            return;
        }

        if (audioRunning) {
            p.resolve(true);
            return;
        }

        try {

            if (currentEngine.needsExternalAudio()) {
                initAudioRecord();
            }

            boolean ok = currentEngine.startRecognition();
            p.resolve(ok);

        } catch (Exception ex) {

            p.reject("START_FAILED", ex.toString());
        }
    }

    @ReactMethod
    public void stopRecognition(String engineId, Promise p) {

        fullStopAndRelease();

        if (currentEngine != null) {
            currentEngine.stopRecognition();
        }

        p.resolve(null);
    }

    // ============================================================
    // AudioRecord init with permission check
    // ============================================================

    private void initAudioRecord() {

        if (ContextCompat.checkSelfPermission(
                getReactApplicationContext(),
                Manifest.permission.RECORD_AUDIO
        ) != PackageManager.PERMISSION_GRANTED) {

            throw new SecurityException("RECORD_AUDIO permission not granted");
        }

        audioBufferSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
        );

        if (audioBufferSize <= 0) {
            throw new IllegalStateException("Invalid buffer size");
        }

        audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                audioBufferSize
        );

        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            throw new IllegalStateException("AudioRecord not initialized");
        }

        audioRunning = true;
        audioRecord.startRecording();

        audioThread = new Thread(() -> {

            short[] buffer = new short[4000];

            while (audioRunning) {

                int read = audioRecord.read(buffer, 0, buffer.length);

                if (read > 0) {
                    nativePushAudio(buffer, read);
                }
            }

        }, "AudioRecordThread");

        audioThread.start();
    }

    private void fullStopAndRelease() {

        audioRunning = false;

        if (audioThread != null) {
            try {
                audioThread.join();
            } catch (InterruptedException ignored) {}
            audioThread = null;
        }

        if (audioRecord != null) {
            try {
                audioRecord.stop();
            } catch (Exception ignored) {}
            audioRecord.release();
            audioRecord = null;
        }
    }

    // ============================================================
    // TTS API
    // ============================================================

    @ReactMethod
    public void isTtsReady(Promise p) {
        p.resolve(ttsReady);
    }

    @ReactMethod
    public void speak(String text, Promise p) {

        if (!ttsReady || tts == null) {
            p.reject("TTS_NOT_READY", "TTS not ready");
            return;
        }

        Locale lang = detectLanguage(text);
        tts.setLanguage(lang);

        String utteranceId = UUID.randomUUID().toString();

        tts.speak(
                text,
                TextToSpeech.QUEUE_FLUSH,
                null,
                utteranceId
        );

        p.resolve(utteranceId);
    }

    // ============================================================
    // Native callback → JS
    // ============================================================

    public static void onNativeResult(String text) {

        if (reactContext == null) return;

        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("SpeechResult", text);
    }

    @Override
    public void invalidate() {
        super.invalidate();

        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
    }
}
