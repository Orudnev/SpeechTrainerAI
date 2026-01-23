#pragma once
#include <vector>
#include <mutex>

class AudioBuffer {
public:
    explicit AudioBuffer(size_t maxFrames = 16000 * 10)
            : maxFrames_(maxFrames) {}

    void push(const int16_t* data, size_t frames) {
        std::lock_guard<std::mutex> lock(mutex_);

        if (buffer_.size() + frames > maxFrames_) {
            // Drop oldest audio
            size_t overflow = (buffer_.size() + frames) - maxFrames_;
            buffer_.erase(buffer_.begin(), buffer_.begin() + overflow);
        }

        buffer_.insert(buffer_.end(), data, data + frames);
    }

    size_t pop(int16_t* out, size_t maxFrames) {
        std::lock_guard<std::mutex> lock(mutex_);
        size_t n = std::min(maxFrames, buffer_.size());
        std::copy(buffer_.begin(), buffer_.begin() + n, out);
        buffer_.erase(buffer_.begin(), buffer_.begin() + n);
        return n;
    }

private:
    std::vector<int16_t> buffer_;
    size_t maxFrames_;
    std::mutex mutex_;
};