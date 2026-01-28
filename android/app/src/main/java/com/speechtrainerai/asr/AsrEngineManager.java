package com.speechtrainerai.asr;

import java.util.HashMap;

/**
 * Центральный реестр ASR движков.
 *
 * По задаче:
 * количество движков фиксируется в Java слое (hardcoded).
 */
public class AsrEngineManager {

    private final HashMap<String, AsrEngine> engines = new HashMap<>();

    public AsrEngineManager() {

        // Пока только Vosk движок (EN)
        engines.put("vosk-en", new VoskAsrEngine("vosk-en"));

        // В будущем добавим:
        // engines.put("android-ru", new AndroidAsrEngine());
    }

    public AsrEngine getEngine(String id) {
        return engines.get(id);
    }
}
