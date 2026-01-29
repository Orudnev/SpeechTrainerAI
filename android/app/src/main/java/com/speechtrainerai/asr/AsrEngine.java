package com.speechtrainerai.asr;

/**
 * Универсальный контракт для всех ASR движков.
 *
 * Важно:
 * движков может быть несколько, но активен только один.
 */
public interface AsrEngine {

    /** Уникальный ID движка (например "vosk-en") */
    String getId();

    /**
     * Нужно ли движку внешнее аудио (AudioRecord)?
     *
     * true  = движок НЕ умеет сам читать микрофон (Vosk)
     * false = движок сам управляет аудиопотоком (Android SpeechRecognizer)
     */
    boolean needsExternalAudio();

    /** Инициализация движка */
    boolean init();

    /** Загрузка модели (если применимо) */
    boolean loadModel(String path);

    /** Запуск распознавания */
    boolean startRecognition();

    /** Остановка распознавания */
    void stopRecognition();

    /** Полное освобождение ресурсов */
    void shutdown();
}
