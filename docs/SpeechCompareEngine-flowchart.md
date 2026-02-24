# SpeechCompareEngine algorithm flowchart

```mermaid
flowchart TD
    A[Start: new ASR event] --> B{asrText exists?}
    B -- No --> Z[Return false<br/>no phrase match]
    B -- Yes --> C[Save asrResult = asrText]

    C --> D[Normalize ASR text<br/>and split to casrrWords]
    D --> E[Get current etalonWord<br/>by currIndex]
    E --> F{etalonWord exists?}
    F -- No --> Z
    F -- Yes --> G{casrrWords.length == 0?}

    G -- Yes --> H[Try mark by variant]
    H --> H1{Variant matched?}
    H1 -- Yes --> M[markWordMatched]
    H1 -- No --> Z

    G -- No --> I[Find index of etalonWord<br/>in casrrWords]
    I --> J{foundIndex == -1?}
    J -- Yes --> H
    J -- No --> K[Set i = foundIndex<br/>phraseMatched = false]

    K --> L{i < casrrWords.length}
    L -- No --> R[Return phraseMatched]
    L -- Yes --> N[Reload etalonWord by currIndex]
    N --> O{etalonWord exists?}
    O -- No --> R
    O -- Yes --> P[spoken = casrrWords[i]]

    P --> Q{spoken == etalonWord?}
    Q -- Yes --> M
    M --> M1[currIndex++<br/>push word to matchedWords]
    M1 --> M2{currIndex >= etalonWords.length?}
    M2 -- Yes --> M3[status = Ответ засчитан<br/>return true for this mark]
    M2 -- No --> M4[return false for this mark]

    M3 --> S[phraseMatched = true]
    M4 --> T[phraseMatched unchanged]
    S --> U[i++]
    T --> U
    U --> L

    Q -- No --> V[Try mark by variant<br/>for current etalonWord]
    V --> W[phraseMatched = variantMark OR phraseMatched]
    W --> R

    R --> END[Return phraseMatched<br/>to caller, may trigger onMatched]
```

## Notes
- `reset(etalon)` initializes engine state: normalized `etalonWords`, `currIndex = 0`, empty `matchedWords`, empty `status`, empty `asrResult`.
- `getCurrentWord()` returns the current expected word (`etalonWords[currIndex]`), or empty string.
- `getSnapshot()` returns UI-ready state (`asrResult`, `matchedWords`, `status`).
