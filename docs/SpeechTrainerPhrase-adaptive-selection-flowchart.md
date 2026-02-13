# Адаптивный выбор следующей фразы — блок-схема (Mermaid)

Ниже показан алгоритм, который сейчас используется после корректного ответа для выбора **следующей** фразы:

- приоритет «слабо изученным» элементам;
- штраф за недавние повторы;
- выбор не строго детерминированный, а взвешенно-случайный.

```mermaid
flowchart TD
    A[onMatched: фраза распознана корректно] --> B[buildResultUpdate:<br/>обновить cnt/df/dw/ts]
    B --> C[saveResultToPhrase в SQLite]
    C --> D[Обновить items в памяти<br/>updatedItems]

    D --> E[Добавить current uid в recentHistory]
    E --> F[Ограничить историю:<br/>historyLimit = max 3, min 8, floor N/2]

    F --> G[Для каждого item рассчитать weakness]
    G --> G1[noveltyPart = 1 / 1+count]
    G --> G2[speedPart = clamp avgWordDuration / TARGET_WORD_DURATION_MS]
    G1 --> G3[weakness = 0.7 novelty + 0.3 speed]
    G2 --> G3

    G3 --> H[Рассчитать recencyFactor по recentHistory]
    H --> H1[если только что показывали: 0.05]
    H --> H2[2 шага назад: 0.2]
    H --> H3[3-4 шага назад: 0.5]
    H --> H4[давно/не было: 0.8..1.0]

    H1 --> I[weight = weakness * recencyFactor * sameAsCurrentFactor]
    H2 --> I
    H3 --> I
    H4 --> I

    I --> J[Отсортировать по weight DESC]
    J --> K[Взять пул top кандидатов:<br/>max 3 или 35 процентов]

    K --> L{sum weights > 0?}
    L -- нет --> M[Fallback: взять первый uid != current]
    L -- да --> N[Weighted random<br/>по суммарному весу]

    M --> O[setPhraseIndex nextIndex]
    N --> O
    O --> P[Следующий цикл speaking/listening]
```

## Коротко о поведении

1. **Слабые элементы** получают более высокий шанс за счёт низкого `count` и медленной скорости ответа.
2. **Недавние элементы** штрафуются, чтобы не повторяться подряд.
3. Выбор делается из **топ-пула**, что удерживает фокус на проблемных фразах, но оставляет вариативность.
