import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Image,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { normalizeText, SpeechCompareEngine, SpeechCompareSnapshot } from './SpeechCompare';
import { speakAndListen } from '../speech/flow/speechOrchestrator';
import { TtsService } from '../speech/tts/TtsService';
import { AsrService } from '../speech/asr/AsrService';
import { AsrResultEvent } from '../speech/asr/types';

import {
  initSpeechDb,
  seedSpeechDbIfEmpty,
  loadAllPhrases,
  SpItem,
  Tvariant,
  toReverse,
  saveVariantsToPhrase,
  saveResult,
  SpItemResult,
  generatePseudoUniqueId,
} from '../db/speechDb';

import { AnchoredOverlay } from './AnchoredOverlay';
import { VariantPicker } from './VariantPicker';
import Toolbar from './Toolbar';
import { Appbar, FAB, Portal, Modal } from 'react-native-paper';
import { AppContext } from '../../App';
import {
  getAppSettingValue,
  loadAppSettingsFromDb,
  saveAppSettingsToDb,
} from '../db/settings';
import { getItemUid, GetLearnTaskUid, LearnTask } from '../helpers/getNextItemUid';
import { buildResultUpdate } from '../helpers/buildResultUpdate';
import { getAsrEngineId } from '../speech/asr/AsrService';
import Svg from 'react-native-svg';
import SvgTest from './SvgTest';
import { SvgButton } from './SvgButton';
import { GradientPanel } from './GradientPanel';
import { addItemToErrorTask } from './TaskEditor';
/**
 * Variant statistics (UI only)
 */
export type VariantStat = {
  text: string;
  count: number;
};

function getTaskItemIndex(
  allItems: SpItem[],
  task: LearnTask,
  isReverse: boolean,
) {
  const itemUid = GetLearnTaskUid(task, isReverse);
  if (!itemUid) {
    return -1;
  }

  return allItems.findIndex(item => item.uid === itemUid);
}




