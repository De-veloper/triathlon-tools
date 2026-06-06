import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  calcTime,
  paceToSecPerKm,
  secondsToTime,
  TRIATHLON_DISTANCES,
} from '../utils/pace';

type DistanceKey = 0 | 1 | 2 | 3;
type DistUnit = 'km' | 'mi';


export default function RacePlannerScreen() {
  const [distIdx, setDistIdx] = useState<DistanceKey>(1);
  const [distUnit, setDistUnit] = useState<DistUnit>('km');
  const [t1, setT1] = useState('2:00');
  const [t2, setT2] = useState('2:00');
  const [swimPace, setSwimPace] = useState('2:00');
  const [bikePace, setBikePace] = useState('30');
  const [runPace, setRunPace] = useState('5:30');
  const [result, setResult] = useState<{
    swim: string;
    t1: string;
    bike: string;
    t2: string;
    run: string;
    total: string;
  } | null>(null);
  const [error, setError] = useState('');

  const race = TRIATHLON_DISTANCES[distIdx];
  const bikeUnit = distUnit === 'km' ? 'km/h' : 'mph';
  const runUnit = distUnit === 'km' ? 'min/km' : 'min/mi';
  const swimUnit = distUnit === 'km' ? 'min/100m' : 'min/100yd';

  function handleDistUnitChange(u: DistUnit) {
    setDistUnit(u);
    setResult(null);
  }

  function calculate() {
    setError('');
    setResult(null);

    const swimSecPerKm = paceToSecPerKm(swimPace, swimUnit);
    const bikeSecPerKm = paceToSecPerKm(bikePace, bikeUnit);
    const runSecPerKm = paceToSecPerKm(runPace, runUnit);

    const t1Parts = t1.split(':').map(Number);
    const t2Parts = t2.split(':').map(Number);
    const t1Sec = t1Parts.length === 2 ? t1Parts[0] * 60 + t1Parts[1] : t1Parts[0];
    const t2Sec = t2Parts.length === 2 ? t2Parts[0] * 60 + t2Parts[1] : t2Parts[0];

    if ([swimSecPerKm, bikeSecPerKm, runSecPerKm].some((v) => isNaN(v) || v <= 0)) {
      setError('Check your pace inputs — use MM:SS for swim/run, number for bike speed.');
      return;
    }

    const swimSec = calcTime(race.swim, swimSecPerKm);
    const bikeSec = calcTime(race.bike, bikeSecPerKm);
    const runSec = calcTime(race.run, runSecPerKm);
    const total = swimSec + t1Sec + bikeSec + t2Sec + runSec;

    setResult({
      swim: secondsToTime(swimSec),
      t1: secondsToTime(t1Sec),
      bike: secondsToTime(bikeSec),
      t2: secondsToTime(t2Sec),
      run: secondsToTime(runSec),
      total: secondsToTime(total),
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Race Planner</Text>

          {/* Distance preset + unit toggle */}
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>Race distance</Text>
            <View style={styles.miniToggle}>
              {(['km', 'mi'] as DistUnit[]).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.miniBtn, distUnit === u && styles.miniBtnActive]}
                  onPress={() => handleDistUnitChange(u)}
                >
                  <Text style={[styles.miniText, distUnit === u && styles.miniTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.segmentRow}>
            {TRIATHLON_DISTANCES.map((d, i) => (
              <TouchableOpacity
                key={d.labelKm}
                style={[styles.segmentBtn, distIdx === i && styles.segmentBtnActive]}
                onPress={() => { setDistIdx(i as DistanceKey); setResult(null); }}
              >
                <Text style={[styles.segmentText, distIdx === i && styles.segmentTextActive]}>
                  {distUnit === 'km' ? d.labelKm : d.labelMi}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Distances display */}
          <View style={styles.distRow}>
            <DistBadge label="Swim" value={distUnit === 'km' ? `${race.swim} km` : `${race.swimMi} mi`} />
            <DistBadge label="Bike" value={distUnit === 'km' ? `${race.bike} km` : `${race.bikeMi} mi`} />
            <DistBadge label="Run"  value={distUnit === 'km' ? `${race.run} km`  : `${race.runMi} mi`} />
          </View>

          {/* Swim */}
          <Text style={styles.sectionHeader}>Swim</Text>
          <LabeledInput label={`Pace (MM:SS /100${distUnit === 'km' ? 'm' : 'yd'})`} value={swimPace} onChangeText={setSwimPace} placeholder="2:00" />

          {/* T1 */}
          <Text style={styles.sectionHeader}>T1 Transition</Text>
          <LabeledInput label="Time (MM:SS)" value={t1} onChangeText={setT1} placeholder="2:00" />

          {/* Bike */}
          <Text style={styles.sectionHeader}>Bike</Text>
          <LabeledInput
            label={`Speed (${bikeUnit})`}
            value={bikePace}
            onChangeText={setBikePace}
            placeholder={distUnit === 'km' ? '30' : '18.6'}
            keyboardType="decimal-pad"
          />

          {/* T2 */}
          <Text style={styles.sectionHeader}>T2 Transition</Text>
          <LabeledInput label="Time (MM:SS)" value={t2} onChangeText={setT2} placeholder="1:30" />

          {/* Run */}
          <Text style={styles.sectionHeader}>Run</Text>
          <LabeledInput
            label={`Pace (MM:SS /${distUnit === 'km' ? 'km' : 'mi'})`}
            value={runPace}
            onChangeText={setRunPace}
            placeholder={distUnit === 'km' ? '5:30' : '8:51'}
          />

          <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
            <Text style={styles.calcBtnText}>Calculate Race Time</Text>
          </TouchableOpacity>

          {error !== '' && <Text style={styles.error}>{error}</Text>}

          {result && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Estimated Finish</Text>
              <Text style={styles.totalTime}>{result.total}</Text>
              <View style={styles.divider} />
              <SplitRow label="Swim" value={result.swim} />
              <SplitRow label="T1" value={result.t1} accent={false} />
              <SplitRow label="Bike" value={result.bike} />
              <SplitRow label="T2" value={result.t2} accent={false} />
              <SplitRow label="Run" value={result.run} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DistBadge({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={styles.badgeValue}>{value}</Text>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'numbers-and-punctuation',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'numbers-and-punctuation' | 'decimal-pad';
}) {
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
      />
    </View>
  );
}

function SplitRow({ label, value, accent = true }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.splitRow}>
      <Text style={styles.splitLabel}>{label}</Text>
      <Text style={[styles.splitValue, !accent && styles.splitMuted]}>{value}</Text>
    </View>
  );
}

const BLUE = '#1A73E8';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 14 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#555' },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginTop: 20, marginBottom: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  miniToggle: { flexDirection: 'row', backgroundColor: '#E8EDF3', borderRadius: 8, padding: 2 },
  miniBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  miniBtnActive: { backgroundColor: BLUE },
  miniText: { fontSize: 12, fontWeight: '600', color: '#666' },
  miniTextActive: { color: '#fff' },
  segmentRow: { flexDirection: 'row', backgroundColor: '#E8EDF3', borderRadius: 10, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  segmentText: { fontSize: 12, color: '#666' },
  segmentTextActive: { color: BLUE, fontWeight: '700' },
  distRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  badge: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', marginHorizontal: 3, borderWidth: 1, borderColor: '#D8DDE6' },
  badgeLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
  badgeValue: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D8DDE6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: '#1A1A2E',
  },
  calcBtn: {
    marginTop: 24,
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { marginTop: 12, color: '#D32F2F', textAlign: 'center' },
  resultCard: { marginTop: 20, backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#D8DDE6' },
  resultTitle: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 4 },
  totalTime: { fontSize: 36, fontWeight: '800', color: BLUE, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#E8EDF3', marginVertical: 14 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  splitLabel: { fontSize: 15, color: '#444', fontWeight: '600' },
  splitValue: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  splitMuted: { color: '#888' },
});
