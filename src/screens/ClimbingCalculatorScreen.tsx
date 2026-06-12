import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Physics constants ─────────────────────────────────────────────────────────
const G = 9.81;
const AIR_DENSITY = 1.225;
const CDA = 0.32;
const CRR = 0.005;

function calcSpeed(powerW: number, massKg: number, gradePct: number): number {
  const grade = gradePct / 100;
  const sinTheta = Math.sin(Math.atan(grade));
  const A = 0.5 * AIR_DENSITY * CDA;
  const B = massKg * G * (sinTheta + CRR);
  let v = 3;
  for (let i = 0; i < 60; i++) {
    const f = A * v * v * v + B * v - powerW;
    const df = 3 * A * v * v + B;
    const step = f / df;
    v -= step;
    if (v < 0.1) v = 0.1;
    if (Math.abs(step) < 0.0001) break;
  }
  return v;
}

function calcPower(speedMs: number, massKg: number, gradePct: number): number {
  const grade = gradePct / 100;
  const sinTheta = Math.sin(Math.atan(grade));
  return (
    massKg * G * (sinTheta + CRR) * speedMs +
    0.5 * AIR_DENSITY * CDA * Math.pow(speedMs, 3)
  );
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function vamLevel(vam: number) {
  if (vam < 700) return { label: "Recreational cyclist", color: "#94a3b8" };
  if (vam < 900) return { label: "Trained club rider", color: "#4ade80" };
  if (vam < 1100) return { label: "Cat 3–4 racer", color: "#facc15" };
  if (vam < 1300) return { label: "Cat 1–2 / Elite amateur", color: "#fb923c" };
  if (vam < 1500) return { label: "Domestic pro", color: "#f87171" };
  return { label: "Tour de France level", color: "#c084fc" };
}

// ── Data ──────────────────────────────────────────────────────────────────────
const FAMOUS_CLIMBS = [
  { name: "Alpe d'Huez", distance: 13.8, gradient: 8.1 },
  { name: "Mont Ventoux", distance: 21.5, gradient: 7.5 },
  { name: "Col du Galibier", distance: 18.1, gradient: 6.9 },
  { name: "Col du Tourmalet", distance: 19.0, gradient: 7.4 },
  { name: "Stelvio Pass", distance: 24.3, gradient: 7.4 },
];

type Mode = "time" | "power";
type UnitSystem = "metric" | "imperial";

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ClimbingCalculatorScreen() {
  const [mode, setMode] = useState<Mode>("time");
  const [units, setUnits] = useState<UnitSystem>("metric");
  const [distance, setDistance] = useState("");
  const [gradient, setGradient] = useState("");
  const [riderWeight, setRiderWeight] = useState("");
  const [bikeWeight, setBikeWeight] = useState("");
  const [power, setPower] = useState("");
  const [targetMin, setTargetMin] = useState("");
  const [targetSec, setTargetSec] = useState("");

  const distKm = (() => {
    const d = parseFloat(distance);
    if (!d) return 0;
    return units === "imperial" ? d * 1.60934 : d;
  })();
  const gradePct = parseFloat(gradient) || 0;
  const riderKg = (() => {
    const w = parseFloat(riderWeight);
    if (!w) return 0;
    return units === "imperial" ? w * 0.453592 : w;
  })();
  const bikeKg = (() => {
    const w = parseFloat(bikeWeight) || 0;
    return units === "imperial" ? w * 0.453592 : w;
  })();
  const totalKg = riderKg + bikeKg;
  const powerW = parseFloat(power) || 0;
  const elevationM = (distKm * 1000 * gradePct) / 100;
  const hasInputs = distKm > 0 && gradePct > 0 && totalKg > 0;

  const timeResult = (() => {
    if (!hasInputs || !powerW || mode !== "time") return null;
    const speedMs = calcSpeed(powerW, totalKg, gradePct);
    const timeS = (distKm * 1000) / speedMs;
    const speedKph = speedMs * 3.6;
    const vam = elevationM / (timeS / 3600);
    const wkg = powerW / riderKg;
    return { timeS, speedKph, vam, wkg };
  })();

  const powerResult = (() => {
    if (!hasInputs || mode !== "power") return null;
    const mins = parseFloat(targetMin) || 0;
    const secs = parseFloat(targetSec) || 0;
    const totalSec = mins * 60 + secs;
    if (totalSec <= 0) return null;
    const speedMs = (distKm * 1000) / totalSec;
    const reqPower = calcPower(speedMs, totalKg, gradePct);
    const speedKph = speedMs * 3.6;
    const vam = elevationM / (totalSec / 3600);
    const wkg = reqPower / riderKg;
    return { reqPower, speedKph, vam, wkg };
  })();

  const distLabel = units === "imperial" ? "mi" : "km";
  const weightLabel = units === "imperial" ? "lbs" : "kg";

  function loadClimb(c: (typeof FAMOUS_CLIMBS)[0]) {
    const d =
      units === "imperial"
        ? (c.distance / 1.60934).toFixed(1)
        : c.distance.toString();
    setDistance(d);
    setGradient(c.gradient.toString());
  }

  const vam = timeResult?.vam ?? powerResult?.vam ?? 0;
  const hasResult = !!timeResult || !!powerResult;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Climbing Calculator</Text>
          <Text style={styles.subtitle}>
            Estimate your climb time from power, or find the watts needed to hit
            a target time.
          </Text>

          {/* Mode + Unit toggles */}
          <View style={styles.toggleBar}>
            <View style={styles.segmentRow}>
              {(["time", "power"] as Mode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.segmentBtn,
                    mode === m && styles.segmentBtnActive,
                  ]}
                  onPress={() => setMode(m)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      mode === m && styles.segmentTextActive,
                    ]}
                  >
                    {m === "time" ? "⏱ Est. Time" : "⚡ Find Power"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.segmentRow, styles.unitRow]}>
              {(["metric", "imperial"] as UnitSystem[]).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.segmentBtn,
                    units === u && styles.segmentBtnGrey,
                  ]}
                  onPress={() => setUnits(u)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      units === u && styles.segmentTextGrey,
                    ]}
                  >
                    {u === "metric" ? "km/kg" : "mi/lbs"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Famous climbs */}
          <Text style={styles.climbsLabel}>Famous Climbs — tap to load</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.climbsScroll}
          >
            {FAMOUS_CLIMBS.map((c) => {
              const d =
                units === "imperial"
                  ? `${(c.distance / 1.60934).toFixed(1)}mi`
                  : `${c.distance}km`;
              return (
                <TouchableOpacity
                  key={c.name}
                  style={styles.climbChip}
                  onPress={() => loadClimb(c)}
                >
                  <Text style={styles.climbName}>{c.name}</Text>
                  <Text style={styles.climbStat}>
                    {d} @ {c.gradient}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Input card */}
          <View style={styles.inputCard}>
            <View style={styles.inputGrid}>
              <LabeledInput
                label={`Distance (${distLabel})`}
                value={distance}
                onChangeText={setDistance}
                placeholder={units === "imperial" ? "e.g. 8.6" : "e.g. 13.8"}
              />
              <LabeledInput
                label="Gradient (%)"
                value={gradient}
                onChangeText={setGradient}
                placeholder="e.g. 8.1"
              />
              <LabeledInput
                label={`Rider weight (${weightLabel})`}
                value={riderWeight}
                onChangeText={setRiderWeight}
                placeholder={units === "imperial" ? "e.g. 154" : "e.g. 70"}
              />
              <LabeledInput
                label={`Bike weight (${weightLabel})`}
                value={bikeWeight}
                onChangeText={setBikeWeight}
                placeholder={units === "imperial" ? "e.g. 17" : "e.g. 8"}
              />

              {mode === "time" ? (
                <LabeledInput
                  label="Power (watts)"
                  value={power}
                  onChangeText={setPower}
                  placeholder="e.g. 220"
                />
              ) : (
                <View>
                  <Text style={styles.inputLabel}>Target time</Text>
                  <View style={styles.targetTimeRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      keyboardType="number-pad"
                      value={targetMin}
                      onChangeText={setTargetMin}
                      placeholder="min"
                      placeholderTextColor="#999"
                    />
                    <Text style={styles.timeSep}>:</Text>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      keyboardType="number-pad"
                      value={targetSec}
                      onChangeText={(v) =>
                        setTargetSec(String(Math.min(parseInt(v) || 0, 59)))
                      }
                      placeholder="sec"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
              )}

              {distKm > 0 && gradePct > 0 && (
                <View style={styles.elevRow}>
                  <Text style={styles.elevText}>
                    📏 Elevation gain:{" "}
                    <Text style={{ fontWeight: "700" }}>
                      {Math.round(elevationM)}m
                    </Text>{" "}
                    ({Math.round(elevationM * 3.28084)}ft)
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Results */}
          {hasResult && (
            <View style={styles.resultCard}>
              <Text style={styles.resultHeader}>Result</Text>
              <View style={styles.resultGrid}>
                {timeResult && (
                  <>
                    <ResultTile
                      label="Estimated Time"
                      value={formatTime(timeResult.timeS)}
                      highlight
                    />
                    <ResultTile
                      label="Speed"
                      value={
                        units === "imperial"
                          ? `${(timeResult.speedKph * 0.621371).toFixed(1)} mph`
                          : `${timeResult.speedKph.toFixed(1)} km/h`
                      }
                    />
                    <ResultTile
                      label="W/kg"
                      value={`${timeResult.wkg.toFixed(2)} w/kg`}
                    />
                    <ResultTile
                      label="VAM"
                      value={`${Math.round(timeResult.vam)} m/h`}
                    />
                  </>
                )}
                {powerResult && (
                  <>
                    <ResultTile
                      label="Required Power"
                      value={`${Math.round(powerResult.reqPower)} W`}
                      highlight
                    />
                    <ResultTile
                      label="W/kg"
                      value={`${powerResult.wkg.toFixed(2)} w/kg`}
                    />
                    <ResultTile
                      label="Speed"
                      value={
                        units === "imperial"
                          ? `${(powerResult.speedKph * 0.621371).toFixed(1)} mph`
                          : `${powerResult.speedKph.toFixed(1)} km/h`
                      }
                    />
                    <ResultTile
                      label="VAM"
                      value={`${Math.round(powerResult.vam)} m/h`}
                    />
                  </>
                )}
              </View>

              {/* VAM context */}
              {vam > 0 &&
                (() => {
                  const lvl = vamLevel(vam);
                  return (
                    <View style={styles.vamRow}>
                      <Text style={[styles.vamValue, { color: lvl.color }]}>
                        VAM {Math.round(vam)} m/h
                      </Text>
                      <Text style={styles.vamArrow}> → </Text>
                      <Text style={styles.vamLabel}>{lvl.label}</Text>
                    </View>
                  );
                })()}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
      />
    </View>
  );
}

function ResultTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.tile, highlight && styles.tileHighlight]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, highlight && styles.tileValueHighlight]}>
        {value}
      </Text>
    </View>
  );
}