export default function SpeechTrainerPhrase() {
  const ctx = useContext(AppContext);
  const screenSize = useWindowDimensions();
  const isLandscape = screenSize.width > screenSize.height;
  
  // ============================================================
  // Core trainer state
  // ============================================================
  const [items, setItems] = useState<SpItem[]>([]);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phase, setPhase] = useState<'speaking' | 'listening' | 'idle'>('speaking');
  const [ttsInitialized, setTtsInitialized] = useState(false);
  const reverseMode = getAppSettingValue<boolean>('reverseMode');
  const [showCurrentItem, setShowCurrentItem] = useState(false);
  const [openWordCounter, setOpenWordCounter] = useState(0); // Счетчик для принудительного обновления при открытии слова
  const [counterText,setCounterText] = useState("0/0");
  const updateCounterText = (task:LearnTask)=>{
    setCounterText(`${reverseMode?task.indr+1:task.indf+1}/${task.itemUids.length}`);
  };
  
  function syncCurrentTaskItem(nextItems: SpItem[]) {
    const currTask = getItemUid('current');
    updateCounterText(currTask);

    if (nextItems.length === 0) {
      setPhraseIndex(0);
      return;
    }

    const nextIndex = getTaskItemIndex(nextItems, currTask, reverseMode);
    setPhraseIndex(nextIndex >= 0 ? nextIndex : 0);
  }
  
  // ============================================================
  // ASR integration (SINGLE SOURCE)
  // ============================================================
  const [lastAsrResult, setLastAsrResult] = useState<AsrResultEvent | null>(
    null,
  );
  const [variantBuffer, setVariantBuffer] = useState<Map<string, VariantStat>>(
    new Map(),
  );
  // ============================================================
  // Current word (reported by SpeechCompare)
  // ============================================================
  const [currentWord, setCurrentWord] = useState('');
  const [compareSnapshot, setCompareSnapshot] = useState<SpeechCompareSnapshot>({
    asrResult: '',
    matchedWords: [],
    status: '',
  });
  const [listeningStartedAt, setListeningStartedAt] = useState<number | null>(
    null,
  );
  const handlingMatchRef = useRef(false);
  const stoppingAfterErrorRef = useRef(false);
  const compareEngineRef = useRef<SpeechCompareEngine>(new SpeechCompareEngine(''));

  // ============================================================
  // Current phrase
  // ============================================================
  const hasData = items.length > 0;
  const rawItem = hasData ? items[phraseIndex] : null;
  const currentItem = useMemo(() => {
    if (!rawItem) return null;
    return reverseMode ? toReverse(rawItem) : rawItem;
  }, [rawItem, reverseMode]);
  const currentAsrId = getAsrEngineId();
  const currentQuestion = currentItem?.q ?? '';

  const currentAnswer = currentItem?.a ?? '';
  const perAnswerVariants: Tvariant[] = useMemo(
    () => rawItem?.variants ?? [],
    [rawItem?.variants],
  );




  // ============================================================
  // Load DB
  // ============================================================
  useEffect(() => {
    async function load() {
      console.log('📦 Loading phrases from SQLite...');

      await initSpeechDb();
      await seedSpeechDbIfEmpty();
      await loadAppSettingsFromDb().catch(err => {
        console.warn('Failed to load app settings', err);
      });

      const data = await loadAllPhrases();
      if (data.length === 0) {
        setItems(data);
        setPhraseIndex(0);
        return;
      }

      setItems(data);
      syncCurrentTaskItem(data);

    }

    load();
  }, []);

  useEffect(() => {
    if (ctx?.currPage !== 'main' || items.length === 0) {
      return;
    }

    syncCurrentTaskItem(items);
  }, [ctx?.currPage, items, reverseMode]);

  // ============================================================
  // TTS ready
  // ============================================================
  useEffect(() => {
    const sub = TtsService.waitReady().then(() => {
      console.log('✅ TTS Ready');
      setTtsInitialized(true);
    });

    return () => {
      // no-op
    };
  }, []);

  // ============================================================
  // ASR subscription (THE ONLY ONE)
  // ============================================================
  useEffect(() => {
    return AsrService.subscribeResults(evt => {
      if (evt.isError) {
        if (!stoppingAfterErrorRef.current) {
          stoppingAfterErrorRef.current = true;
          AsrService.stopSession()
            .catch(err => {
              console.warn('Failed to stop ASR session after error', err);
            })
            .finally(() => {
              stoppingAfterErrorRef.current = false;
            });
        }
        setPhase('idle');
        setListeningStartedAt(null);
        return;
      }

      if (phase !== 'listening') {
        return;
      }

      setLastAsrResult(evt);

      // Collect partials into variant buffer
      if (evt.type === 'partial' && phase === 'listening') {
        const norm = normalizeText(evt.text);
        if (!norm) return;

        setVariantBuffer(prev => {
          const next = new Map(prev);
          const v = next.get(norm);

          next.set(norm, {
            text: norm,
            count: v ? v.count + 1 : 1,
          });

          return next;
        });
      }
    });
  }, [phase]);

  // ============================================================
  // Reset variant buffer on new phrase
  // ============================================================
  useEffect(() => {
    setVariantBuffer(new Map());
    setLastAsrResult(null);

    compareEngineRef.current.reset(currentAnswer);
    setCompareSnapshot(compareEngineRef.current.getSnapshot());
    setCurrentWord(compareEngineRef.current.getCurrentWord());
  }, [phraseIndex]);

  useEffect(() => {
    compareEngineRef.current.reset(currentAnswer);
    setCompareSnapshot(compareEngineRef.current.getSnapshot());
    setCurrentWord(compareEngineRef.current.getCurrentWord());
  }, [currentAnswer]);

  useEffect(() => {
    const matched = compareEngineRef.current.process(
      lastAsrResult?.text ?? null,
      perAnswerVariants,
      reverseMode
    );

    setCompareSnapshot(compareEngineRef.current.getSnapshot());
    setCurrentWord(compareEngineRef.current.getCurrentWord());

    if (matched) {
      handleMatched();
    }
  }, [lastAsrResult, perAnswerVariants, openWordCounter]);

  // ============================================================
  // Trainer loop
  // ============================================================
  useEffect(() => {
    if (!ttsInitialized) return;
    if (!hasData) return;

    let cancelled = false;
    const timerId = setTimeout(runStep, 300);

    async function runStep() {
      if (cancelled) return;
      try {
        setPhase('speaking');
        await speakAndListen(currentQuestion, getAsrEngineId());
        if (cancelled) {
          setPhase('idle');
          return;
        }
        setListeningStartedAt(Date.now());
        setPhase('listening');
      } catch (e) {
        console.warn('Failed to run speak/listen step', e);
        setListeningStartedAt(null);
        setPhase('idle');
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [phraseIndex, ttsInitialized, hasData, currentQuestion]);



  // ============================================================
  // Variant UI helpers
  // ============================================================
  const savedVariantsForCurrentWord: string[] = useMemo(() => {
    if (!currentWord) return [];
    if (!perAnswerVariants || perAnswerVariants.length === 0) {
      return [];
    }
    const entry = perAnswerVariants.find(v => v.word === currentWord);

    return entry?.variants ?? [];
  }, [perAnswerVariants, currentWord]);

  // ============================================================
  // Phrase matched callback
  // ============================================================
  async function handleMatched(resetStreakOnError: boolean = false) {
    if (!rawItem || phase !== 'listening' || handlingMatchRef.current) return;
    handlingMatchRef.current = true;

    try {
      setPhase('speaking');

      const { patch, resultToPersist } = buildResultUpdate(
        rawItem,
        currentAnswer,
        listeningStartedAt,
        reverseMode,
        resetStreakOnError
      );

      await saveResult(rawItem, resultToPersist);

      const updatedItems = items.map(it =>
        it.uid === rawItem.uid ? { ...it, ...patch } : it,
      );

      setItems(updatedItems);
      if (!resetStreakOnError) {
        console.log('✅ Phrase complete!');
        const id = await TtsService.speak('Correct!');
        await TtsService.waitFinish(id);
      } else {
        addItemToErrorTask(rawItem);
      }

      const historyLimit = Math.max(
        3,
        Math.min(8, Math.floor(updatedItems.length / 2)),
      );
      // const nextIndex = pickNextPhraseIndex(
      //   updatedItems,
      //   rawItem.uid,
      //   reverseMode,
      // );

      setListeningStartedAt(null);
      const currTask = getItemUid('next');
      await saveAppSettingsToDb().catch(err => {
        console.warn('Failed to persist task progress', err);
      });
      updateCounterText(currTask);
      const nextIndex = getTaskItemIndex(updatedItems, currTask, reverseMode);
      if (nextIndex < 0) {
        setPhase('idle');
        return;
      }

      setPhraseIndex(nextIndex);

    } finally {
      handlingMatchRef.current = false;
    }
  }

  async function handleSaveVariants(selected: string[]) {
    if (!rawItem || !currentWord) return;

    const prev = rawItem.variants ?? [];
    let updated: Tvariant[];

    const existing = prev.find(v => v.word === currentWord);

    if (existing) {
      updated = prev.map(v =>
        v.word === currentWord
          ? {
            ...v,
            variants: Array.from(new Set([...v.variants, ...selected])),
          }
          : v,
      );
    } else {
      updated = [...prev, { word: currentWord, variants: selected }];
    }

    // 1️⃣ DB
    await saveVariantsToPhrase(rawItem.uid, updated);

    // 2️⃣ React state (немедленно)
    setItems(prevItems =>
      prevItems.map(it =>
        it.uid === rawItem.uid ? { ...it, variants: updated } : it,
      ),
    );
  }

  const variantStatsFromASR: VariantStat[] = useMemo(() => {
    return Array.from(variantBuffer.values())
      .filter(v => v.count >= 2)
      .sort((a, b) => b.count - a.count);
  }, [variantBuffer]);

  const showVariantButton =
    savedVariantsForCurrentWord.length > 0 || variantStatsFromASR.length > 0;

  async function handleStartListeningPress() {
    if (phase !== 'idle') {
      return;
    }

    try {
      setPhase('listening');
      await AsrService.stopSession();
      await AsrService.startSession({ engineId: getAsrEngineId() });
      setListeningStartedAt(Date.now());
    } catch (e) {
      setPhase('idle');
      console.warn('Failed to start ASR session manually', e);
    }
  }

  async function handleNextPhrasePress() {
    if (!hasData) return;

    if (!rawItem) {
      return;
    }

    // const historyLimit = Math.max(3, Math.min(8, Math.floor(items.length / 2)));
    // const nextIndex = pickNextPhraseIndex(
    //   items,
    //   rawItem.uid,
    //   reverseMode,
    // );
    const currTask = getItemUid('next');
    await saveAppSettingsToDb().catch(err => {
      console.warn('Failed to persist task progress', err);
    });
    updateCounterText(currTask);
    const nextIndex = getTaskItemIndex(items, currTask, reverseMode);
    if (nextIndex < 0) {
      setListeningStartedAt(null);
      setPhase('idle');
      return;
    }

    setListeningStartedAt(null);
    setPhraseIndex(nextIndex);
  }
  const openWordDisabled = phase !== 'listening';
  const styles = isLandscape ? lStyles : pStyles;
  const openWordStyle = openWordDisabled ? { opacity: 0.5 } : {};
  const matchedText = compareSnapshot.matchedWords.join(' ');
  const matchedTextDlm = matchedText ? "  " : "";
  // ============================================================
  // Render
  // ============================================================
  return (
    <View style={[styles.root, { width: screenSize.width }]}>
      {!hasData && <Text>Loading phrases...</Text>}

      {hasData && (
        <>
          <Toolbar>
            {(savedVariantsForCurrentWord.length > 0 ||
              variantStatsFromASR.length > 0) && (

                <AnchoredOverlay
                  anchor={({ onPress }) => (
                    <Appbar.Action icon="list-status" onPress={onPress} />
                  )}>
                  {({ close }) => (
                    <VariantPicker
                      variantsFromDatabase={savedVariantsForCurrentWord}
                      variantsFromASR={variantStatsFromASR}
                      currentWord={currentWord}
                      onCancel={close}
                      onSave={selected => {
                        handleSaveVariants(selected);
                        close();
                      }}
                    />
                  )}
                </AnchoredOverlay>
              )}
          </Toolbar>
          {/* Всплывающее окно с подсказкой */}
          <Portal>
            <Modal visible={showCurrentItem} onDismiss={() => setShowCurrentItem(false)} contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}>
              <LinearGradient
                style={[fieldStylesCommon.modalDetailsOfItem, { width: screenSize.width * 0.9 }]}
                colors={['rgba(20,30,48,1)', 'rgba(36,59,85,0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}>
                <View style={{ width: screenSize.width * 0.9, padding: 20 }}>
                  <Text style={[pFieldstyles.fieldCaption, fieldStylesCommon.fldCaptionColor]}>Current question:</Text>
                  <Text style={pFieldstyles.fieldValue}>{currentQuestion}</Text>
                  <Text style={[pFieldstyles.fieldCaption, fieldStylesCommon.fldCaptionColor, { marginTop: 20 }]}>Current answer:</Text>
                  <Text style={pFieldstyles.fieldValue}>{currentAnswer}</Text>
                </View>
              </LinearGradient>
            </Modal>
          </Portal>
          <View style={styles.questionSection}>
            <GradientPanel label="Current question:" mainText={currentQuestion} counterText={counterText}

            onPress={() => { setShowCurrentItem(true); }} />
          </View>
        </>
      )}
      <View style={styles.asrResultSection}>
        <GradientPanel label="Current ASR result:"
          mainText={matchedText}
          suffixText={compareSnapshot.asrResult}
          statusText={compareSnapshot.status}
          onPress={async () => { 
            if(currentItem){
              await speakAndListen(currentItem?.a, getAsrEngineId());
            }
          }}
          />
      </View>
      <View style={styles.buttonSection}>
        {phase === 'idle' && (
          <View style={styles.manualStartButton}>
            <FAB
              icon="microphone"
              size="large"
              onPress={handleStartListeningPress}
            />
          </View>
        )}
        <SvgButton title="Skip Phrase" iconId='skipPhrase' onPress={() => {
          handleNextPhrasePress().catch(err => {
            console.warn('Failed to skip phrase', err);
          });
        }} width={isLandscape ? 120 : 150} />
        <SvgButton title="Can't Remember" iconId='cantRemember' onPress={() => { handleMatched(true); }} width={isLandscape ? 120 : 150} />
        <SvgButton title="Open Word" iconId='openWord' onPress={() => {
          if (!currentWord) return;
          setLastAsrResult({
            engine: currentAsrId,
            type: 'final',
            text: currentWord,
          });
          setOpenWordCounter(prev => prev + 1); // Увеличиваем счетчик при открытии слова
        }} width={isLandscape ? 120 : 150} />
        <SvgButton title="Say Word" iconId='sayWord' onPress={async () => {
          await speakAndListen(currentWord, getAsrEngineId());
        }} width={isLandscape ? 120 : 150} />
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const fieldStylesCommon = StyleSheet.create({
  modalDetailsOfItem: {
    borderRadius: 18,
    overflow: 'hidden',

    // glass / modern look
    borderWidth: 2,
    minHeight: 300,
    borderColor: "gray",

    marginTop: 15,
    marginLeft: 15,
    marginRight: 15,
  },
  fldCaptionColor: {
    color: '#9AA3B2',
  },
});

const pStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  questionSection: {
    flex: 40,
  },
  asrResultSection: {
    flex: 40,
  },
  buttonSection: {
    flex: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10
  },
  manualStartButton: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -28,
    zIndex: 2,
  },
});

const lStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  questionSection: {
    flex: 50,
    width: "85%",
  },
  asrResultSection: {
    flex: 50,
    width: "85%",
  },
  buttonSection: {
    flex: 1,
    position: "absolute",
    top: 60,
    right: 25,
    width: 100,
    gap: 10,
  },
  manualStartButton: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -28,
    zIndex: 2,
  },
});

