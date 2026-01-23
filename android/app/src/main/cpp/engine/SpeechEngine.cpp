#include "SpeechEngine.h"
#include <android/log.h>

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "SpeechEngine", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "SpeechEngine", __VA_ARGS__)

SpeechEngine::SpeechEngine()
        : state_(EngineState::UNINITIALIZED) {}

SpeechEngine& SpeechEngine::instance() {
    static SpeechEngine engine;
    return engine;
}

bool SpeechEngine::init() {
    if (state_ != EngineState::UNINITIALIZED) {
        LOGE("init() called in wrong state");
        return false;
    }
    LOGI("Engine initialized");
    state_ = EngineState::INITIALIZED;
    return true;
}

void SpeechEngine::shutdown() {
    LOGI("Engine shutdown");
    modelPath_.clear();
    state_ = EngineState::UNINITIALIZED;
}

bool SpeechEngine::isInitialized() const {
    return state_ != EngineState::UNINITIALIZED;
}

bool SpeechEngine::loadModel(const std::string& path) {
    if (state_ != EngineState::INITIALIZED) {
        LOGE("loadModel() invalid state");
        return false;
    }
    LOGI("Fake model loaded from: %s", path.c_str());
    modelPath_ = path;
    state_ = EngineState::MODEL_LOADED;
    return true;
}

bool SpeechEngine::startRecognition() {
    if (state_ != EngineState::MODEL_LOADED) {
        LOGE("startRecognition() invalid state");
        return false;
    }
    LOGI("Fake recognition started");
    state_ = EngineState::RECOGNIZING;
    return true;
}

void SpeechEngine::stopRecognition() {
    if (state_ == EngineState::RECOGNIZING) {
        LOGI("Fake recognition stopped");
        state_ = EngineState::MODEL_LOADED;
    }
}

EngineState SpeechEngine::getState() const {
    return state_;
}
