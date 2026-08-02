import {useCallback, useEffect, useRef, useState} from 'react';
import Sound from 'react-native-sound';

import {isUsableAudioFile} from '../services/mediaStorage';

type AudioPlaybackOptions = {
  path?: string;
  fallbackDuration: number;
  onError: (message: string) => void;
};

export function useAudioPlayback({
  path,
  fallbackDuration,
  onError,
}: AudioPlaybackOptions) {
  const playerRef = useRef<Sound | undefined>(undefined);
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);

  const finishPlayback = useCallback((success: boolean) => {
    Sound.setActive(false);
    if (!mountedRef.current) {
      return;
    }
    setPlaying(false);
    setPosition(0);
    if (!success) {
      onError('这段录音暂时无法播放');
    }
  }, [onError]);

  const play = useCallback((player: Sound) => {
    Sound.setCategory('Playback');
    Sound.setActive(true);
    setPlaying(true);
    player.play(finishPlayback);
  }, [finishPlayback]);

  const toggle = useCallback(async () => {
    if (loading) {
      return;
    }
    if (!path) {
      onError('这条日迹没有可播放的录音文件');
      return;
    }

    const current = playerRef.current;
    if (current?.isLoaded()) {
      if (playing) {
        current.pause(() => {
          Sound.setActive(false);
          if (mountedRef.current) {
            setPlaying(false);
          }
        });
      } else {
        play(current);
      }
      return;
    }

    setLoading(true);
    if (!(await isUsableAudioFile(path))) {
      setLoading(false);
      onError('这段录音文件是空的，请重新录制');
      return;
    }
    const player = new Sound(path, '', error => {
      if (!mountedRef.current) {
        player.release();
        return;
      }
      setLoading(false);
      if (error) {
        player.release();
        playerRef.current = undefined;
        onError('录音文件没有加载成功');
        return;
      }
      playerRef.current = player;
      const loadedDuration = player.getDuration();
      if (loadedDuration > 0) {
        setDuration(loadedDuration);
      }
      play(player);
    });
  }, [loading, onError, path, play, playing]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = setInterval(() => {
      playerRef.current?.getCurrentTime(seconds => {
        if (mountedRef.current) {
          setPosition(seconds);
        }
      });
    }, 250);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    setDuration(fallbackDuration);
    setPosition(0);
  }, [fallbackDuration, path]);

  useEffect(
    () => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        const player = playerRef.current;
        if (player) {
          player.stop();
          player.release();
        }
        Sound.setActive(false);
      };
    },
    [],
  );

  return {
    loading,
    playing,
    remaining: Math.max(0, Math.ceil(duration - position)),
    toggle,
  };
}
