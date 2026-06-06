import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Data ──────────────────────────────────────────────────────────────────────
const WHEEL_SIZES = [
  { label: '700c', rimMm: 622 },
  { label: '650b', rimMm: 584 },
  { label: '650c', rimMm: 571 },
  { label: '26"',  rimMm: 559 },
];

const PRESETS = [
  { name: 'Road Compact',  chainrings: [50, 34], cassette: '11,12,13,14,15,17,19,21,24,28' },
  { name: 'Road Standard', chainrings: [53, 39], cassette: '11,12,13,14,15,17,19,21,23,25' },
  { name: 'Triathlon',     chainrings: [55, 42], cassette: '11,12,13,14,15,17,19,21,24,28' },
  { name: 'Gravel 2x',     chainrings: [46, 30], cassette: '10,12,14,16,18,21,24,28,32,36' },
  { name: 'Gravel 1x',     chainrings: [42],     cassette: '10,12,14,16,18,21,24,28,32,36,42' },
];

type CassetteSpeed = 10 | 11 | 12;
const CASSETTE_PRESETS: Record<CassetteSpeed, { label: string; teeth: string; note?: string }[]> = {
  10: [
    { label: '11-25', teeth: '11,12,13,14,15,17,19,21,23,25' },
    { label: '11-28', teeth: '11,12,13,14,15,17,19,21,24,28' },
    { label: '11-32', teeth: '11,12,13,15,17,19,22,25,28,32' },
    { label: '11-34', teeth: '11,12,13,15,17,20,23,26,30,34' },
  ],
  11: [
    { label: '11-25', teeth: '11,12,13,14,15,16,17,19,21,23,25' },
    { label: '11-28', teeth: '11,12,13,14,15,17,19,21,23,25,28' },
    { label: '11-30', teeth: '11,12,13,14,15,17,19,21,24,27,30' },
    { label: '11-32', teeth: '11,12,13,14,15,17,19,22,25,28,32' },
    { label: '11-34', teeth: '11,13,15,17,19,21,23,26,30,34,34', note: 'MTB' },
  ],
  12: [
    { label: '11-30', teeth: '11,12,13,14,15,16,17,19,22,25,28,30' },
    { label: '11-34', teeth: '11,12,13,14,15,17,19,21,24,28,32,34' },
    { label: '10-28', teeth: '10,11,12,13,14,15,17,19,21,23,25,28', note: 'SRAM' },
    { label: '10-36', teeth: '10,11,12,13,15,17,19,22,25,28,32,36', note: 'SRAM' },
  ],
};

const TIRE_WIDTHS = [23, 25, 28, 32, 38, 47];

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseCassette = (s: string) =>
  s.split(',').map(x => parseInt(x.trim())).filter(n => n > 0 && n < 60).sort((a, b) => a - b);

