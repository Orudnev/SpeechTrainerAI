# SpeechTrainerPhrase.tsx — блок-схема и зоны декомпозиции

Ниже блок-схема текущей логики компонента `SpeechTrainerPhrase.tsx` в формате Mermaid.

## Блок-схема

```mermaid
flowchart TD
    A[Монтирование SpeechTrainerPhrase] --> B[Загрузка БД:<br/>initSpeechDb + seedSpeechDbIfEmpty + loadAllPhrases]
    A --> C[Ожидание готовности TTS:<br/>TtsService.waitReady]
    A --> D[Подписка на ASR результаты:<br/>AsrService.subscribeResults]

    B --> E{items.length > 0?}
    E -- нет --> E1[UI: Loading phrases...]
    E -- да --> F[Вычисление currentItem/currentQuestion/currentAnswer]

    C --> G{tts ready and data loaded?}
    F --> G
    G -- да --> H[trainer loop speaking phase]
    H --> I[speakAndListen currentQuestion via vosk en]
    I --> J[phase=listening]

    D --> O[store last ASR result]
    O --> K{partial event и listening phase?}
    K -- да --> L[normalizeText input text]
    L --> M{norm не пустой?}
    M -- да --> N[increment variant buffer counter]
    K -- нет --> O2[skip variant buffer update]

    J --> P[SpeechCompare with etalon answer and ASR text]
    P --> Q[update current word]
    P --> R{onMatched?}
    R -- да --> S[handle matched and wait TTS finish]
    S --> T[move to next phrase index]
    T --> U[Сброс состояния:<br/>variantBuffer empty,<br/>lastAsrResult null]
    U --> F

    Q --> V[VariantPicker]
    N --> V
    V --> W[save selected variants]
    W --> X{raw item and current word exist?}
    X -- да --> Y[Слияние variants по currentWord]
    Y --> Z[saveVariantsToPhrase uid updated]
    Z --> AA[update React items for instant UI]
```

## Ключевые подсистемы внутри компонента

1. **Инициализация данных** (SQLite init/seed/load).
2. **Управление циклом тренировки** (`phase`, `phraseIndex`, `speakAndListen`).
3. **Обработка ASR событий** (подписка, буферизация partial, нормализация).
4. **Сопоставление эталона и ответа** через `SpeechCompare`.
5. **Менеджмент вариантов слов** (`VariantPicker`, сохранение в DB и локальный state).
6. **UI-обвязка страницы** (`Toolbar`, `Settings`, статусы фаз).

## Почему декомпозиция выглядит целесообразной

Компонент уже объединяет несколько независимых контекстов ответственности (данные, оркестрация speech-пайплайна, ASR-аналитика, persistence, UI). Для упрощения сопровождения имеет смысл выделить:

- `useTrainerSession` — управление `phase`, `phraseIndex`, переходами шага.
- `usePhraseData` — загрузка/refresh фраз и операции сохранения variants.
- `useAsrVariantsBuffer` — подписка на ASR, нормализация и статистика partial.
- `SpeechTrainerHeader` / `TrainerStatus` — изоляция UI-слоя от бизнес-логики.

Это снизит связность, упростит unit-тестирование и ускорит эволюцию логики (например, добавление второго ASR-движка или новых режимов тренировки).
