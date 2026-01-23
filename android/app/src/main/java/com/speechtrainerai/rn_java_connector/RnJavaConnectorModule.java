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
public class RnJavaConnectorModule extends ReactContextBaseJavaModule {

    static {
        System.loadLibrary("speechtrainer_jni");
    }

    public RnJavaConnectorModule(com.facebook.react.bridge.ReactApplicationContext ctx) {
        super(ctx);
        reactContext = ctx;
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

        if (ContextCompat.checkSelfPermission(
                getReactApplicationContext(),
                Manifest.permission.RECORD_AUDIO
        ) != PackageManager.PERMISSION_GRANTED) {

            p.reject("NO_PERMISSION", "RECORD_AUDIO not granted");
            return;
        }

        boolean ok = nativeStartRecognition();
        if (!ok) {
            p.resolve(false);
            return;
        }

        try {
            audioBufferSize = AudioRecord.getMinBufferSize(
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
            );

            if (audioBufferSize <= 0) {
                p.reject("AUDIO_ERROR", "Invalid buffer size: " + audioBufferSize);
                return;
            }

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

        audioRunning = true;
        audioRecord.startRecording();

        audioThread = new Thread(() -> {
            // PCM16 → 2 bytes per sample
            short[] buffer = new short[audioBufferSize / 2];

            while (audioRunning) {
                int read = audioRecord.read(buffer, 0, buffer.length);
                if (read > 0) {
                    nativePushAudio(buffer, read);
                }
            }
        }, "AudioRecordThread");

        audioThread.start();
        p.resolve(true);
    }



    @ReactMethod
    public void stopRecognition(Promise p) {
        audioRunning = false;

        if (audioRecord != null) {
            audioRecord.stop();
            audioRecord.release();
            audioRecord = null;
        }

        nativeStopRecognition();
        p.resolve(null);
    }


    @ReactMethod
    public void getEngineState(Promise p) {
        p.resolve(nativeGetEngineState());
    }
    public static void onNativeResult(String text) {
        if (reactContext == null) return;

        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("SpeechResult", text);
    }

}
