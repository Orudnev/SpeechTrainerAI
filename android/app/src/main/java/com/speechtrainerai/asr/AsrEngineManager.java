package com.speechtrainerai.asr;

import java.util.HashMap;
import java.util.Locale;

/**
 * Центральный реестр ASR движков.
 *
 * По задаче:
 * количество движков фиксируется в Java слое (hardcoded).
 */
public class AsrEngineManager {

    private final HashMap<String, AsrEngine> engines = new HashMap<>();

    public AsrEngineManager() {

        // Vosk движок (EN)
        engines.put("vosk-en", new VoskAsrEngine("vosk-en"));

        // Android SpeechRecognizer движки
        engines.put("android-en", new AndroidSpeechRecognizerAsrEngine("android-en", Locale.US));
        engines.put("android-ru", new AndroidSpeechRecognizerAsrEngine("android-ru", new Locale("ru", "RU")));
    }

    public AsrEngine getEngine(String id) {
        return engines.get(id);
    }
}
