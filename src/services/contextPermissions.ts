import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';
import {Camera} from 'react-native-vision-camera';

export async function requestCameraAccess() {
  const current = Camera.getCameraPermissionStatus();
  if (current === 'granted') {
    return true;
  }
  return (await Camera.requestCameraPermission()) === 'granted';
}

export async function requestMicrophoneAccess() {
  if (Platform.OS === 'ios') {
    return (await request(PERMISSIONS.IOS.MICROPHONE)) === RESULTS.GRANTED;
  }
  return (
    (await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: '允许录制语音日记',
        message: '只有点击录音时才会使用麦克风，录音只保存在本机。',
        buttonPositive: '允许',
        buttonNegative: '暂不',
      },
    )) === PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function requestLocationAccess() {
  if (Platform.OS === 'ios') {
    return (await Geolocation.requestAuthorization('whenInUse')) === 'granted';
  }
  return (
    (await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: '允许标记此刻的位置',
        message: '只有点击位置时才会读取一次坐标，位置不会上传。',
        buttonPositive: '允许',
        buttonNegative: '暂不',
      },
    )) === PermissionsAndroid.RESULTS.GRANTED
  );
}
