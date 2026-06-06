/** Convert total seconds to "H:MM:SS" or "M:SS" string */
export function secondsToTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Parse "H:MM:SS" or "MM:SS" or plain seconds string → total seconds, or NaN */
export function timeToSeconds(input: string): number {
  const parts = input.split(':').map(Number);
  if (parts.some(isNaN)) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return NaN;
}

export type PaceUnit = 'min/km' | 'min/mi' | 'min/100m' | 'min/100yd' | 'km/h' | 'mph';

const KM_PER_MILE = 1.60934;
const YARD_PER_METER = 1.09361;

/** Calculate finish time given distance (km) and pace (sec/km) */
export function calcTime(distanceKm: number, paceSecPerKm: number): number {
  return distanceKm * paceSecPerKm;
}

/** Calculate pace (sec/km) given distance (km) and time (sec) */
export function calcPace(distanceKm: number, timeSec: number): number {
  return timeSec / distanceKm;
}

/** Calculate distance (km) given time (sec) and pace (sec/km) */
export function calcDistance(timeSec: number, paceSecPerKm: number): number {
  return timeSec / paceSecPerKm;
}

/** Format pace in sec/km to a display string for the chosen unit */
export function formatPace(paceSecPerKm: number, unit: PaceUnit): string {
  if (!isFinite(paceSecPerKm) || paceSecPerKm <= 0) return '—';
  switch (unit) {
    case 'min/km': {
      return secondsToTime(paceSecPerKm) + ' /km';
    }
    case 'min/mi': {
      const secPerMile = paceSecPerKm * KM_PER_MILE;
      return secondsToTime(secPerMile) + ' /mi';
    }
    case 'min/100m': {
      const secPer100m = paceSecPerKm / 10;
      return secondsToTime(secPer100m) + ' /100m';
    }
    case 'min/100yd': {
      const secPer100yd = paceSecPerKm / (10 * YARD_PER_METER);
      return secondsToTime(secPer100yd) + ' /100yd';
    }
    case 'km/h': {
      const kmh = 3600 / paceSecPerKm;
      return kmh.toFixed(1) + ' km/h';
    }
    case 'mph': {
      const mph = 3600 / (paceSecPerKm * KM_PER_MILE);
      return mph.toFixed(1) + ' mph';
    }
  }
}

/** Convert pace string + unit to sec/km */
export function paceToSecPerKm(paceStr: string, unit: PaceUnit): number {
  switch (unit) {
    case 'min/km': return timeToSeconds(paceStr);
    case 'min/mi': return timeToSeconds(paceStr) / KM_PER_MILE;
    case 'min/100m': return timeToSeconds(paceStr) * 10;
    case 'min/100yd': return timeToSeconds(paceStr) * 10 * YARD_PER_METER;
    case 'km/h': {
      const kmh = parseFloat(paceStr);
      return isNaN(kmh) ? NaN : 3600 / kmh;
    }
    case 'mph': {
      const mph = parseFloat(paceStr);
      return isNaN(mph) ? NaN : (3600 / mph) / KM_PER_MILE;
    }
  }
}

export const TRIATHLON_DISTANCES = [
  { labelKm: 'Sprint',      labelMi: 'Sprint',      swim: 0.75, bike: 20,  run: 5,    swimYd: 820,  swimMi: 0.47, bikeMi: 12.4, runMi: 3.1  },
  { labelKm: 'Olympic',     labelMi: 'Olympic',     swim: 1.5,  bike: 40,  run: 10,   swimYd: 1640, swimMi: 0.93, bikeMi: 24.9, runMi: 6.2  },
  { labelKm: 'Half (113)',  labelMi: 'Half (70.3)', swim: 1.9,  bike: 90,  run: 21.1, swimYd: 2112, swimMi: 1.2,  bikeMi: 56,   runMi: 13.1 },
  { labelKm: 'Full (226)',  labelMi: 'Full (140.6)',swim: 3.8,  bike: 180, run: 42.2, swimYd: 4224, swimMi: 2.4,  bikeMi: 112,  runMi: 26.2 },
] as const;
