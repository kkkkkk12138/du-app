import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {
  activateKeepAwake,
  deactivateKeepAwake,
} from '@sayem314/react-native-keep-awake';
import AudioRecord from 'react-native-audio-record';

import {requestMicrophoneAccess} from '../services/contextPermissions';
import {
  archiveDraftMediaFile,
  isUsableAudioFile,
  removeMediaFile,
} from '../services/mediaStorage';

const maximumDurationSeconds = 30 * 60;
const waveBarCount = 12;

function createWaveLevels() {
  return Array.from(
    {length: waveBarCount},
    () => (4 + Math.random() * 14) / 18,
  );
}

export type AudioAttachment = {
  path: string;
  duration: number;
};

export function useAudioRecorder(
  onComplete: (attachment: AudioAttachment) => void,
  onError: (message: string) => void,
  onPermissionBlocked?: () => void,
) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [waveLevels, setWaveLevels] = useState(createWaveLevels);
  const recordingRef = useRef(false);
  const secondsRef = useRef(0);
  const stoppingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onPermissionBlockedRef = useRef(onPermissionBlocked);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  onPermissionBlockedRef.current = onPermissionBlocked;

  const stop = useCallback(
    async (discard = false) => {
      if (!recordingRef.current || stoppingRef.current) {
        return;
      }
      stoppingRef.current = true;
      try {
        const temporaryPath = await AudioRecord.stop();
        const duration = Math.max(1, secondsRef.current);
        if (discard) {
          await removeMediaFile(temporaryPath);
        } else {
          if (!(await isUsableAudioFile(temporaryPath))) {
            await removeMediaFile(temporaryPath);
            onErrorRef.current('没有录到声音，请确认麦克风后再试一次');
            return;
          }
          const path = await archiveDraftMediaFile(
            temporaryPath,
            'audio',
            'wav',
          );
          onCompleteRef.current({path, duration});
        }
      } catch {
        onErrorRef.current('录音没有保存下来，请再试一次');
      } finally {
        deactivateKeepAwake();
        recordingRef.current = false;
        stoppingRef.current = false;
        secondsRef.current = 0;
        setRecording(false);
        setSeconds(0);
      }
    },
    [],
  );

  const start = useCallback(async () => {
    if (recordingRef.current) {
      return;
    }
    const permission = await requestMicrophoneAccess();
    if (permission === 'blocked') {
      onPermissionBlockedRef.current?.();
      return;
    }
    if (permission !== 'granted') {
      onErrorRef.current('没有麦克风权限，暂时不能录音');
      return;
    }
    try {
      AudioRecord.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
        wavFile: `du-recording-${Date.now()}.wav`,
      });
      secondsRef.current = 0;
      recordingRef.current = true;
      activateKeepAwake();
      AudioRecord.start();
      setSeconds(0);
      setRecording(true);
    } catch {
      recordingRef.current = false;
      deactivateKeepAwake();
      onErrorRef.current('录音没有开始，请再试一次');
    }
  }, []);

  useEffect(() => {
    if (!recording) {
      return;
    }
    const timer = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= maximumDurationSeconds) {
        stop(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [recording, stop]);

  useEffect(() => {
    if (!recording) {
      return;
    }
    const timer = setInterval(() => {
      setWaveLevels(createWaveLevels());
    }, 150);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' && recordingRef.current) {
        stop(false);
      }
    });
    return () => subscription.remove();
  }, [stop]);

  useEffect(
    () => () => {
      if (recordingRef.current) {
        recordingRef.current = false;
        deactivateKeepAwake();
        AudioRecord.stop().catch(() => undefined);
      }
    },
    [],
  );

  return {recording, seconds, waveLevels, start, stop};
}
