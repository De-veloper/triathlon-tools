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
import { parseGpxString, trackPointsToCourse, preloadedToCourse, type CourseData } from '../utils/gpx/parseGpx';
import { OCEANSIDE_703_RUN, OCEANSIDE_703_RUN_META } from '../utils/gpx/oceanside703run';
import { LAQUINTA_703_RUN, LAQUINTA_703_RUN_META } from '../utils/gpx/laquinta703run';
import { IM_CALIFORNIA_RUN, IM_CALIFORNIA_RUN_META } from '../utils/gpx/imcaliforniarun';

// ── Grade-adjusted pace (Minetti 2002) ────────────────────────────────────────
function minettiFactor(grade: number): number {
  const g = grade / 100;
  const cr = 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6;
  return Math.max(cr, 0.5) / 3.6;
}

function estimateRunTime(
  course: CourseData,
  thresholdPaceSecPerKm: number,
  effortFactor: number,
): { totalSec: number; avgPaceSecPerKm: number } {
  const racePaceFlatSecPerM = thresholdPaceSecPerKm / effortFactor / 1000;
  const { segments } = course;
  let totalSec = 0;
  for (let i = 1; i < segments.length; i++) {
    const segDistM = segments[i].cumDistM - segments[i - 1].cumDistM;
    if (segDistM <= 0) continue;
    const gradePct = ((segments[i].eleM - segments[i - 1].eleM) / segDistM) * 100;
    totalSec += segDistM * racePaceFlatSecPerM * minettiFactor(gradePct);
  }
  return { totalSec, avgPaceSecPerKm: totalSec / (course.totalDistM / 1000) };
}

// Linear closed-form: thresholdPace = actualTime * effortFactor * 1000 / weightedDist
function backCalcThresholdPace(course: CourseData, actualTimeSec: number, effortFactor: number): number {
  const { segments } = course;
  let weightedDist = 0;
  for (let i = 1; i < segments.length; i++) {
    const segDistM = segments[i].cumDistM - segments[i - 1].cumDistM;
    if (segDistM <= 0) continue;
    const gradePct = ((segments[i].eleM - segments[i - 1].eleM) / segDistM) * 100;
    weightedDist += segDistM * minettiFactor(gradePct);
  }
  return (actualTimeSec * effortFactor * 1000) / weightedDist;
}

function formatTime(sec: number): string {
  const rounded = Math.round(sec);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

function formatPace(secPerKm: number, imperial: boolean): string {
  const secPerUnit = imperial ? secPerKm * 1.60934 : secPerKm;
  let m = Math.floor(secPerUnit / 60);
  let s = Math.round(secPerUnit % 60);
  if (s === 60) { s = 0; m += 1; }
  return `${m}:${s.toString().padStart(2, '0')} /${imperial ? 'mi' : 'km'}`;
}

function parsePace(str: string): number | null {
  const parts = str.split(':');
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0]);
  const s = parseInt(parts[1]);
  if (isNaN(m) || isNaN(s) || s >= 60) return null;
  return m * 60 + s;
}

// ── Preloaded courses ──────────────────────────────────────────────────────────
const PRELOADED: { id: string; label: string; distKm: number; elevGainM: number; load: () => CourseData }[] = [
  {
    id: 'oceanside',
    label: 'Oceanside 70.3 Run',
    distKm: OCEANSIDE_703_RUN_META.totalDistM / 1000,
    elevGainM: OCEANSIDE_703_RUN_META.elevGainM,
    load: () => preloadedToCourse(OCEANSIDE_703_RUN, OCEANSIDE_703_RUN_META.totalDistM, OCEANSIDE_703_RUN_META.elevGainM),
  },
  {
    id: 'laquinta',
    label: 'La Quinta 70.3 Run',
    distKm: LAQUINTA_703_RUN_META.totalDistM / 1000,
    elevGainM: LAQUINTA_703_RUN_META.elevGainM,
    load: () => preloadedToCourse(LAQUINTA_703_RUN, LAQUINTA_703_RUN_META.totalDistM, LAQUINTA_703_RUN_META.elevGainM),
  },
  {
    id: 'imcalifornia',
    label: 'IM California Run',
    distKm: IM_CALIFORNIA_RUN_META.totalDistM / 1000,
    elevGainM: IM_CALIFORNIA_RUN_META.elevGainM,
    load: () => preloadedToCourse(IM_CALIFORNIA_RUN, IM_CALIFORNIA_RUN_META.totalDistM, IM_CALIFORNIA_RUN_META.elevGainM),
  },
];

const EFFORT_PRESETS = [
  { label: 'Sprint', pct: 95 },
  { label: '70.3',   pct: 90 },
  { label: 'Full IM', pct: 83 },
];

