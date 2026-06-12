export type TrackPoint = { lat: number; lon: number; ele: number };

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function parseGpxString(xml: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  // Match the trkpt tag + its ele child without assuming lat/lon attribute order (GPX 1.1 doesn't guarantee it)
  const trkptRe = /<trkpt([^>]*)>[\s\S]*?<ele>([^<]+)<\/ele>/g;
  let m: RegExpExecArray | null;
  while ((m = trkptRe.exec(xml)) !== null) {
    const attrs = m[1];
    const latM = /lat="([^"]+)"/.exec(attrs);
    const lonM = /lon="([^"]+)"/.exec(attrs);
    if (!latM || !lonM) continue;
    points.push({ lat: parseFloat(latM[1]), lon: parseFloat(lonM[1]), ele: parseFloat(m[2]) });
  }
  return points;
}

export type CourseSegment = { cumDistM: number; eleM: number };

export type CourseData = {
  segments: CourseSegment[];
  totalDistM: number;
  elevGainM: number;
  elevLossM: number;
};

export function trackPointsToCourse(points: TrackPoint[]): CourseData {
  if (points.length < 2) throw new Error('GPX has fewer than 2 track points');

  let cumDist = 0;
  let elevGain = 0;
  let elevLoss = 0;
  const segments: CourseSegment[] = [{ cumDistM: 0, eleM: points[0].ele }];

  for (let i = 1; i < points.length; i++) {
    const d = haversineM(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    cumDist += d;
    const dEle = points[i].ele - points[i - 1].ele;
    if (dEle > 0) elevGain += dEle;
    else elevLoss += -dEle;
    segments.push({ cumDistM: cumDist, eleM: points[i].ele });
  }

  return { segments, totalDistM: cumDist, elevGainM: elevGain, elevLossM: elevLoss };
}

export function preloadedToCourse(
  data: [number, number][],
  totalDistM: number,
  elevGainM: number,
): CourseData {
  let elevLoss = 0;
  for (let i = 1; i < data.length; i++) {
    const dEle = data[i][1] - data[i - 1][1];
    if (dEle < 0) elevLoss += -dEle;
  }
  return {
    segments: data.map(([cumDistM, eleM]) => ({ cumDistM, eleM })),
    totalDistM,
    elevGainM,
    elevLossM: elevLoss,
  };
}
