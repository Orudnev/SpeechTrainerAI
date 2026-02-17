package com.speechtrainerai.asr;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
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

/**
 * Реализация ASR движка на базе Android SpeechRecognizer API.
 *
 * SpeechRecognizer сам управляет микрофоном → needsExternalAudio() = false
 */
public class AndroidSpeechRecognizerAsrEngine implements AsrEngine {

    private static final String TAG = "AndroidAsrEngine";

    private final String id;
    private final Locale locale;

    @Nullable
    private SpeechRecognizer speechRecognizer;

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
        Context context = RnJavaConnectorModule.getAppContext();

        if (context == null) {
            Log.e(TAG, "init() failed: app context is null");
            return false;
        }

        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            Log.e(TAG, "init() failed: SpeechRecognizer is not available");
            return false;
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context);
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                Log.i(TAG, "onReadyForSpeech()");
            }

            @Override
            public void onBeginningOfSpeech() {
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
            }

            @Override
            public void onResults(Bundle results) {
                emitResults(results, "final");
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                emitResults(partialResults, "partial");
            }

            @Override
            public void onEvent(int eventType, Bundle params) { }
        });

        Log.i(TAG, "init() ok: " + id + " locale=" + locale);
        return true;
    }

    @Override
    public boolean loadModel(String path) {
        // Для Android SpeechRecognizer загрузка модели не требуется.
        return true;
    }

    @Override
    public boolean startRecognition() {
        if (speechRecognizer == null) {
            Log.e(TAG, "startRecognition() failed: not initialized");
            return false;
        }

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale.toLanguageTag());
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

        speechRecognizer.startListening(intent);
        return true;
    }

    @Override
    public void stopRecognition() {
        if (speechRecognizer == null) {
            return;
        }

        speechRecognizer.stopListening();
        speechRecognizer.cancel();
    }

    @Override
    public void shutdown() {
        if (speechRecognizer == null) {
            return;
        }

        speechRecognizer.destroy();
        speechRecognizer = null;
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
            RnJavaConnectorModule.onNativeResult(payload.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Failed to emit recognition result", e);
        }
    }
}
