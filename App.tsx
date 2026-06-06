import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import PaceCalculatorScreen from './src/screens/PaceCalculatorScreen';
import RacePlannerScreen from './src/screens/RacePlannerScreen';
import PowerZonesScreen from './src/screens/PowerZonesScreen';
import IronmanQualificationScreen from './src/screens/IronmanQualificationScreen';
import ClimbingCalculatorScreen from './src/screens/ClimbingCalculatorScreen';
import TirePressureScreen from './src/screens/TirePressureScreen';
import GearRatioScreen from './src/screens/GearRatioScreen';
import StemAlignScreen from './src/screens/StemAlignScreen';

export type RootStackParamList = {
  Home: undefined;
  'pace-calculator': undefined;
  'race-planner': undefined;
  'power-zones': undefined;
  'ironman-qualification': undefined;
  'climbing-calculator': undefined;
  'tire-pressure': undefined;
  'gear-ratio': undefined;
  'stem-align': undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#F5F7FA' },
            headerTitleStyle: { fontWeight: '700', color: '#1A1A2E' },
            headerBackTitle: 'Back',
            contentStyle: { backgroundColor: '#F5F7FA' },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="pace-calculator"
            component={PaceCalculatorScreen}
            options={{ title: 'Pace Calculator' }}
          />
          <Stack.Screen
            name="race-planner"
            component={RacePlannerScreen}
            options={{ title: 'Race Planner' }}
          />
          <Stack.Screen
            name="power-zones"
            component={PowerZonesScreen}
            options={{ title: 'Power Zones' }}
          />
          <Stack.Screen
            name="ironman-qualification"
            component={IronmanQualificationScreen}
            options={{ title: 'IM Qualification' }}
          />
          <Stack.Screen
            name="climbing-calculator"
            component={ClimbingCalculatorScreen}
            options={{ title: 'Climbing Calculator' }}
          />
          <Stack.Screen
            name="tire-pressure"
            component={TirePressureScreen}
            options={{ title: 'Tire Pressure' }}
          />
          <Stack.Screen
            name="gear-ratio"
            component={GearRatioScreen}
            options={{ title: 'Gear Ratio' }}
          />
          <Stack.Screen
            name="stem-align"
            component={StemAlignScreen}
            options={{ title: 'Stem Align', headerStyle: { backgroundColor: '#111' }, headerTitleStyle: { color: '#fff' }, headerTintColor: '#aaa' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
