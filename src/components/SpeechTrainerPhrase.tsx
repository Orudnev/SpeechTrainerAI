import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Image,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { normalizeText, SpeechCompareEngine, SpeechCompareSnapshot } from './SpeechCompare';
import { speakAndListen } from '../speech/flow/speechOrchestrator';
import { TtsService } from '../speech/tts/TtsService';
import { AsrService } from '../speech/asr/AsrService';
import { AsrEngineId, AsrResultEvent } from '../speech/asr/types';

import {
  initSpeechDb,
  seedSpeechDbIfEmpty,
  loadAllPhrases,
  SpItem,
  Tvariant,
  toReverse,
  saveVariantsToPhrase,
  saveResultToPhrase,
  SpItemResult,
  generatePseudoUniqueId,
} from '../db/speechDb';

import { AnchoredOverlay } from './AnchoredOverlay';
import { VariantPicker } from './VariantPicker';
import Toolbar from './Toolbar';
import { Appbar, FAB, Portal, Modal } from 'react-native-paper';
import { AppContext } from '../../App';
import { AppSettings, getAppSettingValue } from '../db/settings';
import { getNextItemUid } from '../helpers/getNextItemUid';
import { buildResultUpdate } from '../helpers/buildResultUpdate';

/**
 * Variant statistics (UI only)
 */
export type VariantStat = {
  text: string;
  count: number;
};




