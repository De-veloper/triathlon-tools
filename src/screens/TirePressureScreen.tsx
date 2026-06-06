import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Constants ─────────────────────────────────────────────────────────────────
const TIRE_WIDTHS_MM = [23, 25, 28, 30, 32, 38, 40, 45, 50];
const SURFACE_FACTOR = { road: 1.0, gravel: 0.93, mixed: 0.82 } as const;
const TUBE_FACTOR    = { clincher: 1.0, tubeless: 0.93, tubular: 0.97 } as const;
const RIM_FACTOR     = { narrow: 1.02, standard: 1.0, wide: 0.95 } as const;
const BASE_COEFF = 0.915;
const FRONT_SPLIT = 0.45;
const REAR_SPLIT  = 0.55;

type WeightUnit = 'kg' | 'lbs';
type TireType   = 'clincher' | 'tubeless' | 'tubular';
type Surface    = 'road' | 'gravel' | 'mixed';
type RimWidth   = 'narrow' | 'standard' | 'wide';

function calcPsi(loadLbs: number, widthMm: number, sf: number, tf: number, rf: number): number {
  const widthIn = widthMm / 25.4;
  const raw = (BASE_COEFF * loadLbs / Math.pow(widthIn, 1.85)) * sf * tf * rf;
  return Math.min(130, Math.max(15, Math.round(raw)));
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TirePressureScreen() {
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [riderWeight, setRiderWeight] = useState('72');
  const [bikeWeight, setBikeWeight]   = useState('8');
  const [frontWidth, setFrontWidth]   = useState(25);
  const [rearWidth, setRearWidth]     = useState(25);
  const [sameWidth, setSameWidth]     = useState(true);
  const [tireType, setTireType]       = useState<TireType>('clincher');
  const [surface, setSurface]         = useState<Surface>('road');
  const [rimWidth, setRimWidth]       = useState<RimWidth>('standard');

  const riderKg = weightUnit === 'kg' ? parseFloat(riderWeight) || 0 : (parseFloat(riderWeight) || 0) * 0.453592;
  const bikeKg  = weightUnit === 'kg' ? parseFloat(bikeWeight)  || 0 : (parseFloat(bikeWeight)  || 0) * 0.453592;
  const totalKg  = riderKg + bikeKg;
  const totalLbs = totalKg * 2.20462;

  const sf = SURFACE_FACTOR[surface];
  const tf = TUBE_FACTOR[tireType];
  const rf = RIM_FACTOR[rimWidth];
  const effectiveRear = sameWidth ? frontWidth : rearWidth;

  const frontPsi = calcPsi(totalLbs * FRONT_SPLIT, frontWidth, sf, tf, rf);
  const rearPsi  = calcPsi(totalLbs * REAR_SPLIT,  effectiveRear, sf, tf, rf);
  const frontBar = (frontPsi * 0.0689476).toFixed(1);
  const rearBar  = (rearPsi  * 0.0689476).toFixed(1);

  function selectFront(mm: number) {
    setFrontWidth(mm);
    if (sameWidth) setRearWidth(mm);
  }

  function toggleSameWidth(v: boolean) {
    setSameWidth(v);
    if (v) setRearWidth(frontWidth);
  }

  function switchWeightUnit(u: WeightUnit) {
    if (u === weightUnit) return;
    const factor = u === 'lbs' ? 2.20462 : 0.453592;
    setRiderWeight(String(Math.round((parseFloat(riderWeight) || 0) * factor)));
    setBikeWeight(String(Math.round((parseFloat(bikeWeight) || 0) * factor)));
    setWeightUnit(u);
  }

  const weightLabel = weightUnit === 'kg' ? 'kg' : 'lbs';

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Tire Pressure</Text>
        <Text style={s.subtitle}>Recommended front & rear pressure based on weight, tire width, and surface.</Text>

        {/* ── Weight ── */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.sectionLabel}>Weight</Text>
            <View style={s.miniToggle}>
              {(['kg', 'lbs'] as WeightUnit[]).map(u => (
                <TouchableOpacity key={u} style={[s.miniBtn, weightUnit === u && s.miniBtnActive]} onPress={() => switchWeightUnit(u)}>
                  <Text style={[s.miniText, weightUnit === u && s.miniTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={s.inputLabel}>Rider ({weightLabel})</Text>
              <TextInput style={s.input} keyboardType="decimal-pad" value={riderWeight} onChangeText={setRiderWeight} placeholder="72" placeholderTextColor="#999" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.inputLabel}>Bike ({weightLabel})</Text>
              <TextInput style={s.input} keyboardType="decimal-pad" value={bikeWeight} onChangeText={setBikeWeight} placeholder="8" placeholderTextColor="#999" />
            </View>
          </View>
        </View>

        {/* ── Tire width ── */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.sectionLabel}>Tire Width (mm)</Text>
            <TouchableOpacity style={s.checkRow} onPress={() => toggleSameWidth(!sameWidth)}>
              <View style={[s.checkbox, sameWidth && s.checkboxActive]}>
                {sameWidth && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.checkLabel}>Same F & R</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.subLabel}>{sameWidth ? 'Front & Rear' : 'Front'}</Text>
          <View style={s.chipRow}>
            {TIRE_WIDTHS_MM.map(mm => (
              <TouchableOpacity key={mm} style={[s.chip, frontWidth === mm && s.chipBlueActive]} onPress={() => selectFront(mm)}>
                <Text style={[s.chipText, frontWidth === mm && s.chipBlueText]}>{mm}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!sameWidth && (
            <>
              <Text style={[s.subLabel, { marginTop: 12 }]}>Rear</Text>
              <View style={s.chipRow}>
                {TIRE_WIDTHS_MM.map(mm => (
                  <TouchableOpacity key={mm} style={[s.chip, rearWidth === mm && s.chipAmberActive]} onPress={() => setRearWidth(mm)}>
                    <Text style={[s.chipText, rearWidth === mm && s.chipAmberText]}>{mm}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── Type / Surface / Rim ── */}
        <View style={[s.card, s.row]}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={s.sectionLabel}>Tire Type</Text>
            {(['clincher', 'tubeless', 'tubular'] as TireType[]).map(t => (
              <TouchableOpacity key={t} style={[s.listBtn, tireType === t && s.listBtnAmber]} onPress={() => setTireType(t)}>
                <Text style={[s.listBtnText, tireType === t && s.listBtnAmberText]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={s.sectionLabel}>Surface</Text>
            {([{ id: 'road', label: 'Road' }, { id: 'gravel', label: 'Gravel' }, { id: 'mixed', label: 'Mixed/MTB' }] as { id: Surface; label: string }[]).map(item => (
              <TouchableOpacity key={item.id} style={[s.listBtn, surface === item.id && s.listBtnGreen]} onPress={() => setSurface(item.id)}>
                <Text style={[s.listBtnText, surface === item.id && s.listBtnGreenText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.sectionLabel}>Rim Width</Text>
            {([{ id: 'narrow', label: '≤17mm' }, { id: 'standard', label: '19–21mm' }, { id: 'wide', label: '23mm+' }] as { id: RimWidth; label: string }[]).map(item => (
              <TouchableOpacity key={item.id} style={[s.listBtn, rimWidth === item.id && s.listBtnPurple]} onPress={() => setRimWidth(item.id)}>
                <Text style={[s.listBtnText, rimWidth === item.id && s.listBtnPurpleText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Results ── */}
        <View style={s.row}>
          <PressureCard label="Front" psi={frontPsi} bar={frontBar} widthMm={frontWidth} color="#3b82f6" />
          <View style={{ width: 10 }} />
          <PressureCard label="Rear" psi={rearPsi} bar={rearBar} widthMm={effectiveRear} color="#f59e0b" />
        </View>

        {/* ── Stat pills ── */}
        <View style={[s.chipRow, { marginTop: 12 }]}>
          <StatPill label="System" value={weightUnit === 'kg' ? `${totalKg.toFixed(1)} kg` : `${(totalKg * 2.20462).toFixed(1)} lbs`} color="#60a5fa" />
          <StatPill label="Front load" value={weightUnit === 'kg' ? `${(totalKg * FRONT_SPLIT).toFixed(1)} kg` : `${(totalKg * FRONT_SPLIT * 2.20462).toFixed(1)} lbs`} color="#818cf8" />
          <StatPill label="Rear load" value={weightUnit === 'kg' ? `${(totalKg * REAR_SPLIT).toFixed(1)} kg` : `${(totalKg * REAR_SPLIT * 2.20462).toFixed(1)} lbs`} color="#fb923c" />
          <StatPill label="F/R ratio" value={(frontPsi / rearPsi).toFixed(2)} color="#34d399" />
        </View>

        <Text style={s.note}>
          Starting-point recommendations. Fine-tune ±5 psi to feel. Tubeless can safely run 7–10% lower than clincher.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PressureCard({ label, psi, bar, widthMm, color }: { label: string; psi: number; bar: string; widthMm: number; color: string }) {
  return (
    <View style={[s.pressureCard, { borderColor: color + '55', flex: 1 }]}>
      <Text style={[s.pressureLabel, { color: '#94a3b8' }]}>{label} · {widthMm}mm</Text>
      <Text style={[s.pressurePsi, { color }]}>{psi}</Text>
      <Text style={s.pressureUnit}>PSI</Text>
      <View style={s.pressureTrack}>
        <View style={[s.pressureFill, { width: `${Math.min(1, psi / 130) * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[s.pressureBar, { color: color + 'cc' }]}>{bar} <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '500' }}>bar</Text></Text>
    </View>
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
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 16 },
  card: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 },
  subLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 6 },
  inputLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D8DDE6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 16, fontWeight: '600', textAlign: 'center', color: '#1A1A2E' },
  miniToggle: { flexDirection: 'row', backgroundColor: '#E8EDF3', borderRadius: 8, padding: 2 },
  miniBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  miniBtnActive: { backgroundColor: BLUE },
  miniText: { fontSize: 12, fontWeight: '600', color: '#666' },
  miniTextActive: { color: '#fff' },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#D8DDE6', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  checkboxActive: { backgroundColor: BLUE, borderColor: BLUE },
  checkmark: { color: '#fff', fontSize: 10, fontWeight: '800' },
  checkLabel: { fontSize: 12, color: '#475569' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  chipBlueActive: { backgroundColor: '#EFF6FF', borderColor: '#3b82f6' },
  chipAmberActive: { backgroundColor: '#FFFBEB', borderColor: '#f59e0b' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipBlueText: { color: '#1d4ed8' },
  chipAmberText: { color: '#b45309' },
  listBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff', marginBottom: 5 },
  listBtnAmber: { backgroundColor: '#FFFBEB', borderColor: '#f59e0b' },
  listBtnGreen: { backgroundColor: '#F0FDF4', borderColor: '#22c55e' },
  listBtnPurple: { backgroundColor: '#F5F3FF', borderColor: '#8b5cf6' },
  listBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  listBtnAmberText: { color: '#b45309' },
  listBtnGreenText: { color: '#15803d' },
  listBtnPurpleText: { color: '#6d28d9' },
  pressureCard: { backgroundColor: '#FAFAFA', borderWidth: 1.5, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 0 },
  pressureLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  pressurePsi: { fontSize: 48, fontWeight: '800', lineHeight: 52 },
  pressureUnit: { fontSize: 12, color: '#94a3b8', marginBottom: 10 },
  pressureTrack: { width: '100%', height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  pressureFill: { height: '100%', borderRadius: 3 },
  pressureBar: { fontSize: 20, fontWeight: '700' },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 6, alignItems: 'center' },
  pillLabel: { fontSize: 11, color: '#64748b' },
  pillValue: { fontSize: 12, fontWeight: '700' },
  note: { fontSize: 11, color: '#94a3b8', lineHeight: 17, marginTop: 12 },
});
