import React, {useEffect, useState, useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import Toolbar from './Toolbar';
import {Appbar, Button, Chip, Switch, TextInput} from 'react-native-paper';
import {AppContext} from '../../App';
import {
  getAppSettingValue,
  getArraySettingValue,
  loadAppSettingsFromDb,
  saveAppSettingsToDb,
  setAppSettingValue,
  setArraySettingItem,
} from '../db/settings';
import {initSpeechDb, openSpeechDb} from '../db/speechDb';

export function Settings() {
  const screenSize = useWindowDimensions();
  const ctx = useContext(AppContext);

  const [hasData, setHasData] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [, setSettingsVersion] = useState(0);

  useEffect(() => {
    async function load() {
      await loadAppSettingsFromDb();

      await initSpeechDb();
      const db = await openSpeechDb();
      const res = await db.executeSql(
        `SELECT DISTINCT topic FROM phrases ORDER BY topic;`,
      );

      const dbTopics: string[] = [];
      for (let i = 0; i < res[0].rows.length; i++) {
        const row = res[0].rows.item(i);
        if (typeof row.topic === 'string' && row.topic.trim()) {
          dbTopics.push(row.topic);
        }
      }

      setTopics(dbTopics);
      setHasData(true);
      setSettingsVersion(prev => prev + 1);
    }

    load();
  }, []);

  const reverseMode = getAppSettingValue<boolean>('reverseMode');
  const fullAccess = getAppSettingValue<boolean>('fullAccess');
  const rowsCloudDataSource = getAppSettingValue<string>('rowsCloudDataSource');
  const selectedTopicsSet = new Set(
    getArraySettingValue<string>('selectedTopics'),
  );

  function toggleTopic(topic: string) {
    setArraySettingItem('selectedTopics', topic, !selectedTopicsSet.has(topic));
    setSettingsVersion(prev => prev + 1);
  }

  async function persistSettingsAndExit() {
    await saveAppSettingsToDb();
    ctx?.setCurrPage('main');
  }

  return (
    <View style={[styles.settingsRoot, {width: screenSize.width}]}>
      {!hasData && <Text>Loading settings...</Text>}

      {hasData && (
        <>
          <Toolbar>
            <Appbar.Action
              icon="location-exit"
              onPress={() => {
                persistSettingsAndExit().catch(err => {
                  console.warn('Failed to save app settings', err);
                });
              }}
            />
          </Toolbar>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>reverseMode</Text>
              <Switch
                value={reverseMode}
                onValueChange={value => {
                  setAppSettingValue('reverseMode', value);
                  setSettingsVersion(prev => prev + 1);
                }}
              />
            </View>

            <Text style={styles.sectionTitle}>selectedTopics</Text>
            <View style={styles.chipWrap}>
              {topics.map(topic => (
                <Chip
                  key={topic}
                  selected={selectedTopicsSet.has(topic)}
                  onPress={() => toggleTopic(topic)}
                  style={styles.topicChip}>
                  {topic}
                </Chip>
              ))}
            </View>

            {fullAccess && (
              <>
                <Text style={styles.sectionTitle}>rowsCloudDataSource</Text>
                <TextInput
                  mode="outlined"
                  value={rowsCloudDataSource}
                  onChangeText={text => {
                    setAppSettingValue('rowsCloudDataSource', text);
                    setSettingsVersion(prev => prev + 1);
                  }}
                  placeholder="https://example.com/source.json"
                />

                <View style={styles.actionsRow}>
                  <Button mode="contained" onPress={() => {}}>
                    downloadRowsFromCloud
                  </Button>
                  <Button mode="contained-tonal" onPress={() => {}}>
                    uploadRowsToCloud
                  </Button>
                </View>
              </>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

// ============================================================
const styles = StyleSheet.create({
  settingsRoot: {
    flex: 1,
  },
  content: {
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 20,
    gap: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  actionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
});
