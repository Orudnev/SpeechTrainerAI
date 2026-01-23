#pragma once
#include <atomic>
#include <string>
#include "EngineState.h"

class SpeechEngine {
public:
    static SpeechEngine& instance();

    bool init();
    void shutdown();
    bool isInitialized() const;

    bool loadModel(const std::string& path);
    bool startRecognition();
    void stopRecognition();

    EngineState getState() const;

private:
    SpeechEngine();

    std::atomic<EngineState> state_;
    std::string modelPath_;
};
