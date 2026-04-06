import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Appbar} from 'react-native-paper';
import Toolbar from './Toolbar';
import {BarChart, TBarChartDataItem} from './BarChart';
import {getDataForBarDiagram} from '../helpers/statistics';
import {
  SpItem,
  initSpeechDb,
  loadAllPhrases,
  seedSpeechDbIfEmpty,
  toReverse,
} from '../db/speechDb';
import {
  getAppSettingValue,
  getSelectedTaskTopics,
  loadAppSettingsFromDb,
} from '../db/settings';
import {getNextItemUid} from '../helpers/getNextItemUid';
import {useScreenScale} from '../helpers/screen';

export function Score() {
  const {isLandscape, sch, scw} = useScreenScale();
  const [hasData, setHasData] = useState(false);
  const [currentItem, setCurrentItem] = useState<SpItem | null>(null);
  const [barDiagramItems, setBarDiagramItems] = useState<TBarChartDataItem[]>([]);

  useEffect(() => {
    async function loadScoreScreen() {
      await initSpeechDb();
      await seedSpeechDbIfEmpty();
      await loadAppSettingsFromDb();

      const reverseMode = getAppSettingValue<boolean>('reverseMode');
      const selectedTopics = getSelectedTaskTopics();
      const data = (await loadAllPhrases()).filter(item => {
        if (!item.topic) {
          return false;
        }

        if (selectedTopics.length > 0) {
          return selectedTopics.includes(item.topic);
        }

        return true;
      });

      if (data.length === 0) {
        setCurrentItem(null);
        setBarDiagramItems([]);
        setHasData(true);
        return;
      }

      const nextItemUid = getNextItemUid(data, reverseMode, '');
      const initialIndex = nextItemUid
        ? data.findIndex(item => item.uid === nextItemUid)
        : 0;
      const rawItem = data[Math.max(initialIndex, 0)];
      const itemForChart = reverseMode ? toReverse(rawItem) : rawItem;

      setCurrentItem(itemForChart);
      const diagramItems = await getDataForBarDiagram(reverseMode, itemForChart);
      setBarDiagramItems(diagramItems);
      setHasData(true);
    }

    loadScoreScreen().catch(err => {
      console.warn('Failed to load score screen', err);
      setHasData(true);
    });
  }, []);

  async function refreshDiagram(item?: SpItem | null) {
    const reverseMode = getAppSettingValue<boolean>('reverseMode');
    const diagramItems = await getDataForBarDiagram(reverseMode, item ?? undefined);
    setBarDiagramItems(diagramItems);
  }

  return (
    <View style={styles.root}>
      <Toolbar>
        <Appbar.Action icon="chart-bar" disabled />
      </Toolbar>

      {!hasData && <Text style={styles.statusText}>Loading score...</Text>}

      {hasData && (
        <View style={styles.content}>
          <BarChart
            title={isLandscape ? '' : 'Memory Strength Score'}
            width={scw(100)}
            height={sch(isLandscape ? 72 : 70)}
            colorStep={25}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444']}
            data={barDiagramItems}
            valueFormat="99.99"
            onGroupingsChanged={() => refreshDiagram(currentItem)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  statusText: {
    padding: 20,
  },
});
