package com.speechtrainerai.asr;

/**
 * Универсальный контракт для всех ASR движков.
 *
 * Vosk, Android SpeechRecognizer, Cloud ASR —
 * все обязаны реализовать этот интерфейс.
 */
public interface AsrEngine {

    /** Уникальный ID движка (например "vosk-en") */
    String getId();

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
