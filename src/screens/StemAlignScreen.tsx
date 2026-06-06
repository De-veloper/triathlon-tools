import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  PanResponder, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const CYAN = 'rgba(0,210,255,0.9)';
const CYAN_GLOW = 'rgba(0,210,255,0.4)';

export default function StemAlignScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [hPct, setHPct] = useState(50);
  const [containerHeight, setContainerHeight] = useState(Dimensions.get('window').height * 0.7);
  const viewShotRef = useRef<ViewShotRef>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        const newPct = Math.min(Math.max(
          ((gs.moveY) / containerHeight) * 100,
          2
        ), 98);
        setHPct(newPct);
      },
    })
  ).current;

  // We need a live ref to containerHeight for the pan responder
  const containerHeightRef = useRef(containerHeight);
  containerHeightRef.current = containerHeight;

  const livePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        const h = containerHeightRef.current;
        const newPct = Math.min(Math.max((gs.moveY / h) * 100, 2), 98);
        setHPct(newPct);
      },
    })
  ).current;

  async function handleStartCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setCameraOn(true);
  }

  async function handleScreenshot() {
    try {
      const uri = await (viewShotRef.current as any).capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Stem Align' });
      }
    } catch {
      // silently ignore
    }
  }

  const hY = (hPct / 100) * containerHeight;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Camera + overlay area */}
      <ViewShot
        ref={viewShotRef}
        style={s.viewShot}
        options={{ format: 'png', quality: 1 }}
        onLayout={e => {
          const h = e.nativeEvent.layout.height;
          containerHeightRef.current = h;
          setContainerHeight(h);
        }}
      >
        {cameraOn ? (
          <CameraView style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <View style={s.placeholder}>
            <Text style={s.placeholderIcon}>🚲</Text>
            <Text style={s.placeholderTitle}>Stem Align</Text>
            <Text style={s.placeholderText}>
              Hold your phone above the bike stem looking down.
              Center the stem at the crosshair — handlebar should align with the horizontal line, wheel with the vertical.
            </Text>
          </View>
        )}

        {cameraOn && (
          <>
            {/* Guide tip */}
            <View style={s.guideTip} pointerEvents="none">
              <Text style={s.guideTipText}>Handlebar → horizontal · Wheel → vertical</Text>
            </View>

            {/* Vertical line (fixed center) */}
            <View style={s.vLine} pointerEvents="none" />

            {/* Horizontal line — drag zone */}
            <View
              style={[s.hDragZone, { top: hY - 22 }]}
              {...livePanResponder.panHandlers}
            >
              {/* The visible line */}
              <View style={s.hLine} pointerEvents="none" />
              {/* Drag handle dot */}
              <View style={s.hHandle} pointerEvents="none">
                <Text style={s.hHandleIcon}>↕</Text>
              </View>
            </View>

            {/* Intersection dot */}
            <View
              style={[s.intersectionDot, { top: hY - 6, left: '50%', marginLeft: -6 }]}
              pointerEvents="none"
            />
          </>
        )}
      </ViewShot>

      {/* Toolbar */}
      <View style={s.toolbar}>
        {!cameraOn ? null : (
          <>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#ef4444' }]} onPress={() => setCameraOn(false)}>
              <Text style={s.btnText}>⏹  Stop</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={handleScreenshot}>
              <Text style={s.btnText}>📸  Screenshot</Text>
            </TouchableOpacity>
            {hPct !== 50 && (
              <TouchableOpacity style={[s.btn, { backgroundColor: '#475569' }]} onPress={() => setHPct(50)}>
                <Text style={s.btnText}>↺  Reset</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        {!cameraOn && (
          <TouchableOpacity style={[s.btn, { backgroundColor: '#22c55e' }]} onPress={handleStartCamera}>
            <Text style={s.btnText}>📷  Start Camera</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  viewShot: { flex: 1, backgroundColor: '#111' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  placeholderIcon: { fontSize: 48 },
  placeholderTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  placeholderText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  startBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#22c55e',
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  guideTip: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 20,
  },
  guideTipText: { color: '#ccc', fontSize: 11 },
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: -1,
    width: 2,
    backgroundColor: CYAN,
    shadowColor: CYAN_GLOW,
    shadowRadius: 8,
    shadowOpacity: 1,
    elevation: 4,
    zIndex: 10,
  },
  hDragZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 44,
    zIndex: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 21,
    height: 2,
    backgroundColor: CYAN,
    shadowColor: CYAN_GLOW,
    shadowRadius: 8,
    shadowOpacity: 1,
  },
  hHandle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: CYAN,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hHandleIcon: { color: CYAN, fontSize: 11, fontWeight: '700' },
  intersectionDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: CYAN,
    shadowColor: CYAN_GLOW,
    shadowRadius: 10,
    shadowOpacity: 1,
    zIndex: 12,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
