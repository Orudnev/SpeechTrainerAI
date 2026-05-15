package com.speechtrainerai.asr;

import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.Nullable;

import com.speechtrainerai.rn_java_connector.RnJavaConnectorModule;

import org.json.JSONException;
import org.json.JSONObject;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class OpenAiRealtimeAsrEngine implements AsrEngine {

    private static final String TAG = "OpenAiRealtimeAsr";
    private static final int INPUT_SAMPLE_RATE = 16000;
    private static final long AUTO_COMMIT_SILENCE_MS = 900L;
    // Approximate one average spoken word; helps avoid committing breaths/noise as utterances.
    private static final long MIN_SPEECH_MS = 600L;
    private static final long MAX_SEGMENT_MS = 10000L;
    private static final int SPEECH_AMPLITUDE_THRESHOLD = 900;
    private static final long STOP_CLOSE_DELAY_MS = 1200L;
    private static final String REALTIME_URL =
            "wss://api.openai.com/v1/realtime?intent=transcription";
    private static final String REALTIME_MODEL = "gpt-realtime-whisper";

    private final String id;
    private final String languageCode;
    private final AtomicBoolean isListening = new AtomicBoolean(false);
    private final AtomicBoolean awaitingFinalAfterStop = new AtomicBoolean(false);
    private final AtomicBoolean sessionReady = new AtomicBoolean(false);
    private final Object socketLock = new Object();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private String lastPartialText = "";
    private final Map<String, StringBuilder> partialsByItemId = new HashMap<>();
    private boolean segmentHasSpeech = false;
    private long segmentSpeechMs = 0L;
    private long segmentSilenceMs = 0L;
    private final Runnable stopCloseRunnable = () -> {
        synchronized (socketLock) {
            if (awaitingFinalAfterStop.get()) {
                Log.i(TAG, "Closing OpenAI socket after stop timeout");
                closeSocketLocked(1000, "stop-timeout");
                awaitingFinalAfterStop.set(false);
                resetSegmentState();
                lastPartialText = "";
                partialsByItemId.clear();
                sessionReady.set(false);
            }
        }
    };

    @Nullable
    private OkHttpClient httpClient;

    @Nullable
    private WebSocket webSocket;

    @Nullable
    private String apiKey;

    public OpenAiRealtimeAsrEngine(String id, String languageCode) {
        this.id = id;
        this.languageCode = languageCode;
    }

    @Override
    public String getId() {
        return id;
    }

    @Override
    public boolean needsExternalAudio() {
        return true;
    }

    public void setApiKey(@Nullable String apiKey) {
        this.apiKey = apiKey != null ? apiKey.trim() : null;
    }

    @Override
    public boolean init() {
        if (httpClient == null) {
            httpClient = new OkHttpClient.Builder()
                    .retryOnConnectionFailure(true)
                    .build();
        }
        return true;
    }

    @Override
    public boolean loadModel(String path) {
        return true;
    }

    @Override
    public boolean startRecognition() {
        if (apiKey == null || apiKey.isEmpty()) {
            emitError(401, "OpenAI API key is missing");
            return false;
        }

        if (httpClient == null && !init()) {
            emitError(500, "Failed to initialize OpenAI client");
            return false;
        }

        synchronized (socketLock) {
            closeSocketLocked(1000, "restart");
            awaitingFinalAfterStop.set(false);
            mainHandler.removeCallbacks(stopCloseRunnable);
            resetSegmentState();
            lastPartialText = "";
            partialsByItemId.clear();
            sessionReady.set(false);

            Request request = new Request.Builder()
                    .url(REALTIME_URL)
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .build();

            isListening.set(true);
            webSocket = httpClient.newWebSocket(request, new Listener());
        }

        return true;
    }

    @Override
    public void pushAudio(short[] data, int frames) {
        if (!isListening.get() || !sessionReady.get() || frames <= 0) {
            return;
        }

        WebSocket socketSnapshot;
        synchronized (socketLock) {
            socketSnapshot = webSocket;
        }

        if (socketSnapshot == null) {
            return;
        }

        int safeFrames = Math.min(frames, data != null ? data.length : 0);
        if (safeFrames <= 0) {
            return;
        }

        short[] upsampled = upsample16kTo24k(data, frames);
        ByteBuffer pcmBytes = ByteBuffer.allocate(upsampled.length * 2)
                .order(ByteOrder.LITTLE_ENDIAN);

        for (short sample : upsampled) {
            pcmBytes.putShort(sample);
        }

        String base64Audio = Base64.encodeToString(
                pcmBytes.array(),
                Base64.NO_WRAP
        );

        try {
            JSONObject event = new JSONObject();
            event.put("type", "input_audio_buffer.append");
            event.put("audio", base64Audio);
            socketSnapshot.send(event.toString());
            maybeAutoCommitAfterSilence(data, safeFrames, socketSnapshot);
        } catch (JSONException e) {
            Log.e(TAG, "Failed to send audio chunk", e);
            emitError(500, "Failed to serialize audio chunk");
        }
    }

    @Override
    public void stopRecognition() {
        isListening.set(false);

        WebSocket socketSnapshot;
        synchronized (socketLock) {
            socketSnapshot = webSocket;
        }

        if (socketSnapshot != null && sessionReady.get()) {
            if (sendInputAudioBufferCommit(socketSnapshot)) {
                awaitingFinalAfterStop.set(true);
                mainHandler.removeCallbacks(stopCloseRunnable);
                mainHandler.postDelayed(stopCloseRunnable, STOP_CLOSE_DELAY_MS);
                return;
            }
        }

        synchronized (socketLock) {
            closeSocketLocked(1000, "stop");
        }
        awaitingFinalAfterStop.set(false);
        mainHandler.removeCallbacks(stopCloseRunnable);
        resetSegmentState();
        lastPartialText = "";
        partialsByItemId.clear();
        sessionReady.set(false);
    }

    @Override
    public void shutdown() {
        stopRecognition();

        if (httpClient != null) {
            httpClient.dispatcher().executorService().shutdown();
            httpClient.connectionPool().evictAll();
            httpClient = null;
        }
    }

    private void sendSessionUpdate(WebSocket socket) throws JSONException {
        JSONObject transcription = new JSONObject()
                .put("model", REALTIME_MODEL)
                .put("language", languageCode);
        JSONObject inputFormat = new JSONObject()
                .put("type", "audio/pcm")
                .put("rate", 24000);
        JSONObject audioInput = new JSONObject()
                .put("format", inputFormat)
                .put("transcription", transcription);
        JSONObject audio = new JSONObject()
                .put("input", audioInput);
        JSONObject session = new JSONObject()
                .put("type", "transcription")
                .put("audio", audio);
        session.put("include", new org.json.JSONArray()
                .put("item.input_audio_transcription.logprobs"));

        JSONObject event = new JSONObject();
        event.put("type", "session.update");
        event.put("session", session);

        Log.i(TAG, "Sending session.update: " + event);
        socket.send(event.toString());
    }

    private boolean sendInputAudioBufferCommit(WebSocket socket) {
        try {
            JSONObject event = new JSONObject();
            event.put("type", "input_audio_buffer.commit");
            Log.i(TAG, "Sending input_audio_buffer.commit");
            return socket.send(event.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Failed to serialize input_audio_buffer.commit", e);
            return false;
        }
    }

    private void maybeAutoCommitAfterSilence(short[] data, int frames, WebSocket socket) {
        if (awaitingFinalAfterStop.get()) {
            return;
        }

        long chunkMs = Math.max(1L, Math.round((frames * 1000.0) / INPUT_SAMPLE_RATE));
        boolean isSpeech = isSpeechChunk(data, frames);

        if (isSpeech) {
            segmentHasSpeech = true;
            segmentSpeechMs += chunkMs;
            segmentSilenceMs = 0L;
            return;
        }

        if (!segmentHasSpeech) {
            return;
        }

        segmentSilenceMs += chunkMs;
        if (segmentSpeechMs >= MAX_SEGMENT_MS
                || (segmentSpeechMs >= MIN_SPEECH_MS && segmentSilenceMs >= AUTO_COMMIT_SILENCE_MS)) {
            Log.i(TAG, "Auto-committing buffered audio: speechMs=" + segmentSpeechMs
                    + ", silenceMs=" + segmentSilenceMs);
            if (sendInputAudioBufferCommit(socket)) {
                resetSegmentState();
            }
        }
    }

    private boolean isSpeechChunk(short[] data, int frames) {
        long totalAmplitude = 0L;
        for (int i = 0; i < frames; i++) {
            totalAmplitude += Math.abs((int) data[i]);
        }
        long averageAmplitude = totalAmplitude / Math.max(1, frames);
        return averageAmplitude >= SPEECH_AMPLITUDE_THRESHOLD;
    }

    private void resetSegmentState() {
        segmentHasSpeech = false;
        segmentSpeechMs = 0L;
        segmentSilenceMs = 0L;
    }

    private void handleServerMessage(String text) {
        try {
            JSONObject event = new JSONObject(text);
            String type = event.optString("type", "");

            if ("session.created".equals(type)
                    || "session.updated".equals(type)
                    || "transcription_session.created".equals(type)
                    || "transcription_session.updated".equals(type)) {
                sessionReady.set(true);
                Log.i(TAG, "OpenAI session ready via " + type + ": " + text);
                return;
            }

            if ("input_audio_buffer.speech_started".equals(type)
                    || "input_audio_buffer.speech_stopped".equals(type)
                    || "input_audio_buffer.committed".equals(type)) {
                Log.i(TAG, "OpenAI audio event: " + text);
                return;
            }

            if ("conversation.item.input_audio_transcription.delta".equals(type)) {
                String itemId = event.optString("item_id", "");
                String delta = event.optString("delta", "").trim();
                emitPartial(itemId, delta);
                return;
            }

            if ("conversation.item.input_audio_transcription.completed".equals(type)) {
                String itemId = event.optString("item_id", "");
                String transcript = event.optString("transcript", "").trim();
                partialsByItemId.remove(itemId);
                emitFinal(transcript);
                resetSegmentState();
                if (awaitingFinalAfterStop.get()) {
                    synchronized (socketLock) {
                        closeSocketLocked(1000, "stop-complete");
                    }
                    awaitingFinalAfterStop.set(false);
                    mainHandler.removeCallbacks(stopCloseRunnable);
                    sessionReady.set(false);
                }
                return;
            }

            if ("conversation.item.input_audio_transcription.failed".equals(type)
                    || "error".equals(type)) {
                String itemId = event.optString("item_id", "");
                if (!itemId.isEmpty()) {
                    partialsByItemId.remove(itemId);
                }
                Log.w(TAG, "OpenAI server error event: " + text);
                JSONObject error = event.optJSONObject("error");
                emitError(500, error != null
                        ? error.optString("message", "OpenAI realtime error")
                        : "OpenAI realtime error");
                resetSegmentState();
                if (awaitingFinalAfterStop.get()) {
                    synchronized (socketLock) {
                        closeSocketLocked(1000, "stop-error");
                    }
                    awaitingFinalAfterStop.set(false);
                    mainHandler.removeCallbacks(stopCloseRunnable);
                    sessionReady.set(false);
                }
                return;
            }

            Log.d(TAG, "Ignoring OpenAI realtime event: " + type);
        } catch (JSONException e) {
            Log.e(TAG, "Failed to parse OpenAI realtime event: " + text, e);
            emitError(500, "Failed to parse OpenAI event");
        }
    }

    private void emitPartial(String itemId, String delta) {
        if (delta.isEmpty()) {
            return;
        }

        String text = delta;
        if (!itemId.isEmpty()) {
            StringBuilder builder = partialsByItemId.get(itemId);
            if (builder == null) {
                builder = new StringBuilder();
                partialsByItemId.put(itemId, builder);
            }
            builder.append(delta);
            text = builder.toString().trim();
        }

        if (text.isEmpty() || text.equals(lastPartialText)) {
            return;
        }

        lastPartialText = text;
        emitPayload("partial", text, false, 0);
    }

    private void emitFinal(String text) {
        lastPartialText = "";
        emitPayload("final", text, false, 0);
    }

    private void emitError(int errorCode, String message) {
        Log.w(TAG, "emitError(" + errorCode + "): " + message);
        lastPartialText = "";
        emitPayload("final", "", true, errorCode);
    }

    private void emitPayload(String type, String text, boolean isError, int errorCode) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("type", type);
            payload.put("text", text);
            payload.put("isError", isError);
            if (isError) {
                payload.put("errorCode", errorCode);
            }
            RnJavaConnectorModule.onNativeResult(payload.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Failed to emit payload", e);
        }
    }

    private void closeSocketLocked(int code, String reason) {
        if (webSocket != null) {
            webSocket.close(code, reason);
            webSocket = null;
        }
    }

    private short[] upsample16kTo24k(short[] source, int frames) {
        int safeFrames = Math.min(frames, source != null ? source.length : 0);
        if (safeFrames <= 0) {
            return new short[0];
        }

        short[] output = new short[safeFrames + (safeFrames / 2)];
        int outIndex = 0;

        for (int i = 0; i < safeFrames; i++) {
            short current = source[i];
            output[outIndex++] = current;

            if (i < safeFrames - 1 && i % 2 == 0) {
                short next = source[i + 1];
                output[outIndex++] = (short) ((current + next) / 2);
            }
        }

        return output;
    }

    private final class Listener extends WebSocketListener {
        @Override
        public void onOpen(WebSocket webSocket, Response response) {
            try {
                Log.i(TAG, "OpenAI realtime socket opened");
                sendSessionUpdate(webSocket);
            } catch (JSONException e) {
                Log.e(TAG, "Failed to send session.update", e);
                emitError(500, "Failed to configure OpenAI session");
            }
        }

        @Override
        public void onMessage(WebSocket webSocket, String text) {
            handleServerMessage(text);
        }

        @Override
        public void onClosing(WebSocket webSocket, int code, String reason) {
            webSocket.close(code, reason);
        }

        @Override
        public void onClosed(WebSocket webSocket, int code, String reason) {
            synchronized (socketLock) {
                if (OpenAiRealtimeAsrEngine.this.webSocket == webSocket) {
                    OpenAiRealtimeAsrEngine.this.webSocket = null;
                }
            }
            awaitingFinalAfterStop.set(false);
            mainHandler.removeCallbacks(stopCloseRunnable);
            resetSegmentState();
            sessionReady.set(false);
        }

        @Override
        public void onFailure(WebSocket webSocket, Throwable t, @Nullable Response response) {
            Log.e(TAG, "OpenAI realtime socket failed", t);
            synchronized (socketLock) {
                if (OpenAiRealtimeAsrEngine.this.webSocket == webSocket) {
                    OpenAiRealtimeAsrEngine.this.webSocket = null;
                }
            }
            awaitingFinalAfterStop.set(false);
            mainHandler.removeCallbacks(stopCloseRunnable);
            resetSegmentState();
            sessionReady.set(false);
            if (isListening.get()) {
                emitError(response != null ? response.code() : 500, "OpenAI realtime connection failed");
            }
        }
    }
}
