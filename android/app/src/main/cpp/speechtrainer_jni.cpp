#include <jni.h>
#include <string>

extern "C"
JNIEXPORT jstring JNICALL
Java_com_speechtrainerai_rn_1java_1connector_RnJavaConnectorModule_nativeHello(
        JNIEnv* env,
        jclass /* clazz */) {

    std::string msg = "Hello from C++";
    return env->NewStringUTF(msg.c_str());
}