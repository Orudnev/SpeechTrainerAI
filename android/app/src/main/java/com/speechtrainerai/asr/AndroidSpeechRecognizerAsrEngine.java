package com.speechtrainerai.asr;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import androidx.annotation.Nullable;

import com.speechtrainerai.rn_java_connector.RnJavaConnectorModule;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Реализация ASR движка на базе Android SpeechRecognizer API.
 *
 * SpeechRecognizer сам управляет микрофоном → needsExternalAudio() = false
 */
public class AndroidSpeechRecognizerAsrEngine implements AsrEngine {

    private static final String TAG = "AndroidAsrEngine";
    private static final long DEFAULT_RESTART_DELAY_MS = 450L;
    private static final long SILENCE_RESTART_DELAY_MS = 1800L;
    private static final long MIN_RESTART_GAP_MS = 900L;
    private static final long MAX_NO_MATCH_BACKOFF_MS = 6000L;

    private final String id;
    private final Locale locale;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Nullable
    private SpeechRecognizer speechRecognizer;

    private final AtomicBoolean shouldBeListening = new AtomicBoolean(false);
    private final AtomicInteger restartGeneration = new AtomicInteger(0);
    private final AtomicInteger consecutiveNoMatchErrors = new AtomicInteger(0);
    private final AtomicLong lastListenStartAtMs = new AtomicLong(0L);
    private final AtomicReference<Intent> currentIntent = new AtomicReference<>();
    private final Runnable restartRunnable = this::restartNowIfNeeded;

    public AndroidSpeechRecognizerAsrEngine(String id, Locale locale) {
        this.id = id;
        this.locale = locale;
    }

    @Override
    public String getId() {
        return id;
    }

    @Override
    public boolean needsExternalAudio() {
        return false;
    }

