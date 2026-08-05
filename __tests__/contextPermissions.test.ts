import {Platform} from 'react-native';
import {check} from 'react-native-permissions';
import {Camera} from 'react-native-vision-camera';

import {
  requestCameraAccess,
  requestLocationAccess,
  requestMicrophoneAccess,
} from '../src/services/contextPermissions';

const checkMock = check as jest.Mock;
const cameraStatusMock = Camera.getCameraPermissionStatus as jest.Mock;
const cameraRequestMock = Camera.requestCameraPermission as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

test('reports a previously denied camera permission as blocked', async () => {
  cameraStatusMock.mockReturnValueOnce('denied');
  cameraRequestMock.mockResolvedValueOnce('denied');

  await expect(requestCameraAccess()).resolves.toBe('blocked');
});

test('reports blocked iOS microphone and location permissions', async () => {
  if (Platform.OS !== 'ios') {
    return;
  }
  checkMock.mockResolvedValue('blocked');

  await expect(requestMicrophoneAccess()).resolves.toBe('blocked');
  await expect(requestLocationAccess()).resolves.toBe('blocked');
});
