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
import {
  calcPace,
  calcTime,
  calcDistance,
  formatPace,
  paceToSecPerKm,
  secondsToTime,
  timeToSeconds,
  PaceUnit,
} from "../utils/pace";

type Sport = "run" | "bike" | "swim";
type SolveFor = "time" | "pace" | "distance";
type DistUnit = "km" | "mi";

const MI_PER_KM = 0.621371;
const KM_PER_MI = 1.60934;

const SPORT_UNITS: Record<Sport, PaceUnit[]> = {
  run: ["min/km", "min/mi"],
  bike: ["km/h", "mph"],
  swim: ["min/100m", "min/100yd"],
};

const SPORT_LABELS: Record<Sport, string> = {
  run: "Run",
  bike: "Bike",
  swim: "Swim",
};

const DEFAULT_DISTANCE_KM: Record<Sport, number> = {
  run: 10,
  bike: 40,
  swim: 1.5,
};

function defaultDist(sport: Sport, unit: DistUnit): string {
  const km = DEFAULT_DISTANCE_KM[sport];
  return unit === "mi" ? (km * MI_PER_KM).toFixed(2) : String(km);
}

export default function PaceCalculatorScreen() {
  const [sport, setSport] = useState<Sport>("run");
  const [solveFor, setSolveFor] = useState<SolveFor>("time");
  const [distUnit, setDistUnit] = useState<DistUnit>("km");
  const [distanceStr, setDistanceStr] = useState(defaultDist("run", "km"));
  const [timeStr, setTimeStr] = useState("");
  const [paceStr, setPaceStr] = useState("");
  const [paceUnit, setPaceUnit] = useState<PaceUnit>("min/km");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [solvedPaceSecPerKm, setSolvedPaceSecPerKm] = useState<number | null>(
    null,
  );

  function handleSportChange(s: Sport) {
    setSport(s);
    setDistanceStr(defaultDist(s, distUnit));
    setPaceUnit(SPORT_UNITS[s][0]);
    setResult("");
    setError("");
  }

  function handleDistUnitChange(u: DistUnit) {
    const current = parseFloat(distanceStr);
    if (!isNaN(current) && current > 0) {
      const converted = u === "mi" ? current * MI_PER_KM : current * KM_PER_MI;
      setDistanceStr(converted.toFixed(2));
    }
    setDistUnit(u);
    setResult("");
  }

  function toKm(val: number): number {
    return distUnit === "mi" ? val * KM_PER_MI : val;
  }

  function calculate() {
    setError("");
    setResult("");
    const distInput = parseFloat(distanceStr);
    const distKm = toKm(distInput);

    if (solveFor === "time") {
      setSolvedPaceSecPerKm(null);
      if (isNaN(distKm) || distKm <= 0) {
        setError("Enter a valid distance.");
        return;
      }
      const secPerKm = paceToSecPerKm(paceStr, paceUnit);
      if (isNaN(secPerKm) || secPerKm <= 0) {
        setError("Enter a valid pace.");
        return;
      }
      const totalSec = calcTime(distKm, secPerKm);
      setResult(`Finish time: ${secondsToTime(totalSec)}`);
    } else if (solveFor === "pace") {
      if (isNaN(distKm) || distKm <= 0) {
        setError("Enter a valid distance.");
        return;
      }
      const totalSec = timeToSeconds(timeStr);
      if (isNaN(totalSec) || totalSec <= 0) {
        setError("Enter a valid time (e.g. 1:30:00).");
        return;
      }
      const secPerKm = calcPace(distKm, totalSec);
      setSolvedPaceSecPerKm(secPerKm);
      setResult(
        `${sport === "bike" ? "Speed" : "Pace"}: ${formatPace(secPerKm, paceUnit)}`,
      );
    } else {
      setSolvedPaceSecPerKm(null);
      const totalSec = timeToSeconds(timeStr);
      if (isNaN(totalSec) || totalSec <= 0) {
        setError("Enter a valid time.");
        return;
      }
      const secPerKm = paceToSecPerKm(paceStr, paceUnit);
      if (isNaN(secPerKm) || secPerKm <= 0) {
        setError("Enter a valid pace.");
        return;
      }
      const km = calcDistance(totalSec, secPerKm);
      const display = distUnit === "mi" ? km * MI_PER_KM : km;
      setResult(`Distance: ${display.toFixed(2)} ${distUnit}`);
    }
  }

  const units = SPORT_UNITS[sport];

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
          <Text style={styles.title}>Pace Calculator</Text>

          {/* Sport selector */}
          <View style={styles.segmentRow}>
            {(Object.keys(SPORT_LABELS) as Sport[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.segmentBtn,
                  sport === s && styles.segmentBtnActive,
                ]}
                onPress={() => handleSportChange(s)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    sport === s && styles.segmentTextActive,
                  ]}
                >
                  {SPORT_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Solve For selector */}
          <Text style={styles.label}>Solve for</Text>
          <View style={styles.segmentRow}>
            {(["time", "pace", "distance"] as SolveFor[]).map((sf) => (
              <TouchableOpacity
                key={sf}
                style={[
                  styles.segmentBtn,
                  solveFor === sf && styles.segmentBtnActive,
                ]}
                onPress={() => {
                  setSolveFor(sf);
                  setResult("");
                  setError("");
                }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    solveFor === sf && styles.segmentTextActive,
                  ]}
                >
                  {sf === "pace" && sport === "bike"
                    ? "Speed"
                    : sf.charAt(0).toUpperCase() + sf.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Inputs */}
          {solveFor !== "distance" && (
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { marginTop: 0, marginBottom: 0 }]}>
                  Distance
                </Text>
                <View style={styles.miniToggle}>
                  {(["km", "mi"] as DistUnit[]).map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[
                        styles.miniBtn,
                        distUnit === u && styles.miniBtnActive,
                      ]}
                      onPress={() => handleDistUnitChange(u)}
                    >
                      <Text
                        style={[
                          styles.miniText,
                          distUnit === u && styles.miniTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={distanceStr}
                onChangeText={setDistanceStr}
                placeholder={distUnit === "km" ? "e.g. 10" : "e.g. 6.2"}
                placeholderTextColor="#999"
              />
            </View>
          )}

          {solveFor !== "time" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Time (H:MM:SS or MM:SS)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numbers-and-punctuation"
                value={timeStr}
                onChangeText={setTimeStr}
                placeholder="e.g. 1:00:00"
                placeholderTextColor="#999"
              />
            </View>
          )}

          {solveFor !== "pace" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {sport === "bike" ? "Speed" : "Pace"}
              </Text>
              <View style={styles.paceRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  keyboardType="numbers-and-punctuation"
                  value={paceStr}
                  onChangeText={setPaceStr}
                  placeholder={paceUnit.startsWith("min") ? "MM:SS" : "e.g. 30"}
                  placeholderTextColor="#999"
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.unitScroll}
                >
                  {units.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[
                        styles.unitBtn,
                        paceUnit === u && styles.unitBtnActive,
                      ]}
                      onPress={() => setPaceUnit(u)}
                    >
                      <Text
                        style={[
                          styles.unitText,
                          paceUnit === u && styles.unitTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {solveFor === "pace" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {sport === "bike" ? "Speed unit" : "Result unit"}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {units.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[
                      styles.unitBtn,
                      paceUnit === u && styles.unitBtnActive,
                    ]}
                    onPress={() => {
                      setPaceUnit(u);
                      if (solvedPaceSecPerKm !== null) {
                        setResult(
                          `${sport === "bike" ? "Speed" : "Pace"}: ${formatPace(solvedPaceSecPerKm, u)}`,
                        );
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.unitText,
                        paceUnit === u && styles.unitTextActive,
                      ]}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
            <Text style={styles.calcBtnText}>Calculate</Text>
          </TouchableOpacity>

          {error !== "" && <Text style={styles.error}>{error}</Text>}
          {result !== "" && (
            <View style={styles.resultBox}>
              <Text style={styles.resultText}>{result}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BLUE = "#1A73E8";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FA" },
  container: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
    marginTop: 14,
  },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: "#E8EDF3",
    borderRadius: 10,
    padding: 3,
    marginBottom: 4,
  },
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
  segmentText: { fontSize: 14, color: "#666" },
  segmentTextActive: { color: BLUE, fontWeight: "700" },
  inputGroup: { marginTop: 4 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    marginTop: 14,
  },
  miniToggle: {
    flexDirection: "row",
    backgroundColor: "#E8EDF3",
    borderRadius: 8,
    padding: 2,
  },
  miniBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  miniBtnActive: { backgroundColor: BLUE },
  miniText: { fontSize: 12, fontWeight: "600", color: "#666" },
  miniTextActive: { color: "#fff" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8DDE6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    color: "#1A1A2E",
  },
  paceRow: { flexDirection: "row", alignItems: "center" },
  unitScroll: { flexShrink: 1 },
  unitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#E8EDF3",
    marginRight: 6,
  },
  unitBtnActive: { backgroundColor: BLUE },
  unitText: { fontSize: 13, color: "#555" },
  unitTextActive: { color: "#fff", fontWeight: "600" },
  calcBtn: {
    marginTop: 24,
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  calcBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  error: { marginTop: 12, color: "#D32F2F", textAlign: "center" },
  resultBox: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8DDE6",
  },
  resultText: { fontSize: 22, fontWeight: "700", color: BLUE },
});