    @Override
    public boolean init() {
        AtomicBoolean initResult = new AtomicBoolean(false);

        runOnMainThreadBlocking(() -> {
            Context context = RnJavaConnectorModule.getAppContext();

            if (context == null) {
                Log.e(TAG, "init() failed: app context is null");
                return;
            }

            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                Log.e(TAG, "init() failed: SpeechRecognizer is not available");
                return;
            }

            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context);
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onReadyForSpeech(Bundle params) {
                    cancelPendingRestart();
                    consecutiveNoMatchErrors.set(0);
                    Log.i(TAG, "onReadyForSpeech()");
                }

                @Override
                public void onBeginningOfSpeech() {
                    cancelPendingRestart();
                    Log.i(TAG, "onBeginningOfSpeech()");
                }

                @Override
                public void onRmsChanged(float rmsdB) { }

                @Override
                public void onBufferReceived(byte[] buffer) { }

                @Override
                public void onEndOfSpeech() {
                    Log.i(TAG, "onEndOfSpeech()");
                }

                @Override
                public void onError(int error) {
                    Log.w(TAG, "onError(): " + error);
                    emitError(error);
                    restartIfNeeded(getRestartDelayForError(error));
                }

                @Override
                public void onResults(Bundle results) {
                    emitResults(results, "final");
                    consecutiveNoMatchErrors.set(0);
                    restartIfNeeded(DEFAULT_RESTART_DELAY_MS);
                }

                @Override
                public void onPartialResults(Bundle partialResults) {
                    emitResults(partialResults, "partial");
                }

                @Override
                public void onEvent(int eventType, Bundle params) { }
            });

            Log.i(TAG, "init() ok: " + id + " locale=" + locale);
            initResult.set(true);
        });

        return initResult.get();
    }

    @Override
    public boolean loadModel(String path) {
        // Для Android SpeechRecognizer загрузка модели не требуется.
        return true;
    }

    @Override
    public boolean startRecognition() {
        AtomicBoolean started = new AtomicBoolean(false);

        runOnMainThreadBlocking(() -> {
            if (speechRecognizer == null) {
                Log.e(TAG, "startRecognition() failed: not initialized");
                return;
            }

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale.toLanguageTag());
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1200);

            shouldBeListening.set(true);
            restartGeneration.incrementAndGet();
            consecutiveNoMatchErrors.set(0);
            cancelPendingRestart();
            currentIntent.set(intent);

            startListeningSafely(intent);
            started.set(true);
        });

        return started.get();
    }

    @Override
    public void stopRecognition() {
        shouldBeListening.set(false);
        restartGeneration.incrementAndGet();
        cancelPendingRestart();

        runOnMainThreadBlocking(() -> {
            if (speechRecognizer == null) {
                return;
            }

            speechRecognizer.stopListening();
            speechRecognizer.cancel();
        });

        currentIntent.set(null);
    }

    @Override
    public void shutdown() {
        shouldBeListening.set(false);
        restartGeneration.incrementAndGet();
        cancelPendingRestart();

        runOnMainThreadBlocking(() -> {
            if (speechRecognizer == null) {
                return;
            }

            speechRecognizer.destroy();
            speechRecognizer = null;
        });
    }

    private void runOnMainThreadBlocking(Runnable action) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action.run();
            return;
        }

        CountDownLatch latch = new CountDownLatch(1);

        mainHandler.post(() -> {
            try {
                action.run();
            } finally {
                latch.countDown();
            }
        });

        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            Log.e(TAG, "Interrupted while waiting main thread task", e);
        }
    }

    private void emitResults(Bundle results, String type) {
        if (results == null) {
            return;
        }

        ArrayList<String> texts = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);

        if (texts == null || texts.isEmpty()) {
            return;
        }

        String text = texts.get(0);

        try {
            JSONObject payload = new JSONObject();
            payload.put("type", type);
            payload.put("text", text);
            payload.put("isError", false);
            RnJavaConnectorModule.onNativeResult(payload.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Failed to emit recognition result", e);
        }
    }

    private void emitError(int errorCode) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("type", "final");
            payload.put("text", "");
            payload.put("isError", true);
            payload.put("errorCode", errorCode);
            RnJavaConnectorModule.onNativeResult(payload.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Failed to emit recognition error", e);
        }
    }

    private void restartIfNeeded(long delayMs) {
        int generation = restartGeneration.get();

        mainHandler.removeCallbacks(restartRunnable);
        mainHandler.postDelayed(() -> {
            if (generation != restartGeneration.get()) {
                return;
            }
            restartNowIfNeeded();
        }, Math.max(0L, delayMs));
    }

    private void restartNowIfNeeded() {
        if (!shouldBeListening.get()) {
            return;
        }
        if (speechRecognizer == null) {
            return;
        }

        Intent intent = currentIntent.get();
        if (intent == null) {
            return;
        }

        startListeningSafely(intent);
    }

    private void cancelPendingRestart() {
        mainHandler.removeCallbacks(restartRunnable);
    }

    private long getRestartDelayForError(int error) {
        if (error == SpeechRecognizer.ERROR_NO_MATCH
                || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
            int noMatchCount = Math.min(4, consecutiveNoMatchErrors.incrementAndGet());
            long exponentialBackoff = SILENCE_RESTART_DELAY_MS * (1L << (noMatchCount - 1));
            return Math.min(MAX_NO_MATCH_BACKOFF_MS, exponentialBackoff);
        }

        consecutiveNoMatchErrors.set(0);

        return DEFAULT_RESTART_DELAY_MS;
    }

    private void startListeningSafely(Intent intent) {
        if (speechRecognizer == null) {
            return;
        }

        long now = System.currentTimeMillis();
        long elapsedSinceLastStart = now - lastListenStartAtMs.get();
        if (elapsedSinceLastStart < MIN_RESTART_GAP_MS) {
            restartIfNeeded(MIN_RESTART_GAP_MS - elapsedSinceLastStart);
            return;
        }

        try {
            speechRecognizer.startListening(intent);
            lastListenStartAtMs.set(System.currentTimeMillis());
        } catch (IllegalStateException illegalState) {
            Log.w(TAG, "startListening in illegal state, fallback to cancel+start", illegalState);
            try {
                speechRecognizer.cancel();
                speechRecognizer.startListening(intent);
                lastListenStartAtMs.set(System.currentTimeMillis());
            } catch (Exception e) {
                Log.e(TAG, "Failed to restart recognition", e);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to restart recognition", e);
        }
    }
}
