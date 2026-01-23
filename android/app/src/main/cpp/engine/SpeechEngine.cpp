#include "SpeechEngine.h"
#include <android/log.h>

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "SpeechEngine", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "SpeechEngine", __VA_ARGS__)
#include <chrono>

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

EngineState SpeechEngine::getState() const {
    return state_;
}
#include <chrono>

void SpeechEngine::setResultCallback(void (*cb)(const char*)) {
    resultCallback_ = cb;
}

bool SpeechEngine::startRecognition() {
    if (state_ != EngineState::MODEL_LOADED)
        return false;

    recognition_.running = true;
    recognition_.worker = std::thread(&SpeechEngine::recognitionLoop, this);

    state_ = EngineState::RECOGNIZING;
    return true;
}

void SpeechEngine::stopRecognition() {
    if (recognition_.running) {
        recognition_.running = false;
        if (recognition_.worker.joinable())
            recognition_.worker.join();
    }
    if (state_ == EngineState::RECOGNIZING)
        state_ = EngineState::MODEL_LOADED;
}

void SpeechEngine::recognitionLoop() {
    int counter = 0;
    while (recognition_.running) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        if (!recognition_.running)
            break;
        if (resultCallback_) {
            std::string fake =
                    "fake result #" + std::to_string(++counter);
            resultCallback_(fake.c_str());
        }
    }
}
