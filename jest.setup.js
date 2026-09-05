/* global jest */

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn().mockResolvedValue(undefined),
  isVisible: jest.fn().mockResolvedValue(false),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    impactHeavy: 'impactHeavy',
    notificationSuccess: 'notificationSuccess',
    selection: 'selection',
  },
}));

jest.mock('react-native-permissions', () =>
  require('react-native-permissions/mock'),
);

jest.mock('@sayem314/react-native-keep-awake', () => ({
  activateKeepAwake: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('react-native-geolocation-service', () => ({
  requestAuthorization: jest.fn().mockResolvedValue('granted'),
  getCurrentPosition: jest.fn(),
}));

jest.mock('react-native-vision-camera', () => ({
  Camera: {
    getCameraPermissionStatus: jest.fn(() => 'granted'),
    requestCameraPermission: jest.fn().mockResolvedValue('granted'),
  },
  useCameraDevice: jest.fn(() => undefined),
}));

jest.mock('react-native-audio-record', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    start: jest.fn(),
    stop: jest.fn().mockResolvedValue('/tmp/du-recording.wav'),
    on: jest.fn(),
  },
}));

jest.mock('react-native-sound', () => {
  class MockSound {
    static instances = [];
    static setActive = jest.fn();
    static setCategory = jest.fn();

    constructor(path, _basePath, loadCallback) {
      this.path = path;
      this.loaded = true;
      this.play = jest.fn(onEnd => {
        this.onEnd = onEnd;
        return this;
      });
      this.pause = jest.fn(onPause => {
        onPause?.();
        return this;
      });
      this.stop = jest.fn(onStop => {
        onStop?.();
        return this;
      });
      this.release = jest.fn();
      this.isLoaded = jest.fn(() => this.loaded);
      this.getDuration = jest.fn(() => 2);
      this.getCurrentTime = jest.fn(onTime => onTime(0.5));
      MockSound.instances.push(this);
      Promise.resolve().then(() => loadCallback(null, { duration: 2 }));
    }
  }

  return MockSound;
});

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/tmp',
    CachesDirectoryPath: '/tmp',
    TemporaryDirectoryPath: '/tmp',
    mkdir: jest.fn().mockResolvedValue(undefined),
    copyFile: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    stat: jest.fn().mockResolvedValue({ size: 32_044 }),
    readDir: jest.fn().mockResolvedValue([]),
    unlink: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

const {NativeModules} = require('react-native');

NativeModules.DuMediaCrypto = {
  generateRandomKey: jest
    .fn()
    .mockResolvedValue(
      'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
    ),
  keyVerifier: jest.fn().mockResolvedValue('a'.repeat(64)),
  encryptMediaFile: jest.fn(input =>
    Promise.resolve({
      encryptedPath: input.destinationPath,
      encryptedBytes: 2048,
      plaintextBytes: 1024,
      sha256: 'b'.repeat(64),
      formatVersion: 1,
    }),
  ),
  inspectEncryptedFile: jest.fn(path =>
    Promise.resolve({
      encryptedPath: path,
      encryptedBytes: 2048,
      plaintextBytes: 1024,
      sha256: 'b'.repeat(64),
      formatVersion: 1,
    }),
  ),
  deleteEncryptedFile: jest.fn().mockResolvedValue(undefined),
};

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
      'AccessibleAfterFirstUnlockThisDeviceOnly',
  },
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
  },
  AUTHENTICATION_TYPE: {
    BIOMETRICS: 'AuthenticationWithBiometrics',
  },
  BIOMETRY_TYPE: {
    FACE_ID: 'FaceID',
    TOUCH_ID: 'TouchID',
    OPTIC_ID: 'OpticID',
    FINGERPRINT: 'Fingerprint',
    FACE: 'Face',
    IRIS: 'Iris',
  },
  getGenericPassword: jest.fn().mockResolvedValue({
    username: 'du-owner',
    password: 'unlocked',
  }),
  setGenericPassword: jest.fn().mockResolvedValue({
    service: 'test',
    storage: 'test',
  }),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  getSupportedBiometryType: jest.fn().mockResolvedValue('FaceID'),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn().mockResolvedValue('/tmp/ink.png'),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn().mockResolvedValue({didCancel: true}),
}));

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: {
    saveAsset: jest.fn().mockResolvedValue({ node: { id: 'asset-1' } }),
  },
  iosRequestAddOnlyGalleryPermission: jest.fn().mockResolvedValue('granted'),
}));

jest.mock('react-native-date-picker', () => {
  const React = require('react');
  const { View } = require('react-native');

  return props =>
    React.createElement(View, {
      ...props,
      accessibilityLabel: props.title || '日期选择器',
    });
});

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    createChannel: jest.fn().mockResolvedValue('future-letters'),
    createTriggerNotification: jest.fn().mockResolvedValue('notification-id'),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
  },
  AndroidImportance: { DEFAULT: 3 },
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
  TriggerType: { TIMESTAMP: 0 },
  RepeatFrequency: { DAILY: 1 },
}));
