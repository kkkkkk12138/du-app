import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { OverlayPortal } from '../../components/OverlayHost';
import { useToast } from '../../components/Toast';
import { Wish, WishTape } from '../../db/models';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../tokens/radius';
import { shadows } from '../../tokens/shadows';
import { spacing } from '../../tokens/spacing';
import { fontFamilies } from '../../tokens/typography';
import {
  addQuestSticky,
  getQuestAggregates,
  QuestAggregate,
} from './questRepository';
import {
  journalDetailBackdropColor,
  journalDetailBorderColor,
  journalDetailPaperColor,
  journalDetailTapeColor,
} from './journalPaper';
import {
  createWishTape,
  createWish,
  deleteWishTape,
  deleteWish,
  getWishTapes,
  getWishes,
  setWishFulfilled,
  setWishPinned,
  updateWish,
  WishCategory,
  WishTapeStyle,
  wishCategories,
  wishTapeStyles,
} from './wishRepository';

type WishColor = 'yellow' | 'pink' | 'green' | 'blue' | 'purple' | 'orange';
type ComposerMode = 'create' | 'edit' | null;

const colorOptions: WishColor[] = [
  'yellow',
  'pink',
  'green',
  'blue',
  'purple',
  'orange',
];

const categoryNames: Record<WishCategory, string> = {
  place: '地方',
  do: '事',
  self: '自己',
  friend: '人',
  time: '时',
  habit: '习惯',
};

const tapeNames: Record<WishTapeStyle, string> = {
  plain: '米黄',
  stripes: '红格',
  blue: '蓝条',
  green: '浅绿',
  yellow: '黄条',
  vintage: '旧纸',
  washi: '和纸',
  dots: '点纹',
};

const tapeColors: Record<WishTapeStyle, { paper: string; edge: string }> = {
  plain: { paper: '#FFF8DC', edge: '#C8AA78' },
  stripes: { paper: '#FFFBE6', edge: '#C85B4B' },
  blue: { paper: '#EBF4FF', edge: '#4E82B8' },
  green: { paper: '#EEF8E6', edge: '#79A15E' },
  yellow: { paper: '#FFF8D0', edge: '#C9A744' },
  vintage: { paper: '#EAD5B4', edge: '#9D7A4D' },
  washi: { paper: '#FAF4F0', edge: '#B88E9D' },
  dots: { paper: '#FFF8F0', edge: '#C57A88' },
};

function normalizeWishColor(value?: string): WishColor {
  return colorOptions.includes(value as WishColor)
    ? (value as WishColor)
    : 'yellow';
}