// Auto-derive effort factor from course distance (no user input needed)
function effortFromDistM(distM: number): number {
  if (distM < 15000) return 0.95; // Sprint
  if (distM < 30000) return 0.90; // 70.3 half marathon
  return 0.83;                    // Full IM marathon
}

// ── Types ─────────────────────────────────────────────────────────────────────
type UnitSystem = 'metric' | 'imperial';
type Mode = 'pace' | 'past-race';

// ── Screen ────────────────────────────────────────────────────────────────────
export default function RunTimePredictorScreen() {
  // shared
  const [mode, setMode] = useState<Mode>('pace');
  const [units, setUnits] = useState<UnitSystem>('imperial');
  const [effortIdx, setEffortIdx] = useState(1); // pace mode only

  // pace mode
  const [paceInput, setPaceInput] = useState('');

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

  // stale-upload guards
  const refUploadSeq = useRef(0);
  const targetUploadSeq = useRef(0);

  // ── Derived values ──────────────────────────────────────────────────────────
  const effort = EFFORT_PRESETS[effortIdx].pct / 100; // pace mode only

  const thresholdSecPerKm = (() => {
    const raw = parsePace(paceInput);
    if (!raw) return null;
    return units === 'imperial' ? raw / 1.60934 : raw;
  })();

  const actualTimeSec = (() => {
    const h = parseInt(actualH) || 0;
    const m = Math.min(parseInt(actualM) || 0, 59);
    const s = Math.min(parseInt(actualS) || 0, 59);
    const total = h * 3600 + m * 60 + s;
    return total >= 60 ? total : 0;
  })();

  const refEffort = refCourse ? effortFromDistM(refCourse.totalDistM) : 0.90;
  const targetEffort = targetCourse ? effortFromDistM(targetCourse.totalDistM) : 0.90;

  const derivedThresholdPace = useMemo(() => {
    if (!(mode === 'past-race' && refCourse && actualTimeSec > 0)) return null;
    return backCalcThresholdPace(refCourse, actualTimeSec, refEffort);
  }, [mode, refCourse, actualTimeSec, refEffort]);

  const effectivePace = mode === 'pace' ? thresholdSecPerKm : derivedThresholdPace;

  const activeTargetEffort = mode === 'pace' ? effort : targetEffort;

  const result = useMemo(() => {
    if (!(targetCourse && effectivePace && effectivePace > 0)) return null;
    return estimateRunTime(targetCourse, effectivePace, activeTargetEffort);
  }, [targetCourse, effectivePace, activeTargetEffort]);

  const distanceMismatchWarning = useMemo(() => {
    if (mode !== 'past-race' || !refCourse || !targetCourse) return null;
    const ratio = targetCourse.totalDistM / refCourse.totalDistM;
    if (ratio > 1.3 || ratio < 0.77) {
      const refKm = (refCourse.totalDistM / 1000).toFixed(0);
      const tgtKm = (targetCourse.totalDistM / 1000).toFixed(0);
      return `Reference race (${refKm} km) and target race (${tgtKm} km) are very different distances. Pacing effort differs across distances, so this prediction may be off.`;
    }
    return null;
  }, [mode, refCourse, targetCourse]);

  // ── Course loaders ──────────────────────────────────────────────────────────
  function loadPreset(p: (typeof PRELOADED)[0], isRef: boolean) {
    if (isRef) {
      refUploadSeq.current++;
      setParseErrorRef(null);
      setRefFileName(null);
      setRefCourseId(p.id);
      setRefCourse(p.load());
    } else {
      targetUploadSeq.current++;
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
      if (seqRef.current !== seq) return;
      if (isRef) {
        setRefCourse(course); setRefCourseId('upload'); setRefFileName(file.name ?? 'Custom course');
      } else {
        setTargetCourse(course); setTargetCourseId('upload'); setTargetFileName(file.name ?? 'Custom course');
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

  const targetCourseLabel = targetCourseId === 'upload' ? targetFileName : PRELOADED.find(p => p.id === targetCourseId)?.label;
  const refCourseLabel = refCourseId === 'upload' ? refFileName : PRELOADED.find(p => p.id === refCourseId)?.label;

  const paceLabel = `Threshold pace (min:ss /${units === 'imperial' ? 'mi' : 'km'})`;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Run Time Predictor</Text>
          <Text style={s.subtitle}>Estimate your run split using a GPX course file.</Text>

          {/* Mode toggle */}
          <View style={s.unitRow}>
            {(['pace', 'past-race'] as Mode[]).map(m => (
              <TouchableOpacity key={m} style={[s.segBtn, mode === m && s.segBtnActive]} onPress={() => setMode(m)}>
                <Text style={[s.segText, mode === m && s.segTextActive]}>
                  {m === 'pace' ? 'I know my pace' : 'Use a past race'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Unit toggle */}
          <View style={[s.unitRow, { marginBottom: 24 }]}>
            {(['metric', 'imperial'] as UnitSystem[]).map(u => (
              <TouchableOpacity key={u} style={[s.segBtn, units === u && s.segBtnActive]} onPress={() => setUnits(u)}>
                <Text style={[s.segText, units === u && s.segTextActive]}>
                  {u === 'metric' ? 'Metric (km)' : 'Imperial (mi)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── PAST RACE MODE: reference course ── */}
          {mode === 'past-race' && (
            <>
              <Text style={s.sectionLabel}>Reference Race (you completed)</Text>
              <Text style={s.refRaceNote}>Use a triathlon or running race result — training runs won't give accurate estimates since the model assumes race-level effort.</Text>
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
                  <TextInput style={s.timeInput} keyboardType="number-pad" value={actualH} onChangeText={setActualH} placeholder="1" placeholderTextColor="#999" maxLength={2} />
                </View>
                <Text style={s.timeSep}>:</Text>
                <View style={s.timeField}>
                  <Text style={s.timeLabel}>MM</Text>
                  <TextInput style={s.timeInput} keyboardType="number-pad" value={actualM} onChangeText={setActualM} placeholder="45" placeholderTextColor="#999" maxLength={2} />
                </View>
                <Text style={s.timeSep}>:</Text>
                <View style={s.timeField}>
                  <Text style={s.timeLabel}>SS</Text>
                  <TextInput style={s.timeInput} keyboardType="number-pad" value={actualS} onChangeText={setActualS} placeholder="30" placeholderTextColor="#999" maxLength={2} />
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

          {/* Distance mismatch warning */}
          {distanceMismatchWarning && (
            <View style={s.distWarning}>
              <Text style={s.distWarningIcon}>⚠️</Text>
              <Text style={s.distWarningText}>{distanceMismatchWarning}</Text>
            </View>
          )}

          {/* ── YOUR DATA ── */}
          {mode === 'pace' && (
            <>
              <Text style={s.sectionLabel}>Your Data</Text>
              <View style={s.inputCard}>
                <Text style={s.inputLabel}>{paceLabel}</Text>
                <TextInput
                  style={s.input}
                  value={paceInput}
                  onChangeText={setPaceInput}
                  placeholder={units === 'imperial' ? 'e.g. 7:30' : 'e.g. 4:40'}
                  placeholderTextColor="#999"
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={[s.inputLabel, { marginTop: 14 }]}>Race type</Text>
                <EffortSelector effortIdx={effortIdx} onChange={setEffortIdx} />
                {effectivePace && (
                  <Text style={s.paceHintText}>
                    Race pace ≈ {formatPace(effectivePace / effort, units === 'imperial')}
                  </Text>
                )}
              </View>
            </>
          )}

          {/* ── RESULTS ── */}
          {mode === 'past-race' && derivedThresholdPace !== null && (
            <View style={s.derivedPaceBadge}>
              <Text style={s.derivedPaceLabel}>Derived threshold pace from reference race</Text>
              <Text style={s.derivedPaceValue}>{formatPace(derivedThresholdPace, units === 'imperial')}</Text>
              <Text style={s.derivedPaceSub}>
                Target race pace ≈ {formatPace(derivedThresholdPace / targetEffort, units === 'imperial')}
              </Text>
            </View>
          )}

          {result && (
            <View style={s.resultCard}>
              <Text style={s.resultHeader}>Estimated Run Split — {targetCourseLabel}</Text>
              <View style={s.resultGrid}>
                <ResultTile label="Finish Time" value={formatTime(result.totalSec)} highlight />
                <ResultTile label="Avg Pace" value={formatPace(result.avgPaceSecPerKm, units === 'imperial')} />
              </View>
              <Text style={s.assumption}>Elevation-adjusted using Minetti (2002) grade cost model.</Text>
              <View style={s.caveatBox}>
                <Text style={s.caveatTitle}>Not accounted for</Text>
                <Text style={s.caveatItem}>· Wind, heat, humidity</Text>
                <Text style={s.caveatItem}>· Accumulated fatigue from swim/bike</Text>
                <Text style={s.caveatItem}>· Pacing strategy (model assumes steady effort)</Text>
                <Text style={s.caveatItem}>· Cross-distance predictions (70.3 → 140.6) may be off due to different pacing intensity</Text>
              </View>
            </View>
          )}

          {/* Hints */}
          {mode === 'pace' && !result && thresholdSecPerKm && !targetCourse && (
            <Text style={s.hint}>Select or upload a course above to get your estimate.</Text>
          )}
          {mode === 'pace' && !result && targetCourse && !thresholdSecPerKm && (
            <Text style={s.hint}>Enter your threshold pace to see results.</Text>
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
      <TouchableOpacity
        style={[s.dropdownBtn, selectedId && s.dropdownBtnSelected]}
        onPress={() => setOpen(true)}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={GREEN} style={{ flex: 1 }} />
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

function EffortSelector({ effortIdx, onChange, style }: { effortIdx: number; onChange: (i: number) => void; style?: object }) {
  return (
    <View style={[s.effortRow, style]}>
      {EFFORT_PRESETS.map((e, i) => (
        <TouchableOpacity
          key={e.label}
          style={[s.effortBtn, effortIdx === i && s.effortBtnActive]}
          onPress={() => onChange(i)}
        >
          <Text style={[s.effortText, effortIdx === i && s.effortTextActive]}>{e.label}</Text>
          <Text style={s.effortPct}>~{e.pct}% of threshold</Text>
        </TouchableOpacity>
      ))}
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

const GREEN = '#16a34a';

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 18 },

  unitRow: { flexDirection: 'row', backgroundColor: '#E8EDF3', borderRadius: 10, padding: 3, marginBottom: 10 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  segText: { fontSize: 12, color: '#666' },
  segTextActive: { color: GREEN, fontWeight: '700', fontSize: 12 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  refRaceNote: { fontSize: 12, color: '#94a3b8', lineHeight: 17, marginBottom: 10, marginTop: -4 },

  dropdownBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: '#D8DDE6', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, minHeight: 48 },
  dropdownBtnSelected: { borderColor: GREEN, backgroundColor: '#F0FDF4' },
  dropdownValue: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  dropdownPlaceholder: { color: '#94a3b8', fontWeight: '400' },
  dropdownChevron: { fontSize: 20, color: '#94a3b8', marginLeft: 6 },

  errorText: { fontSize: 12, color: '#ef4444', marginBottom: 10 },

  courseSummary: { backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#86EFAC', marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseSummaryText: { fontSize: 12, color: '#166534', fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#D8DDE6', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, paddingVertical: 12 },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderColor: '#F1F5F9' },
  modalItemActive: { backgroundColor: '#F0FDF4' },
  modalItemLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  modalItemLabelActive: { color: GREEN },
  modalItemSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  modalCheck: { fontSize: 16, color: GREEN, fontWeight: '700', marginLeft: 10 },
  modalDivider: { height: 1, backgroundColor: '#E2E8F0', marginHorizontal: 20, marginVertical: 6 },
  modalUploadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  modalUploadIcon: { fontSize: 20 },
  modalUploadText: { fontSize: 15, color: '#475569', fontWeight: '500' },

  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 24 },
  timeField: { alignItems: 'center', flex: 1 },
  timeLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  timeInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D8DDE6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 22, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', width: '100%' },
  timeSep: { fontSize: 22, fontWeight: '700', color: '#94a3b8', paddingBottom: 10 },

  inputCard: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D8DDE6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#1A1A2E' },

  effortRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  effortBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff', alignItems: 'center' },
  effortBtnActive: { borderColor: GREEN, backgroundColor: '#F0FDF4' },
  effortText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  effortTextActive: { color: GREEN },
  effortPct: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  paceHintText: { fontSize: 12, color: '#64748b', marginTop: 10, fontStyle: 'italic' },

  distWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 1, borderColor: '#FCD34D', padding: 12, marginBottom: 12 },
  distWarningIcon: { fontSize: 16 },
  distWarningText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },

  derivedPaceBadge: { backgroundColor: '#F0FDF4', borderRadius: 12, borderWidth: 1.5, borderColor: '#86EFAC', padding: 14, marginBottom: 12, alignItems: 'center' },
  derivedPaceLabel: { fontSize: 11, fontWeight: '600', color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  derivedPaceValue: { fontSize: 28, fontWeight: '800', color: '#15803d' },
  derivedPaceSub: { fontSize: 12, color: '#16a34a', marginTop: 4, fontStyle: 'italic' },

  resultCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: GREEN, padding: 16 },
  resultHeader: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  tileHighlight: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  tileLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  tileValue: { fontSize: 18, fontWeight: '800', color: '#111' },
  tileValueHighlight: { color: '#15803d' },
  assumption: { fontSize: 11, color: '#94a3b8', marginTop: 12, fontStyle: 'italic' },
  caveatBox: { marginTop: 10, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  caveatTitle: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
  caveatItem: { fontSize: 11, color: '#94a3b8', lineHeight: 18 },
  hint: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 12 },
});
