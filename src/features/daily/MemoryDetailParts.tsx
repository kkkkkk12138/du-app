import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Memory } from '../../db/models';
import { useAudioPlayback } from '../../hooks/useAudioPlayback';
import { useHaptics } from '../../hooks/useHaptics';
import { radius } from '../../tokens/radius';
import { spacing } from '../../tokens/spacing';
import { fontFamilies, fontSizes } from '../../tokens/typography';
import { formatReplyDate, formatReplySign } from './memoryDetailLogic';

export const detailColors = {
  background: '#F7F0E4',
  note: '#FFFDF7',
  slip: '#FBF2E0',
  ink: '#3B322A',
  inkSoft: '#5B4F44',
  inkLight: '#9A8B7B',
  inkFaint: '#C4B7A7',
  accent: '#C0704A',
  accentSoft: '#E3B392',
};

const photoTones: Record<string, string> = {
  dusk: '#B99076',
  spring: '#C8C2A1',
  warm: '#C69A72',
};

export function fileSource(path?: string) {
  if (!path) {
    return undefined;
  }
  return { uri: path.startsWith('file://') ? path : `file://${path}` };
}

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export function PaperTexture() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[
        [13, 9, 28],
        [46, 18, 15],
        [79, 7, 24],
        [24, 42, 18],
        [68, 52, 30],
        [8, 72, 21],
        [52, 84, 20],
        [86, 91, 14],
      ].map(([left, top, width], index) => (
        <View
          key={index}
          style={[
            styles.paperFiber,
            {
              left: `${left}%`,
              top: `${top}%`,
              width,
              transform: [{ rotate: `${index % 2 ? -7 : 5}deg` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function Polaroid({ memory }: { memory: Memory }) {
  const source = fileSource(memory.imagePath);
  return (
    <View style={styles.polaroid}>
      {source ? (
        <Image
          accessibilityLabel="日迹照片"
          resizeMode="cover"
          source={source}
          style={styles.photo}
        />
      ) : (
        <View
          accessibilityLabel="日迹照片色调"
          style={[
            styles.photo,
            {
              backgroundColor: photoTones[memory.photoTone ?? ''] ?? '#C8B39D',
            },
          ]}
        >
          <View style={styles.placeholderSun} />
          <View style={styles.placeholderHorizon} />
        </View>
      )}
      <Text style={styles.photoCaption}>
        {memory.placeDetail || '留在这一天的光'}
      </Text>
    </View>
  );
}

export function HandwritingAttachment({ path }: { path: string }) {
  return (
    <View style={styles.inkAttachment}>
      <View style={styles.inkTape} />
      <Image
        accessibilityLabel="手书原图"
        resizeMode="contain"
        source={fileSource(path)}
        style={styles.inkImage}
      />
    </View>
  );
}

export function AudioStrip({
  memory,
  onError,
}: {
  memory: Memory;
  onError: (message: string) => void;
}) {
  const haptics = useHaptics();
  const playback = useAudioPlayback({
    path: memory.audioPath,
    fallbackDuration: Math.max(1, memory.audioDuration ?? 1),
    onError,
  });
  const [waveTick, setWaveTick] = useState(0);

  useEffect(() => {
    if (!playback.playing) {
      return;
    }
    const timer = setInterval(() => setWaveTick(value => value + 1), 150);
    return () => clearInterval(timer);
  }, [playback.playing]);

  return (
    <View style={styles.audioStrip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playback.playing ? '暂停录音' : '播放录音'}
        disabled={playback.loading}
        onPress={() => {
          haptics.trigger('selection');
          playback.toggle();
        }}
        style={({ pressed }) => [
          styles.playButton,
          {
            opacity: playback.loading ? 0.45 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={styles.playIcon}>
          {playback.loading ? '···' : playback.playing ? 'Ⅱ' : '▶'}
        </Text>
      </Pressable>
      <View style={styles.wave}>
        {[7, 14, 9, 19, 11, 16, 8, 21, 13, 9, 17, 7, 12, 6, 15].map(
          (height, index) => (
            <View
              key={index}
              style={[
                styles.waveBar,
                index === 4 || index === 10
                  ? styles.hotWaveBar
                  : styles.calmWaveBar,
                {
                  height: playback.playing
                    ? 6 + ((height + waveTick * (index + 2)) % 17)
                    : height,
                },
              ]}
            />
          ),
        )}
      </View>
      <Text style={styles.duration}>{formatDuration(playback.remaining)}</Text>
    </View>
  );
}

export function ReplySlip({
  memory,
  parentDate,
  index,
  onDelete,
}: {
  memory: Memory;
  parentDate: Date;
  index: number;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={expanded ? '收起回信' : '展开回信'}
      onPress={() => setExpanded(value => !value)}
      style={[
        styles.replySlip,
        index ? styles.replyOverlap : undefined,
        {
          transform: [{ rotate: `${index % 2 ? 1.2 : -1.1}deg` }],
          zIndex: index + 1,
        },
      ]}
    >
      <View style={styles.replyTape} />
      <Text style={styles.replyDate}>{formatReplyDate(memory.writtenAt)}</Text>
      <Text numberOfLines={expanded ? undefined : 2} style={styles.replyBody}>
        {memory.content}
      </Text>
      <Text style={styles.replySign}>
        {formatReplySign(parentDate, memory.writtenAt)}
      </Text>
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="删除这封回信"
          hitSlop={8}
          onPress={event => {
            event.stopPropagation();
            onDelete();
          }}
          style={styles.replyDelete}
        >
          <Text style={styles.replyDeleteText}>删除</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function ThreadDecorations() {
  return (
    <>
      <View style={styles.teaStain}>
        <View style={styles.teaStainInner} />
      </View>
      <View style={styles.inkSpeckOne} />
      <View style={styles.inkSpeckTwo} />
    </>
  );
}

const styles = StyleSheet.create({
  paperFiber: {
    position: 'absolute',
    height: 0.7,
    backgroundColor: 'rgba(91,79,68,0.055)',
  },
  polaroid: {
    width: '94%',
    alignSelf: 'center',
    marginTop: spacing.xxl,
    padding: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: '#FFFEFA',
    transform: [{ rotate: '-1.4deg' }],
    boxShadow: '0 5px 16px rgba(59,50,42,0.16)',
  },
  photo: { width: '100%', height: 220, overflow: 'hidden' },
  photoCaption: {
    color: detailColors.inkLight,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.caption,
  },
  placeholderSun: {
    position: 'absolute',
    top: 32,
    right: 34,
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: 'rgba(255,236,196,0.62)',
  },
  placeholderHorizon: {
    position: 'absolute',
    right: 0,
    bottom: 46,
    left: 0,
    height: 52,
    backgroundColor: 'rgba(80,68,65,0.20)',
    transform: [{ skewY: '-5deg' }],
  },
  inkAttachment: {
    height: 190,
    marginTop: spacing.xxl,
    padding: spacing.sm,
    backgroundColor: '#FCF8EE',
    borderWidth: 0.5,
    borderColor: 'rgba(91,79,68,0.12)',
    transform: [{ rotate: '0.8deg' }],
  },
  inkTape: {
    position: 'absolute',
    top: -8,
    right: 30,
    width: 70,
    height: 18,
    backgroundColor: 'rgba(227,179,146,0.30)',
    transform: [{ rotate: '4deg' }],
  },
  inkImage: { width: '100%', height: '100%' },
  audioStrip: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.cardGap,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    backgroundColor: '#F1E8D9',
    borderRadius: 2,
  },
  playButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: detailColors.accent,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
  wave: {
    height: 26,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: { width: 2, borderRadius: 1 },
  hotWaveBar: { backgroundColor: detailColors.accent },
  calmWaveBar: { backgroundColor: 'rgba(91,79,68,0.34)' },
  duration: {
    color: detailColors.inkLight,
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  replySlip: {
    minHeight: 118,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: detailColors.slip,
    borderRadius: 2,
    boxShadow: '0 4px 12px rgba(72,53,38,0.10)',
  },
  replyOverlap: { marginTop: -5 },
  replyTape: {
    position: 'absolute',
    top: -7,
    left: 28,
    width: 58,
    height: 17,
    backgroundColor: 'rgba(219,197,159,0.48)',
    transform: [{ rotate: '-4deg' }],
  },
  replyDate: {
    color: detailColors.accent,
    fontFamily: fontFamilies.englishSerif,
    fontSize: fontSizes.caption,
    letterSpacing: 1.2,
  },
  replyBody: {
    color: detailColors.inkSoft,
    marginTop: spacing.sm,
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.meta,
    lineHeight: 24,
  },
  replySign: {
    color: detailColors.inkLight,
    marginTop: spacing.sm,
    textAlign: 'right',
    fontFamily: fontFamilies.serif,
    fontSize: 10,
  },
  replyDelete: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  replyDeleteText: {
    color: detailColors.accent,
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  teaStain: {
    position: 'absolute',
    top: 0,
    right: 12,
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(168,111,66,0.10)',
    borderRadius: radius.round,
  },
  teaStainInner: {
    width: 55,
    height: 55,
    borderWidth: 1,
    borderColor: 'rgba(168,111,66,0.07)',
    borderRadius: radius.round,
  },
  inkSpeckOne: {
    position: 'absolute',
    top: 88,
    right: 26,
    width: 3,
    height: 3,
    borderRadius: radius.round,
    backgroundColor: 'rgba(59,50,42,0.22)',
  },
  inkSpeckTwo: {
    position: 'absolute',
    top: 96,
    right: 39,
    width: 2,
    height: 2,
    borderRadius: radius.round,
    backgroundColor: 'rgba(59,50,42,0.16)',
  },
});
