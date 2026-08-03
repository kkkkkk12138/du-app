import * as Keychain from 'react-native-keychain';

const biometricLockService = 'cn.du.app.biometric-lock';

export async function getBiometricLabel() {
  const type = await Keychain.getSupportedBiometryType();
  switch (type) {
    case Keychain.BIOMETRY_TYPE.FACE_ID:
      return '面容 ID';
    case Keychain.BIOMETRY_TYPE.TOUCH_ID:
      return '触控 ID';
    case Keychain.BIOMETRY_TYPE.FINGERPRINT:
      return '指纹';
    case Keychain.BIOMETRY_TYPE.FACE:
      return '面容识别';
    case Keychain.BIOMETRY_TYPE.IRIS:
      return '虹膜';
    case Keychain.BIOMETRY_TYPE.OPTIC_ID:
      return 'Optic ID';
    default:
      return null;
  }
}

export async function enableBiometricLock() {
  const label = await getBiometricLabel();
  if (!label) {
    throw new Error('当前设备没有可用的生物识别');
  }

  const saved = await Keychain.setGenericPassword('du-owner', 'unlocked', {
    service: biometricLockService,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
  });
  if (!saved) {
    throw new Error('无法启用隐私锁');
  }

  await verifyBiometricLock();
  return label;
}

export async function verifyBiometricLock() {
  const credentials = await Keychain.getGenericPassword({
    service: biometricLockService,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
    authenticationPrompt: {
      title: '解锁渡',
      subtitle: '验证后查看你的日迹与信件',
      cancel: '取消',
    },
  });
  return Boolean(credentials);
}

export async function disableBiometricLock() {
  await Keychain.resetGenericPassword({ service: biometricLockService });
}
