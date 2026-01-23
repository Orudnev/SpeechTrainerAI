#include "Threading.h"
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

    // callback setter (JNI layer will set this)
    void setResultCallback(void (*cb)(const char* text));

private:
    SpeechEngine();

    void recognitionLoop();

    std::atomic<EngineState> state_;
    std::string modelPath_;

    RecognitionThread recognition_;
    void (*resultCallback_)(const char* text) = nullptr;
};
