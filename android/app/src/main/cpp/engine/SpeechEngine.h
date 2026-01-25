#pragma once
#include <atomic>
#include <string>
#include "EngineState.h"
#include "Threading.h"
#include "AudioBuffer.h"
#include <vosk_api.h>

class SpeechEngine {
public:
    static SpeechEngine& instance();

    bool init();
    void shutdown();
    bool isInitialized() const;
    bool loadModel(const std::string& path);
    bool startRecognition();
    void stopRecognition();

    void pushAudio(const int16_t* data, size_t frames);

    EngineState getState() const;

    // callback setter (JNI layer will set this)
    void setResultCallback(void (*cb)(const char* text));

private:
    SpeechEngine();

    void recognitionLoop();

    std::atomic<EngineState> state_;
    RecognitionThread recognition_;
    AudioBuffer audioBuffer_;
    std::string modelPath_;
    VoskModel* model_ = nullptr;
    VoskRecognizer* recognizer_ = nullptr;

    void (*resultCallback_)(const char* text) = nullptr;
};
