#pragma once

enum class EngineState {
    UNINITIALIZED,
    INITIALIZED,
    MODEL_LOADED,
    RECOGNIZING
};

inline const char* toString(EngineState state) {
    switch (state) {
        case EngineState::UNINITIALIZED: return "UNINITIALIZED";
        case EngineState::INITIALIZED: return "INITIALIZED";
        case EngineState::MODEL_LOADED: return "MODEL_LOADED";
        case EngineState::RECOGNIZING: return "RECOGNIZING";
        default: return "UNKNOWN";
    }
}
