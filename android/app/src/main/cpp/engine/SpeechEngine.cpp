#include "SpeechEngine.h"
#include <android/log.h>
#include <chrono>

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "SpeechEngine", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "SpeechEngine", __VA_ARGS__)


SpeechEngine::SpeechEngine()
        : state_(EngineState::UNINITIALIZED) {}

void SpeechEngine::pushAudio(const int16_t* data, size_t frames) {
    audioBuffer_.push(data, frames);
}

SpeechEngine& SpeechEngine::instance() {
    static SpeechEngine engine;
    return engine;
}

bool SpeechEngine::init() {
    if (state_ != EngineState::UNINITIALIZED) {
        LOGI("init() called again, ignoring");
        return true; // <-- ВАЖНО
    }

    LOGI("Engine initialized");
    state_ = EngineState::INITIALIZED;
    return true;
}

void SpeechEngine::shutdown() {
    LOGI("Engine shutdown");
    stopRecognition();
    modelPath_.clear();
    state_ = EngineState::UNINITIALIZED;
}

bool SpeechEngine::isInitialized() const {
    return state_ != EngineState::UNINITIALIZED;
}

bool SpeechEngine::loadModel(const std::string& path) {

    if (state_ == EngineState::MODEL_LOADED ||
        state_ == EngineState::RECOGNIZING) {

        LOGI("loadModel() called again, ignoring");
        return true;
    }

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
    if (state_ == EngineState::RECOGNIZING) {
        LOGI("startRecognition() already running");
        return true;
    }

    if (state_ != EngineState::MODEL_LOADED) {
        LOGE("startRecognition() invalid state");
        return false;
    }

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
    int16_t tmp[1600];

    while (recognition_.running) {
        size_t frames = audioBuffer_.pop(tmp, 1600);

        if (frames > 0 && resultCallback_) {
            counter++;

            std::string json =
                    std::string("{\"type\":\"partial\",\"text\":\"fake chunk ")
                    + std::to_string(counter)
                    + "\"}";

            resultCallback_(json.c_str());

            if (counter % 5 == 0) {
                std::string finalJson =
                        std::string("{\"type\":\"final\",\"text\":\"fake sentence ")
                        + std::to_string(counter / 5)
                        + "\"}";

                resultCallback_(finalJson.c_str());
            }
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
}

