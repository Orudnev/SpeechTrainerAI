#include <jni.h>
#include "../engine/SpeechEngine.h"

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_speechtrainerai_rn_1java_1connector_RnJavaConnectorModule_nativeInit(
        JNIEnv*, jclass) {
    return SpeechEngine::instance().init();
}

JNIEXPORT void JNICALL
Java_com_speechtrainerai_rn_1java_1connector_RnJavaConnectorModule_nativeShutdown(
        JNIEnv*, jclass) {
SpeechEngine::instance().shutdown();
}

JNIEXPORT jboolean JNICALL
Java_com_speechtrainerai_rn_1java_1connector_RnJavaConnectorModule_nativeIsInitialized(
        JNIEnv*, jclass) {
    return SpeechEngine::instance().isInitialized();
}

JNIEXPORT jboolean JNICALL
        Java_com_speechtrainerai_rn_1java_1connector_RnJavaConnectorModule_nativeLoadModel(
        JNIEnv* env, jclass, jstring path) {
const char* cpath = env->GetStringUTFChars(path, nullptr);
bool ok = SpeechEngine::instance().loadModel(cpath);
env->ReleaseStringUTFChars(path, cpath);
return ok;
}

JNIEXPORT jboolean JNICALL
Java_com_speechtrainerai_rn_1java_1connector_RnJavaConnectorModule_nativeStartRecognition(
        JNIEnv*, jclass) {
    return SpeechEngine::instance().startRecognition();
}

JNIEXPORT void JNICALL
Java_com_speechtrainerai_rn_1java_1connector_RnJavaConnectorModule_nativeStopRecognition(
        JNIEnv*, jclass) {
SpeechEngine::instance().stopRecognition();
}

JNIEXPORT jstring JNICALL
Java_com_speechtrainerai_rn_1java_1connector_RnJavaConnectorModule_nativeGetEngineState(
        JNIEnv* env, jclass) {
    auto state = SpeechEngine::instance().getState();
    return env->NewStringUTF(toString(state));
}

}
