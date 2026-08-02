import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {
  CompositeNavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from 'react-native-svg';

import {useToast} from '../../components/Toast';
import {createMemory} from '../../db/memoryRepository';
import {useHaptics} from '../../hooks/useHaptics';
import {
  MainTabParamList,
  RootStackParamList,
} from '../../navigation/RootNavigator';
import {primitiveColors} from '../../tokens/colors';
import {radius} from '../../tokens/radius';
import {spacing} from '../../tokens/spacing';
import {fontFamilies} from '../../tokens/typography';
import {useTheme} from '../../theme/useTheme';

type WriteNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Write'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type FeelingCategory = 'weather' | 'body' | 'heart';

const FEELINGS_COLLAPSED_HEIGHT = 104;
const FEELINGS_EXPANDED_HEIGHT = 236;
const CUSTOM_FEELING_MAX_LENGTH = 12;

const feelingCategories: Record<
  FeelingCategory,
  {label: string; tags: string[]}
> = {
  weather: {
    label: '天',
    tags: [
      '好冷',
      '雨大了',
      '风好大',
      '天很闷',
      '好热',
      '雾很大',
      '天晴了',
      '天黑了',
      '雨终于小了',
      '风停了',
      '晒得慌',
      '空气黏黏的',
      '天有点灰',
      '月亮很亮',
    ],
  },
  body: {
    label: '身',
    tags: [
      '胃空空',
      '困得睁不开',
      '头有点疼',
      '肩膀硬了',
      '想喝热的',
      '手冰凉',
      '有点饿',
      '呼吸有点沉',
      '腿走酸了',
      '终于松下来',
      '没什么力气',
      '身上暖和了',
    ],
  },
  heart: {
    label: '心',
    tags: [
      '想家了',
      '想说话',
      '不想动',
      '想出去走走',
      '有点难过',
      '偷偷开心',
      '心里堵着',
      '有点委屈',
      '终于放心了',
      '平静',
      '说不上来',
      '想一个人待会儿',
      '其实挺好的',
    ],
  },
};

const presetFeelingTags = new Set(
  Object.values(feelingCategories).flatMap(item => item.tags),
);

function formatDates(now: Date) {
  const shortWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  return {
    stamp: `${months[now.getMonth()]} ${now.getDate()}`,
    line: `${shortWeekdays[now.getDay()]} · ${months[now.getMonth()]} ${now.getDate()} · ${hour}:${minute}`,
  };
}

function PaperBackground({isDark}: {isDark: boolean}) {
  return (
    <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="writePaper" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={isDark ? '#3A3028' : '#FEFCF5'} />
          <Stop offset="1" stopColor={isDark ? '#2F2923' : '#FDF8EE'} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#writePaper)" />
    </Svg>
  );
}

function PaperRules() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.bindingLine} />
      {Array.from({length: 22}, (_, index) => (
        <View
          key={index}
          style={[styles.paperRule, {top: index * 31 + 31}]}
        />
      ))}
    </View>
  );
}

function ToolIcon({name, color}: {name: string; color: string}) {
  if (name === 'camera') {
    return (
      <Svg height={20} width={20} viewBox="0 0 24 24">
        <Rect x={3} y={6} width={18} height={13} rx={2} fill="none" stroke={color} strokeWidth={1.3} />
        <Circle cx={12} cy={12.5} r={3.5} fill="none" stroke={color} strokeWidth={1.3} />
        <Path d="M8 6 9.5 4h5L16 6" fill="none" stroke={color} strokeWidth={1.3} />
      </Svg>
    );
  }
  if (name === 'audio') {
    return (
      <Svg height={20} width={20} viewBox="0 0 24 24">
        <Rect x={9} y={3} width={6} height={11} rx={3} fill="none" stroke={color} strokeWidth={1.3} />
        <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke={color} strokeWidth={1.3} />
      </Svg>
    );
  }
  if (name === 'ink') {
    return (
      <Svg height={20} width={20} viewBox="0 0 24 24">
        <Path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" fill="none" stroke={color} strokeWidth={1.3} />
      </Svg>
    );
  }
  return (
    <Svg height={20} width={20} viewBox="0 0 24 24">
      <Path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" fill="none" stroke={color} strokeWidth={1.3} />
      <Circle cx={12} cy={9} r={2.5} fill="none" stroke={color} strokeWidth={1.3} />
    </Svg>
  );
}

