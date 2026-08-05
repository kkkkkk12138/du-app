import {Linking, PermissionsAndroid, Platform} from 'react-native';
import {
  check,
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';
import {Camera} from 'react-native-vision-camera';

export type PermissionAccess = 'granted' | 'denied' | 'blocked';

export async function requestCameraAccess() {
  const current = Camera.getCameraPermissionStatus();
  if (current === 'granted') {
    return 'granted' satisfies PermissionAccess;
  }
  if (current === 'restricted') {
    return 'blocked' satisfies PermissionAccess;
  }
  const next = await Camera.requestCameraPermission();
  if (next === 'granted') {
    return 'granted' satisfies PermissionAccess;
  }
  return current === 'denied' ? 'blocked' : 'denied';
}

export async function requestMicrophoneAccess() {
  if (Platform.OS === 'ios') {
    const current = await check(PERMISSIONS.IOS.MICROPHONE);
    if (current === RESULTS.GRANTED) {
      return (await request(PERMISSIONS.IOS.MICROPHONE)) === RESULTS.GRANTED
        ? 'granted'
        : 'denied';
    }
    if (current === RESULTS.BLOCKED) {
      return 'blocked' satisfies PermissionAccess;
    }
    const next = await request(PERMISSIONS.IOS.MICROPHONE);
    return next === RESULTS.GRANTED
      ? 'granted'
      : next === RESULTS.BLOCKED
        ? 'blocked'
        : 'denied';
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: '允许录制语音日记',
      message: '只有点击录音时才会使用麦克风，录音只保存在本机。',
      buttonPositive: '允许',
      buttonNegative: '暂不',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED
    ? 'granted'
    : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ? 'blocked'
      : 'denied';
}

export async function requestLocationAccess() {
  if (Platform.OS === 'ios') {
    const current = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    if (current === RESULTS.GRANTED) {
      return 'granted' satisfies PermissionAccess;
    }
    if (current === RESULTS.BLOCKED) {
      return 'blocked' satisfies PermissionAccess;
    }
    const next = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    return next === RESULTS.GRANTED
      ? 'granted'
      : next === RESULTS.BLOCKED
        ? 'blocked'
        : 'denied';
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: '允许标记此刻的位置',
      message: '只有点击位置时才会读取一次坐标，位置不会上传。',
      buttonPositive: '允许',
      buttonNegative: '暂不',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED
    ? 'granted'
    : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ? 'blocked'
      : 'denied';
}

export async function openAppSettings() {
  await Linking.openSettings();
}
