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
import categoriesJson from '../data/normalizedTable.json';

type RaceDistance = '70.3' | '140.6';
type Gender = 'M' | 'F';

interface AgeGroup {
  AG: string;
  Value: string;
}

const categories = categoriesJson as Record<RaceDistance, AgeGroup[]>;

const AGE_GROUPS = ['18-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80-84', '85-89'];

function secondsToTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function IronmanQualificationScreen() {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [raceDistance, setRaceDistance] = useState<RaceDistance>('70.3');
  const [gender, setGender] = useState<Gender>('M');
  const [selectedAG, setSelectedAG] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const totalSeconds = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);

  function clampMinSec(val: string, max: number): string {
    const n = parseInt(val);
    if (isNaN(n)) return '';
    return String(Math.min(n, max));
  }

  function calculate() {
    setError('');
    setResult('');

    if (totalSeconds <= 0) { setError('Enter your finish time.'); return; }
    if (!selectedAG) { setError('Select an age group.'); return; }

    const agKey = `${gender}${selectedAG}`.toLowerCase();
    const row = categories[raceDistance].find(
      (c) => c.AG.toLowerCase() === agKey || c.AG.toLowerCase() === `${gender.toLowerCase()}${selectedAG}`
    );

    if (!row || row.Value === 'TBD') {
      setError('Qualification standard not yet available for this age group.');
      return;
    }

    const multiplier = parseFloat(row.Value);
    const adjusted = Math.round(totalSeconds * multiplier);
    setResult(secondsToTime(adjusted));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Ironman Qualification</Text>
          <Text style={styles.subtitle}>
            Age-graded finish time based on Ironman's performance-based qualification system.
          </Text>

          {/* Finish time */}
          <Text style={styles.sectionHeader}>Your Finish Time</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <TextInput
                style={styles.timeInput}
                keyboardType="number-pad"
                value={hours}
                onChangeText={setHours}
                placeholder="0"
                placeholderTextColor="#999"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>HH</Text>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.timeField}>
              <TextInput
                style={styles.timeInput}
                keyboardType="number-pad"
                value={minutes}
                onChangeText={(v) => setMinutes(clampMinSec(v, 59))}
                placeholder="00"
                placeholderTextColor="#999"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>MM</Text>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.timeField}>
              <TextInput
                style={styles.timeInput}
                keyboardType="number-pad"
                value={seconds}
                onChangeText={(v) => setSeconds(clampMinSec(v, 59))}
                placeholder="00"
                placeholderTextColor="#999"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>SS</Text>
            </View>
          </View>

          {/* Race distance */}
          <Text style={styles.sectionHeader}>Race Distance</Text>
          <View style={styles.segmentRow}>
            {(['70.3', '140.6'] as RaceDistance[]).map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.segmentBtn, raceDistance === d && styles.segmentBtnActive]}
                onPress={() => { setRaceDistance(d); setResult(''); setError(''); }}
              >
                <Text style={[styles.segmentText, raceDistance === d && styles.segmentTextActive]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Gender */}
          <Text style={styles.sectionHeader}>Gender</Text>
          <View style={[styles.segmentRow, { maxWidth: 160 }]}>
            {(['M', 'F'] as Gender[]).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.segmentBtn, gender === g && styles.segmentBtnActive]}
                onPress={() => { setGender(g); setSelectedAG(''); setResult(''); setError(''); }}
              >
                <Text style={[styles.segmentText, gender === g && styles.segmentTextActive]}>
                  {g === 'M' ? 'Male' : 'Female'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Age group */}
          <Text style={styles.sectionHeader}>Age Group</Text>
          <View style={styles.agGrid}>
            {AGE_GROUPS.map((ag) => {
              const agKey = `${gender}${ag}`.toLowerCase();
              const row = categories[raceDistance].find(
                (c) => c.AG.toLowerCase() === agKey
              );
              const unavailable = !row || row.Value === 'TBD';
              const isSelected = selectedAG === ag;

              return (
                <TouchableOpacity
                  key={ag}
                  style={[
                    styles.agBtn,
                    isSelected && styles.agBtnActive,
                    unavailable && styles.agBtnDisabled,
                  ]}
                  onPress={() => {
                    if (!unavailable) {
                      setSelectedAG(ag);
                      setResult('');
                      setError('');
                    }
                  }}
                  disabled={unavailable}
                >
                  <Text style={[
                    styles.agText,
                    isSelected && styles.agTextActive,
                    unavailable && styles.agTextDisabled,
                  ]}>
                    {ag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
            <Text style={styles.calcBtnText}>Calculate</Text>
          </TouchableOpacity>

          {error !== '' && <Text style={styles.error}>{error}</Text>}

          {result !== '' && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Age-Graded Finish Time</Text>
              <Text style={styles.resultTime}>{result}</Text>
              <Text style={styles.resultNote}>
                Based on Ironman's performance-based age group qualification system (updated 7/11/2025).
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BLUE = '#1A73E8';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 4 },
  sectionHeader: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginTop: 20, marginBottom: 10 },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  timeField: { alignItems: 'center', flex: 1 },
  timeInput: {
    width: '100%',
    fontSize: 28,
    fontWeight: '700',
    borderWidth: 2,
    borderColor: '#D8DDE6',
    borderRadius: 10,
    paddingVertical: 10,
    textAlign: 'center',
    color: '#1A1A2E',
    backgroundColor: '#fff',
  },
  timeLabel: { fontSize: 11, color: '#999', marginTop: 4, fontWeight: '600' },
  timeSep: { fontSize: 28, fontWeight: '700', color: '#1A1A2E', marginTop: 10 },
  segmentRow: { flexDirection: 'row', backgroundColor: '#E8EDF3', borderRadius: 10, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  segmentText: { fontSize: 14, color: '#666' },
  segmentTextActive: { color: BLUE, fontWeight: '700' },
  agGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  agBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E8EDF3',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  agBtnActive: { backgroundColor: BLUE, borderColor: BLUE },
  agBtnDisabled: { backgroundColor: '#F0F0F0', opacity: 0.5 },
  agText: { fontSize: 13, fontWeight: '600', color: '#555' },
  agTextActive: { color: '#fff' },
  agTextDisabled: { color: '#bbb' },
  calcBtn: {
    marginTop: 24,
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { marginTop: 12, color: '#D32F2F', textAlign: 'center' },
  resultCard: {
    marginTop: 20,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
  },
  resultLabel: { fontSize: 13, color: '#1d4ed8', marginBottom: 6 },
  resultTime: { fontSize: 36, fontWeight: '800', color: '#1d4ed8' },
  resultNote: { fontSize: 11, color: '#6d97e0', marginTop: 10, textAlign: 'center', lineHeight: 16 },
});