const pFieldstyles = StyleSheet.create({
  fieldCaption: {
    fontSize: 13,
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  fieldValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E6F1FF',
    lineHeight: 24,
  },
});



// data={[
//   { bottomLabel: "01", value: 10 },
//   { bottomLabel: "02", value: 15 },
//   { bottomLabel: "03", value: 20 },
//   { bottomLabel: "04", value: 88 },
//   { bottomLabel: "05", value: 60 },
//   { bottomLabel: "06", value: 45 },
//   { bottomLabel: "07", value: 72 },
//   { bottomLabel: "08", value: 30 },
//   { bottomLabel: "09", value: 88 },
//   { bottomLabel: "10", value: 60 },
//   isLandscape?"Feb 26":"Feb 2026",
//   { bottomLabel: "11", value: 60 },
//   { bottomLabel: "12", value: 45 },
//   { bottomLabel: "13", value: 72 },
//   { bottomLabel: "14", value: 30 },
//   { bottomLabel: "15", value: 88 },
//   { bottomLabel: "16", value: 10 },
//   { bottomLabel: "17", value: 15 },
//   { bottomLabel: "18", value: 20 },
//   { bottomLabel: "19", value: 88 },
//   { bottomLabel: "20", value: 60 },
//   { bottomLabel: "21", value: 45 },
//   { bottomLabel: "22", value: 72 },
//   { bottomLabel: "23", value: 30 },
//   { bottomLabel: "24", value: 88 },
//   { bottomLabel: "25", value: 60 },
//   { bottomLabel: "26", value: 60 },
//   { bottomLabel: "27", value: 45 },
//   { bottomLabel: "28", value: 72 },
//   { bottomLabel: "29", value: 30 },
//   { bottomLabel: "30", value: 88 }

// ]}

