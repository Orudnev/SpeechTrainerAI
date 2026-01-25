cmake_minimum_required(VERSION 3.22)

project(speechtrainer_jni LANGUAGES C CXX)

# ------------------------------------------------------------
# 1) Build our JNI library
# ------------------------------------------------------------
add_library(
        speechtrainer_jni
        SHARED
        jni/speechtrainer_jni.cpp
        engine/SpeechEngine.cpp
)

# ------------------------------------------------------------
# 2) Include paths (Engine + Vosk headers)
# ------------------------------------------------------------
target_include_directories(
        speechtrainer_jni
        PRIVATE
        ${CMAKE_SOURCE_DIR}/engine
        ${CMAKE_SOURCE_DIR}/third_party/vosk/include
)

# ------------------------------------------------------------
# 3) Import prebuilt libvosk.so
# ------------------------------------------------------------
set(VOSK_LIB_PATH
        ${CMAKE_SOURCE_DIR}/third_party/vosk/libs/${ANDROID_ABI}/libvosk.so
)

if(NOT EXISTS ${VOSK_LIB_PATH})
    message(FATAL_ERROR "Vosk library not found: ${VOSK_LIB_PATH}")
endif()

add_library(vosk SHARED IMPORTED)

set_target_properties(vosk PROPERTIES
        IMPORTED_LOCATION ${VOSK_LIB_PATH}
)

# ------------------------------------------------------------
# 4) Android system log library
# ------------------------------------------------------------
find_library(log-lib log)

# ------------------------------------------------------------
# 5) Link everything together
# ------------------------------------------------------------
target_link_libraries(
        speechtrainer_jni
        vosk
        ${log-lib}
)
