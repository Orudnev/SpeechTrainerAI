# SpeechCompareEngine algorithm flowchart

```mermaid
flowchart TD
    A[-A- Start: new ASR event] --> B{-B- asrText exists?}
    B -- No --> Z[-Z- Return false<br/>no phrase match]
    B -- Yes --> C[-C- Save asrResult = asrText]

    C --> D[-D- Normalize ASR text<br/>and split to casrrWords]
    D --> E[-E- Get current etalonWord<br/>by currIndex]
    E --> F{-F- etalonWord exists?}
    F -- No --> Z
    F -- Yes --> G{-G- casrrWords.length == 0?}

    G -- Yes --> H[-H- Try mark by variant]
    H --> H1{-H1- Variant matched?}
    H1 -- Yes --> M[-M- markWordMatched]
    H1 -- No --> Z

    G -- No --> I[-I- Find index of etalonWord<br/>in casrrWords]
    I --> J{-J- foundIndex == -1?}
    J -- Yes --> H
    J -- No --> K[-K- Set i = foundIndex<br/>phraseMatched = false]

    K --> L{-L- i < casrrWords.length}
    L -- No --> R[-R- Return phraseMatched]
    L -- Yes --> N[-N- Reload etalonWord by currIndex]
    N --> O{-O- etalonWord exists?}
    O -- No --> R
    O -- Yes --> P[-P- spoken = casrrWords[i]]

    P --> Q{-Q- spoken == etalonWord?}
    Q -- Yes --> M
    M --> M1[-M1- currIndex++<br/>push word to matchedWords]
    M1 --> M2{-M2- currIndex >= etalonWords.length?}
    M2 -- Yes --> M3[-M3- status = Ответ засчитан<br/>return true for this mark]
    M2 -- No --> M4[-M4- return false for this mark]

    M3 --> S[-S- phraseMatched = true]
    M4 --> T[-T- phraseMatched unchanged]
    S --> U[-U- i++]
    T --> U
    U --> L

    Q -- No --> V[-V- Try mark by variant<br/>for current etalonWord]
    V --> W[-W- phraseMatched = variantMark OR phraseMatched]
    W --> R

    R --> END[-END- Return phraseMatched<br/>to caller, may trigger onMatched]
```

## Notes
- `reset(etalon)` initializes engine state: normalized `etalonWords`, `currIndex = 0`, empty `matchedWords`, empty `status`, empty `asrResult`.
- `getCurrentWord()` returns the current expected word (`etalonWords[currIndex]`), or empty string.
- `getSnapshot()` returns UI-ready state (`asrResult`, `matchedWords`, `status`).
