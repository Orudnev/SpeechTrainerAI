#include <jni.h>
#include "../engine/SpeechEngine.h"

extern "C" {
static JavaVM* gJvm = nullptr;
static jclass gModuleClass = nullptr;
static jmethodID gOnResultMethod = nullptr;

void emitResultToJava(const char* text) {
    JNIEnv* env = nullptr;
    gJvm->AttachCurrentThread(&env, nullptr);

    jstring jtext = env->NewStringUTF(text);
    env->CallStaticVoidMethod(
            gModuleClass,
            gOnResultMethod,
            jtext
    );
    env->DeleteLocalRef(jtext);
}

JNIEXPORT void JNICALL
Java_com_speechtrainerai_rn_1java_1connector_RnJavaConnectorModule_nativePushAudio(
        JNIEnv* env, jclass, jshortArray data, jint frames) {

jshort* pcm = env->GetShortArrayElements(data, nullptr);
SpeechEngine::instance().pushAudio(
reinterpret_cast<int16_t*>(pcm),
frames
);
env->ReleaseShortArrayElements(data, pcm, JNI_ABORT);
}

JNIEXPORT jboolean JNICALL
Java_com_speechtrainerai_rn_1java_1connector_RnJavaConnectorModule_nativeInit(
        JNIEnv* env, jclass clazz) {

    gModuleClass = (jclass)env->NewGlobalRef(clazz);
    gOnResultMethod = env->GetStaticMethodID(
            clazz,
            "onNativeResult",
            "(Ljava/lang/String;)V"
    );

    SpeechEngine::instance().setResultCallback(emitResultToJava);
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

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    gJvm = vm;
    return JNI_VERSION_1_6;
}



}
