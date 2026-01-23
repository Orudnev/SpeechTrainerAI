#pragma once
#include <thread>
#include <atomic>

struct RecognitionThread {
    std::thread worker;
    std::atomic<bool> running{false};
};
