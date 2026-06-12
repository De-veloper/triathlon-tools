import { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { preloadedToCourse, parseGpxString, trackPointsToCourse, type CourseData } from '../utils/gpx/parseGpx';
import { OCEANSIDE_703_BIKE, OCEANSIDE_703_BIKE_META } from '../utils/gpx/oceanside703bike';
import { LAQUINTA_703_BIKE, LAQUINTA_703_BIKE_META } from '../utils/gpx/laquinta703bike';
import { IM_CALIFORNIA_BIKE, IM_CALIFORNIA_BIKE_META } from '../utils/gpx/imcaliforniabike';

// ── Physics ────────────────────────────────────────────────────────────────────
const G = 9.81;
const AIR_DENSITY = 1.225;

const BIKE_TYPES = [
  { label: 'TT / Tri', cda: 0.24 },
  { label: 'Aero Road', cda: 0.30 },
  { label: 'Road', cda: 0.38 },
];

const MAX_SPEED_MS = 22.2; // 80 km/h descent cap

function calcSpeedMs(powerW: number, massKg: number, gradePct: number, cda: number): number {
  const grade = gradePct / 100;
  const sinTheta = Math.sin(Math.atan(grade));
  const A = 0.5 * AIR_DENSITY * cda;
  const B = massKg * G * (sinTheta + 0.005);
  if (A * MAX_SPEED_MS ** 3 + B * MAX_SPEED_MS < powerW) return MAX_SPEED_MS;
  let v = grade < 0 ? MAX_SPEED_MS : 5;
  for (let i = 0; i < 80; i++) {
    const f = A * v * v * v + B * v - powerW;
    const df = 3 * A * v * v + B;
    if (Math.abs(df) < 1e-6) break;
    const step = f / df;
    v -= step;
    if (v < 0.5) v = 0.5;
    if (v > MAX_SPEED_MS) v = MAX_SPEED_MS;
    if (Math.abs(step) < 0.0001) break;
  }
  return v;
}

function estimateTime(course: CourseData, ftp: number, massKg: number, cda: number) {
  const racePower = ftp * 0.75;
  const { segments } = course;
  let totalSec = 0;
  for (let i = 1; i < segments.length; i++) {
    const segDistM = segments[i].cumDistM - segments[i - 1].cumDistM;
    if (segDistM <= 0) continue;
    const gradePct = ((segments[i].eleM - segments[i - 1].eleM) / segDistM) * 100;
    totalSec += segDistM / calcSpeedMs(racePower, massKg, gradePct, cda);
  }
  return {
    totalSec,
    avgSpeedKph: (course.totalDistM / 1000) / (totalSec / 3600),
    wkg: racePower / massKg,
    racePowerW: racePower,
  };
}

// Binary search for FTP that produces the given finish time on a reference course
function backCalcFtp(course: CourseData, actualTimeSec: number, massKg: number, cda: number): number {
  let lo = 50, hi = 700;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (estimateTime(course, mid, massKg, cda).totalSec > actualTimeSec) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

// ── Preloaded courses ──────────────────────────────────────────────────────────
const PRELOADED: { id: string; label: string; distKm: number; elevGainM: number; load: () => CourseData }[] = [
  {
    id: 'oceanside',
    label: 'Oceanside 70.3',
    distKm: OCEANSIDE_703_BIKE_META.totalDistM / 1000,
    elevGainM: OCEANSIDE_703_BIKE_META.elevGainM,
    load: () => preloadedToCourse(OCEANSIDE_703_BIKE, OCEANSIDE_703_BIKE_META.totalDistM, OCEANSIDE_703_BIKE_META.elevGainM),
  },
  {
    id: 'laquinta',
    label: 'La Quinta 70.3',
    distKm: LAQUINTA_703_BIKE_META.totalDistM / 1000,
    elevGainM: LAQUINTA_703_BIKE_META.elevGainM,
    load: () => preloadedToCourse(LAQUINTA_703_BIKE, LAQUINTA_703_BIKE_META.totalDistM, LAQUINTA_703_BIKE_META.elevGainM),
  },
  {
    id: 'imcalifornia',
    label: 'IM California 140.6',
    distKm: IM_CALIFORNIA_BIKE_META.totalDistM / 1000,
    elevGainM: IM_CALIFORNIA_BIKE_META.elevGainM,
    load: () => preloadedToCourse(IM_CALIFORNIA_BIKE, IM_CALIFORNIA_BIKE_META.totalDistM, IM_CALIFORNIA_BIKE_META.elevGainM),
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type UnitSystem = 'metric' | 'imperial';
type Mode = 'ftp' | 'past-race';

// ── Screen ────────────────────────────────────────────────────────────────────
export default function BikeTimePredictorScreen() {
  // shared
  const [mode, setMode] = useState<Mode>('ftp');
  const [units, setUnits] = useState<UnitSystem>('imperial');
  const [riderWeight, setRiderWeight] = useState('');
  const [bikeWeight, setBikeWeight] = useState('');
  const [bikeTypeIdx, setBikeTypeIdx] = useState(0);

  // ftp mode
  const [ftp, setFtp] = useState('');

  // target course (both modes)
  const [targetCourse, setTargetCourse] = useState<CourseData | null>(null);
  const [targetCourseId, setTargetCourseId] = useState<string | null>(null);
  const [targetFileName, setTargetFileName] = useState<string | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [parseErrorTarget, setParseErrorTarget] = useState<string | null>(null);

  // reference course (past-race mode)
  const [refCourse, setRefCourse] = useState<CourseData | null>(null);
  const [refCourseId, setRefCourseId] = useState<string | null>(null);
  const [refFileName, setRefFileName] = useState<string | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);
  const [parseErrorRef, setParseErrorRef] = useState<string | null>(null);

  // actual race time (past-race mode)
  const [actualH, setActualH] = useState('');
  const [actualM, setActualM] = useState('');
  const [actualS, setActualS] = useState('');

  // stale-upload guards: incremented each time a new upload starts for that slot
  const refUploadSeq = useRef(0);
  const targetUploadSeq = useRef(0);

  // ── Derived values ──────────────────────────────────────────────────────────
  const weightLabel = units === 'imperial' ? 'lbs' : 'kg';

  const riderKg = (() => {
    const w = parseFloat(riderWeight);
    if (!w) return 0;
    return units === 'imperial' ? w * 0.453592 : w;
  })();
  const bikeKg = (() => {
    const raw = parseFloat(bikeWeight);
    if (raw) return units === 'imperial' ? raw * 0.453592 : raw;
    return 8; // default always 8 kg regardless of display unit
  })();
  const totalKg = riderKg + bikeKg;
  const cda = BIKE_TYPES[bikeTypeIdx].cda;
  const ftpW = parseFloat(ftp) || 0;

  const actualTimeSec = (() => {
    const h = parseInt(actualH) || 0;
    const m = Math.min(parseInt(actualM) || 0, 59); // clamp to valid range
    const s = Math.min(parseInt(actualS) || 0, 59);
    const total = h * 3600 + m * 60 + s;
    return total >= 60 ? total : 0; // require at least 1 minute to avoid nonsense FTP
  })();

  const derivedFtp = useMemo(() => {
    if (!(mode === 'past-race' && refCourse && actualTimeSec > 0 && riderKg > 0)) return null;
    return Math.round(backCalcFtp(refCourse, actualTimeSec, totalKg, cda));
  }, [mode, refCourse, actualTimeSec, riderKg, totalKg, cda]);

  const effectiveFtp = mode === 'ftp' ? ftpW : (derivedFtp ?? 0);

  const result = useMemo(() => {
    if (!(targetCourse && effectiveFtp > 0 && riderKg > 0)) return null;
    return estimateTime(targetCourse, effectiveFtp, totalKg, cda);
  }, [targetCourse, effectiveFtp, riderKg, totalKg, cda]);

  // Warn when reference and target distances differ by more than 30%
  const distanceMismatchWarning = useMemo(() => {
    if (mode !== 'past-race' || !refCourse || !targetCourse) return null;
    const ratio = targetCourse.totalDistM / refCourse.totalDistM;
    if (ratio > 1.3 || ratio < 0.77) {
      const refKm = (refCourse.totalDistM / 1000).toFixed(0);
      const tgtKm = (targetCourse.totalDistM / 1000).toFixed(0);
      return `Reference race (${refKm} km) and target race (${tgtKm} km) are very different distances. Pacing intensity differs across distances, so this prediction may be off by 10–20 min.`;
    }
    return null;
  }, [mode, refCourse, targetCourse]);

  // ── Course loaders ──────────────────────────────────────────────────────────
  function loadPreset(p: (typeof PRELOADED)[0], isRef: boolean) {
    if (isRef) {
      refUploadSeq.current++; // invalidate any in-flight ref upload
      setParseErrorRef(null);
      setRefFileName(null);
      setRefCourseId(p.id);
      setRefCourse(p.load());
    } else {
      targetUploadSeq.current++; // invalidate any in-flight target upload
      setParseErrorTarget(null);
      setTargetFileName(null);
      setTargetCourseId(p.id);
      setTargetCourse(p.load());
    }
  }

  async function pickGpxFile(isRef: boolean) {
    const seqRef = isRef ? refUploadSeq : targetUploadSeq;
    const seq = ++seqRef.current;
    const setLoading = isRef ? setLoadingRef : setLoadingTarget;
    const setError = isRef ? setParseErrorRef : setParseErrorTarget;
    setError(null);
    setLoading(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'text/xml', 'application/xml', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const file = res.assets[0];
      const xml = await fetch(file.uri).then(r => r.text());
      const points = parseGpxString(xml);
      if (points.length < 2) {
        setError('No track points found. Make sure the file is a valid GPX with <trkpt> elements.');
        return;
      }
      const course = trackPointsToCourse(points);
      if (seqRef.current !== seq) return; // a newer upload or preset was selected — discard
      if (isRef) {
        setRefCourse(course);
        setRefCourseId('upload');
        setRefFileName(file.name ?? 'Custom course');
      } else {
        setTargetCourse(course);
        setTargetCourseId('upload');
        setTargetFileName(file.name ?? 'Custom course');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to read file.');
    } finally {
      setLoading(false);
    }
  }

  const targetDistKm = targetCourse ? (targetCourse.totalDistM / 1000).toFixed(1) : null;
  const targetElevGain = targetCourse ? Math.round(targetCourse.elevGainM) : null;
  const refDistKm = refCourse ? (refCourse.totalDistM / 1000).toFixed(1) : null;
  const refElevGain = refCourse ? Math.round(refCourse.elevGainM) : null;

  const targetCourseLabel = targetCourseId === 'upload'
    ? targetFileName
    : PRELOADED.find(p => p.id === targetCourseId)?.label;
  const refCourseLabel = refCourseId === 'upload'
    ? refFileName
    : PRELOADED.find(p => p.id === refCourseId)?.label;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Bike Time Predictor</Text>
          <Text style={s.subtitle}>Estimate your bike split using a GPX course file.</Text>

          {/* Mode toggle */}
          <View style={s.unitRow}>
            {(['ftp', 'past-race'] as Mode[]).map(m => (
              <TouchableOpacity key={m} style={[s.segBtn, mode === m && s.segBtnActive]} onPress={() => setMode(m)}>
                <Text style={[s.segText, mode === m && s.segTextActive]}>
                  {m === 'ftp' ? 'I know my FTP' : 'Use a past race'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Unit toggle */}
          <View style={[s.unitRow, { marginBottom: 24 }]}>
            {(['metric', 'imperial'] as UnitSystem[]).map(u => (
              <TouchableOpacity key={u} style={[s.segBtn, units === u && s.segBtnActive]} onPress={() => setUnits(u)}>
                <Text style={[s.segText, units === u && s.segTextActive]}>
                  {u === 'metric' ? 'Metric (km / kg)' : 'Imperial (mi / lbs)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── PAST RACE MODE: reference course ── */}
          {mode === 'past-race' && (
            <>
              <Text style={s.sectionLabel}>Reference Race (you completed)</Text>
              <Text style={s.refRaceNote}>Use a triathlon or cycling race result — training rides won't give accurate estimates since the model assumes race-level effort.</Text>
              <CoursePicker
                courses={PRELOADED}
                selectedId={refCourseId}
                units={units}
                loading={loadingRef}
                fileName={refFileName}
                parseError={parseErrorRef}
                selectedCourse={refCourse}
                courseLabel={refCourseLabel}
                distKm={refDistKm}
                elevGain={refElevGain}
                onSelectPreset={p => loadPreset(p, true)}
                onUpload={() => pickGpxFile(true)}
              />

              <Text style={[s.sectionLabel, { marginTop: 4 }]}>Your Actual Finish Time</Text>
              <View style={s.timeRow}>
                <View style={s.timeField}>
                  <Text style={s.timeLabel}>H</Text>
                  <TextInput
                    style={s.timeInput}
                    keyboardType="number-pad"
                    value={actualH}
                    onChangeText={setActualH}
                    placeholder="2"
                    placeholderTextColor="#999"
                    maxLength={2}
                  />
                </View>
                <Text style={s.timeSep}>:</Text>
                <View style={s.timeField}>
                  <Text style={s.timeLabel}>MM</Text>
                  <TextInput
                    style={s.timeInput}
                    keyboardType="number-pad"
                    value={actualM}
                    onChangeText={setActualM}
                    placeholder="45"
                    placeholderTextColor="#999"
                    maxLength={2}
                  />
                </View>
                <Text style={s.timeSep}>:</Text>
                <View style={s.timeField}>
                  <Text style={s.timeLabel}>SS</Text>
                  <TextInput
                    style={s.timeInput}
                    keyboardType="number-pad"
                    value={actualS}
                    onChangeText={setActualS}
                    placeholder="30"
                    placeholderTextColor="#999"
                    maxLength={2}
                  />
                </View>
              </View>
            </>
          )}

          {/* ── TARGET COURSE ── */}
          <Text style={s.sectionLabel}>
            {mode === 'past-race' ? 'Target Race (to estimate)' : 'Course'}
          </Text>
          <CoursePicker
            courses={PRELOADED}
            selectedId={targetCourseId}
            units={units}
            loading={loadingTarget}
            fileName={targetFileName}
            parseError={parseErrorTarget}
            selectedCourse={targetCourse}
            courseLabel={targetCourseLabel}
            distKm={targetDistKm}
            elevGain={targetElevGain}
            onSelectPreset={p => loadPreset(p, false)}
            onUpload={() => pickGpxFile(false)}
          />

          {distanceMismatchWarning && (
            <View style={s.distWarning}>
              <Text style={s.distWarningIcon}>⚠️</Text>
              <Text style={s.distWarningText}>{distanceMismatchWarning}</Text>
            </View>
          )}

          {/* ── YOUR DATA ── */}
          <Text style={s.sectionLabel}>Your Data</Text>
          <View style={s.inputCard}>
            <View style={s.inputGrid}>
              {mode === 'ftp' && (
                <LabeledInput label="FTP (watts)" value={ftp} onChangeText={setFtp} placeholder="e.g. 240" />
              )}
              <LabeledInput
                label={`Rider weight (${weightLabel})`}
                value={riderWeight}
                onChangeText={setRiderWeight}
                placeholder={units === 'imperial' ? 'e.g. 154' : 'e.g. 70'}
              />
              <LabeledInput
                label={`Bike weight (${weightLabel}, optional)`}
                value={bikeWeight}
                onChangeText={setBikeWeight}
                placeholder={units === 'imperial' ? 'e.g. 17' : 'e.g. 8 (default)'}
              />
            </View>
            <Text style={[s.subsectionLabel, { marginTop: 14, marginBottom: 6 }]}>Bike type</Text>
            <View style={s.bikeTypeRow}>
              {BIKE_TYPES.map((bt, i) => (
                <TouchableOpacity
                  key={bt.label}
                  style={[s.bikeTypeBtn, bikeTypeIdx === i && s.bikeTypeBtnActive]}
                  onPress={() => setBikeTypeIdx(i)}
                >
                  <Text style={[s.bikeTypeText, bikeTypeIdx === i && s.bikeTypeTextActive]}>{bt.label}</Text>
                  <Text style={s.bikeTypeCda}>CdA {bt.cda}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── RESULTS ── */}
          {mode === 'past-race' && derivedFtp !== null && (
            <View style={s.derivedFtpBadge}>
              <Text style={s.derivedFtpLabel}>Derived FTP from reference race</Text>
              <Text style={s.derivedFtpValue}>{derivedFtp} W</Text>
              <Text style={s.derivedFtpSub}>({(derivedFtp / riderKg).toFixed(2)} w/kg)</Text>
            </View>
          )}

          {result && (
            <View style={s.resultCard}>
              <Text style={s.resultHeader}>Estimated Bike Split — {targetCourseLabel}</Text>
              <View style={s.resultGrid}>
                <ResultTile label="Finish Time" value={formatTime(result.totalSec)} highlight />
                <ResultTile
                  label="Avg Speed"
                  value={units === 'imperial'
                    ? `${(result.avgSpeedKph * 0.621371).toFixed(1)} mph`
                    : `${result.avgSpeedKph.toFixed(1)} km/h`}
                />
                <ResultTile label="W/kg" value={`${result.wkg.toFixed(2)} w/kg`} />
                <ResultTile label="Race Power" value={`${Math.round(result.racePowerW)} W`} />
              </View>
              <Text style={s.assumption}>Assumes 75% FTP effort (IF 0.75) — typical for a 70.3 bike leg.</Text>
              <View style={s.caveatBox}>
                <Text style={s.caveatTitle}>Not accounted for</Text>
                <Text style={s.caveatItem}>· Wind (head/tailwind can shift time ±10–15 min)</Text>
                <Text style={s.caveatItem}>· Drafting (legal in some races)</Text>
                <Text style={s.caveatItem}>· Pacing strategy (model assumes steady power)</Text>
                <Text style={s.caveatItem}>· Air density changes with altitude</Text>
                <Text style={s.caveatItem}>· Nutrition, heat, fatigue</Text>
                <Text style={s.caveatItem}>· Cross-distance predictions (70.3 → 140.6) may be off by 10–15 min due to different pacing intensity</Text>
              </View>
            </View>
          )}

          {/* Hints */}
          {mode === 'ftp' && !result && ftpW > 0 && totalKg > 0 && !targetCourse && (
            <Text style={s.hint}>Select or upload a course above to get your estimate.</Text>
          )}
          {mode === 'ftp' && !result && targetCourse && (!ftpW || !totalKg) && (
            <Text style={s.hint}>Enter your FTP and body weight to see results.</Text>
          )}
          {mode === 'past-race' && !refCourse && (
            <Text style={s.hint}>Select the race you completed to get started.</Text>
          )}
          {mode === 'past-race' && refCourse && !actualTimeSec && (
            <Text style={s.hint}>Enter your actual finish time for the reference race.</Text>
          )}
          {mode === 'past-race' && refCourse && actualTimeSec > 0 && !targetCourse && (
            <Text style={s.hint}>Now select the target race you want to estimate.</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type CoursePickerProps = {
  courses: typeof PRELOADED;
  selectedId: string | null;
  units: UnitSystem;
  loading: boolean;
  fileName: string | null;
  parseError: string | null;
  selectedCourse: CourseData | null;
  courseLabel: string | null | undefined;
  distKm: string | null;
  elevGain: number | null;
  onSelectPreset: (p: (typeof PRELOADED)[0]) => void;
  onUpload: () => void;
};

function CoursePicker({
  courses, selectedId, units, loading, fileName, parseError,
  selectedCourse, courseLabel, distKm, elevGain,
  onSelectPreset, onUpload,
}: CoursePickerProps) {
  const [open, setOpen] = useState(false);

  const buttonLabel = selectedId === 'upload'
    ? (fileName ?? 'Uploaded GPX')
    : courses.find(p => p.id === selectedId)?.label ?? null;

  return (
    <>
      {/* Dropdown trigger */}
      <TouchableOpacity
        style={[s.dropdownBtn, selectedId && s.dropdownBtnSelected]}
        onPress={() => setOpen(true)}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#1A73E8" style={{ flex: 1 }} />
        ) : (
          <>
            <Text style={[s.dropdownValue, !buttonLabel && s.dropdownPlaceholder]} numberOfLines={1}>
              {buttonLabel ?? 'Select a course…'}
            </Text>
            <Text style={s.dropdownChevron}>›</Text>
          </>
        )}
      </TouchableOpacity>

      {parseError && <Text style={s.errorText}>{parseError}</Text>}

      {selectedCourse && (
        <View style={s.courseSummary}>
          <Text style={s.courseSummaryText}>📍 {courseLabel}</Text>
          <Text style={s.courseSummaryText}>
            {units === 'imperial'
              ? `${(parseFloat(distKm!) * 0.621371).toFixed(1)} mi`
              : `${distKm} km`}
            {'  ·  '}
            +{units === 'imperial' ? `${Math.round(elevGain! * 3.28084)} ft` : `${elevGain} m`}
          </Text>
        </View>
      )}

      {/* Bottom-sheet modal */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Select Course</Text>

          {courses.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[s.modalItem, selectedId === p.id && s.modalItemActive]}
              onPress={() => { onSelectPreset(p); setOpen(false); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.modalItemLabel, selectedId === p.id && s.modalItemLabelActive]}>{p.label}</Text>
                <Text style={s.modalItemSub}>
                  {units === 'imperial'
                    ? `${(p.distKm * 0.621371).toFixed(1)} mi · +${Math.round(p.elevGainM * 3.28084)} ft`
                    : `${p.distKm.toFixed(1)} km · +${p.elevGainM} m`}
                </Text>
              </View>
              {selectedId === p.id && <Text style={s.modalCheck}>✓</Text>}
            </TouchableOpacity>
          ))}

          <View style={s.modalDivider} />

          <TouchableOpacity
            style={s.modalUploadRow}
            onPress={() => { setOpen(false); setTimeout(onUpload, 300); }}
          >
            <Text style={s.modalUploadIcon}>📂</Text>
            <Text style={s.modalUploadText}>Upload a GPX file…</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

function LabeledInput({ label, value, onChangeText, placeholder }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
}) {
  return (
    <View>
      <Text style={s.inputLabel}>{label}</Text>
      <TextInput
        style={s.input}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
      />
    </View>
  );
}

function ResultTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[s.tile, highlight && s.tileHighlight]}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={[s.tileValue, highlight && s.tileValueHighlight]}>{value}</Text>
    </View>
  );
}

const BLUE = '#1A73E8';

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 18 },

  unitRow: { flexDirection: 'row', backgroundColor: '#E8EDF3', borderRadius: 10, padding: 3, marginBottom: 10 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  segText: { fontSize: 12, color: '#666' },
  segTextActive: { color: BLUE, fontWeight: '700', fontSize: 12 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  subsectionLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 8 },

  dropdownBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: '#D8DDE6', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, minHeight: 48 },
  dropdownBtnSelected: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  dropdownValue: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  dropdownPlaceholder: { color: '#94a3b8', fontWeight: '400' },
  dropdownChevron: { fontSize: 20, color: '#94a3b8', marginLeft: 6 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 36, paddingHorizontal: 0 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#D8DDE6', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, paddingVertical: 12 },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderColor: '#F1F5F9' },
  modalItemActive: { backgroundColor: '#EFF6FF' },
  modalItemLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  modalItemLabelActive: { color: BLUE },
  modalItemSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  modalCheck: { fontSize: 16, color: BLUE, fontWeight: '700', marginLeft: 10 },
  modalDivider: { height: 1, backgroundColor: '#E2E8F0', marginHorizontal: 20, marginVertical: 6 },
  modalUploadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  modalUploadIcon: { fontSize: 20 },
  modalUploadText: { fontSize: 15, color: '#475569', fontWeight: '500' },

  errorText: { fontSize: 12, color: '#ef4444', marginBottom: 10 },

  courseSummary: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseSummaryText: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },

  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 24 },
  timeField: { alignItems: 'center', flex: 1 },
  timeLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  timeInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D8DDE6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 22, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', width: '100%' },
  timeSep: { fontSize: 22, fontWeight: '700', color: '#94a3b8', paddingBottom: 10 },

  inputCard: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 16 },
  inputGrid: { gap: 14 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D8DDE6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#1A1A2E' },

  bikeTypeRow: { flexDirection: 'row', gap: 8 },
  bikeTypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff', alignItems: 'center' },
  bikeTypeBtnActive: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  bikeTypeText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  bikeTypeTextActive: { color: BLUE },
  bikeTypeCda: { fontSize: 10, color: '#94a3b8', marginTop: 2 },

  distWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 1, borderColor: '#FCD34D', padding: 12, marginBottom: 12 },
  distWarningIcon: { fontSize: 16 },
  distWarningText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },

  derivedFtpBadge: { backgroundColor: '#F0FDF4', borderRadius: 12, borderWidth: 1.5, borderColor: '#86EFAC', padding: 14, marginBottom: 12, alignItems: 'center' },
  derivedFtpLabel: { fontSize: 11, fontWeight: '600', color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  derivedFtpValue: { fontSize: 28, fontWeight: '800', color: '#15803d' },
  derivedFtpSub: { fontSize: 12, color: '#4ade80', marginTop: 2 },

  resultCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: BLUE, padding: 16 },
  resultHeader: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  tileHighlight: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  tileLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  tileValue: { fontSize: 18, fontWeight: '800', color: '#111' },
  tileValueHighlight: { color: '#1d4ed8' },
  assumption: { fontSize: 11, color: '#94a3b8', marginTop: 12, fontStyle: 'italic' },
  caveatBox: { marginTop: 10, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  caveatTitle: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
  caveatItem: { fontSize: 11, color: '#94a3b8', lineHeight: 18 },
  hint: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 12 },
  refRaceNote: { fontSize: 12, color: '#94a3b8', lineHeight: 17, marginBottom: 10, marginTop: -4 },
});