export function WriteScreen() {
  const navigation = useNavigation<WriteNavigation>();
  const {colors, isDark} = useTheme();
  const toast = useToast();
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();
  const [now, setNow] = useState(() => new Date());
  const date = useMemo(() => formatDates(now), [now]);
  const [content, setContent] = useState('');
  const [isFuture, setIsFuture] = useState(false);
  const [category, setCategory] = useState<FeelingCategory>('weather');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customFeelingTags, setCustomFeelingTags] = useState<string[]>([]);
  const [customFeelingDraft, setCustomFeelingDraft] = useState('');
  const [showCustomFeelingInput, setShowCustomFeelingInput] = useState(false);
  const [feelingsExpanded, setFeelingsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stampScale = useSharedValue(1);
  const stampTranslateY = useSharedValue(0);
  const bloomScale = useSharedValue(1);
  const bloomOpacity = useSharedValue(0);
  const whiteOpacity = useSharedValue(0);
  const pageOpacity = useSharedValue(1);
  const feelingsHeight = useSharedValue(FEELINGS_COLLAPSED_HEIGHT);
  const feelingsStartHeight = useSharedValue(FEELINGS_COLLAPSED_HEIGHT);
  const screenBackgroundStyle = {
    backgroundColor: isDark ? colors.background : '#F5F0E4',
  };
  const whiteFieldStyle = {
    backgroundColor: isDark ? colors.background : '#FEFCF5',
  };

  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      stampScale.value = 1;
      stampTranslateY.value = 0;
      bloomScale.value = 1;
      bloomOpacity.value = 0;
      whiteOpacity.value = 0;
      pageOpacity.value = 1;
      feelingsHeight.value = FEELINGS_COLLAPSED_HEIGHT;
      setFeelingsExpanded(false);
      setSaving(false);
      return () => {
        if (navigationTimer.current) {
          clearTimeout(navigationTimer.current);
          navigationTimer.current = null;
        }
      };
    }, [
      bloomOpacity,
      bloomScale,
      feelingsHeight,
      pageOpacity,
      stampScale,
      stampTranslateY,
      whiteOpacity,
    ]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNow(new Date());
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(
    () => () => {
      if (navigationTimer.current) {
        clearTimeout(navigationTimer.current);
      }
    },
    [],
  );

  const stampStyle = useAnimatedStyle(() => ({
    transform: [
      {translateY: stampTranslateY.value},
      {rotate: '-3deg'},
      {scale: stampScale.value},
    ],
  }));
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomOpacity.value,
    transform: [{scale: bloomScale.value}],
  }));
  const whiteStyle = useAnimatedStyle(() => ({
    opacity: whiteOpacity.value,
  }));
  const pageStyle = useAnimatedStyle(() => ({
    opacity: pageOpacity.value,
  }));
  const feelingsPanelStyle = useAnimatedStyle(() => ({
    height: feelingsHeight.value,
  }));

  const setFeelingsPanel = (expanded: boolean) => {
    setFeelingsExpanded(expanded);
    feelingsHeight.value = withTiming(
      expanded ? FEELINGS_EXPANDED_HEIGHT : FEELINGS_COLLAPSED_HEIGHT,
      {
        duration: reduceMotion ? 1 : 220,
        easing: Easing.out(Easing.cubic),
      },
    );
  };

  const feelingsGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .onStart(() => {
      feelingsStartHeight.value = feelingsHeight.value;
    })
    .onUpdate(event => {
      feelingsHeight.value = Math.min(
        FEELINGS_EXPANDED_HEIGHT,
        Math.max(
          FEELINGS_COLLAPSED_HEIGHT,
          feelingsStartHeight.value - event.translationY,
        ),
      );
    })
    .onEnd(event => {
      const expanded =
        event.velocityY < -300 ||
        (event.velocityY <= 300 &&
          feelingsHeight.value >
            (FEELINGS_COLLAPSED_HEIGHT + FEELINGS_EXPANDED_HEIGHT) / 2);
      feelingsHeight.value = withTiming(
        expanded ? FEELINGS_EXPANDED_HEIGHT : FEELINGS_COLLAPSED_HEIGHT,
        {
          duration: reduceMotion ? 1 : 220,
          easing: Easing.out(Easing.cubic),
        },
      );
      runOnJS(setFeelingsExpanded)(expanded);
    });

  const toggleFuture = () => {
    const next = !isFuture;
    haptics.trigger('selection');
    setIsFuture(next);
    if (next) {
      toast.show('寄给一年后的自己');
    }
  };

  const toggleTag = (tag: string) => {
    haptics.trigger('selection');
    setSelectedTags(current =>
      current.includes(tag)
        ? current.filter(item => item !== tag)
        : [...current, tag],
    );
  };

  const openCustomFeelingInput = () => {
    setFeelingsPanel(true);
    setShowCustomFeelingInput(true);
  };

  const addCustomFeeling = () => {
    const tag = customFeelingDraft.trim();
    if (!tag) {
      return;
    }

    haptics.trigger('selection');
    if (!presetFeelingTags.has(tag)) {
      setCustomFeelingTags(current =>
        current.includes(tag) ? current : [...current, tag],
      );
    }
    setSelectedTags(current =>
      current.includes(tag) ? current : [...current, tag],
    );
    setCustomFeelingDraft('');
    setShowCustomFeelingInput(false);
  };

  const renderFeelingTag = (tag: string) => {
    const selected = selectedTags.includes(tag);
    const selectedFeelingStyle = {
      backgroundColor: selected ? colors.text : 'transparent',
      borderColor: selected ? colors.text : 'rgba(58,51,45,0.1)',
    };

    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={tag}
        accessibilityState={{checked: selected}}
        key={tag}
        onPress={() => toggleTag(tag)}
        style={[styles.feelingTag, selectedFeelingStyle]}>
        <Text
          style={[
            styles.feelingTagText,
            {
              color: selected
                ? isDark
                  ? colors.background
                  : '#FEFCF5'
                : colors.textMuted,
            },
          ]}>
          {tag}
        </Text>
      </Pressable>
    );
  };

  const animateStamp = (onFinished: () => void, includeBloom: boolean) => {
    haptics.trigger('seal');
    const quick = reduceMotion ? 1 : 100;
    stampScale.value = withSequence(
      withTiming(0.9, {duration: quick}),
      withTiming(1, {duration: quick}),
    );
    stampTranslateY.value = withSequence(
      withDelay(quick, withTiming(1, {duration: quick})),
      withTiming(0, {duration: quick}),
    );

    if (includeBloom && !reduceMotion) {
      bloomOpacity.value = withDelay(
        150,
        withSequence(
          withTiming(0.4, {duration: 275}),
          withTiming(0, {duration: 275}),
        ),
      );
      bloomScale.value = withDelay(
        150,
        withTiming(20, {duration: 550, easing: Easing.out(Easing.cubic)}),
      );
      whiteOpacity.value = withDelay(
        600,
        withSequence(
          withTiming(1, {duration: 100}),
          withTiming(0, {duration: 300}),
        ),
      );
      pageOpacity.value = withDelay(1000, withTiming(0, {duration: 200}));
    }

    navigationTimer.current = setTimeout(
      onFinished,
      reduceMotion ? 220 : includeBloom ? 1200 : 220,
    );
  };

  const submit = async () => {
    if (saving) {
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      toast.show('先落下几句话');
      return;
    }
    if (isFuture) {
      animateStamp(() => navigation.navigate('NewLetter'), false);
      return;
    }

    setSaving(true);
    try {
      const memory = await createMemory({
        content: trimmed,
        customTags: selectedTags,
        writtenAt: new Date(),
      });
      animateStamp(() => {
        toast.show('落下了');
        navigation.navigate('Daily', {newMemoryId: memory.id});
        setContent('');
        setSelectedTags([]);
        setCustomFeelingTags([]);
        setCustomFeelingDraft('');
        setShowCustomFeelingInput(false);
        setSaving(false);
      }, true);
    } catch (error) {
      console.error('保存此刻失败', error);
      setSaving(false);
      toast.show('没有落稳，请再试一次');
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.safeArea,
        screenBackgroundStyle,
      ]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safeArea}>
        <Animated.View style={[styles.page, pageStyle]}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="收起"
              hitSlop={8}
              onPress={() => navigation.navigate('Daily')}
              style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
              <Text style={[styles.close, {color: colors.textMuted}]}>收起</Text>
            </Pressable>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="未来信模式"
              accessibilityState={{checked: isFuture}}
              hitSlop={8}
              onPress={toggleFuture}
              style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
              <Text
                style={[
                  styles.dateStamp,
                  {color: isFuture ? colors.accent : colors.textMuted},
                ]}>
                {date.stamp.toUpperCase()}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.paper, {borderColor: colors.line}]}>
            <PaperBackground isDark={isDark} />
            <PaperRules />
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="寄给明年"
              accessibilityState={{checked: isFuture}}
              onPress={toggleFuture}
              style={styles.futureFold}>
              <Svg height={44} width={44}>
                <Polygon
                  points="44,0 44,44 0,0"
                  fill={isFuture ? colors.accent : colors.text}
                  opacity={isFuture ? 0.15 : 0.04}
                />
              </Svg>
              <Text
                style={[
                  styles.futureText,
                  {color: isFuture ? colors.accent : colors.textFaint},
                ]}>
                明年
              </Text>
            </Pressable>

            <View style={styles.paperHead}>
              <Text style={[styles.paperDate, {color: colors.textFaint}]}>
                {date.line.toUpperCase()}
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.body}>
              <TextInput
                accessibilityLabel="此刻内容"
                multiline
                onChangeText={setContent}
                placeholder={'此刻……\n\n不用想好，落下来就好。'}
                placeholderTextColor={
                  isDark ? 'rgba(232,223,211,0.25)' : 'rgba(58,51,45,0.2)'
                }
                selectionColor={colors.accent}
                style={[styles.input, {color: colors.text}]}
                textAlignVertical="top"
                value={content}
              />
              {content.length > 400 ? (
                <Text style={[styles.count, {color: colors.textFaint}]}>
                  {content.length} 字 · 建议在 500 字内
                </Text>
              ) : null}
            </ScrollView>

            <GestureDetector gesture={feelingsGesture}>
              <Animated.View
                style={[
                  styles.feelingsPanel,
                  isDark
                    ? styles.feelingsPanelDark
                    : styles.feelingsPanelLight,
                  {borderTopColor: colors.line},
                  feelingsPanelStyle,
                ]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    feelingsExpanded ? '收起感觉标签' : '展开感觉标签'
                  }
                  accessibilityHint="也可以上下拖动"
                  onPress={() => setFeelingsPanel(!feelingsExpanded)}
                  style={styles.feelingsHandle}>
                  <View
                    style={[
                      styles.feelingsHandleBar,
                      {backgroundColor: colors.textFaint},
                    ]}
                  />
                </Pressable>

                <View style={styles.feelings}>
                  <View style={styles.categoryRow}>
                    {(Object.keys(feelingCategories) as FeelingCategory[]).map(
                      item => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`感觉分类${feelingCategories[item].label}`}
                          key={item}
                          onPress={() => setCategory(item)}
                          style={[
                            styles.category,
                            category === item && {
                              borderBottomColor: colors.text,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.categoryText,
                              {
                                color:
                                  category === item
                                    ? colors.text
                                    : colors.textFaint,
                              },
                            ]}>
                            {feelingCategories[item].label}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                  {feelingsExpanded ? (
                    <View style={styles.expandedTagGrid}>
                      {feelingCategories[category].tags.map(renderFeelingTag)}
                      {customFeelingTags.map(renderFeelingTag)}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="自己写感觉"
                        onPress={openCustomFeelingInput}
                        style={styles.customFeelingTrigger}>
                        <Text
                          style={[
                            styles.customFeelingTriggerText,
                            {color: colors.textFaint},
                          ]}>
                          ＋ 自己写…
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <ScrollView
                      horizontal
                      contentContainerStyle={styles.tagRow}
                      showsHorizontalScrollIndicator={false}>
                      {feelingCategories[category].tags.map(renderFeelingTag)}
                      {customFeelingTags.map(renderFeelingTag)}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="自己写感觉"
                        onPress={openCustomFeelingInput}
                        style={styles.customFeelingTrigger}>
                        <Text
                          style={[
                            styles.customFeelingTriggerText,
                            {color: colors.textFaint},
                          ]}>
                          ＋ 自己写…
                        </Text>
                      </Pressable>
                    </ScrollView>
                  )}
                </View>

                {showCustomFeelingInput ? (
                  <View style={styles.customFeelingComposer}>
                    <TextInput
                      accessibilityLabel="自定义感觉"
                      autoFocus
                      blurOnSubmit={false}
                      maxLength={CUSTOM_FEELING_MAX_LENGTH}
                      onChangeText={setCustomFeelingDraft}
                      onSubmitEditing={addCustomFeeling}
                      placeholder="比如：今天有点软"
                      placeholderTextColor={colors.textFaint}
                      returnKeyType="done"
                      selectionColor={colors.accent}
                      style={[
                        styles.customFeelingInput,
                        {
                          borderBottomColor: colors.line,
                          color: colors.text,
                        },
                      ]}
                      value={customFeelingDraft}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="加入自定义感觉"
                      disabled={!customFeelingDraft.trim()}
                      onPress={addCustomFeeling}
                      style={({pressed}) => [
                        styles.customFeelingAdd,
                        {
                          opacity:
                            !customFeelingDraft.trim() ? 0.35 : pressed ? 0.6 : 1,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.customFeelingAddText,
                          {color: colors.accent},
                        ]}>
                        加入
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {selectedTags.length ? (
                  <View style={styles.selectedTags}>
                    {selectedTags.map(tag => (
                      <View key={tag} style={styles.selectedTag}>
                        <Text
                          style={[
                            styles.selectedTagText,
                            {color: primitiveColors.rose},
                          ]}>
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            </GestureDetector>
          </View>

          <View style={styles.edge}>
            <View style={styles.tools}>
              {['camera', 'audio', 'ink', 'location'].map(tool => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    {
                      camera: '拍照',
                      audio: '录音',
                      ink: '手书',
                      location: '位置',
                    }[tool]
                  }
                  key={tool}
                  onPress={() => toast.show('将在下一阶段开放')}
                  style={({pressed}) => [
                    styles.tool,
                    pressed && {backgroundColor: colors.line},
                  ]}>
                  <ToolIcon color={colors.textFaint} name={tool} />
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isFuture ? '继续写未来信' : '落下此刻'}
              disabled={saving}
              onPress={submit}
              style={styles.sealButton}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.sealBloom,
                  {backgroundColor: colors.seal},
                  bloomStyle,
                ]}
              />
              <Animated.View
                style={[
                  styles.sealStamp,
                  {backgroundColor: colors.seal},
                  stampStyle,
                ]}>
                <Text style={styles.sealText}>落</Text>
              </Animated.View>
            </Pressable>
          </View>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.whiteField,
            whiteFieldStyle,
            whiteStyle,
          ]}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  page: {flex: 1},
  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.cardGap,
  },
  close: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    letterSpacing: 1,
  },
  dateStamp: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 11,
    letterSpacing: 3,
  },
  paper: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 0.5,
    borderRadius: 2,
    overflow: 'hidden',
    boxShadow:
      '0 1px 3px rgba(58,51,45,0.05), 0 6px 20px rgba(58,51,45,0.04)',
  },
  bindingLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 44,
    width: 0.5,
    backgroundColor: 'rgba(212,168,83,0.12)',
  },
  paperRule: {
    position: 'absolute',
    right: 0,
    left: 0,
    height: 0.5,
    backgroundColor: 'rgba(58,51,45,0.025)',
  },
  futureFold: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 4,
    width: 44,
    height: 44,
  },
  futureText: {
    position: 'absolute',
    top: 6,
    right: 5,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 7,
    letterSpacing: 1,
  },
  paperHead: {
    zIndex: 2,
    paddingTop: spacing.xl,
    paddingRight: spacing.xxl,
    paddingLeft: 58,
  },
  paperDate: {
    fontFamily: fontFamilies.englishSerif,
    fontSize: 11,
    letterSpacing: 3,
  },
  body: {flex: 1, zIndex: 2},
  bodyContent: {
    flexGrow: 1,
    paddingTop: spacing.lg,
    paddingRight: spacing.xxl,
    paddingBottom: spacing.sm,
    paddingLeft: 58,
  },
  input: {
    minHeight: 180,
    flex: 1,
    padding: 0,
    fontFamily: fontFamilies.serif,
    fontSize: 16,
    lineHeight: 32,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  count: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    textAlign: 'right',
  },
  feelings: {
    paddingBottom: 6,
    paddingLeft: 58,
  },
  feelingsPanel: {
    zIndex: 3,
    flexShrink: 0,
    overflow: 'hidden',
    borderTopWidth: 0.5,
  },
  feelingsPanelLight: {
    backgroundColor: 'rgba(253,248,238,0.96)',
  },
  feelingsPanelDark: {
    backgroundColor: 'rgba(47,41,35,0.96)',
  },
  feelingsHandle: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feelingsHandleBar: {
    width: 32,
    height: 3,
    borderRadius: radius.pill,
    opacity: 0.35,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  category: {
    marginRight: spacing.gap,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  categoryText: {
    fontFamily: fontFamilies.sans,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  tagRow: {
    gap: spacing.xs,
    paddingRight: spacing.xxl,
  },
  expandedTagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingRight: spacing.xxl,
  },
  customFeelingTrigger: {
    justifyContent: 'center',
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(58,51,45,0.15)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.cardGap,
    paddingVertical: 3,
  },
  customFeelingTriggerText: {
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15.4,
  },
  customFeelingComposer: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginRight: spacing.xxl,
    marginLeft: 58,
    gap: spacing.sm,
  },
  customFeelingInput: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: spacing.xxs,
    borderBottomWidth: 0.5,
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 19.2,
  },
  customFeelingAdd: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  customFeelingAddText: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
  },
  feelingTag: {
    borderWidth: 0.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.cardGap,
    paddingVertical: 3,
  },
  feelingTagText: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 15.4,
  },
  selectedTags: {
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingRight: spacing.xxl,
    paddingLeft: 58,
  },
  selectedTag: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(201,155,146,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  selectedTagText: {
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  edge: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  tools: {flexDirection: 'row', gap: spacing.xxs},
  tool: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.image,
  },
  sealButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealStamp: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    boxShadow: '0 2px 8px rgba(192,57,43,0.2)',
  },
  sealText: {
    color: '#FFF8F0',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 20,
  },
  sealBloom: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: radius.round,
  },
  whiteField: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
  },
});
