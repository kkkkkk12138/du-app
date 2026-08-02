import React, {useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Camera, useCameraDevice} from 'react-native-vision-camera';
import {SafeAreaView} from 'react-native-safe-area-context';

import {archiveMediaFile} from '../../services/mediaStorage';
import {fontFamilies} from '../../tokens/typography';

type CameraOverlayProps = {
  onCancel: () => void;
  onCapture: (path: string) => void;
};

export function CameraOverlay({onCancel, onCapture}: CameraOverlayProps) {
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string>();

  const takePhoto = async () => {
    if (!camera.current || capturing) {
      return;
    }
    setCapturing(true);
    setCaptureError(undefined);
    try {
      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableShutterSound: true,
      });
      onCapture(await archiveMediaFile(photo.path, 'photo', 'jpg'));
    } catch {
      setCaptureError('照片没有保存下来，请再试一次');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="取消拍照"
          onPress={onCancel}>
          <Text style={styles.topAction}>取消</Text>
        </Pressable>
        <Text style={styles.title}>此刻的景</Text>
        <View style={styles.topPlaceholder} />
      </View>
      {device ? (
        <Camera
          ref={camera}
          device={device}
          isActive
          photo
          style={styles.camera}
        />
      ) : (
        <View style={styles.unavailable}>
          <Text style={styles.unavailableText}>当前设备没有可用相机</Text>
        </View>
      )}
      <View style={styles.controls}>
        {captureError ? (
          <Text accessibilityRole="alert" style={styles.captureError}>
            {captureError}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="拍下此刻"
          disabled={!device || capturing}
          onPress={takePhoto}
          style={({pressed}) => [
            styles.shutterOuter,
            {opacity: !device || capturing ? 0.35 : pressed ? 0.7 : 1},
          ]}>
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#171411'},
  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  topAction: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fontFamilies.sans,
    fontSize: 14,
  },
  title: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.serif,
    fontSize: 16,
  },
  topPlaceholder: {width: 28},
  camera: {flex: 1},
  unavailable: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  unavailableText: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
  },
  controls: {
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  captureError: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fontFamilies.sans,
    fontSize: 11,
  },
  shutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF8F0',
  },
});
