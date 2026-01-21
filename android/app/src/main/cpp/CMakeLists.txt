cmake_minimum_required(VERSION 3.18.1)

project(speechtrainer_jni LANGUAGES C CXX)

add_library(
        speechtrainer_jni
        SHARED
        speechtrainer_jni.cpp
)

find_library(
        log-lib
        log
)

target_link_libraries(
        speechtrainer_jni
        ${log-lib}
)