export default function SpeechTrainerPhrase() {
  const ctx = useContext(AppContext);
  const screenSize = useWindowDimensions();
  const scw = (scwUnits: number) => (screenSize.width / 100) * scwUnits;
  const sch = (scwUnits: number) => (screenSize.height / 100) * scwUnits;

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


  function getAsrEngineId(): AsrEngineId {
    if (getAppSettingValue<string>('asrModelType') === 'vosk') {
      if (getAppSettingValue<boolean>('reverseMode')) {
        return 'vosk-ru';
      } else {
        return 'vosk-en';
      }
    } else {
      if (getAppSettingValue<boolean>('reverseMode')) {
        return 'android-ru';
      } else {
        return 'android-en';
      }
    }
  }

  // ============================================================
  // Load DB
  // ============================================================
  useEffect(() => {
    async function load() {
      console.log('📦 Loading phrases from SQLite...');

      await initSpeechDb();
      await seedSpeechDbIfEmpty();
      const data = (await loadAllPhrases()).filter(item => {
        if (!item.topic) {
          return false;
        }
        const selectedTopics = getAppSettingValue<string[]>('selectedTopics');
        let result = selectedTopics.includes(item.topic);
        return result;
      });

      if (data.length === 0) {
        setItems(data);
        setPhraseIndex(0);
        return;
      }

      const nextItemUid = getNextItemUid(data, reverseMode, "");
      const initialIndex = data.findIndex(itm => itm.uid == nextItemUid);

      setItems(data);
      setPhraseIndex(initialIndex);
    }

    load();
  }, []);

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

      await saveResultToPhrase(rawItem.uid, resultToPersist);

      const updatedItems = items.map(it =>
        it.uid === rawItem.uid ? { ...it, ...patch } : it,
      );

      setItems(updatedItems);
      if (!resetStreakOnError) {
          console.log('✅ Phrase complete!');      
          const id = await TtsService.speak('Correct!');
          await TtsService.waitFinish(id);
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

      const nextItemUid = getNextItemUid(updatedItems, reverseMode, rawItem.uid);
      const nextIndex = updatedItems.findIndex(itm => itm.uid == nextItemUid);

      setListeningStartedAt(null);
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

  function handleNextPhrasePress() {
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
    const nextItemUid = getNextItemUid(items, reverseMode, rawItem.uid);
    const nextIndex = items.findIndex(itm => itm.uid == nextItemUid);


    setListeningStartedAt(null);
    setPhraseIndex(nextIndex);
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <View style={[styles.root, { width: screenSize.width }]}>
      {!hasData && <Text>Loading phrases...</Text>}

      {hasData && (
        <>
          <Toolbar>
            <Appbar.Action
              icon="eye-outline"
              onPress={() => { setShowCurrentItem(true); }}
            />
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
            <Appbar.Action
              icon="cog-outline"
              onPress={() => {
                ctx?.setCurrPage('settings');
              }}
            />
          </Toolbar>
          <Portal>
            <Modal visible={showCurrentItem} onDismiss={() => setShowCurrentItem(false)} contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}>
              <LinearGradient
                style={[Fieldstyles.modalDetailsOfItem, { width: screenSize.width * 0.9 }]}
                colors={['rgba(20,30,48,1)', 'rgba(36,59,85,0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}>
                <View style={{ width: screenSize.width * 0.9, padding: 20 }}>
                  <Text style={Fieldstyles.fieldCaption}>Current question:</Text>
                  <Text style={Fieldstyles.fieldValue}>{currentQuestion}</Text>
                  <Text style={[Fieldstyles.fieldCaption, { marginTop: 20 }]}>Current answer:</Text>
                  <Text style={Fieldstyles.fieldValue}>{currentAnswer}</Text>
                </View>
              </LinearGradient>
            </Modal>
          </Portal>
          <View style={styles.questionSection}>
            <LinearGradient
              style={[Fieldstyles.fieldCard, { height: 200 }]}
              colors={['rgba(20,30,48,1)', 'rgba(36,59,85,0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}>
              <View style={Fieldstyles.fieldCardInner}>
                <Text style={Fieldstyles.fieldCaption}>Current question:</Text>
                <Text style={Fieldstyles.fieldValue}>{currentQuestion}</Text>
              </View>
            </LinearGradient>
          </View>
        </>
      )}

      <View style={styles.asrResultSection}>
        <View>
          <LinearGradient
            style={Fieldstyles.fieldCard}
            colors={['rgba(20,30,48,1)', 'rgba(36,59,85,0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}>
            <View style={Fieldstyles.fieldCardInner}>
              <Text style={Fieldstyles.fieldCaption}>Current ASR result:</Text>
              <Text style={Fieldstyles.fieldValue}>{compareSnapshot.asrResult}</Text>
            </View>
          </LinearGradient>
          <LinearGradient
            style={[Fieldstyles.fieldCard, { height: 200 }]}
            colors={['rgba(20,30,48,1)', 'rgba(36,59,85,0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}>
            <View style={Fieldstyles.fieldCardInner}>
              <Text style={Fieldstyles.fieldCaption}>Matched:</Text>
              <Text style={Fieldstyles.fieldValue}>{compareSnapshot.matchedWords.join(' ')}</Text>
            </View>
            {compareSnapshot.status.length > 0 && (
              <Text style={styles.compareStatus}>{compareSnapshot.status}</Text>
            )}
          </LinearGradient>
        </View>
      </View>
      <View style={styles.bottomSection}>
        {phase == 'listening' && (
          <TouchableOpacity
            onPress={() => {
              if (!currentWord) return;
              setLastAsrResult({
                engine: currentAsrId,
                type: 'final',
                text: currentWord,
              });
              setOpenWordCounter(prev => prev + 1); // Увеличиваем счетчик при открытии слова
            }}
            style={{ position: 'absolute', top: -40, left: 20 }}>
            <Image
              style={{ width: 150 }}
              source={require('../assets/openword.png')}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}

        {phase === 'idle' && (
          <View style={styles.manualStartButton}>
            <FAB
              icon="microphone"
              size="large"
              onPress={handleStartListeningPress}
            />
          </View>
        )}

        <TouchableOpacity
          onPress={handleNextPhrasePress}
          style={{ position: 'absolute', top: -40, right: 20 }}>
          <Image
            style={{ width: 150 }}
            source={require('../assets/skipphrase.png')}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            handleMatched(true)
          }}
          style={{ position: 'absolute', top: 40, right: 20 }}>
          <Image
            style={{ width: 150 }}
            source={require('../assets/cannotremember.png')}
            resizeMode="contain"
          />
        </TouchableOpacity>

      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
export const Fieldstyles = StyleSheet.create({
  modalDetailsOfItem: {
    borderRadius: 18,
    overflow: 'hidden',

    // glass / modern look
    borderWidth: 2,
    minHeight: 300,
    borderColor: "gray",

    // тень (Android + iOS)
    elevation: 8,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    marginTop: 15,
    marginLeft: 15,
    marginRight: 15,
  },
  fieldCard: {
    borderRadius: 18,
    overflow: 'hidden',

    // glass / modern look
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.08)',

    // тень (Android + iOS)
    elevation: 8,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    marginTop: 15,
    marginLeft: 15,
    marginRight: 15,
  },

  fieldCardInner: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  fieldCaption: {
    fontSize: 13,
    color: '#9AA3B2',
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  questionSection: {
    flex: 3,
  },
  asrResultSection: {
    flex: 5,
  },
  bottomSection: {
    flex: 2,
  },
  manualStartButton: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -28,
    zIndex: 2,
  },
  compareStatus: {
    marginLeft: 17,
    color: '#06a81c',
    fontSize: 18,
    fontWeight: '800',
  },
  currentWord: {
    marginTop: 10,
    fontWeight: '800',
    fontSize: 16,
  },
  phase: {
    fontSize: 16,
    marginTop: 10,
    marginBottom: 10,
    fontWeight: '600',
  },
});
