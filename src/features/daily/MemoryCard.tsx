import React, {useEffect, useMemo, useState} from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import {useToast} from '../../components/Toast';
import {Memory} from '../../db/models';
import {useAudioPlayback} from '../../hooks/useAudioPlayback';
import {useHaptics} from '../../hooks/useHaptics';
import {primitiveColors} from '../../tokens/colors';
import {radius} from '../../tokens/radius';
import {spacing} from '../../tokens/spacing';
import {
  fontFamilies,
  fontSizes,
} from '../../tokens/typography';
import {useTheme} from '../../theme/useTheme';
import {
  formatMemoryDate,
  formatMemoryTime,
  parseMemoryTags,
} from './dailyContext';

export type MemoryCardVariant =
  | 'text'
  | 'photo'
  | 'audio'
  | 'note'
  | 'anchor'
  | 'old';

type MemoryCardProps = {
  memory: Memory;
  variant?: MemoryCardVariant;
  isNew?: boolean;
  isFresh?: boolean;
  anchorSummary?: string;
  oldReason?: string;
  onPress: () => void;
};

const moodColors: Record<string, string> = {
  calm: primitiveColors.sage,
  warm: primitiveColors.dusk,
  sad: primitiveColors.sky,
  intense: primitiveColors.accent,
  soft: primitiveColors.rose,
};

const photoGradients: Record<string, [string, string, string]> = {
  dusk: ['#6A4A38', '#A07850', '#E8C890'],
  night: ['#0E1220', '#1E2540', '#3A4A68'],
  spring: ['#C8D8BE', '#E0E8D0', '#F0EFE0'],
  rain: ['#5A6A78', '#7A8A98', '#A0AEB8'],
};

const waveHeights = [8, 14, 10, 18, 12, 16, 8, 22, 14, 10, 16, 8, 12, 6, 14, 10, 18];

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function MemoryPressable({
  children,
  label,
  onPress,
  style,
}: {
  children: React.ReactNode;
  label: string;
  onPress: () => void;
  style: object;
}) {
  const haptics = useHaptics();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.trigger('button');
        onPress();
      }}
      style={({pressed}) => [
        style,
        {
          opacity: pressed ? 0.92 : 1,
          transform: [{scale: pressed ? 0.98 : 1}],
        },
      ]}>
      {children}
    </Pressable>
  );
}