export function WishSection({
  userId,
  onCountChange,
  onAttachedToQuest,
  onOpenQuests,
  refreshRevision = 0,
}: {
  userId?: string;
  onCountChange?: (count: number) => void;
  onAttachedToQuest?: (questId: string, nodeId: string) => void;
  onOpenQuests?: () => void;
  refreshRevision?: number;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const detailLift = useRef(new Animated.Value(1)).current;
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [listTapes, setListTapes] = useState<Record<string, WishTape[]>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedWish, setSelectedWish] = useState<Wish>();
  const [selectedWishTapes, setSelectedWishTapes] = useState<WishTape[]>([]);
  const [tapePickerOpen, setTapePickerOpen] = useState(false);
  const [tapeText, setTapeText] = useState('');
  const [tapeStyle, setTapeStyle] = useState<WishTapeStyle>('plain');
  const [tapeSaving, setTapeSaving] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const [editingWishId, setEditingWishId] = useState<string>();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [color, setColor] = useState<WishColor>('yellow');
  const [category, setCategory] = useState<WishCategory>('place');

  useEffect(() => {
    if (!selectedWish || reduceMotion) {
      detailLift.setValue(1);
      return;
    }
    detailLift.setValue(0);
    const animation = Animated.timing(detailLift, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [detailLift, reduceMotion, selectedWish]);
  const [targetAt, setTargetAt] = useState<Date>();
  const [saving, setSaving] = useState(false);
  const [questItems, setQuestItems] = useState<QuestAggregate[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [selectedQuestId, setSelectedQuestId] = useState<string>();

  const load = useCallback(async () => {
    try {
      const next = await getWishes(userId);
      setWishes(next);
      const tapes = await Promise.all(
        next.map(async wish => [wish.id, await getWishTapes(wish.id)] as const),
      );
      setListTapes(Object.fromEntries(tapes));
      onCountChange?.(next.length);
      setSelectedWish(current =>
        current ? next.find(wish => wish.id === current.id) : undefined,
      );
      setFailed(false);
    } catch (error) {
      console.error('念想读取失败', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [onCountChange, userId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load, refreshRevision]);

  const visibleWishes = wishes;
  const selectedQuest = questItems.find(
    item => item.quest.id === selectedQuestId,
  );

  const openWishDetail = async (wish: Wish) => {
    setQuestItems([]);
    setSelectedQuestId(undefined);
    setSelectedWish(wish);
    try {
      setSelectedWishTapes(await getWishTapes(wish.id));
    } catch (error) {
      console.error('念想胶带读取失败', error);
      setSelectedWishTapes([]);
      toast.show('胶带暂时没有展开');
    }
  };

  const closeWishDetail = () => {
    setSelectedWish(undefined);
    setSelectedWishTapes([]);
    setTapePickerOpen(false);
    setTapeText('');
    setTapeStyle('plain');
  };

  const addTape = async () => {
    if (!selectedWish || !tapeText.trim() || tapeSaving) {
      return;
    }
    if (tapeText.trim().length > 120) {
      toast.show('胶带批注最多 120 个字');
      return;
    }
    setTapeSaving(true);
    try {
      await createWishTape({
        wishId: selectedWish.id,
        text: tapeText,
        style: tapeStyle,
      });
      setSelectedWishTapes(await getWishTapes(selectedWish.id));
      setTapePickerOpen(false);
      setTapeText('');
      setTapeStyle('plain');
      toast.show('胶带贴好了');
    } catch (error) {
      console.error('念想胶带保存失败', error);
      toast.show(error instanceof Error ? error.message : '胶带没有贴稳');
    } finally {
      setTapeSaving(false);
    }
  };

  const confirmDeleteTape = (tape: WishTape) => {
    Alert.alert('揭下这条胶带？', undefined, [
      { text: '取消', style: 'cancel' },
      {
        text: '揭下',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWishTape(tape.id);
            if (selectedWish) {
              setSelectedWishTapes(await getWishTapes(selectedWish.id));
            }
          } catch (error) {
            console.error('念想胶带删除失败', error);
            toast.show('胶带没有揭下来');
          }
        },
      },
    ]);
  };

  const run = async (work: Promise<unknown>, failure: string) => {
    try {
      await work;
      await load();
      return true;
    } catch (error) {
      console.error(failure, error);
      toast.show(error instanceof Error ? error.message : failure);
      return false;
    }
  };

  const openComposer = (wish?: Wish) => {
    setSelectedWish(undefined);
    setComposerMode(wish ? 'edit' : 'create');
    setEditingWishId(wish?.id);
    setTitle(wish?.title ?? '');
    setNote(wish?.note ?? '');
    setColor(normalizeWishColor(wish?.color));
    setCategory(
      wishCategories.includes(wish?.category as WishCategory)
        ? (wish?.category as WishCategory)
        : 'place',
    );
    setTargetAt(wish?.targetAt);
  };

  const closeComposer = () => {
    if (!saving) {
      setComposerMode(null);
      setEditingWishId(undefined);
      setTitle('');
      setNote('');
      setColor('yellow');
      setCategory('place');
      setTargetAt(undefined);
    }
  };

  const submit = async () => {
    if (!userId || !title.trim() || saving) {
      if (!userId) {
        toast.show('本地身份还没有准备好');
      }
      return;
    }
    if (title.trim().length > 80) {
      toast.show('念想标题最多 80 个字');
      return;
    }
    if (note.trim().length > 300) {
      toast.show('念想备注最多 300 个字');
      return;
    }
    setSaving(true);
    const work =
      composerMode === 'edit' && editingWishId
        ? updateWish({
            wishId: editingWishId,
            title,
            note,
            color,
            category,
            targetAt,
          })
        : createWish({ userId, title, note, color, category });
    const saved = await run(work, '念想没有保存');
    setSaving(false);
    if (saved) {
      closeComposer();
    }
  };

  const confirmDelete = (wish: Wish) => {
    Alert.alert('放下这个念想？', '删除后将无法恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const deleted = await run(deleteWish(wish.id), '念想没有删除');
          if (deleted) {
            setSelectedWish(undefined);
          }
        },
      },
    ]);
  };

  const beginAttach = async () => {
    if (!userId || !selectedWish || attaching) {
      return;
    }
    setAttaching(true);
    try {
      const quests = await getQuestAggregates(userId);
      setQuestItems(quests);
      setSelectedQuestId(quests[0]?.quest.id);
      if (!quests.length) {
        toast.show('先创建一张副本，再把念想贴上去');
        setSelectedWish(undefined);
        onOpenQuests?.();
      }
    } catch (error) {
      console.error('读取可贴副本失败', error);
      toast.show('副本暂时没有展开');
    } finally {
      setAttaching(false);
    }
  };

  const attachToNode = async (questId: string, nodeId: string) => {
    if (!selectedWish || attaching) {
      return;
    }
    setAttaching(true);
    const text = [selectedWish.title, selectedWish.note]
      .filter(Boolean)
      .join('\n');
    const attached = await run(
      addQuestSticky({
        questId,
        nodeId,
        text,
        color: normalizeWishColor(selectedWish.color),
      }),
      '念想没有贴稳',
    );
    setAttaching(false);
    if (attached) {
      setSelectedWish(undefined);
      setQuestItems([]);
      setSelectedQuestId(undefined);
      toast.show('念想已贴到副本');
      onAttachedToQuest?.(questId, nodeId);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.wishHero}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          风里的<Text style={{ color: colors.accent }}>念头</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="记一笔念想"
          onPress={() => openComposer()}
          style={[styles.heroButton, { borderColor: `${colors.accent}33` }]}
        >
          <Text style={[styles.heroButtonText, { color: colors.accent }]}>
            ＋
          </Text>
          <Text style={[styles.heroButtonText, { color: colors.accent }]}>
            记一笔
          </Text>
        </Pressable>
      </View>

      <View style={[styles.looseLeaf, shadows.paper]}>
        <View pointerEvents="none" style={styles.paperLines}>
          {Array.from({ length: 24 }, (_, index) => (
            <View key={index} style={styles.paperLine} />
          ))}
        </View>
        <View pointerEvents="none" style={styles.marginLine} />
        <View pointerEvents="none" style={styles.holes}>
          {Array.from({ length: 10 }, (_, index) => (
            <View key={index} style={styles.hole} />
          ))}
        </View>
        <View pointerEvents="none" style={styles.ripTop}>
          <Svg height={6} width="100%" viewBox="0 0 360 6">
            <Path
              d="M0 1 Q9 5 18 2 T36 2 T54 1 T72 3 T90 1 T108 2 T126 0 T144 3 T162 1 T180 2 T198 0 T216 3 T234 1 T252 2 T270 0 T288 3 T306 1 T324 2 T342 0 T360 2"
              fill="none"
              stroke="#FBF7EE"
              strokeWidth={6}
            />
          </Svg>
        </View>

        {loading ? (
          <Text style={[styles.stateText, { color: colors.textMuted }]}>
            正在展开念想…
          </Text>
        ) : failed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="重新读取念想"
            onPress={() => load().catch(() => undefined)}
            style={styles.paperEmpty}
          >
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              念想暂时没有展开
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              轻触重新翻开这一页。
            </Text>
          </Pressable>
        ) : visibleWishes.length ? (
          <View style={styles.board}>
            {visibleWishes.map(wish => {
              const fulfilled = wish.status === 'fulfilled';
              const categoryValue = wishCategories.includes(
                wish.category as WishCategory,
              )
                ? (wish.category as WishCategory)
                : undefined;
              const firstTape = listTapes[wish.id]?.[0];
              const upcoming =
                wish.targetAt &&
                wish.targetAt.getTime() > Date.now() &&
                wish.targetAt.getTime() - Date.now() <=
                  90 * 24 * 60 * 60 * 1000;
              const checkStyle = {
                borderColor: fulfilled
                  ? 'rgba(143,170,149,0.5)'
                  : 'rgba(139,115,85,0.3)',
                backgroundColor: fulfilled
                  ? 'rgba(143,170,149,0.5)'
                  : 'transparent',
              };
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`查看念想${wish.title}`}
                  key={wish.id}
                  onPress={() => openWishDetail(wish)}
                  style={({ pressed }) => [
                    styles.wishItem,
                    fulfilled && styles.wishItemDone,
                    { opacity: pressed ? 0.75 : fulfilled ? 0.6 : 1 },
                  ]}
                >
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`标记念想${wish.title}完成`}
                    accessibilityState={{ checked: fulfilled }}
                    onPress={event => {
                      event.stopPropagation();
                      run(
                        setWishFulfilled(wish.id, !fulfilled),
                        '念想状态没有保存',
                      ).catch(() => undefined);
                    }}
                    style={[styles.check, checkStyle]}
                  >
                    {fulfilled ? <Text style={styles.checkMark}>✓</Text> : null}
                  </Pressable>
                  {categoryValue ? (
                    <Text style={styles.categoryCode}>{categoryValue}</Text>
                  ) : null}
                  <View style={styles.titleRow}>
                    {upcoming ? (
                      <View
                        style={[
                          styles.upcomingDot,
                          { backgroundColor: colors.accent },
                        ]}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.itemTitle,
                        { color: fulfilled ? colors.textFaint : colors.text },
                        fulfilled && styles.fulfilledTitle,
                      ]}
                    >
                      {wish.title}
                    </Text>
                  </View>
                  {wish.note ? (
                    <Text
                      numberOfLines={2}
                      style={[styles.itemNote, { color: colors.textFaint }]}
                    >
                      {wish.note}
                    </Text>
                  ) : null}
                  <View style={styles.itemMeta}>
                    {categoryValue ? (
                      <Text style={styles.itemTag}>
                        #{categoryNames[categoryValue]}
                      </Text>
                    ) : null}
                    <Text style={styles.itemDate}>
                      {wish.targetAt
                        ? wish.targetAt.toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                          })
                        : wish.updatedAt.toLocaleDateString('zh-CN', {
                            month: 'numeric',
                            day: 'numeric',
                          })}
                    </Text>
                  </View>
                  {firstTape ? (
                    <View
                      style={[
                        styles.listTapeNote,
                        {
                          backgroundColor:
                            tapeColors[
                              wishTapeStyles.includes(
                                firstTape.style as WishTapeStyle,
                              )
                                ? (firstTape.style as WishTapeStyle)
                                : 'plain'
                            ].paper,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.listTapeStrip,
                          {
                            backgroundColor:
                              tapeColors[
                                wishTapeStyles.includes(
                                  firstTape.style as WishTapeStyle,
                                )
                                  ? (firstTape.style as WishTapeStyle)
                                  : 'plain'
                              ].edge,
                          },
                        ]}
                      />
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.listTapeText,
                          { color: colors.textMuted },
                        ]}
                      >
                        {firstTape.text}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.paperEmpty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              还没有写下念想
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              贴下一个想去的地方，或一个想完成的念头。
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="写下第一个念想"
              onPress={() => openComposer()}
            >
              <Text style={[styles.emptyAction, { color: colors.accent }]}>
                贴下第一个
              </Text>
            </Pressable>
          </View>
        )}
        <View pointerEvents="none" style={styles.ripBottom}>
          <Svg height={6} width="100%" viewBox="0 0 360 6">
            <Path
              d="M0 4 Q9 0 18 3 T36 3 T54 5 T72 2 T90 5 T108 3 T126 6 T144 2 T162 5 T180 3 T198 6 T216 2 T234 5 T252 3 T270 6 T288 2 T306 5 T324 3 T342 6 T360 3"
              fill="none"
              stroke="#FBF7EE"
              strokeWidth={6}
            />
          </Svg>
        </View>
      </View>

      <View style={styles.pageFooter}>
        <Text style={styles.pageNumber}>— page 01 —</Text>
      </View>

      <OverlayPortal
        blurBackground
        name="wish-detail"
        onRequestClose={closeWishDetail}
        visible={Boolean(selectedWish) && !tapePickerOpen}
      >
        <View style={styles.detailModalRoot}>
          <Pressable
            accessibilityLabel="收起念想"
            onPress={closeWishDetail}
            style={styles.modalBackdrop}
          />
          {selectedWish ? (
            <Animated.ScrollView
              accessibilityLabel="念想纸页详情"
              accessibilityViewIsModal
              showsVerticalScrollIndicator={false}
              style={[
                styles.detailPaper,
                shadows.deep,
                {
                  backgroundColor: journalDetailPaperColor,
                  opacity: detailLift,
                  transform: [
                    {
                      translateY: detailLift.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                    {
                      scale: detailLift.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                    { rotate: '-0.7deg' },
                  ],
                },
              ]}
            >
              <View pointerEvents="none" style={styles.detailTape} />
              <View pointerEvents="none" style={styles.detailFold} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭念想详情"
                onPress={closeWishDetail}
                style={styles.composerClose}
              >
                <Text style={{ color: colors.text }}>✕</Text>
              </Pressable>
              <Text style={styles.detailCategory}>
                {wishCategories.includes(selectedWish.category as WishCategory)
                  ? categoryNames[selectedWish.category as WishCategory]
                  : '念想'}
              </Text>
              <Text style={[styles.detailDate, { color: colors.textMuted }]}>
                {(
                  selectedWish.targetAt ?? selectedWish.createdAt
                ).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
              <Text style={[styles.detailTitle, { color: colors.text }]}>
                {selectedWish.title}
              </Text>
              <Text style={[styles.detailNote, { color: colors.textSoft }]}>
                {selectedWish.note || '这张念想还没有写小字。'}
              </Text>

              {selectedWishTapes.length ? (
                <View style={styles.tapeList}>
                  {selectedWishTapes.map(tape => {
                    const style = wishTapeStyles.includes(
                      tape.style as WishTapeStyle,
                    )
                      ? (tape.style as WishTapeStyle)
                      : 'plain';
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`揭下胶带${tape.text}`}
                        key={tape.id}
                        onLongPress={() => confirmDeleteTape(tape)}
                        style={[
                          styles.tapeRow,
                          {
                            backgroundColor: tapeColors[style].paper,
                            borderLeftColor: tapeColors[style].edge,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.tapeRowText, { color: colors.text }]}
                        >
                          {tape.text}
                        </Text>
                        <Text
                          style={[styles.tapeHint, { color: colors.textFaint }]}
                        >
                          长按揭下
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {questItems.length ? (
                <View
                  style={[styles.questPicker, { borderColor: colors.line }]}
                >
                  <Text style={[styles.pickerTitle, { color: colors.text }]}>
                    贴到哪张副本
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.questChoices}
                  >
                    {questItems.map(item => (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{
                          selected: selectedQuestId === item.quest.id,
                        }}
                        key={item.quest.id}
                        onPress={() => setSelectedQuestId(item.quest.id)}
                        style={[
                          styles.questChoice,
                          {
                            borderColor:
                              selectedQuestId === item.quest.id
                                ? colors.accent
                                : colors.line,
                          },
                        ]}
                      >
                        <Text style={{ color: colors.text }}>
                          {item.quest.title}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Text style={[styles.pickerTitle, { color: colors.text }]}>
                    选择节点
                  </Text>
                  {selectedQuest?.nodes.length ? (
                    <View style={styles.nodeChoices}>
                      {selectedQuest.nodes.map(node => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`贴到节点${node.title}`}
                          disabled={attaching}
                          key={node.id}
                          onPress={() =>
                            attachToNode(selectedQuest.quest.id, node.id)
                          }
                          style={[
                            styles.nodeChoice,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.line,
                            },
                          ]}
                        >
                          <Text style={{ color: colors.textSoft }}>
                            {node.icon} {node.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="前往副本钉节点"
                      onPress={() => {
                        setSelectedWish(undefined);
                        onOpenQuests?.();
                      }}
                    >
                      <Text
                        style={[styles.noNode, { color: colors.textMuted }]}
                      >
                        这张副本还没有节点，去钉下第一站 →
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <>
                  <View style={styles.primaryActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="给念想贴胶带"
                      onPress={() => setTapePickerOpen(true)}
                      style={[styles.tapeAction, { borderColor: colors.line }]}
                    >
                      <Text
                        style={[
                          styles.detailAction,
                          { color: colors.textMuted },
                        ]}
                      >
                        ＋ 贴一条胶带
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.secondaryFeatureActions}>
                    <Pressable onPress={() => openComposer(selectedWish)}>
                      <Text
                        style={[
                          styles.secondaryFeatureText,
                          { color: colors.textMuted },
                        ]}
                      >
                        编辑
                      </Text>
                    </Pressable>
                    <Pressable disabled={attaching} onPress={beginAttach}>
                      <Text
                        style={[
                          styles.secondaryFeatureText,
                          { color: colors.textMuted },
                        ]}
                      >
                        贴到副本
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(selectedWish)}>
                      <Text
                        style={[
                          styles.secondaryFeatureText,
                          { color: colors.textMuted },
                        ]}
                      >
                        删除
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
              {!questItems.length ? (
                <View style={styles.secondaryFeatureActions}>
                  <Pressable
                    onPress={() =>
                      run(
                        setWishPinned(selectedWish.id, !selectedWish.pinned),
                        '念想没有置顶',
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.secondaryFeatureText,
                        { color: colors.textMuted },
                      ]}
                    >
                      {selectedWish.pinned ? '取消置顶' : '置顶'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Animated.ScrollView>
          ) : null}
        </View>
      </OverlayPortal>

      <OverlayPortal
        name="wish-tape-picker"
        onRequestClose={() => setTapePickerOpen(false)}
        visible={tapePickerOpen}
      >
        <View style={styles.tapeModalRoot}>
          <Pressable
            accessibilityLabel="收起胶带选择"
            onPress={() => setTapePickerOpen(false)}
            style={styles.modalBackdrop}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.tapeSheet,
              shadows.deep,
              { backgroundColor: colors.surfaceWarm },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: colors.line }]}
            />
            <Text style={[styles.tapeSheetTitle, { color: colors.text }]}>
              选一条胶带
            </Text>
            <View style={styles.tapeGrid}>
              {wishTapeStyles.map(option => {
                const optionStyle = {
                  backgroundColor: tapeColors[option].paper,
                  borderColor:
                    tapeStyle === option ? colors.accent : 'transparent',
                };
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={`胶带样式${tapeNames[option]}`}
                    accessibilityState={{ selected: tapeStyle === option }}
                    key={option}
                    onPress={() => setTapeStyle(option)}
                    style={[styles.tapeOption, optionStyle]}
                  >
                    <View
                      style={[
                        styles.tapeOptionEdge,
                        { backgroundColor: tapeColors[option].edge },
                      ]}
                    />
                    <Text
                      style={[
                        styles.tapeOptionText,
                        { color: colors.textSoft },
                      ]}
                    >
                      {tapeNames[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              accessibilityLabel="胶带批注"
              defaultValue=""
              multiline
              onChangeText={setTapeText}
              placeholder="写一句再贴"
              placeholderTextColor={colors.textFaint}
              style={[
                styles.tapeInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  color: colors.text,
                },
              ]}
              textAlignVertical="top"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="贴上胶带"
              disabled={!tapeText.trim() || tapeSaving}
              onPress={addTape}
              style={[
                styles.tapeSubmit,
                (!tapeText.trim() || tapeSaving) && styles.disabled,
                { backgroundColor: colors.text },
              ]}
            >
              <Text style={[styles.tapeSubmitText, { color: colors.surface }]}>
                {tapeSaving ? '正在贴好…' : '贴上'}
              </Text>
            </Pressable>
          </View>
        </View>
      </OverlayPortal>

      <OverlayPortal
        name="wish-composer"
        onRequestClose={closeComposer}
        visible={Boolean(composerMode)}
      >
        <View style={styles.composerModalRoot}>
          <Pressable onPress={closeComposer} style={styles.modalBackdrop} />
          <View
            accessibilityViewIsModal
            style={[styles.composer, shadows.deep, styles.warmSheet]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="收起念想编辑"
              onPress={closeComposer}
              style={styles.composerClose}
            >
              <Text style={{ color: colors.text }}>✕</Text>
            </Pressable>
            <Text style={[styles.composerMark, { color: colors.textMuted }]}>
              {composerMode === 'edit' ? '改一改' : '记一笔'}
            </Text>
            <Text style={[styles.composerDate, { color: colors.textMuted }]}>
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            <TextInput
              accessibilityLabel="念想标题"
              autoFocus
              defaultValue={title}
              key={`wish-title-${composerMode}-${editingWishId ?? 'new'}`}
              onChangeText={setTitle}
              placeholder="想去的地方，或想完成的事"
              placeholderTextColor={colors.textFaint}
              style={[
                styles.composerTitleInput,
                { borderBottomColor: colors.line, color: colors.text },
              ]}
            />
            <View style={styles.categoryRow}>
              {wishCategories
                .filter(option => option !== 'habit')
                .map(option => {
                  const selected = category === option;
                  const optionStyle = {
                    backgroundColor: selected ? colors.text : 'transparent',
                    borderColor: selected ? colors.text : colors.line,
                  };
                  const labelStyle = {
                    color: selected ? '#F2EAD9' : colors.textMuted,
                  };
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel={`念想分类${categoryNames[option]}`}
                      accessibilityState={{ selected }}
                      key={option}
                      onPress={() => setCategory(option)}
                      style={[styles.categoryButton, optionStyle]}
                    >
                      <Text style={[styles.categoryButtonText, labelStyle]}>
                        {categoryNames[option]}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
            <TextInput
              accessibilityLabel="念想备注"
              defaultValue={note}
              key={`wish-note-${composerMode}-${editingWishId ?? 'new'}`}
              multiline
              onChangeText={setNote}
              placeholder="为什么想做，或从哪里开始"
              placeholderTextColor={colors.textFaint}
              style={[
                styles.composerNote,
                { borderColor: colors.line, color: colors.text },
              ]}
              textAlignVertical="top"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="保存念想"
              disabled={!title.trim() || saving}
              onPress={submit}
              style={[
                styles.composerSubmit,
                (!title.trim() || saving) && styles.disabled,
                { backgroundColor: colors.accent },
              ]}
            >
              <Text style={styles.submitText}>
                {saving ? '正在收好…' : '钉到纸上'}
              </Text>
            </Pressable>
          </View>
        </View>
      </OverlayPortal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: spacing.xxl },
  wishHero: {
    minHeight: 52,
    paddingHorizontal: 22,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 1,
  },
  heroButton: {
    minHeight: 30,
    paddingHorizontal: 9,
    borderWidth: 0.5,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroButtonText: {
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  looseLeaf: {
    position: 'relative',
    minHeight: 380,
    marginTop: 12,
    marginHorizontal: 18,
    paddingTop: 20,
    paddingRight: 20,
    paddingBottom: 22,
    paddingLeft: 36,
    borderRadius: 1,
    backgroundColor: '#FBF7EE',
    overflow: 'visible',
  },
  paperLines: {
    position: 'absolute',
    top: 0,
    right: 16,
    bottom: 0,
    left: 36,
    overflow: 'hidden',
  },
  paperLine: {
    height: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(154,184,200,0.1)',
  },
  marginLine: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 30,
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(184,92,56,0.12)',
  },
  holes: {
    position: 'absolute',
    top: 25,
    bottom: 25,
    left: -9,
    justifyContent: 'space-around',
  },
  hole: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#EDE5D2',
  },
  ripTop: {
    position: 'absolute',
    top: -5,
    left: 0,
    right: 0,
    height: 6,
  },
  ripBottom: {
    position: 'absolute',
    bottom: -5,
    left: 0,
    right: 0,
    height: 6,
  },
  pageFooter: {
    paddingTop: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumber: {
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 9,
    color: 'rgba(58,51,45,0.2)',
    letterSpacing: 3,
  },
  headingRow: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { fontFamily: fontFamilies.serifMedium, fontSize: 18 },
  subtitle: { marginTop: 4, fontFamily: fontFamilies.serif, fontSize: 11 },
  addText: { fontFamily: fontFamilies.sans, fontSize: 12 },
  filterRow: {
    marginBottom: spacing.lg,
    flexDirection: 'row',
    gap: spacing.lg,
  },
  filter: { paddingVertical: spacing.sm, borderBottomWidth: 1 },
  filterText: { fontFamily: fontFamilies.serif, fontSize: 11 },
  stateText: {
    padding: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
  },
  board: {
    minHeight: 360,
  },
  wishItem: {
    position: 'relative',
    minHeight: 78,
    paddingTop: 9,
    paddingRight: 32,
    paddingBottom: 8,
    paddingLeft: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(58,51,45,0.04)',
  },
  wishItemDone: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  check: {
    position: 'absolute',
    top: 12,
    right: 8,
    zIndex: 5,
    width: 16,
    height: 16,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 12,
  },
  categoryCode: {
    position: 'absolute',
    top: 11,
    right: 31,
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 9,
    color: 'rgba(58,51,45,0.2)',
    letterSpacing: 1,
  },
  titleRow: {
    paddingRight: 62,
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingDot: {
    width: 4,
    height: 4,
    marginRight: 7,
    borderRadius: 2,
    opacity: 0.5,
  },
  itemTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: 13,
    lineHeight: 21,
    letterSpacing: 0.3,
  },
  itemNote: {
    marginTop: 2,
    paddingLeft: 10,
    paddingRight: 66,
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    lineHeight: 19,
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  itemMeta: {
    marginTop: 3,
    paddingLeft: 10,
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTag: {
    fontFamily: fontFamilies.serif,
    fontSize: 9,
    color: 'rgba(58,51,45,0.25)',
    letterSpacing: 0.3,
  },
  itemDate: {
    marginLeft: 'auto',
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 9,
    color: 'rgba(58,51,45,0.2)',
    letterSpacing: 0.3,
  },
  listTapeNote: {
    position: 'absolute',
    top: 42,
    right: -10,
    zIndex: 6,
    maxWidth: 120,
    minWidth: 88,
    paddingTop: 8,
    paddingRight: 10,
    paddingBottom: 8,
    paddingLeft: 22,
    borderRadius: 1,
    transform: [{ rotate: '2deg' }],
  },
  listTapeStrip: {
    position: 'absolute',
    top: -6,
    left: '35%',
    width: 36,
    height: 10,
    borderRadius: 1,
    opacity: 0.65,
    transform: [{ rotate: '-3deg' }],
  },
  listTapeText: {
    fontFamily: fontFamilies.serif,
    fontSize: 10,
    lineHeight: 15,
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  paperEmpty: {
    minHeight: 250,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  stickyCard: {
    width: '100%',
    minHeight: 112,
    padding: spacing.lg,
    borderWidth: 0.5,
    borderLeftWidth: 3,
    borderRadius: 2,
  },
  listTape: {
    position: 'absolute',
    top: -5,
    right: 24,
    width: 34,
    height: 10,
    borderRadius: 1,
    opacity: 0.68,
    transform: [{ rotate: '-2deg' }],
  },
  pin: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: radius.round,
  },
  stickyTitle: {
    paddingRight: spacing.sm,
    fontFamily: fontFamilies.serifMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  fulfilledTitle: { textDecorationLine: 'line-through' },
  stickyNote: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 19,
  },
  stickyDate: {
    marginTop: 'auto',
    paddingTop: spacing.md,
    fontFamily: fontFamilies.sans,
    fontSize: 9,
  },
  empty: {
    padding: spacing.xl,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderRadius: radius.paper,
  },
  emptyTitle: { fontFamily: fontFamilies.serifMedium, fontSize: 16 },
  emptyBody: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.serif,
    fontSize: 13,
    lineHeight: 22,
  },
  emptyAction: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
  },
  modalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  warmSheet: { backgroundColor: '#F2EAD9' },
  detailModalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 54,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: journalDetailBackdropColor,
  },
  detailPaper: {
    width: '94%',
    maxWidth: 342,
    maxHeight: '78%',
    paddingTop: 34,
    paddingHorizontal: 22,
    paddingBottom: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: journalDetailBorderColor,
    borderRadius: 3,
  },
  detailTape: {
    position: 'absolute',
    top: -7,
    left: '32%',
    width: 92,
    height: 22,
    backgroundColor: journalDetailTapeColor,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(132,105,73,0.14)',
    transform: [{ rotate: '1.5deg' }],
  },
  detailFold: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderTopWidth: 22,
    borderLeftWidth: 22,
    borderTopColor: 'rgba(255,255,255,0.34)',
    borderLeftColor: 'transparent',
  },
  detailCategory: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,115,85,0.3)',
    borderRadius: 2,
    color: '#765F49',
    fontFamily: fontFamilies.serif,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  detailDate: {
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 10,
    letterSpacing: 1,
  },
  detailTitle: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.serifMedium,
    fontSize: 21,
    lineHeight: 31,
    letterSpacing: 0.35,
  },
  detailNote: {
    minHeight: 76,
    marginTop: spacing.md,
    fontFamily: fontFamilies.serif,
    fontSize: 14.5,
    lineHeight: 25,
    letterSpacing: 0.2,
  },
  tapeList: { marginTop: spacing.lg, gap: 10 },
  tapeRow: {
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderLeftWidth: 2,
    borderRadius: 1,
    justifyContent: 'center',
    transform: [{ rotate: '0.35deg' }],
    boxShadow: '0 2px 5px rgba(72,55,39,0.08)',
  },
  tapeRowText: {
    paddingRight: 68,
    fontFamily: fontFamilies.serif,
    fontSize: 13.5,
    lineHeight: 21,
  },
  tapeHint: {
    position: 'absolute',
    right: spacing.sm,
    fontFamily: fontFamilies.sans,
    fontSize: 8,
  },
  primaryActions: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tapeAction: {
    minHeight: 42,
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailActions: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  detailAction: { fontFamily: fontFamilies.serifMedium, fontSize: 12 },
  secondaryFeatureActions: {
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(139,115,85,0.18)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  secondaryFeatureText: {
    fontFamily: fontFamilies.serif,
    fontSize: 10,
  },
  secondaryActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.lg,
  },
  secondaryAction: { fontFamily: fontFamilies.serif, fontSize: 10 },
  tapeModalRoot: { flex: 1, justifyContent: 'flex-end' },
  tapeSheet: {
    width: '100%',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.pageBottom,
    borderTopLeftRadius: radius.cardLarge,
    borderTopRightRadius: radius.cardLarge,
  },
  sheetHandle: {
    width: 36,
    height: 3,
    alignSelf: 'center',
    borderRadius: radius.round,
  },
  tapeSheetTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    textAlign: 'center',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 15,
    letterSpacing: 2,
  },
  tapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tapeOption: {
    width: '23%',
    minHeight: 52,
    padding: spacing.sm,
    borderWidth: 2,
    borderRadius: radius.paper,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tapeOptionEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  tapeOptionText: { fontFamily: fontFamilies.serif, fontSize: 11 },
  tapeInput: {
    minHeight: 80,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderWidth: 0.5,
    borderRadius: radius.paper,
    fontFamily: fontFamilies.serif,
    fontSize: 14,
  },
  tapeSubmit: {
    minHeight: 44,
    marginTop: spacing.md,
    borderRadius: radius.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapeSubmitText: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 14,
    letterSpacing: 4,
  },
  questPicker: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
  },
  pickerTitle: {
    marginBottom: spacing.sm,
    fontFamily: fontFamilies.serifMedium,
    fontSize: 12,
  },
  questChoices: { marginBottom: spacing.md },
  questChoice: {
    minHeight: 36,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  nodeChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nodeChoice: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderWidth: 0.5,
    borderRadius: radius.paper,
    justifyContent: 'center',
  },
  noNode: { fontFamily: fontFamilies.serif, fontSize: 11, lineHeight: 18 },
  composerModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  composer: {
    width: '100%',
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  composerClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: 'rgba(58,51,45,0.15)',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerMark: {
    marginBottom: 6,
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  composerDate: {
    marginBottom: 14,
    fontFamily: fontFamilies.serif,
    fontSize: 13,
  },
  composerTitleInput: {
    minHeight: 48,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    fontFamily: fontFamilies.serif,
    fontSize: 18,
  },
  categoryRow: {
    marginBottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryButtonText: {
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  composerNote: {
    minHeight: 82,
    marginBottom: 18,
    padding: 10,
    borderWidth: 1,
    borderRadius: 4,
    fontFamily: fontFamilies.serif,
    fontSize: 13,
    lineHeight: 21,
  },
  composerSubmit: {
    minHeight: 46,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#FFF9ED',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 14,
  },
  disabled: { opacity: 0.35 },
});