const BLUE = "#1A73E8";
const GREY = "#64748b";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FA" },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "700", color: "#1A1A2E", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#888", lineHeight: 18, marginBottom: 18 },

  toggleBar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  segmentRow: {
    flexDirection: "row",
    flex: 1,
    backgroundColor: "#E8EDF3",
    borderRadius: 10,
    padding: 3,
  },
  unitRow: { flex: 0, minWidth: 130 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnGrey: { backgroundColor: GREY },
  segmentText: { fontSize: 10, color: "#666" },
  segmentTextActive: { color: BLUE, fontWeight: "700" },
  segmentTextGrey: { color: "#fff", fontWeight: "700" },

  climbsLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  climbsScroll: { marginBottom: 16 },
  climbChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    marginRight: 8,
  },
  climbName: { fontSize: 13, fontWeight: "700", color: "#475569" },
  climbStat: { fontSize: 11, color: "#94a3b8", marginTop: 1 },

  inputCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
  },
  inputGrid: { gap: 14 },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#D8DDE6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1A1A2E",
  },
  targetTimeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeSep: { fontSize: 20, fontWeight: "700", color: "#1A1A2E" },
  elevRow: { paddingVertical: 4 },
  elevText: { fontSize: 13, color: "#64748b" },

  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BLUE,
    padding: 16,
  },
  resultHeader: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  resultGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "47%",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tileHighlight: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  tileLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  tileValue: { fontSize: 18, fontWeight: "800", color: "#111" },
  tileValueHighlight: { color: "#1d4ed8" },
  vamRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E8EDF3",
  },
  vamValue: { fontSize: 14, fontWeight: "700" },
  vamArrow: { fontSize: 13, color: "#64748b" },
  vamLabel: { fontSize: 13, color: "#475569", flex: 1 },
});
