import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TOOLS, Tool } from '../tools';
import type { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// ── Checklist data ─────────────────────────────────────────────────────────────
type CheckItem = { id: string; label: string; emoji: string };
type CheckCategory = { title: string; color: string; items: CheckItem[] };

const CHECKLIST: CheckCategory[] = [
  {
    title: 'Swim',
    color: '#2563eb',
    items: [
      { id: 'wetsuit',   label: 'Wetsuit',          emoji: '🏊' },
      { id: 'goggles',   label: 'Goggles',           emoji: '🥽' },
      { id: 'swim-cap',  label: 'Swim cap',          emoji: '🧢' },
      { id: 'body-glide',label: 'Body Glide / lube', emoji: '🧴' },
      { id: 'earplugs',  label: 'Earplugs',          emoji: '🔇' },
    ],
  },
  {
    title: 'Bike',
    color: '#16a34a',
    items: [
      { id: 'bike',        label: 'Bike',             emoji: '🚴' },
      { id: 'helmet',      label: 'Helmet',           emoji: '⛑️' },
      { id: 'bike-shoes',  label: 'Bike shoes',       emoji: '👟' },
      { id: 'bike-kit',    label: 'Bike kit / jersey',emoji: '👕' },
      { id: 'sunglasses',  label: 'Sunglasses',       emoji: '🕶️' },
      { id: 'garmin',      label: 'GPS / computer',   emoji: '⌚' },
      { id: 'co2',         label: 'CO₂ / pump + tube',emoji: '💨' },
      { id: 'nutrition-b', label: 'Nutrition on bike', emoji: '🍌' },
      { id: 'bike-bottle', label: 'Water bottles',    emoji: '💧' },
    ],
  },
  {
    title: 'Run',
    color: '#ea580c',
    items: [
      { id: 'run-shoes',  label: 'Run shoes',         emoji: '👟' },
      { id: 'race-belt',  label: 'Race number belt',  emoji: '🎽' },
      { id: 'hat-run',    label: 'Hat / visor',       emoji: '🧢' },
      { id: 'nutrition-r',label: 'Nutrition / gels',  emoji: '⚡' },
    ],
  },
  {
    title: 'Transition',
    color: '#7c3aed',
    items: [
      { id: 't-bag',      label: 'Transition bag',    emoji: '🎒' },
      { id: 'towel',      label: 'Towel',             emoji: '🧺' },
      { id: 'socks',      label: 'Socks',             emoji: '🧦' },
      { id: 'sunscreen',  label: 'Sunscreen',         emoji: '🌞' },
      { id: 'lock',       label: 'Bike lock (travel)',emoji: '🔒' },
      { id: 'pump',       label: 'Floor pump',        emoji: '🔧' },
    ],
  },
  {
    title: 'Race Day',
    color: '#0891b2',
    items: [
      { id: 'race-num',   label: 'Race number',       emoji: '📋' },
      { id: 'timing-chip',label: 'Timing chip',       emoji: '📡' },
      { id: 'id',         label: 'ID / passport',     emoji: '🪪' },
      { id: 'cash',       label: 'Cash / card',       emoji: '💳' },
      { id: 'pre-race',   label: 'Pre-race breakfast',emoji: '🥐' },
      { id: 'phone',      label: 'Phone + charger',   emoji: '📱' },
    ],
  },
];

const BUILT_IN_IDS = CHECKLIST.flatMap(c => c.items.map(i => i.id));
const STORAGE_CUSTOM   = 'checklist_custom_v1';
const STORAGE_CHECKED  = 'checklist_checked_v1';
const STORAGE_HIDDEN   = 'checklist_hidden_v1';

type CustomItem = { id: string; label: string };

// ── Checklist component ────────────────────────────────────────────────────────
function RaceChecklist() {
  const [checked, setChecked]           = useState<Set<string>>(new Set());
  const [expanded, setExpanded]         = useState(false);
  const [editMode, setEditMode]         = useState(false);
  const [customItems, setCustomItems]   = useState<CustomItem[]>([]);
  const [hiddenDefaults, setHiddenDefaults] = useState<Set<string>>(new Set());
  const [inputText, setInputText]       = useState('');
  const [showInput, setShowInput]       = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_CUSTOM, STORAGE_CHECKED, STORAGE_HIDDEN]).then(pairs => {
      if (pairs[0][1]) setCustomItems(JSON.parse(pairs[0][1]));
      if (pairs[1][1]) setChecked(new Set(JSON.parse(pairs[1][1])));
      if (pairs[2][1]) setHiddenDefaults(new Set(JSON.parse(pairs[2][1])));
    });
  }, []);

  function persistChecked(next: Set<string>) {
    AsyncStorage.setItem(STORAGE_CHECKED, JSON.stringify([...next]));
  }
  function persistCustom(items: CustomItem[]) {
    AsyncStorage.setItem(STORAGE_CUSTOM, JSON.stringify(items));
  }
  function persistHidden(next: Set<string>) {
    AsyncStorage.setItem(STORAGE_HIDDEN, JSON.stringify([...next]));
  }

  function toggle(id: string) {
    if (editMode) return;
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistChecked(next);
      return next;
    });
  }

  function resetAll() {
    const next = new Set<string>();
    setChecked(next);
    persistChecked(next);
  }

  function restoreDefaults() {
    const next = new Set<string>();
    setHiddenDefaults(next);
    persistHidden(next);
  }

  function toggleHideDefault(id: string) {
    setHiddenDefaults(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // also uncheck when hiding
        setChecked(c => {
          const s = new Set(c);
          s.delete(id);
          persistChecked(s);
          return s;
        });
      }
      persistHidden(next);
      return next;
    });
  }

  function addItem() {
    const label = inputText.trim();
    if (!label) return;
    const item: CustomItem = { id: `custom-${Date.now()}`, label };
    const next = [...customItems, item];
    setCustomItems(next);
    persistCustom(next);
    setInputText('');
    setShowInput(false);
    Keyboard.dismiss();
  }

  function deleteCustomItem(id: string) {
    const next = customItems.filter(i => i.id !== id);
    setCustomItems(next);
    persistCustom(next);
    setChecked(prev => {
      const s = new Set(prev);
      s.delete(id);
      persistChecked(s);
      return s;
    });
  }

  const visibleBuiltInIds = BUILT_IN_IDS.filter(id => !hiddenDefaults.has(id));
  const allVisibleIds = [...visibleBuiltInIds, ...customItems.map(i => i.id)];
  const total = allVisibleIds.length;
  const done  = [...checked].filter(id => allVisibleIds.includes(id)).length;
  const pct   = total === 0 ? 0 : done / total;

  function toggleEditMode() {
    setEditMode(e => !e);
    if (showInput) { setShowInput(false); Keyboard.dismiss(); }
  }

  return (
    <View style={cl.section}>
      {/* Header row */}
      <TouchableOpacity style={cl.headerRow} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={cl.sectionTitle}>Race Day Checklist</Text>
          <Text style={cl.progress}>{done} / {total} packed</Text>
        </View>
        <View style={cl.headerRight}>
          {expanded && (
            <TouchableOpacity
              style={[cl.editBtn, editMode && cl.editBtnActive]}
              onPress={toggleEditMode}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[cl.editBtnText, editMode && cl.editBtnTextActive]}>
                {editMode ? 'Done' : 'Edit'}
              </Text>
            </TouchableOpacity>
          )}
          {!editMode && done > 0 && (
            <TouchableOpacity style={cl.resetBtn} onPress={resetAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={cl.resetText}>Reset</Text>
            </TouchableOpacity>
          )}
          <Text style={cl.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Progress bar */}
      <View style={cl.barBg}>
        <View style={[cl.barFill, { width: `${pct * 100}%` as any, backgroundColor: pct === 1 ? '#22c55e' : '#3b82f6' }]} />
      </View>

      {expanded && (
        <View style={{ marginTop: 12 }}>
          {/* Built-in categories */}
          {CHECKLIST.map(cat => {
            const visibleItems = cat.items.filter(item => !hiddenDefaults.has(item.id));
            if (visibleItems.length === 0 && !editMode) return null;
            return (
              <View key={cat.title} style={{ marginBottom: 12 }}>
                <Text style={[cl.catTitle, { color: cat.color }]}>{cat.title}</Text>
                <View style={cl.itemGrid}>
                  {(editMode ? cat.items : visibleItems).map(item => {
                    const isChecked = checked.has(item.id);
                    const isHidden  = hiddenDefaults.has(item.id);
                    return (
                      <View key={item.id} style={[cl.chip, cl.customChip, !editMode && isChecked && cl.chipChecked, editMode && cl.chipEditMode, isHidden && cl.chipHidden]}>
                        <TouchableOpacity onPress={() => toggle(item.id)} style={cl.chipInner} disabled={editMode}>
                          <Text style={cl.chipEmoji}>{item.emoji}</Text>
                          <Text style={[cl.chipLabel, !editMode && isChecked && cl.chipLabelChecked, isHidden && cl.chipLabelHidden]}>{item.label}</Text>
                          {!editMode && isChecked && <Text style={cl.checkMark}>✓</Text>}
                        </TouchableOpacity>
                        {editMode && (
                          <TouchableOpacity
                            onPress={() => toggleHideDefault(item.id)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={[cl.deleteBtn, isHidden && cl.restoreBtn]}>{isHidden ? '↩' : '✕'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Restore hint */}
          {!editMode && hiddenDefaults.size > 0 && (
            <TouchableOpacity onPress={restoreDefaults} style={cl.restoreRow}>
              <Text style={cl.restoreRowText}>↩ Restore {hiddenDefaults.size} hidden default{hiddenDefaults.size > 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          )}

          {/* Custom items */}
          <View style={{ marginBottom: 8 }}>
            <View style={cl.myItemsHeader}>
              <Text style={[cl.catTitle, { color: '#f59e0b', marginBottom: 0 }]}>My Items</Text>
              {!editMode && (
                <TouchableOpacity
                  style={cl.addBtn}
                  onPress={() => {
                    setShowInput(s => !s);
                    if (!showInput) setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                >
                  <Text style={cl.addBtnText}>{showInput ? '✕ Cancel' : '+ Add'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {showInput && !editMode && (
              <View style={cl.inputRow}>
                <TextInput
                  ref={inputRef}
                  style={cl.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="e.g. Extra goggles"
                  placeholderTextColor="#adb5bd"
                  returnKeyType="done"
                  onSubmitEditing={addItem}
                  autoCapitalize="sentences"
                />
                <TouchableOpacity style={cl.saveBtn} onPress={addItem}>
                  <Text style={cl.saveBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}

            {customItems.length > 0 && (
              <View style={[cl.itemGrid, { marginTop: 8 }]}>
                {customItems.map(item => {
                  const isChecked = checked.has(item.id);
                  return (
                    <View key={item.id} style={[cl.chip, cl.customChip, !editMode && isChecked && cl.chipChecked, editMode && cl.chipEditMode]}>
                      <TouchableOpacity onPress={() => toggle(item.id)} style={cl.chipInner} disabled={editMode}>
                        <Text style={cl.chipEmoji}>📝</Text>
                        <Text style={[cl.chipLabel, !editMode && isChecked && cl.chipLabelChecked]}>{item.label}</Text>
                        {!editMode && isChecked && <Text style={cl.checkMark}>✓</Text>}
                      </TouchableOpacity>
                      {editMode && (
                        <TouchableOpacity onPress={() => deleteCustomItem(item.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Text style={cl.deleteBtn}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {customItems.length === 0 && !showInput && !editMode && (
              <Text style={cl.emptyHint}>Tap "+ Add" to add your own items.</Text>
            )}
          </View>

          {!editMode && pct === 1 && (
            <View style={cl.allDone}>
              <Text style={cl.allDoneText}>🎉 You're all packed! Go crush it.</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Home screen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation<Nav>();

  function renderTool({ item }: { item: Tool }) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => navigation.navigate(item.id as keyof RootStackParamList)}
      >
        <View style={[styles.iconBox, { backgroundColor: item.color + '1A' }]}>
          <Text style={styles.iconText}>{item.icon}</Text>
        </View>
        <View style={styles.cardText}>
          <Text style={styles.toolName}>{item.name}</Text>
          <Text style={styles.toolDesc}>{item.description}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <FlatList
        data={TOOLS}
        keyExtractor={(t) => t.id}
        renderItem={renderTool}
        numColumns={2}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Triathlon Tools</Text>
              <Text style={styles.subtitle}>Calculators & utilities for training and racing.</Text>
            </View>
            <RaceChecklist />
            <Text style={styles.toolsLabel}>Tools</Text>
          </View>
        }
        columnWrapperStyle={styles.row}
      />
    </SafeAreaView>
  );
}

// ── Checklist styles ───────────────────────────────────────────────────────────
const cl = StyleSheet.create({
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E8EF',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  progress: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  resetText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  editBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  editBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  editBtnText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  editBtnTextActive: { color: '#2563eb' },
  chevron: { fontSize: 11, color: '#94a3b8' },
  barBg: { height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3 },
  catTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  chipChecked: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  chipEmoji: { fontSize: 13 },
  chipLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipLabelChecked: { color: '#16a34a' },
  checkMark: { fontSize: 11, color: '#22c55e', fontWeight: '700' },
  allDone: { marginTop: 8, padding: 12, backgroundColor: '#F0FDF4', borderRadius: 10, alignItems: 'center' },
  allDoneText: { fontSize: 14, fontWeight: '700', color: '#16a34a' },
  myItemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0, marginTop: 4 },
  addBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  addBtnText: { fontSize: 12, fontWeight: '700', color: '#d97706' },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#D8DDE6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#1A1A2E',
  },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: '#f59e0b', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  customChip: { flexDirection: 'row', alignItems: 'center', paddingRight: 6 },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipEditMode: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  chipHidden: { opacity: 0.45, borderStyle: 'dashed' },
  chipLabelHidden: { textDecorationLine: 'line-through', color: '#94a3b8' },
  deleteBtn: { fontSize: 12, color: '#ef4444', marginLeft: 4, fontWeight: '700' },
  restoreBtn: { color: '#3b82f6' },
  restoreRow: { marginBottom: 10, alignSelf: 'flex-start' },
  restoreRowText: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },
  emptyHint: { fontSize: 12, color: '#cbd5e1', marginTop: 8, fontStyle: 'italic' },
});

// ── Main styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  list: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  toolsLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  row: { justifyContent: 'space-between', marginBottom: 12 },
  card: {
    width: '48.5%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E8EF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconText: { fontSize: 26 },
  cardText: {},
  toolName: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  toolDesc: { fontSize: 12, color: '#888', lineHeight: 17 },
});