function heatColor(pct: number): string {
  const h = Math.round(120 - pct * 120);
  return `hsl(${h}, 65%, 88%)`;
}
function heatTextColor(pct: number): string {
  const h = Math.round(120 - pct * 120);
  return `hsl(${h}, 60%, 28%)`;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function GearRatioScreen() {
  const [preset, setPreset]               = useState('Road Compact');
  const [chainrings, setChainrings]       = useState([50, 34]);
  const [cassetteStr, setCassetteStr]     = useState('11,12,13,14,15,17,19,21,24,28');
  const [cassetteSpeed, setCassetteSpeed] = useState<CassetteSpeed>(11);
  const [rimLabel, setRimLabel]           = useState('700c');
  const [tireMm, setTireMm]               = useState(25);
  const [cadence, setCadence]             = useState(90);
  const [units, setUnits]                 = useState<'mph' | 'kmh'>('mph');

  const cassette   = parseCassette(cassetteStr);
  const rim        = WHEEL_SIZES.find(w => w.label === rimLabel) ?? WHEEL_SIZES[0];
  const circumM    = Math.PI * (rim.rimMm + 2 * tireMm) / 1000;
  const unitLabel  = units === 'mph' ? 'mph' : 'km/h';

  const speedAt = (cr: number, sp: number) => {
    const kmh = (cr / sp) * circumM * cadence * 60 / 1000;
    return units === 'mph' ? kmh * 0.621371 : kmh;
  };

  const allSpeeds = chainrings.flatMap(cr => cassette.map(sp => speedAt(cr, sp)));
  const minS = Math.min(...allSpeeds);
  const maxS = Math.max(...allSpeeds);
  const pct  = (s: number) => (maxS === minS ? 0.5 : (s - minS) / (maxS - minS));

  const isCrossChain = (crIdx: number, spIdx: number) =>
    (crIdx === 0 && spIdx >= cassette.length - 2) ||
    (crIdx === chainrings.length - 1 && spIdx <= 1);

  function applyPreset(p: typeof PRESETS[0]) {
    setPreset(p.name);
    setChainrings([...p.chainrings]);
    setCassetteStr(p.cassette);
  }

  function addChainring() {
    if (chainrings.length >= 3) return;
    setChainrings(prev => [...prev, 30]);
  }

  function removeChainring(i: number) {
    if (chainrings.length <= 1) return;
    setChainrings(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateChainring(i: number, val: string) {
    const n = parseInt(val);
    if (!n) return;
    setChainrings(prev => prev.map((c, idx) => idx === i ? n : c));
  }

  const COG_W = 52;
  const ROW_H = 38;
  const LABEL_W = 72;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Gear Ratio</Text>
        <Text style={s.subtitle}>Speed for every gear combo at any cadence.</Text>

        {/* ── Drivetrain presets ── */}
        <Text style={s.groupLabel}>Drivetrain Presets</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {PRESETS.map(p => (
            <TouchableOpacity key={p.name} style={[s.presetChip, preset === p.name && s.presetChipActive]} onPress={() => applyPreset(p)}>
              <Text style={[s.presetText, preset === p.name && s.presetTextActive]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Chainrings ── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Chainring(s)</Text>
          <View style={s.rowWrap}>
            {chainrings.map((cr, i) => (
              <View key={i} style={s.crRow}>
                <TextInput
                  style={s.crInput}
                  keyboardType="number-pad"
                  value={String(cr)}
                  onChangeText={v => { updateChainring(i, v); setPreset(''); }}
                />
                <Text style={s.tLabel}>T</Text>
                {chainrings.length > 1 && (
                  <TouchableOpacity style={s.removeBtn} onPress={() => removeChainring(i)}>
                    <Text style={s.removeBtnText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {chainrings.length < 3 && (
              <TouchableOpacity style={s.addBtn} onPress={addChainring}>
                <Text style={s.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Cassette ── */}
          <Text style={[s.cardLabel, { marginTop: 14 }]}>Cassette</Text>
          <View style={s.rowWrap}>
            {([10, 11, 12] as CassetteSpeed[]).map(sp => (
              <TouchableOpacity key={sp} style={[s.speedTab, cassetteSpeed === sp && s.speedTabActive]} onPress={() => setCassetteSpeed(sp)}>
                <Text style={[s.speedTabText, cassetteSpeed === sp && s.speedTabTextActive]}>{sp}-spd</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[s.rowWrap, { marginTop: 8 }]}>
            {CASSETTE_PRESETS[cassetteSpeed].map(p => (
              <TouchableOpacity key={p.label} style={[s.casChip, cassetteStr === p.teeth && s.casChipActive]}
                onPress={() => { setCassetteStr(p.teeth); setPreset(''); }}>
                <Text style={[s.casChipText, cassetteStr === p.teeth && s.casChipTextActive]}>{p.label}{p.note ? ` (${p.note})` : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[s.input, { marginTop: 8, fontSize: 13 }]}
            value={cassetteStr}
            onChangeText={v => { setCassetteStr(v); setPreset(''); }}
            placeholder="e.g. 11,12,13,14,15,17,19,21,24,28"
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
        </View>

        {/* ── Wheel + Tire ── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Wheel Size</Text>
          <View style={s.rowWrap}>
            {WHEEL_SIZES.map(w => (
              <TouchableOpacity key={w.label} style={[s.chip, rimLabel === w.label && s.chipActive]} onPress={() => setRimLabel(w.label)}>
                <Text style={[s.chipText, rimLabel === w.label && s.chipTextActive]}>{w.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.cardLabel, { marginTop: 12 }]}>Tire Width (mm)</Text>
          <View style={s.rowWrap}>
            {TIRE_WIDTHS.map(mm => (
              <TouchableOpacity key={mm} style={[s.chip, tireMm === mm && s.chipActive]} onPress={() => setTireMm(mm)}>
                <Text style={[s.chipText, tireMm === mm && s.chipTextActive]}>{mm}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Cadence + Units ── */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={s.cardLabel}>Cadence: <Text style={{ color: '#111', fontWeight: '700' }}>{cadence} RPM</Text></Text>
            <View style={s.miniToggle}>
              {(['mph', 'kmh'] as const).map(u => (
                <TouchableOpacity key={u} style={[s.miniBtn, units === u && s.miniBtnActive]} onPress={() => setUnits(u)}>
                  <Text style={[s.miniText, units === u && s.miniTextActive]}>{u === 'mph' ? 'mph' : 'km/h'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.cadRow}>
            <TouchableOpacity style={s.cadBtn} onPress={() => setCadence(c => Math.max(50, c - 5))}>
              <Text style={s.cadBtnText}>−5</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cadBtn} onPress={() => setCadence(c => Math.max(50, c - 1))}>
              <Text style={s.cadBtnText}>−1</Text>
            </TouchableOpacity>
            <Text style={s.cadValue}>{cadence}</Text>
            <TouchableOpacity style={s.cadBtn} onPress={() => setCadence(c => Math.min(130, c + 1))}>
              <Text style={s.cadBtnText}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cadBtn} onPress={() => setCadence(c => Math.min(130, c + 5))}>
              <Text style={s.cadBtnText}>+5</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Gear table ── */}
        {cassette.length > 0 && chainrings.length > 0 && (
          <>
            <Text style={s.groupLabel}>Speed at {cadence} RPM ({unitLabel}) — ⚠ = cross-chain</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={s.tableScroll}>
              <View>
                {/* Header */}
                <View style={s.tableRow}>
                  <View style={[s.thCell, { width: LABEL_W }]}>
                    <Text style={s.thText}>Ring / Cog</Text>
                  </View>
                  {cassette.map(sp => (
                    <View key={sp} style={[s.thCell, { width: COG_W }]}>
                      <Text style={s.thText}>{sp}T</Text>
                    </View>
                  ))}
                </View>
                {/* Rows */}
                {chainrings.map((cr, crIdx) => (
                  <View key={cr + '-' + crIdx} style={s.tableRow}>
                    <View style={[s.tdLabel, { width: LABEL_W, height: ROW_H }]}>
                      <Text style={s.tdLabelText}>{cr}T</Text>
                      <Text style={s.tdLabelSub}>{(cr / cassette[0]).toFixed(1)}–{(cr / cassette[cassette.length - 1]).toFixed(1)}</Text>
                    </View>
                    {cassette.map((sp, spIdx) => {
                      const speed = speedAt(cr, sp);
                      const p = pct(speed);
                      const xchain = isCrossChain(crIdx, spIdx);
                      return (
                        <View key={sp} style={[s.tdCell, { width: COG_W, height: ROW_H, backgroundColor: heatColor(p), opacity: xchain ? 0.45 : 1 }]}>
                          <Text style={[s.tdText, { color: heatTextColor(p) }]}>{speed.toFixed(1)}</Text>
                          {xchain && <Text style={s.xchainMark}>⚠</Text>}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Summary */}
            <View style={[s.rowWrap, { marginTop: 12 }]}>
              <StatPill label="Lowest" value={`${minS.toFixed(1)} ${unitLabel}`} color="#4ade80" />
              <StatPill label="Top" value={`${maxS.toFixed(1)} ${unitLabel}`} color="#f87171" />
              <StatPill label="Range" value={`${(maxS / minS).toFixed(1)}×`} color="#60a5fa" />
              <StatPill label="Circ." value={`${(circumM * 100).toFixed(1)} cm`} color="#c084fc" />
            </View>
            <Text style={s.note}>⚠ Cross-chaining (big ring + biggest cogs, or small ring + smallest cogs) causes extra chain wear.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[s.pill, { backgroundColor: color + '18', borderColor: color + '44' }]}>
      <Text style={s.pillLabel}>{label}</Text>
      <Text style={[s.pillValue, { color }]}>{value}</Text>
    </View>
  );
}

const BLUE = '#1A73E8';
const INDIGO = '#6366f1';
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 14 },
  groupLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  card: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FAFAFA', marginRight: 6 },
  presetChipActive: { backgroundColor: '#EFF6FF', borderColor: BLUE },
  presetText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  presetTextActive: { color: '#1d4ed8' },
  crRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  crInput: { width: 58, fontSize: 16, fontWeight: '700', borderWidth: 1.5, borderColor: '#D8DDE6', borderRadius: 8, paddingVertical: 7, textAlign: 'center', backgroundColor: '#fff', color: '#1A1A2E' },
  tLabel: { fontSize: 11, color: '#94a3b8' },
  removeBtn: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#fca5a5', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  addBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#cbd5e1', borderStyle: 'dashed', backgroundColor: '#fff' },
  addBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  speedTab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  speedTabActive: { backgroundColor: '#EEF2FF', borderColor: INDIGO },
  speedTabText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  speedTabTextActive: { color: '#4338ca' },
  casChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FAFAFA' },
  casChipActive: { backgroundColor: '#EEF2FF', borderColor: INDIGO },
  casChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  casChipTextActive: { color: '#4338ca' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: BLUE },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#1d4ed8' },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D8DDE6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 16, color: '#1A1A2E' },
  miniToggle: { flexDirection: 'row', backgroundColor: '#E8EDF3', borderRadius: 8, padding: 2 },
  miniBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  miniBtnActive: { backgroundColor: BLUE },
  miniText: { fontSize: 12, fontWeight: '600', color: '#666' },
  miniTextActive: { color: '#fff' },
  cadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  cadBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#E8EDF3' },
  cadBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  cadValue: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', minWidth: 60, textAlign: 'center' },
  tableScroll: { borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 4 },
  tableRow: { flexDirection: 'row' },
  thCell: { paddingVertical: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
  thText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  tdLabel: { backgroundColor: '#F8FAFC', justifyContent: 'center', paddingLeft: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
  tdLabelText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  tdLabelSub: { fontSize: 10, color: '#94a3b8' },
  tdCell: { alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', borderRightWidth: 1, borderRightColor: 'rgba(0,0,0,0.04)' },
  tdText: { fontSize: 12, fontWeight: '700' },
  xchainMark: { position: 'absolute', top: 2, right: 3, fontSize: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 5, alignItems: 'center' },
  pillLabel: { fontSize: 11, color: '#64748b' },
  pillValue: { fontSize: 12, fontWeight: '700' },
  note: { fontSize: 11, color: '#94a3b8', lineHeight: 17, marginTop: 8 },
});
