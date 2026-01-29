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
    vosk_set_log_level(0);
    if (state_ != EngineState::UNINITIALIZED) {
        LOGI("init() called again, ignoring");
        return true; // <-- ВАЖНО
    }

    LOGI("Engine initialized");
    state_ = EngineState::INITIALIZED;
    return true;
}

void SpeechEngine::shutdown() {

    LOGI("Engine shutdown requested");

    stopRecognition();

    if (recognizer_) {
        vosk_recognizer_free(recognizer_);
        recognizer_ = nullptr;
    }

    if (model_) {
        vosk_model_free(model_);
        model_ = nullptr;
    }

    state_ = EngineState::UNINITIALIZED;

    LOGI("Engine fully shutdown");
}

void SpeechEngine::fullReset() {

    LOGI("FULL RESET requested");

    // 1) Stop recognition thread
    stopRecognition();

    // 2) Clear audio buffer
    audioBuffer_.clear();

    // 3) Destroy recognizer completely
    if (recognizer_) {
        vosk_recognizer_free(recognizer_);
        recognizer_ = nullptr;
    }

    // 4) Recreate recognizer fresh (if model loaded)
    if (model_) {

        recognizer_ = vosk_recognizer_new(model_, 16000.0f);

        vosk_recognizer_set_max_alternatives(recognizer_, 0);
        vosk_recognizer_set_words(recognizer_, 1);

        state_ = EngineState::MODEL_LOADED;

        LOGI("Recognizer recreated successfully");
    }

    LOGI("FULL RESET done");
}


bool SpeechEngine::isInitialized() const {
    return state_ != EngineState::UNINITIALIZED;
}

bool SpeechEngine::loadModel(const std::string& path) {

    if (model_ != nullptr) {
        LOGI("Model already loaded, ignoring");
        return true;
    }

    LOGI("Loading Vosk model from: %s", path.c_str());

    model_ = vosk_model_new(path.c_str());
    if (!model_) {
        LOGE("vosk_model_new failed (bad path?)");
        return false;
    }

    recognizer_ = vosk_recognizer_new(model_, 16000.0f);
    if (!recognizer_) {
        LOGE("vosk_recognizer_new failed");
        return false;
    }

    vosk_recognizer_set_max_alternatives(recognizer_, 0);
    vosk_recognizer_set_words(recognizer_, 1);

    state_ = EngineState::MODEL_LOADED;

    LOGI("Vosk model loaded OK");
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

    LOGI("stopRecognition() requested");

    // 1) Stop recognition thread
    if (recognition_.running) {
        recognition_.running = false;

        if (recognition_.worker.joinable()) {
            recognition_.worker.join();
        }
    }

    // 2) Flush final result from Vosk
    if (recognizer_) {

        const char* finalJson = vosk_recognizer_final_result(recognizer_);

        LOGI("Final result JSON: %s", finalJson);

        // Extract "text" field (temporary simple parser)
        std::string json = finalJson;

        auto pos = json.find("\"text\"");
        if (pos != std::string::npos) {

            auto q1 = json.find("\"", pos + 6);
            auto q2 = json.find("\"", q1 + 1);

            if (q1 != std::string::npos && q2 != std::string::npos) {

                std::string finalText =
                        json.substr(q1 + 1, q2 - q1 - 1);

                if (!finalText.empty() && resultCallback_) {

                    std::string evt =
                            std::string("{\"type\":\"final\",\"text\":\"")
                            + finalText + "\"}";

                    resultCallback_(evt.c_str());
                }
            }
        }

        // 3) Reset recognizer for next session
        vosk_recognizer_reset(recognizer_);
    }

    // 4) Update engine state
    if (state_ == EngineState::RECOGNIZING) {
        state_ = EngineState::MODEL_LOADED;
    }

    LOGI("stopRecognition() done");
}

void SpeechEngine::recognitionLoop() {

    LOGI("Recognition thread started");

    int16_t tmp[4000]; // ~250ms audio
    std::string lastPartial;

    while (recognition_.running) {

        size_t frames = audioBuffer_.pop(tmp, 4000);

        if (frames > 0 && recognizer_) {

            int accepted = vosk_recognizer_accept_waveform_s(
                    recognizer_,
                    tmp,
                    frames
            );

            if (accepted) {
                // FINAL
                const char* resJson = vosk_recognizer_result(recognizer_);
                std::string json = resJson;

                auto pos = json.find("\"text\"");
                if (pos != std::string::npos) {

                    auto q1 = json.find("\"", pos + 6);
                    auto q2 = json.find("\"", q1 + 1);

                    std::string finalText =
                            json.substr(q1 + 1, q2 - q1 - 1);

                    if (!finalText.empty() && resultCallback_) {

                        std::string evt =
                                std::string("{\"type\":\"final\",\"text\":\"")
                                + finalText + "\"}";

                        resultCallback_(evt.c_str());
                    }
                }

                lastPartial.clear();
            }
            else {
                // PARTIAL
                const char* partialJson =
                        vosk_recognizer_partial_result(recognizer_);

                std::string json = partialJson;

                auto pos = json.find("\"partial\"");
                if (pos != std::string::npos) {

                    auto q1 = json.find("\"", pos + 9);
                    auto q2 = json.find("\"", q1 + 1);

                    std::string partialText =
                            json.substr(q1 + 1, q2 - q1 - 1);

                    if (partialText.empty()) {
                        continue; // <-- НЕ return!
                    }

                    if (partialText == lastPartial) {
                        continue; // no spam
                    }

                    lastPartial = partialText;

                    if (resultCallback_) {

                        std::string evt =
                                std::string("{\"type\":\"partial\",\"text\":\"")
                                + partialText + "\"}";

                        resultCallback_(evt.c_str());
                    }
                }
            }
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }

    LOGI("Recognition thread stopped");
}



