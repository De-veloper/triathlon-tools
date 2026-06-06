import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ZONES = [
  { zone: 1, name: 'Active Recovery',    min: 0,   max: 55,  color: '#94a3b8', desc: 'Very easy spinning. Good for warm-up, cool-down, or recovery days.' },
  { zone: 2, name: 'Endurance',          min: 56,  max: 75,  color: '#4ade80', desc: 'All-day pace. Builds aerobic base. Most of your training volume.' },
  { zone: 3, name: 'Tempo',              min: 76,  max: 90,  color: '#facc15', desc: 'Comfortably hard. Improves sustained power and efficiency.' },
  { zone: 4, name: 'Lactate Threshold',  min: 91,  max: 105, color: '#fb923c', desc: 'Your FTP zone. Race pace for 40–60 min efforts. Hard but sustainable.' },
  { zone: 5, name: 'VO₂ Max',            min: 106, max: 120, color: '#f87171', desc: '3–8 min efforts. Builds maximum aerobic power. Very hard.' },
  { zone: 6, name: 'Anaerobic Capacity', min: 121, max: 150, color: '#c084fc', desc: '30 sec – 2 min all-out. Builds anaerobic capacity.' },
  { zone: 7, name: 'Neuromuscular',      min: 151, max: null, color: '#ec4899', desc: 'Short explosive sprints under 30 sec. Maximum power output.' },
] as const;

type DisplayUnit = 'watts' | 'pct';

function calcWatts(ftp: number, pct: number) {
  return Math.round(ftp * pct / 100);
}

export default function PowerZonesScreen() {
  const [ftpStr, setFtpStr] = useState('');
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>('watts');

  const ftp = parseInt(ftpStr) || 0;
  const valid = ftp > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Power Zones</Text>
        <Text style={styles.subtitle}>Coggan 7-zone model. Enter your FTP to see training zones.</Text>

        {/* FTP input */}
        <View style={styles.ftpCard}>
          <Text style={styles.ftpLabel}>Your FTP</Text>
          <View style={styles.ftpRow}>
            <TextInput
              style={styles.ftpInput}
              keyboardType="number-pad"
              value={ftpStr}
              onChangeText={setFtpStr}
              placeholder="e.g. 220"
              placeholderTextColor="#999"
            />
            <Text style={styles.ftpUnit}>watts</Text>

            {valid && (
              <View style={styles.unitToggle}>
                {(['watts', 'pct'] as DisplayUnit[]).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitBtn, displayUnit === u && styles.unitBtnActive]}
                    onPress={() => setDisplayUnit(u)}
                  >
                    <Text style={[styles.unitText, displayUnit === u && styles.unitTextActive]}>
                      {u === 'watts' ? 'Watts' : '% FTP'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Zone list */}
        {valid ? (
          <>
            {ZONES.map((z) => {
              const low = calcWatts(ftp, z.min);
              const high = z.max !== null ? calcWatts(ftp, z.max) : null;
              const rangeLabel = displayUnit === 'watts'
                ? high ? `${low}–${high} W` : `${low}+ W`
                : high ? `${z.min}–${z.max}%` : `${z.min}%+`;
              const barStart = Math.min((z.min / 180) * 100, 100);
              const barEnd = Math.min(((z.max ?? 180) / 180) * 100, 100);

              return (
                <View key={z.zone} style={styles.zoneCard}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, {
                      left: `${barStart}%` as any,
                      width: `${barEnd - barStart}%` as any,
                      backgroundColor: z.color,
                    }]} />
                  </View>
                  <View style={styles.zoneRow}>
                    <View style={[styles.zoneBadge, { backgroundColor: z.color + '22' }]}>
                      <Text style={[styles.zoneBadgeText, { color: z.color }]}>Z{z.zone}</Text>
                    </View>
                    <View style={styles.zoneInfo}>
                      <Text style={styles.zoneName}>{z.name}</Text>
                      <Text style={styles.zoneDesc}>{z.desc}</Text>
                    </View>
                    <View style={[styles.rangeBox, { backgroundColor: z.color + '18' }]}>
                      <Text style={[styles.rangeText, { color: z.color }]}>{rangeLabel}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            <View style={styles.ftpNote}>
              <Text style={styles.ftpNoteText}>
                <Text style={{ fontWeight: '700' }}>What is FTP? </Text>
                Functional Threshold Power is the highest average power you can sustain for ~60 minutes. Common test: ride all-out for 20 min, multiply average power by 0.95.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Enter your FTP above to see your power zones</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 18 },
  ftpCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D8DDE6',
    marginBottom: 20,
  },
  ftpLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  ftpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  ftpInput: {
    width: 100,
    fontSize: 28,
    fontWeight: '700',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    textAlign: 'center',
    color: '#1A1A2E',
  },
  ftpUnit: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  unitToggle: { flexDirection: 'row', marginLeft: 'auto', backgroundColor: '#E8EDF3', borderRadius: 20, padding: 3 },
  unitBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16 },
  unitBtnActive: { backgroundColor: '#1A73E8' },
  unitText: { fontSize: 12, fontWeight: '600', color: '#666' },
  unitTextActive: { color: '#fff' },
  zoneCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 10,
  },
  barTrack: { height: 5, backgroundColor: '#F1F5F9' },
  barFill: { position: 'absolute', top: 0, height: '100%' },
  zoneRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  zoneBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  zoneBadgeText: { fontWeight: '800', fontSize: 14 },
  zoneInfo: { flex: 1 },
  zoneName: { fontSize: 14, fontWeight: '700', color: '#111' },
  zoneDesc: { fontSize: 11, color: '#94a3b8', lineHeight: 16, marginTop: 2 },
  rangeBox: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexShrink: 0, minWidth: 80, alignItems: 'center' },
  rangeText: { fontSize: 13, fontWeight: '700' },
  ftpNote: {
    marginTop: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 14,
  },
  ftpNoteText: { fontSize: 12, color: '#1d4ed8', lineHeight: 18 },
  emptyState: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 48,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
});