function Tags({tags}: {tags: string[]}) {
  const {colors} = useTheme();
  if (!tags.length) {
    return null;
  }

  return (
    <View style={styles.tags}>
      {tags.slice(0, 3).map((tag, index) => (
        <View
          key={`${tag}-${index}`}
          style={[styles.tag, {backgroundColor: colors.surfaceWarm}]}>
          <Text
            style={[
              styles.tagText,
              {color: index === 2 ? colors.accent : colors.textMuted},
            ]}>
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AttachmentPreview({memory}: {memory: Memory}) {
  const {colors} = useTheme();
  const inkSource = memory.inkImagePath
    ? {
        uri: memory.inkImagePath.startsWith('file://')
          ? memory.inkImagePath
          : `file://${memory.inkImagePath}`,
      }
    : undefined;

  if (!inkSource) {
    return null;
  }

  return (
    <View style={styles.attachmentPreview}>
      <View
        style={[
          styles.inkPreviewCard,
          {backgroundColor: colors.surfaceWarm, borderColor: colors.line},
        ]}>
        <Text style={[styles.inkPreviewLabel, {color: colors.accent}]}>
          手书
        </Text>
        <Image
          accessibilityLabel="手书缩略图"
          resizeMode="contain"
          source={inkSource}
          style={styles.inkPreviewImage}
        />
      </View>
    </View>
  );
}

function NewSeal({animate}: {animate: boolean}) {
  const {colors} = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(animate && !reduceMotion ? 0.6 : 0.3);
  const scale = useSharedValue(animate && !reduceMotion ? 1.5 : 1);

  useEffect(() => {
    if (!animate || reduceMotion) {
      opacity.value = 0.3;
      scale.value = 1;
      return;
    }
    scale.value = withDelay(
      200,
      withTiming(1, {duration: 500, easing: Easing.out(Easing.cubic)}),
    );
    opacity.value = withDelay(
      200,
      withSequence(
        withTiming(1, {duration: 500}),
        withTiming(0.3, {duration: 200}),
      ),
    );
  }, [animate, opacity, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{rotate: '-3deg'}, {scale: scale.value}],
  }));

  return (
    <Animated.View
      style={[
        styles.newSeal,
        {backgroundColor: colors.seal},
        animatedStyle,
      ]}>
      <Text style={styles.newSealText}>落</Text>
    </Animated.View>
  );
}

function PhotoSurface({memory}: {memory: Memory}) {
  const colors = photoGradients[memory.photoTone ?? 'dusk'] ?? photoGradients.dusk;
  const source = memory.imagePath
    ? {uri: memory.imagePath.startsWith('file://') ? memory.imagePath : `file://${memory.imagePath}`}
    : null;

  return (
    <View
      style={[
        styles.photoSurface,
        memory.photoTone === 'spring' ? styles.springPhotoSurface : null,
      ]}>
      {source ? (
        <Image resizeMode="cover" source={source} style={StyleSheet.absoluteFill} />
      ) : (
        <Svg height="100%" width="100%">
          <Defs>
            <LinearGradient id="photoTone" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="0.48" stopColor={colors[1]} />
              <Stop offset="1" stopColor={colors[2]} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#photoTone)" />
        </Svg>
      )}
      <Svg
        height={72}
        pointerEvents="none"
        style={styles.photoOverlay}
        width="100%">
        <Defs>
          <LinearGradient id="photoOverlay" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.55} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#photoOverlay)" />
      </Svg>
      <View style={styles.photoMeta}>
        <Text style={styles.photoTime}>{formatMemoryTime(memory.writtenAt)}</Text>
        {memory.placeDetail ? (
          <Text style={styles.photoPlace}>{memory.placeDetail}</Text>
        ) : null}
      </View>
    </View>
  );
}

function PaperGlow() {
  const {isDark} = useTheme();
  return (
    <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="paperGlow" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={isDark ? '#3A3028' : '#FBF4E8'} />
          <Stop offset="1" stopColor={isDark ? '#2A2520' : '#F5EBD8'} />
        </LinearGradient>
        <RadialGradient id="anchorGlow" cx="1" cy="0" r="0.7">
          <Stop offset="0" stopColor="#C0392B" stopOpacity={0.06} />
          <Stop offset="1" stopColor="#C0392B" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#paperGlow)" />
      <Rect width="100%" height="100%" fill="url(#anchorGlow)" />
    </Svg>
  );
}

function AudioBackground() {
  return (
    <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="audioBackground" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2A2F3D" />
          <Stop offset="1" stopColor="#3A4255" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#audioBackground)" />
    </Svg>
  );
}

function OldPaperEdge() {
  return (
    <View pointerEvents="none" style={styles.oldPaperEdge}>
      {Array.from({length: 24}, (_, index) => (
        <View key={index} style={styles.oldPaperDash} />
      ))}
    </View>
  );
}

function AudioMemoryCard({
  memory,
  isFresh,
  animateSeal,
  onPress,
}: {
  memory: Memory;
  isFresh: boolean;
  animateSeal: boolean;
  onPress: () => void;
}) {
  const haptics = useHaptics();
  const toast = useToast();
  const tags = parseMemoryTags(memory.customTags);
  const totalDuration = Math.max(1, Math.round(memory.audioDuration ?? 12));
  const [waveTick, setWaveTick] = useState(0);
  const playback = useAudioPlayback({
    path: memory.audioPath,
    fallbackDuration: totalDuration,
    onError: toast.show,
  });

  useEffect(() => {
    if (!playback.playing) {
      return;
    }

    const timer = setInterval(() => {
      setWaveTick(value => value + 1);
    }, 150);

    return () => clearInterval(timer);
  }, [playback.playing]);

  return (
    <MemoryPressable
      label={`音频日迹，${memory.placeDetail ?? ''}`}
      onPress={onPress}
      style={styles.audioCard}>
      <AudioBackground />
      {isFresh ? <NewSeal animate={animateSeal} /> : null}
      <View style={styles.audioContent}>
        <Text style={styles.audioLocation}>
          {formatMemoryTime(memory.writtenAt)}
          {memory.placeDetail ? ` · ${memory.placeDetail}` : ''}
        </Text>
        <Text style={styles.audioBody}>{memory.content}</Text>
        <View style={styles.audioControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              playback.playing ? '暂停录音' : '播放录音'
            }
            disabled={playback.loading}
            onPress={() => {
              haptics.trigger('selection');
              playback.toggle();
            }}
            style={({pressed}) => [
              styles.playButton,
              {opacity: playback.loading ? 0.45 : pressed ? 0.8 : 1},
            ]}>
            <Text style={styles.playIcon}>
              {playback.loading ? '···' : playback.playing ? 'Ⅱ' : '▶'}
            </Text>
          </Pressable>
          <View style={styles.wave}>
            {waveHeights.map((height, index) => {
              const animatedHeight = playback.playing
                ? 6 + ((height + waveTick * (index + 3)) % 17)
                : height;
              return (
                <View
                  key={index}
                  style={[
                    styles.waveBar,
                    index === 3 || index === 7 ? styles.hotWaveBar : null,
                    {height: animatedHeight},
                  ]}
                />
              );
            })}
          </View>
          <Text style={styles.audioDuration}>
            {formatDuration(playback.remaining)}
          </Text>
        </View>
        <View style={styles.audioTags}>
          {tags.slice(0, 3).map(tag => (
            <View key={tag} style={styles.audioTag}>
              <Text style={styles.audioTagText}>{tag}</Text>
            </View>
          ))}
        </View>
        {memory.inkImagePath ? <AttachmentPreview memory={memory} /> : null}
      </View>
    </MemoryPressable>
  );
}

export function MemoryCard({
  memory,
  variant,
  isNew = false,
  isFresh = false,
  anchorSummary,
  oldReason = '同一时节',
  onPress,
}: MemoryCardProps) {
  const {colors, isDark} = useTheme();
  const displayType = (variant ?? memory.type) as MemoryCardVariant;
  const tags = useMemo(
    () => parseMemoryTags(memory.customTags),
    [memory.customTags],
  );
  const reduceMotion = useReducedMotion();
  const entry = useSharedValue(isNew && !reduceMotion ? 0 : 1);

  useEffect(() => {
    if (!isNew || reduceMotion) {
      entry.value = 1;
      return;
    }
    entry.value = 0;
    entry.value = withTiming(1, {
      duration: 500,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
  }, [entry, isNew, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: entry.value,
    transform: [
      {translateY: -20 * (1 - entry.value)},
      {scale: 0.96 + 0.04 * entry.value},
    ],
  }));

  if (displayType === 'audio') {
    return (
      <Animated.View style={animatedStyle}>
        <AudioMemoryCard
          animateSeal={isNew}
          memory={memory}
          isFresh={isFresh}
          onPress={onPress}
        />
      </Animated.View>
    );
  }

  if (displayType === 'note') {
    return (
      <Animated.View style={animatedStyle}>
        <MemoryPressable
          label={`短记，${memory.content}`}
          onPress={onPress}
          style={styles.noteCard}>
          <Text
            style={[
              styles.noteText,
              {
                color: colors.textSoft,
                borderLeftColor: colors.surfaceAged,
              },
            ]}>
            {memory.content}
          </Text>
          {isFresh ? <NewSeal animate={isNew} /> : null}
          <Text style={[styles.noteMeta, {color: colors.textMuted}]}>
            {formatMemoryTime(memory.writtenAt)}
            {memory.placeDetail ? ` · ${memory.placeDetail}` : ''}
            {tags[0] ? ` · ${tags[0]}` : ''}
          </Text>
          <AttachmentPreview memory={memory} />
        </MemoryPressable>
      </Animated.View>
    );
  }

  if (displayType === 'old') {
    return (
      <Animated.View style={animatedStyle}>
        <MemoryPressable
          label={`故纸相似，${memory.content}`}
          onPress={onPress}
          style={[
            styles.oldCard,
            {backgroundColor: colors.surface, borderColor: colors.line},
          ]}>
          <OldPaperEdge />
          <View style={styles.oldHeader}>
            <View style={styles.oldMark}>
              <Svg height={11} width={11} viewBox="0 0 24 24">
                <Path
                  d={
                    oldReason === '也是一个人吃饭'
                      ? 'M16 13v4a4 4 0 0 1-8 0v-4M12 3v10M8 7l4-4 4 4'
                      : 'M12 2v6M12 22v-6M2 12h6M22 12h-6'
                  }
                  fill="none"
                  stroke={colors.accent}
                  strokeWidth={1.2}
                />
              </Svg>
              <Text style={[styles.oldMarkText, {color: colors.textFaint}]}>
                故纸相似
              </Text>
            </View>
            <View style={styles.oldReason}>
              <Text style={[styles.oldReasonText, {color: colors.accent}]}>
                {oldReason}
              </Text>
            </View>
          </View>
          <Text style={[styles.oldText, {color: colors.textSoft}]}>
            {memory.content}
          </Text>
          <AttachmentPreview memory={memory} />
          <View style={styles.oldFooter}>
            <Text style={[styles.oldDate, {color: colors.textFaint}]}>
              {formatMemoryDate(memory.writtenAt)}
              {memory.placeDetail ? ` · ${memory.placeDetail}` : ''}
            </Text>
            <Text style={[styles.oldOpen, {color: colors.textMuted}]}>
              翻开 →
            </Text>
          </View>
        </MemoryPressable>
      </Animated.View>
    );
  }

  if (displayType === 'anchor') {
    return (
      <Animated.View style={animatedStyle}>
        <MemoryPressable
          label={`锚点时刻，${memory.content}`}
          onPress={onPress}
          style={[
            styles.anchorCard,
            isDark ? styles.anchorCardDark : styles.anchorCardLight,
          ]}>
          <PaperGlow />
          {isFresh ? <NewSeal animate={isNew} /> : null}
          <View style={styles.anchorContent}>
            <Text style={[styles.anchorMark, {color: colors.accent}]}>
              ★  锚点时刻
            </Text>
            <Text style={[styles.anchorText, {color: colors.text}]}>
              {memory.content}
            </Text>
            <AttachmentPreview memory={memory} />
            <View style={styles.anchorFooter}>
              <View style={styles.anchorMetaLine} />
              <Text style={[styles.anchorMeta, {color: colors.textMuted}]}>
                {anchorSummary ??
                  `${memory.writtenAt.getMonth() + 1}月${memory.writtenAt.getDate()}日${
                    memory.placeDetail ? ` · ${memory.placeDetail}` : ''
                  }`}
              </Text>
            </View>
          </View>
        </MemoryPressable>
      </Animated.View>
    );
  }

  if (displayType === 'photo') {
    const isSpringPhoto = memory.photoTone === 'spring';
    return (
      <Animated.View style={animatedStyle}>
        <MemoryPressable
          label={`照片日迹，${memory.content}`}
          onPress={onPress}
          style={[
            styles.photoCard,
            {backgroundColor: colors.surface},
          ]}>
          {isFresh ? <NewSeal animate={isNew} /> : null}
          <PhotoSurface memory={memory} />
          <Text
            style={[
              styles.photoBody,
              isSpringPhoto ? styles.springPhotoBody : null,
              {color: isSpringPhoto ? colors.textSoft : colors.text},
            ]}>
            {memory.content}
          </Text>
          {memory.inkImagePath ? <AttachmentPreview memory={memory} /> : null}
          {isSpringPhoto ? (
            <View style={[styles.photoFooter, {borderTopColor: colors.line}]}>
              {tags.slice(0, 2).map(tag => (
                <Text
                  key={tag}
                  style={[styles.photoFooterText, {color: colors.textFaint}]}>
                  {tag}
                </Text>
              ))}
            </View>
          ) : (
            <View style={styles.photoSenses}>
              {tags.slice(0, 3).map((tag, index) => (
                <View
                  key={tag}
                  style={[
                    styles.photoSense,
                    index === 2
                      ? styles.accentPhotoSense
                      : {backgroundColor: colors.surfaceWarm},
                  ]}>
                  <Text
                    style={[
                      styles.photoSenseText,
                      {
                        color:
                          index === 2 ? colors.accent : colors.textMuted,
                      },
                    ]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </MemoryPressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <MemoryPressable
        label={`文字日迹，${memory.content}`}
        onPress={onPress}
        style={styles.textCard}>
        {isFresh ? <NewSeal animate={isNew} /> : null}
        <View
          style={[
            styles.moodLine,
            {backgroundColor: moodColors[memory.mood ?? 'calm']},
          ]}
        />
        <Text style={[styles.textMeta, {color: colors.textFaint}]}>
          {formatMemoryTime(memory.writtenAt)}
          {memory.placeDetail ? ` · ${memory.placeDetail}` : ''}
        </Text>
        <Text style={[styles.textBody, {color: colors.text}]}>
          {memory.content}
        </Text>
        <AttachmentPreview memory={memory} />
        <Tags tags={tags} />
      </MemoryPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  textCard: {
    marginHorizontal: spacing.greeting,
    marginBottom: spacing.gap,
    paddingTop: spacing.md,
    paddingBottom: spacing.cardGap,
  },
  moodLine: {
    width: 20,
    height: 1.5,
    borderRadius: 1,
    marginBottom: spacing.sm,
  },
  textMeta: {
    marginBottom: spacing.xs,
    fontFamily: fontFamilies.englishSerif,
    fontSize: fontSizes.caption,
    letterSpacing: 1.5,
  },
  textBody: {
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    lineHeight: 28,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tag: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: spacing.xxs,
  },
  tagText: {
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  attachmentPreview: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  inkPreviewCard: {
    height: 104,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderWidth: 0.5,
    borderRadius: radius.image,
    overflow: 'hidden',
  },
  inkPreviewLabel: {
    alignSelf: 'flex-start',
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    letterSpacing: 1.8,
  },
  inkPreviewImage: {
    width: '100%',
    flex: 1,
  },
  photoCard: {
    marginHorizontal: spacing.page,
    marginBottom: spacing.lg,
    borderRadius: radius.paper,
    overflow: 'hidden',
    boxShadow: '0 2px 10px rgba(58,51,45,0.08)',
  },
  photoSurface: {
    height: 220,
    marginBottom: 0,
    overflow: 'hidden',
  },
  springPhotoSurface: {
    height: 150,
  },
  photoOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
  },
  photoMeta: {
    position: 'absolute',
    left: spacing.gap,
    right: spacing.gap,
    bottom: spacing.cardGap,
  },
  photoTime: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 10,
    letterSpacing: 2,
  },
  photoPlace: {
    marginTop: spacing.xxs,
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  photoBody: {
    paddingHorizontal: spacing.gap,
    paddingTop: spacing.md,
    paddingBottom: spacing.cardGap,
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    lineHeight: 26.6,
  },
  springPhotoBody: {
    paddingTop: spacing.cardGap,
    paddingBottom: spacing.sm,
    fontSize: 13,
  },
  photoSenses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.gap,
    paddingBottom: spacing.cardGap,
  },
  photoSense: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: spacing.xxs,
  },
  accentPhotoSense: {
    backgroundColor: 'rgba(192,57,43,0.07)',
  },
  photoSenseText: {
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  photoFooter: {
    minHeight: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gap,
    paddingTop: 7,
    paddingBottom: 9,
    borderTopWidth: 0.5,
  },
  photoFooterText: {
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  noteCard: {
    marginHorizontal: 36,
    marginBottom: spacing.cardGap,
    paddingVertical: spacing.xs,
  },
  noteText: {
    borderLeftWidth: 1.5,
    paddingLeft: spacing.md,
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 26.6,
  },
  noteMeta: {
    marginTop: spacing.xs,
    paddingLeft: spacing.gap,
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  anchorCard: {
    marginHorizontal: spacing.page,
    marginBottom: spacing.lg,
    borderRadius: radius.paper,
    overflow: 'hidden',
  },
  anchorCardLight: {
    backgroundColor: '#FBF4E8',
  },
  anchorCardDark: {
    backgroundColor: '#3A3028',
  },
  anchorContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.letterCard,
  },
  anchorMark: {
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    letterSpacing: 2,
  },
  anchorText: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: fontSizes.body,
    fontWeight: Platform.select({android: '500', default: '400'}),
    lineHeight: 28.5,
  },
  anchorFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  anchorMeta: {
    flex: 1,
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  anchorMetaLine: {
    width: spacing.lg,
    height: 1,
    backgroundColor: 'rgba(192,57,43,0.2)',
  },
  oldCard: {
    marginHorizontal: spacing.page,
    marginTop: spacing.card,
    marginBottom: 0,
    paddingHorizontal: spacing.card,
    paddingTop: spacing.card,
    paddingBottom: spacing.gap,
    borderWidth: 0.5,
    borderRadius: radius.paper,
  },
  oldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.cardGap,
  },
  oldMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  oldMarkText: {
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    letterSpacing: 2,
  },
  oldPaperEdge: {
    position: 'absolute',
    top: 0,
    right: spacing.card,
    left: spacing.card,
    height: 1.5,
    flexDirection: 'row',
    gap: spacing.xs,
    overflow: 'hidden',
  },
  oldPaperDash: {
    width: spacing.xs,
    height: 1.5,
    backgroundColor: primitiveColors.paperAged,
  },
  oldReason: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(192,57,43,0.06)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  oldReasonText: {
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  oldText: {
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    lineHeight: 26.6,
  },
  oldFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.cardGap,
  },
  oldDate: {
    fontFamily: fontFamilies.englishSerif,
    fontSize: 10,
    letterSpacing: 2,
  },
  oldOpen: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.caption,
  },
  audioCard: {
    marginHorizontal: spacing.page,
    marginBottom: spacing.gap,
    borderRadius: radius.audio,
    backgroundColor: '#2A2F3D',
    overflow: 'hidden',
  },
  audioContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  audioLocation: {
    marginBottom: spacing.xs,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 10,
    letterSpacing: 2,
  },
  audioBody: {
    marginBottom: spacing.md,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes.meta,
    lineHeight: 23.4,
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.cardGap,
  },
  playButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  playIcon: {
    color: '#FFFFFF',
    fontSize: 9,
  },
  wave: {
    height: 22,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  hotWaveBar: {
    backgroundColor: 'rgba(192,57,43,0.7)',
  },
  audioDuration: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  audioTags: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  audioTag: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  audioTagText: {
    color: 'rgba(255,255,255,0.48)',
    fontFamily: fontFamilies.sans,
    fontSize: 9,
  },
  newSeal: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.seal,
  },
  newSealText: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
});
