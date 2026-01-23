cmake_minimum_required(VERSION 3.22)

project(speechtrainer_jni LANGUAGES C CXX)

add_library(
        speechtrainer_jni
        SHARED

        jni/speechtrainer_jni.cpp
        engine/SpeechEngine.cpp
)

target_include_directories(
        speechtrainer_jni
        PRIVATE
        engine
)

find_library(
        log-lib
        log
)

target_link_libraries(
        speechtrainer_jni
        ${log-lib}
)
