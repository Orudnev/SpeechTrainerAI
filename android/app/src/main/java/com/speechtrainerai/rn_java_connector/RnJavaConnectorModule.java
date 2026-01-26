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
import java.util.HashMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;


public class RnJavaConnectorModule extends ReactContextBaseJavaModule {

    static {
        System.loadLibrary("speechtrainer_jni");
    }

    public RnJavaConnectorModule(ReactApplicationContext ctx) {
        super(ctx);
        reactContext = ctx;

        Log.i("TTS", "Initializing TextToSpeech...");

        tts = new TextToSpeech(ctx, status -> {
            if (status == TextToSpeech.SUCCESS) {

                Log.i("TTS", "TTS engine ready");

                // Default language = English
                tts.setLanguage(localeEn);

                // Attach progress listener
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {

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

    private static native boolean nativeInit();
    private static native void nativeShutdown();
    private static native boolean nativeIsInitialized();
    private static native boolean nativeLoadModel(String path);
    private static native boolean nativeStartRecognition();
    private static native void nativeStopRecognition();
    private static native String nativeGetEngineState();
    private static ReactApplicationContext reactContext;
    private static native void nativePushAudio(short[] data, int frames);
    private Promise permissionPromise;
    private PermissionListener permissionListener;
    private AudioRecord audioRecord;
    private Thread audioThread;
    private volatile boolean audioRunning = false;
    private static final int SAMPLE_RATE = 16000;
    private int audioBufferSize = 0;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    private Locale localeEn = Locale.US;

    private Locale localeRu = new Locale("ru", "RU");

    private void emitEventToJS(String eventName, String payload) {
        if (reactContext == null) return;

        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, payload);
    }

    private Locale detectLanguage(String text) {
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);

            // Cyrillic диапазон
            if (c >= 0x0400 && c <= 0x04FF) {
                return localeRu;
            }
        }
        return localeEn;
    }

    @ReactMethod
    public void init(Promise p) {
        p.resolve(nativeInit());
    }

    @ReactMethod
    public void shutdown(Promise p) {
        Log.i("SpeechTrainerJNI", "JS -> shutdown()");
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


    @ReactMethod
    public void startRecognition(Promise p) {

        // Guard: already running
        if (audioRunning) {
            Log.i("RnJavaConnector", "Audio already running, ignoring startRecognition()");
            p.resolve(true);
            return;
        }

        // Permission check
        if (ContextCompat.checkSelfPermission(
                getReactApplicationContext(),
                Manifest.permission.RECORD_AUDIO
        ) != PackageManager.PERMISSION_GRANTED) {
            p.reject("NO_PERMISSION", "RECORD_AUDIO not granted");
            return;
        }

        // Buffer size
        audioBufferSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
        );

        if (audioBufferSize <= 0) {
            p.reject("AUDIO_ERROR", "Invalid buffer size: " + audioBufferSize);
            return;
        }

        // Create AudioRecord
        try {
            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    audioBufferSize
            );
        } catch (SecurityException se) {
            p.reject("SECURITY_EXCEPTION", se);
            return;
        }

        // Check initialized
        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            p.reject("AUDIO_ERROR", "AudioRecord not initialized");
            return;
        }

        // Start audio capture
        audioRunning = true;
        audioRecord.startRecording();

        // Start audio thread
        audioThread = new Thread(() -> {

            short[] buffer = new short[4000];

            while (audioRunning) {
                int read = audioRecord.read(buffer, 0, buffer.length);

                if (read > 0) {
                    long sum = 0;
                    for (int i = 0; i < read; i++) {
                        sum += Math.abs(buffer[i]);
                    }
                    long avg = sum / read;

                    Log.i("AudioDebug", "read=" + read + " avgAmp=" + avg);

                    nativePushAudio(buffer, read);
                }
            }

        }, "AudioRecordThread");

        audioThread.start();

        // Start recognition AFTER audio is flowing
        boolean ok = nativeStartRecognition();
        if (!ok) {
            p.reject("ENGINE_ERROR", "nativeStartRecognition failed");
            return;
        }

        p.resolve(true);
    }

    @ReactMethod
    public void stopRecognition(Promise p) {

        // Stop loop
        audioRunning = false;

        // Join audio thread FIRST
        if (audioThread != null) {
            try {
                audioThread.join();
            } catch (InterruptedException ignored) {
            }
            audioThread = null;
        }

        // Stop + release AudioRecord
        if (audioRecord != null) {
            try {
                audioRecord.stop();
            } catch (Exception ignored) {
            }

            audioRecord.release();
            audioRecord = null;
        }

        // Stop native recognition thread
        nativeStopRecognition();

        p.resolve(null);
    }



    @ReactMethod
    public void getEngineState(Promise p) {
        p.resolve(nativeGetEngineState());
    }

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
    public void initEngineWithBundledModel(Promise p) {
        try {
            nativeInit();

            String installedPath =
                    ModelInstaller.installModelIfNeeded(
                            getReactApplicationContext(),
                            "vosk-model-small-en-us-0.15"
                    );

            boolean ok = nativeLoadModel(installedPath);

            p.resolve(ok);

        } catch (Exception ex) {
            p.reject("ENGINE_INIT_ERROR", ex);
        }
    }

    @ReactMethod
    public void speak(String text, Promise p) {

        if (!ttsReady || tts == null) {
            p.reject("TTS_NOT_READY", "TextToSpeech not initialized yet");
            return;
        }

        if (text == null || text.trim().isEmpty()) {
            p.reject("EMPTY_TEXT", "Nothing to speak");
            return;
        }

        Locale lang = detectLanguage(text);

        int res = tts.setLanguage(lang);
        if (res == TextToSpeech.LANG_MISSING_DATA ||
                res == TextToSpeech.LANG_NOT_SUPPORTED) {

            p.reject("LANG_NOT_SUPPORTED", "Language not supported: " + lang);
            return;
        }

        String utteranceId = UUID.randomUUID().toString();

        Log.i("TTS", "Speaking (" + lang + "): " + text);

        tts.speak(
                text,
                TextToSpeech.QUEUE_FLUSH,
                null,
                utteranceId
        );

        p.resolve(utteranceId);
    }


    @Override
    public void invalidate() {
        super.invalidate();

        if (tts != null) {
            Log.i("TTS", "Shutting down TTS");
            tts.stop();
            tts.shutdown();
            tts = null;
        }
    }

    public static void onNativeResult(String text) {
        if (reactContext == null) return;

        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("SpeechResult", text);
    }

}
