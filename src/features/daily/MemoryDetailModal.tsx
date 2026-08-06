import {
  CameraRoll,
  iosRequestAddOnlyGalleryPermission,
} from '@react-native-camera-roll/camera-roll';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Clipboard,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {AppText as Text} from "../../components/AppText";
import DatePicker from 'react-native-date-picker';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { OverlayPortal } from '../../components/OverlayHost';
import { useToast } from '../../components/Toast';
import { Letter, Memory } from '../../db/models';
import { useHaptics } from '../../hooks/useHaptics';
import {
  cancelLetterArrivalNotification,
  requestLetterNotificationAccess,
  scheduleLetterArrivalNotification,
} from '../../services/letterNotifications';
import { minimumArrivalDate } from '../newLetter/futureLetterLogic';
import { formatMemoryTime, parseMemoryTags } from './dailyContext';
import { MemoryExportCard } from './MemoryExportCard';
import {
  AudioStrip,
  HandwritingAttachment,
  PaperTexture,
  Polaroid,
  ReplySlip,
  ThreadDecorations,
} from './MemoryDetailParts';
import { ReplySheet, StampSheet } from './MemoryDetailSheets';
import { formatDetailDate, getMemoryDateContext } from './memoryDetailLogic';
import { memoryDetailStyles as styles } from './memoryDetailModalStyles';
import {
  createMemoryReply,
  deleteMemory,
  deleteMemoryReply,
  getMemoryDetailData,
  removeMemoryStamp,
  setMemoryStamp,
} from './memoryDetailRepository';

type MemoryDetailModalProps = {
  contextLabel?: string;
  memory: Memory | null;
  onDismiss: () => void;
  onDeleted?: () => void;
};

type Sheet = 'reply' | 'stamp' | null;

const moodLabels: Record<string, string> = {
  calm: '平静',
  soft: '柔软',
  warm: '温暖',
  intense: '浓烈',
};

