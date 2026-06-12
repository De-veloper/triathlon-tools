export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const TOOLS: Tool[] = [
  {
    id: 'pace-calculator',
    name: 'Pace Calculator',
    description: 'Calculate run, bike, and swim pace for any distance or target time.',
    icon: '⏱️',
    color: '#1A73E8',
  },
  {
    id: 'race-planner',
    name: 'Race Planner',
    description: 'Estimate your triathlon finish time with split breakdowns.',
    icon: '🏁',
    color: '#22C55E',
  },
  {
    id: 'power-zones',
    name: 'Power Zones',
    description: 'Enter your FTP to see all 7 Coggan power training zones in watts.',
    icon: '⚡',
    color: '#F59E0B',
  },
  {
    id: 'ironman-qualification',
    name: 'IM Qualification',
    description: 'Calculate your age-graded finish time for Ironman World Championship qualification.',
    icon: '🏆',
    color: '#EF4444',
  },
  {
    id: 'climbing-calculator',
    name: 'Climbing Calculator',
    description: 'Estimate climb time from power, or find the watts needed to hit a target time.',
    icon: '⛰️',
    color: '#64748B',
  },
  {
    id: 'tire-pressure',
    name: 'Tire Pressure',
    description: 'Calculate optimal front and rear tire pressure based on rider weight and tire width.',
    icon: '🛞',
    color: '#0ea5e9',
  },
  {
    id: 'gear-ratio',
    name: 'Gear Ratio',
    description: 'See speed for every chainring/cog combo with color-coded heat map.',
    icon: '⚙️',
    color: '#6366f1',
  },
  {
    id: 'stem-align',
    name: 'Stem Align',
    description: 'Use the camera to check if your bike stem and handlebar are perfectly centered.',
    icon: '🚲',
    color: '#0d9488',
  },
  {
    id: 'bike-time-predictor',
    name: 'Bike Time Predictor',
    description: 'Estimate your bike split from a GPX course file and your FTP.',
    icon: '🗺️',
    color: '#7c3aed',
  },
  {
    id: 'run-time-predictor',
    name: 'Run Time Predictor',
    description: 'Estimate your run split from threshold pace with elevation adjustment.',
    icon: '🏃',
    color: '#16a34a',
  },
];