export function MemoryDetailModal({
  contextLabel,
  memory,
  onDismiss,
  onDeleted,
}: MemoryDetailModalProps) {
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();
  const exportRef = useRef<View>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useSharedValue(0);
  const feedbackOpacity = useSharedValue(0);
  const feedbackLift = useSharedValue(0);
  const progressRef = useRef(progress);
  const showToastRef = useRef(showToast);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [replies, setReplies] = useState<Memory[]>([]);
  const [stamp, setStamp] = useState<Letter | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savedPreviewUri, setSavedPreviewUri] = useState<string>();

  const tags = useMemo(
    () => parseMemoryTags(memory?.customTags ?? '[]'),
    [memory?.customTags],
  );
  const dateContext = useMemo(
    () => (memory ? getMemoryDateContext(memory.writtenAt) : null),
    [memory],
  );

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(
    () => () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    },
    [],
  );

  const memoryId = memory?.id;
  useEffect(() => {
    if (!memoryId) {
      return;
    }

    let active = true;
    setSheet(null);
    setReplies([]);
    setStamp(null);
    getMemoryDetailData(memoryId)
      .then(data => {
        if (active) {
          setReplies(data.replies);
          setStamp(data.stamp);
        }
      })
      .catch(error => {
        console.error('读取记忆详情失败', error);
        showToastRef.current('这一页暂时没有翻开');
      });

    const entryProgress = progressRef.current;
    entryProgress.value = 0;
    entryProgress.value = withTiming(1, {
      duration: reduceMotion ? 180 : 760,
      easing: Easing.bezier(0.22, 0.78, 0.18, 1),
    });
    return () => {
      active = false;
    };
  }, [memoryId, reduceMotion]);

  const pageStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion
      ? []
      : [
          { translateY: 18 * (1 - progress.value) },
          { scale: 0.985 + progress.value * 0.015 },
        ],
  }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion ? [] : [{ translateY: -10 * (1 - progress.value) }],
  }));
  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
    transform: reduceMotion
      ? []
      : [
          { translateY: 24 - feedbackLift.value * 42 },
          { scale: 0.9 + feedbackLift.value * 0.1 },
        ],
  }));

  const close = useCallback(() => {
    setSheet(null);
    haptics.trigger('selection');
    progress.value = withTiming(0, {
      duration: reduceMotion ? 100 : 220,
      easing: Easing.in(Easing.cubic),
    });
    setTimeout(onDismiss, reduceMotion ? 100 : 220);
  }, [haptics, onDismiss, progress, reduceMotion]);

  const sendReply = async (content: string) => {
    if (!memory || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const reply = await createMemoryReply(memory, content);
      setReplies(current => [...current, reply]);
      setSheet(null);
      haptics.trigger('envelopeOpen');
      showToast('回信已夹进这页');
    } catch (error) {
      console.error('保存回信失败', error);
      showToast('回信没有夹稳，请再试一次');
    } finally {
      setSubmitting(false);
    }
  };

  const saveStamp = async ({
    months,
    arriveOn,
  }: {
    months?: number;
    arriveOn?: Date;
  }) => {
    if (!memory || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      if (stamp) {
        await cancelLetterArrivalNotification(stamp.id);
      }
      const nextStamp = await setMemoryStamp({
        memory,
        months,
        arriveOn,
        existingStamp: stamp,
      });
      setStamp(nextStamp);

      let notificationAllowed = false;
      try {
        notificationAllowed = await requestLetterNotificationAccess();
        if (notificationAllowed) {
          await scheduleLetterArrivalNotification({
            letterId: nextStamp.id,
            arriveDate: nextStamp.arriveDate,
          });
        }
      } catch (error) {
        console.warn('详情页未来邮票通知调度失败', error);
      }
      setSheet(null);
      haptics.trigger('letterArrived');
      showToast(
        notificationAllowed
          ? '邮票已贴上，到时会提醒你'
          : '邮票已贴上，通知暂未开启',
      );
    } catch (error) {
      console.error('保存未来邮票失败', error);
      showToast('邮票没有贴稳，请再试一次');
    } finally {
      setSubmitting(false);
    }
  };

  const removeStamp = async () => {
    if (!stamp || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await cancelLetterArrivalNotification(stamp.id);
      await removeMemoryStamp(stamp);
      setStamp(null);
      setSheet(null);
      haptics.trigger('selection');
      showToast('已撕下邮票');
    } catch (error) {
      console.error('移除未来邮票失败', error);
      showToast('邮票暂时撕不下来');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteReply = (reply: Memory) => {
    Alert.alert(
      '删除这封回信？',
      '回信会从这段日迹和信箱中永久移除，此操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除回信',
          style: 'destructive',
          onPress: () => {
            deleteMemoryReply(reply)
              .then(() => {
                setReplies(current =>
                  current.filter(item => item.id !== reply.id),
                );
                haptics.trigger('selection');
                showToast('回信已删除');
              })
              .catch(error => {
                console.error('删除回信失败', error);
                showToast('回信没有删除，请再试一次');
              });
          },
        },
      ],
    );
  };

  const confirmDeleteMemory = () => {
    if (!memory || submitting) {
      return;
    }
    Alert.alert(
      '删除这条日迹？',
      '日迹、回信和关联的未来提醒会一并移除。此操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除日迹',
          style: 'destructive',
          onPress: () => {
            setSubmitting(true);
            deleteMemory(memory)
              .then(letterIds =>
                Promise.allSettled(
                  letterIds.map(cancelLetterArrivalNotification),
                ),
              )
              .then(() => {
                haptics.trigger('selection');
                showToast('日迹已删除');
                onDeleted?.();
                onDismiss();
              })
              .catch(error => {
                console.error('删除日迹失败', error);
                showToast('日迹没有删除，请再试一次');
              })
              .finally(() => setSubmitting(false));
          },
        },
      ],
    );
  };

  const copyMemory = () => {
    if (!memory) {
      return;
    }
    const meta = [
      formatDetailDate(memory.writtenAt),
      formatMemoryTime(memory.writtenAt),
      memory.placeDetail,
    ]
      .filter(Boolean)
      .join(' · ');
    Clipboard.setString(`${memory.content}\n\n${meta}`);
    haptics.trigger('selection');
    showToast('已复制');
  };

  const exportMemory = async () => {
    if (!exportRef.current) {
      return;
    }
    try {
      if (Platform.OS === 'ios') {
        const permission = await iosRequestAddOnlyGalleryPermission();
        if (permission !== 'granted' && permission !== 'limited') {
          showToast('需要允许添加照片，才能存进相册');
          return;
        }
      } else if (
        typeof Platform.Version === 'number' &&
        Platform.Version <= 28
      ) {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          showToast('需要允许存储照片，才能存进相册');
          return;
        }
      }
      const uri = await captureRef(exportRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      const imageUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      await CameraRoll.saveAsset(imageUri, { album: '渡', type: 'photo' });
      haptics.trigger('envelopeOpen');
      setSavedPreviewUri(imageUri);
      feedbackOpacity.value = 0;
      feedbackLift.value = 0;
      feedbackOpacity.value = withSequence(
        withTiming(1, { duration: reduceMotion ? 120 : 220 }),
        withDelay(850, withTiming(0, { duration: 280 })),
      );
      feedbackLift.value = withTiming(1, {
        duration: reduceMotion ? 1 : 1200,
        easing: Easing.out(Easing.cubic),
      });
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
      feedbackTimer.current = setTimeout(
        () => setSavedPreviewUri(undefined),
        1450,
      );
      showToast('已存为图片');
    } catch (error) {
      console.error('导出记忆图片失败', error);
      showToast('图片没有存好，请再试一次');
    }
  };

  if (!memory || !dateContext) {
    return null;
  }

  const hasPhoto = Boolean(memory.imagePath || memory.photoTone);
  const hasTags = Boolean(tags.length || memory.mood);

  return (
    <OverlayPortal
      name="memory-detail"
      onRequestClose={sheet ? () => setSheet(null) : close}
      visible
    >
      <View
        accessibilityViewIsModal
        style={[styles.root, { paddingTop: insets.top }]}
      >
        <PaperTexture />
        <View pointerEvents="none" style={styles.exportStage}>
          <View ref={exportRef} collapsable={false}>
            <MemoryExportCard memory={memory} replies={replies} />
          </View>
        </View>
        <Animated.View style={[styles.topBar, headerStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="收起日迹详情"
            hitSlop={12}
            onPress={close}
            style={({ pressed }) => [
              styles.collapseButton,
              { opacity: pressed ? 0.52 : 1 },
            ]}
          >
            <Text style={styles.collapseText}>收起</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.page, pageStyle]}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              styles.androidBottom,
              { paddingBottom: insets.bottom + 38 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.exportPage}>
              {contextLabel ? (
                <Text style={styles.contextLabel}>{contextLabel}</Text>
              ) : null}
              <View style={styles.dateHeader}>
                <Text style={styles.monthYear}>
                  {dateContext.monthName.toUpperCase()} · {dateContext.year}
                </Text>
                <Text style={styles.dayNumber}>{dateContext.day}</Text>
                <View style={styles.dayMeta}>
                  <Text style={styles.weekday}>{dateContext.weekday}</Text>
                  <View style={styles.dateDot} />
                  <Text style={styles.lunar}>{dateContext.lunar}</Text>
                  <View style={styles.dateDot} />
                  <Text style={styles.solarTerm}>{dateContext.solarTerm}</Text>
                </View>
                <View style={styles.seasonSeal}>
                  <Text style={styles.seasonSealText}>
                    {dateContext.seasonChar}
                  </Text>
                </View>
              </View>

              <View style={styles.note}>
                <View pointerEvents="none" style={styles.noteRules}>
                  {Array.from({ length: 20 }, (_, index) => (
                    <View key={index} style={styles.noteRule} />
                  ))}
                </View>
                <View pointerEvents="none" style={styles.noteHeaderRule} />
                <View style={styles.noteTape} />
                <View style={styles.cornerMark} />
                <Text
                  accessibilityLabel={
                    memory.placeDetail
                      ? `此刻位置，${memory.placeDetail}`
                      : undefined
                  }
                  style={styles.noteMeta}
                >
                  {formatMemoryTime(memory.writtenAt)}
                  {memory.placeDetail ? ` · ${memory.placeDetail}` : ''}
                </Text>
                {memory.content ? (
                  <Text style={styles.noteBody}>{memory.content}</Text>
                ) : (
                  <Text style={styles.emptyBody}>这一刻没有写下文字</Text>
                )}
                {hasPhoto ? <Polaroid memory={memory} /> : null}
                {memory.audioPath ? (
                  <AudioStrip memory={memory} onError={showToast} />
                ) : null}
                {memory.inkImagePath ? (
                  <HandwritingAttachment path={memory.inkImagePath} />
                ) : null}
                {hasTags ? (
                  <View style={styles.tagLine}>
                    {tags.map(tag => (
                      <Text key={tag} style={styles.tagText}>
                        # {tag}
                      </Text>
                    ))}
                    {memory.mood ? (
                      <Text style={styles.moodText}>
                        心绪 · {moodLabels[memory.mood] ?? memory.mood}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={styles.thread}>
                <ThreadDecorations />
                <Text style={styles.threadEyebrow}>REPLIES THROUGH TIME</Text>
                <Text style={styles.threadTitle}>后来，你这样回信</Text>
                {replies.length ? (
                  replies.map((reply, index) => (
                    <ReplySlip
                      index={index}
                      key={reply.id}
                      memory={reply}
                      onDelete={() => confirmDeleteReply(reply)}
                      parentDate={memory.writtenAt}
                    />
                  ))
                ) : (
                  <Text style={styles.emptyReplies}>
                    这里还没有回声。以后再读到时，也许会想说点什么。
                  </Text>
                )}
              </View>

              {stamp ? (
                <View style={styles.stampStatus}>
                  <View style={styles.miniStamp}>
                    <Text style={styles.miniStampText}>渡</Text>
                  </View>
                  <View style={styles.stampStatusCopy}>
                    <Text style={styles.stampStatusTitle}>这页已寄给未来</Text>
                    <Text style={styles.stampStatusDate}>
                      将于 {formatDetailDate(stamp.arriveDate)} 再次抵达
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSheet('stamp')}
                    style={styles.changeStamp}
                  >
                    <Text style={styles.changeStampText}>改期</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSheet('reply')}
                style={({ pressed }) => [
                  styles.replyAction,
                  { opacity: pressed ? 0.76 : 1 },
                ]}
              >
                <Text style={styles.replyActionMark}>＋</Text>
                <Text style={styles.replyActionText}>写一封回信</Text>
              </Pressable>
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    showToast('已放回日迹');
                    close();
                  }}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>放回日迹</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSheet('stamp')}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>
                    {stamp ? '查看邮票' : '寄给未来'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={copyMemory}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>复制</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={exportMemory}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>存为图</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="删除这条日迹"
                disabled={submitting}
                onPress={confirmDeleteMemory}
                style={({ pressed }) => [
                  styles.deleteAction,
                  { opacity: submitting ? 0.35 : pressed ? 0.55 : 1 },
                ]}
              >
                <Text style={styles.deleteActionText}>删除这条日迹</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>

        {sheet === 'reply' ? (
          <ReplySheet
            onClose={() => setSheet(null)}
            onSend={sendReply}
            submitting={submitting}
          />
        ) : null}
        {sheet === 'stamp' ? (
          <StampSheet
            currentStamp={stamp}
            onClose={() => setSheet(null)}
            onCustom={() => setPickerOpen(true)}
            onPick={months => saveStamp({ months })}
            onRemove={removeStamp}
            submitting={submitting}
          />
        ) : null}
        <DatePicker
          modal
          cancelText="取消"
          confirmText="贴在这一天"
          date={stamp?.arriveDate ?? minimumArrivalDate()}
          locale="zh-CN"
          minimumDate={minimumArrivalDate()}
          mode="date"
          open={pickerOpen}
          theme="light"
          title="选择再次抵达的日期"
          onCancel={() => setPickerOpen(false)}
          onConfirm={date => {
            setPickerOpen(false);
            saveStamp({ arriveOn: date });
          }}
        />
        {savedPreviewUri ? (
          <Animated.View
            accessibilityLiveRegion="polite"
            accessibilityLabel="图片已保存到相册"
            pointerEvents="none"
            style={[styles.saveFeedback, feedbackStyle]}
          >
            <Image
              resizeMode="cover"
              source={{ uri: savedPreviewUri }}
              style={styles.saveFeedbackImage}
            />
            <View style={styles.saveFeedbackCopy}>
              <Text style={styles.saveFeedbackTitle}>已存入相册</Text>
              <Text style={styles.saveFeedbackDetail}>只保留信件内容</Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </OverlayPortal>
  );
}
