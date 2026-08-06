import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {AppText as Text} from "../../components/AppText";
import Svg, { Path } from 'react-native-svg';

import { OverlayPortal } from '../../components/OverlayHost';
import { useToast } from '../../components/Toast';
import { QuestNode } from '../../db/models';
import { removeMediaFile } from '../../services/mediaStorage';
import { pickPhotoFromLibrary } from '../../services/photoLibrary';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../tokens/radius';
import { shadows } from '../../tokens/shadows';
import { spacing } from '../../tokens/spacing';
import { fontFamilies, fontSizes } from '../../tokens/typography';
import {
  journalDetailBackdropColor,
  journalDetailBorderColor,
  journalDetailPaperColor,
  journalDetailTapeColor,
} from './journalPaper';
import {
  addQuestSticky,
  createQuest,
  createQuestNode,
  deleteQuest,
  deleteQuestNode,
  deleteQuestSticky,
  getQuestAggregates,
  QuestAggregate,
} from './questRepository';

type Composer = 'quest' | 'node' | null;

const stickyColors: Record<string, string> = {
  yellow: '#F7E7A9',
  pink: '#F2D8D3',
  green: '#DCE8D8',
  blue: '#D9E7ED',
  purple: '#E5DDED',
  orange: '#F3DDC2',
};
const stickyColorOptions = [
  'yellow',
  'pink',
  'green',
  'blue',
  'purple',
  'orange',
] as const;
type StickyColor = (typeof stickyColorOptions)[number];

function borderColorStyle(borderColor: string) {
  return { borderColor };
}

function QuestChapter() {
  return (
    <View style={styles.chapter}>
      <View style={styles.chapterHead}>
        <Svg height={14} viewBox="0 0 24 24" width={14}>
          <Path
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            fill="none"
            stroke="#B4A58F"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        </Svg>
        <Text style={styles.chapterHeadText}>CHAPTER III</Text>
      </View>
      <Text style={styles.chapterTitle}>
        布上的<Text style={styles.chapterAccent}>副本</Text>
      </Text>
      <Text style={styles.chapterSubtitle}>
        把想做的事收进纸页，添一站，贴一笔。
      </Text>
      <View style={styles.chapterLine}>
        <View style={styles.chapterLineAccent} />
      </View>
    </View>
  );
}

function JournalNode({
  node,
  index,
  color,
  selected,
  stickyCount,
  onPress,
}: {
  node: QuestNode;
  index: number;
  color: string;
  selected: boolean;
  stickyCount: number;
  onPress: (node: QuestNode) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`副本节点${node.title}`}
      accessibilityState={{ expanded: selected }}
      onPress={() => onPress(node)}
      style={({ pressed }) => [
        styles.journalNodeRow,
        selected && { backgroundColor: `${color}10` },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.journalNodeIndex, { color }]}>
        {String(index + 1).padStart(2, '0')}
      </Text>
      <View style={[styles.journalNodeMark, { borderColor: color }]}>
        <Text style={[styles.journalNodeIcon, { color }]}>{node.icon}</Text>
      </View>
      <Text numberOfLines={1} style={styles.journalNodeTitle}>
        {node.title}
      </Text>
      <Text style={styles.journalNodeMeta}>
        {stickyCount ? `${stickyCount} 贴` : '空白'}
      </Text>
    </Pressable>
  );
}

export function QuestSection({
  userId,
  onCountChange,
  focusTarget,
  refreshRevision = 0,
}: {
  userId?: string;
  onCountChange?: (count: number) => void;
  focusTarget?: { questId: string; nodeId: string; revision: number };
  refreshRevision?: number;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<QuestAggregate[]>([]);
  const [selectedQuestId, setSelectedQuestId] = useState<string>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [composer, setComposer] = useState<Composer>(null);
  const composerTextRef = useRef('');
  const [composerCoverPath, setComposerCoverPath] = useState<string>();
  const [composerSaving, setComposerSaving] = useState(false);
  const stickyInputRef = useRef<TextInput>(null);
  const stickyTextRef = useRef('');
  const [stickyColor, setStickyColor] = useState<StickyColor>('yellow');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = await getQuestAggregates(userId);
      setItems(next);
      onCountChange?.(next.length);
      setFailed(false);
      setSelectedQuestId(current =>
        next.some(item => item.quest.id === current)
          ? current
          : next[0]?.quest.id,
      );
    } catch (error) {
      console.error('副本读取失败', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [onCountChange, userId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load, refreshRevision]);

  useEffect(() => {
    if (!focusTarget) {
      return;
    }
    setSelectedQuestId(focusTarget.questId);
    setSelectedNodeId(focusTarget.nodeId);
  }, [focusTarget]);

  const selected = useMemo(
    () => items.find(item => item.quest.id === selectedQuestId),
    [items, selectedQuestId],
  );
  const selectedNode = selected?.nodes.find(node => node.id === selectedNodeId);
  const selectedStickies =
    selected?.stickies.filter(sticky => sticky.nodeId === selectedNodeId) ?? [];

  const refreshAfter = async (work: Promise<unknown>) => {
    try {
      await work;
      await load();
      return true;
    } catch (error) {
      toast.show(error instanceof Error ? error.message : '副本没有保存');
      return false;
    }
  };

  const closeComposer = () => {
    const draftCover = composerCoverPath;
    composerTextRef.current = '';
    setComposer(null);
    setComposerCoverPath(undefined);
    if (draftCover) {
      removeMediaFile(draftCover).catch(() => undefined);
    }
  };

  const chooseComposerCover = async () => {
    const result = await pickPhotoFromLibrary();
    if (result.status === 'cancelled') {
      return;
    }
    if (result.status === 'error') {
      toast.show(result.message);
      return;
    }
    const previous = composerCoverPath;
    setComposerCoverPath(result.path);
    if (previous && previous !== result.path) {
      removeMediaFile(previous).catch(() => undefined);
    }
  };

  const submitComposer = async () => {
    const title = composerTextRef.current.trim();
    if (!title || !composer || composerSaving) {
      if (!title) {
        toast.show(composer === 'quest' ? '先写下副本名称' : '先写下节点名称');
      }
      return;
    }
    setComposerSaving(true);
    let saved = false;
    if (composer === 'quest') {
      if (!userId) {
        toast.show('本地身份还没有准备好');
        setComposerSaving(false);
        return;
      }
      saved = await refreshAfter(
        createQuest({
          userId,
          title,
          coverImagePath: composerCoverPath,
        }),
      );
    } else if (selected) {
      const index = selected.nodes.length;
      saved = await refreshAfter(
        createQuestNode({
          questId: selected.quest.id,
          title,
          icon: Array.from(title)[0] ?? '渡',
          x: 0,
          y: index,
        }),
      );
    }
    setComposerSaving(false);
    if (saved) {
      composerTextRef.current = '';
      setComposer(null);
      setComposerCoverPath(undefined);
    }
  };

  const handleNodePress = (node: QuestNode) => {
    if (!selected) {
      return;
    }
    stickyTextRef.current = '';
    stickyInputRef.current?.clear();
    setSelectedNodeId(current => (current === node.id ? undefined : node.id));
  };

  const closeNodeDetail = () => {
    stickyTextRef.current = '';
    stickyInputRef.current?.clear();
    setSelectedNodeId(undefined);
  };

  const confirmDeleteNode = (node: QuestNode) => {
    Alert.alert('删除这个节点？', '节点上的便利贴会一并移除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          setSelectedNodeId(undefined);
          refreshAfter(deleteQuestNode(node.id)).catch(() => undefined);
        },
      },
    ]);
  };

  const addSticky = async () => {
    const text = stickyTextRef.current.trim();
    if (!selected || !selectedNode || !text) {
      if (!text) {
        toast.show('先写下便利贴内容');
      }
      return;
    }
    const saved = await refreshAfter(
      addQuestSticky({
        questId: selected.quest.id,
        nodeId: selectedNode.id,
        text,
        color: stickyColor,
      }),
    );
    if (saved) {
      stickyTextRef.current = '';
      stickyInputRef.current?.clear();
    }
  };

  const confirmDeleteQuest = () => {
    if (!selected) {
      return;
    }
    Alert.alert('删除整张副本？', '节点与便利贴会一并移除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () =>
          refreshAfter(deleteQuest(selected.quest.id)).catch(() => undefined),
      },
    ]);
  };

  const confirmDeleteSticky = (stickyId: string) => {
    Alert.alert('揭下这张贴纸？', undefined, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () =>
          refreshAfter(deleteQuestSticky(stickyId)).catch(() => undefined),
      },
    ]);
  };

  if (loading) {
    return (
      <Text style={[styles.stateText, { color: colors.textMuted }]}>
        正在铺开副本…
      </Text>
    );
  }

  if (failed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="重新读取副本"
        onPress={() => load().catch(() => undefined)}
        style={[styles.empty, { borderColor: colors.line }]}
      >
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          副本暂时没有展开
        </Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
          轻触重新铺开画布。
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.root}>
      <QuestChapter />
      <ScrollView
        horizontal
        contentContainerStyle={styles.templateCards}
        showsHorizontalScrollIndicator={false}
      >
        {items.map(item => {
          const active = item.quest.id === selectedQuestId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`打开副本${item.quest.title}`}
              key={item.quest.id}
              onPress={() => {
                setSelectedQuestId(item.quest.id);
                setSelectedNodeId(undefined);
              }}
              style={[
                styles.templateCard,
                borderColorStyle(
                  active ? item.quest.themeColor : 'rgba(139,115,85,0.2)',
                ),
              ]}
            >
              {item.quest.coverImageAssetId ? (
                <Image
                  accessibilityLabel={`${item.quest.title}副本封面`}
                  resizeMode="cover"
                  source={{ uri: `file://${item.quest.coverImageAssetId}` }}
                  style={styles.templateCoverImage}
                />
              ) : (
                <View style={styles.templateMiniature}>
                  {item.nodes.slice(0, 3).map((node, index) => (
                    <View key={node.id} style={styles.miniJournalRow}>
                      <Text
                        style={[
                          styles.miniJournalIndex,
                          { color: item.quest.themeColor },
                        ]}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                      <View
                        style={[
                          styles.miniJournalRule,
                          { backgroundColor: item.quest.themeColor },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.templateCardTitle}>{item.quest.title}</Text>
              <Text style={styles.templateCardMeta}>
                {item.nodes.length
                  ? `${item.nodes.length} 站 · ${item.stickies.length} 贴`
                  : '空白纸页'}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="新建副本"
          onPress={() => setComposer('quest')}
          style={[styles.templateCard, styles.newTemplateCard]}
        >
          <View style={styles.newTemplateMark}>
            <Text style={styles.newTemplatePlus}>＋</Text>
          </View>
          <Text style={styles.newTemplateTitle}>新副本</Text>
          <Text style={styles.templateCardMeta}>新建纸页</Text>
        </Pressable>
      </ScrollView>

      {selected ? (
        <View style={styles.board}>
          <View
            style={[
              styles.journalToolbar,
              { borderColor: colors.line, backgroundColor: colors.surface },
            ]}
          >
            <View style={styles.journalHeading}>
              <Text
                numberOfLines={1}
                style={[styles.journalTitle, { color: colors.text }]}
              >
                {selected.quest.title}
              </Text>
              <Text style={[styles.journalMeta, { color: colors.textFaint }]}>
                {selected.nodes.length} 个节点 · {selected.stickies.length}{' '}
                张便利贴
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="加入节点"
              onPress={() => setComposer('node')}
              style={[
                styles.addNodeAction,
                { backgroundColor: selected.quest.themeColor },
              ]}
            >
              <Text style={styles.addNodeActionText}>＋ 加入节点</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`删除副本${selected.quest.title}`}
              hitSlop={8}
              onPress={confirmDeleteQuest}
              style={styles.deleteQuestAction}
            >
              <Text
                style={[styles.deleteQuestText, { color: colors.textFaint }]}
              >
                删除副本
              </Text>
            </Pressable>
          </View>

          <View
            accessibilityLabel="副本手帐画布"
            style={[
              styles.journalCanvas,
              shadows.paper,
              { backgroundColor: colors.surfaceWarm, borderColor: colors.line },
            ]}
          >
            <View pointerEvents="none" style={styles.journalMarginLine} />
            <View pointerEvents="none" style={styles.journalRules}>
              {Array.from(
                { length: Math.max(8, selected.nodes.length * 2 + 3) },
                (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.journalRule,
                      { backgroundColor: colors.line },
                    ]}
                  />
                ),
              )}
            </View>

            {selected.nodes.length ? (
              selected.nodes.map((node, index) => (
                <JournalNode
                  color={selected.quest.themeColor}
                  index={index}
                  key={node.id}
                  node={node}
                  onPress={handleNodePress}
                  selected={node.id === selectedNodeId}
                  stickyCount={
                    selected.stickies.filter(
                      sticky => sticky.nodeId === node.id,
                    ).length
                  }
                />
              ))
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="加入第一个节点"
                onPress={() => setComposer('node')}
                style={styles.emptyJournal}
              >
                <Text
                  style={[styles.emptyJournalText, { color: colors.textMuted }]}
                >
                  这页还是空的，加入第一个节点
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : !items.length ? (
        <View style={[styles.empty, { borderColor: colors.line }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            还没有自己的副本
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            建一页自己的手帐，再把节点和便利贴慢慢添进去。
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="创建第一张副本"
            onPress={() => setComposer('quest')}
          >
            <Text style={[styles.emptyAction, { color: colors.accent }]}>
              创建第一张副本
            </Text>
          </Pressable>
        </View>
      ) : null}

      <OverlayPortal
        blurBackground
        name="faraway-quest-node-detail"
        onRequestClose={closeNodeDetail}
        visible={Boolean(selectedNode)}
      >
        <View style={styles.nodeModalRoot}>
          <Pressable
            accessibilityLabel="收起节点便利贴"
            onPress={closeNodeDetail}
            style={styles.nodeModalBackdrop}
          />
          {selected && selectedNode ? (
            <ScrollView
              accessibilityLabel={`节点${selectedNode.title}便利贴`}
              accessibilityViewIsModal
              contentContainerStyle={styles.nodePaperContent}
              showsVerticalScrollIndicator={false}
              style={[
                styles.nodePaper,
                shadows.deep,
                { backgroundColor: journalDetailPaperColor },
              ]}
            >
              <View pointerEvents="none" style={styles.nodePaperTape} />
              <View pointerEvents="none" style={styles.nodePaperFold} />
              <View style={styles.popoverHeader}>
                <View>
                  <Text style={[styles.popoverTitle, { color: colors.text }]}>
                    {selectedNode.title}
                  </Text>
                  <Text
                    style={[styles.popoverCount, { color: colors.textFaint }]}
                  >
                    {selectedStickies.length} 张便利贴
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="关闭节点便利贴"
                  hitSlop={10}
                  onPress={closeNodeDetail}
                >
                  <Text style={[styles.nodeCloseText, { color: colors.text }]}>
                    ✕
                  </Text>
                </Pressable>
              </View>

              <View style={styles.stickyList}>
                {selectedStickies.length ? (
                  selectedStickies.map((sticky, index) => (
                    <View
                      key={sticky.id}
                      style={[
                        styles.sticky,
                        {
                          backgroundColor:
                            stickyColors[sticky.color] ?? stickyColors.yellow,
                          transform: [
                            { rotate: index % 2 ? '0.5deg' : '-0.5deg' },
                          ],
                        },
                      ]}
                    >
                      <View pointerEvents="none" style={styles.stickyTape} />
                      <Text
                        style={[styles.stickyText, { color: colors.textSoft }]}
                      >
                        {sticky.text}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`删除便利贴${sticky.text}`}
                        hitSlop={8}
                        onPress={() => confirmDeleteSticky(sticky.id)}
                      >
                        <Text
                          style={[
                            styles.stickyDelete,
                            { color: colors.textFaint },
                          ]}
                        >
                          ×
                        </Text>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text
                    style={[styles.stickyEmpty, { color: colors.textMuted }]}
                  >
                    这里还没有便利贴，写下一句留在这一站。
                  </Text>
                )}
              </View>

              <View style={styles.stickyPalette}>
                {stickyColorOptions.map(option => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={`贴纸颜色${option}`}
                    accessibilityState={{ selected: stickyColor === option }}
                    key={option}
                    onPress={() => setStickyColor(option)}
                    style={[
                      styles.stickySwatch,
                      {
                        backgroundColor: stickyColors[option],
                        borderColor:
                          stickyColor === option
                            ? selected.quest.themeColor
                            : colors.line,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.stickyComposer}>
                <TextInput
                  accessibilityLabel="贴纸内容"
                  autoCapitalize="none"
                  autoCorrect={false}
                  defaultValue=""
                  onChangeText={text => {
                    stickyTextRef.current = text;
                  }}
                  placeholder="贴一句话…"
                  placeholderTextColor={colors.textFaint}
                  ref={stickyInputRef}
                  returnKeyType="default"
                  style={[styles.stickyInput, { color: colors.text }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="贴上便利贴"
                  onPress={() => addSticky().catch(() => undefined)}
                  style={styles.stickySubmit}
                >
                  <Text style={{ color: colors.accent }}>贴上</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`删除节点${selectedNode.title}`}
                onPress={() => confirmDeleteNode(selectedNode)}
                style={styles.nodeDeleteAction}
              >
                <Text
                  style={[styles.nodeDeleteText, { color: colors.textFaint }]}
                >
                  删除节点
                </Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </View>
      </OverlayPortal>

      <OverlayPortal
        name="faraway-quest-composer"
        onRequestClose={closeComposer}
        visible={Boolean(composer)}
      >
        <View style={styles.modalRoot}>
          <Pressable onPress={closeComposer} style={styles.modalBackdrop} />
          <View
            style={[
              styles.composer,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <Text style={[styles.composerTitle, { color: colors.text }]}>
              {composer === 'quest' ? '新建副本' : '加入节点'}
            </Text>
            <TextInput
              accessibilityLabel={
                composer === 'quest' ? '副本名称' : '节点名称'
              }
              accessibilityHint="输入完成后点击落下"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              defaultValue=""
              key={`composer-input-${composer}`}
              onChangeText={text => {
                composerTextRef.current = text;
              }}
              placeholder={composer === 'quest' ? '这页手帐叫什么' : '节点名称'}
              placeholderTextColor={colors.textFaint}
              returnKeyType="default"
              style={[
                styles.composerInput,
                { borderColor: colors.line, color: colors.text },
              ]}
            />
            {composer === 'quest' ? (
              <View style={styles.coverPicker}>
                {composerCoverPath ? (
                  <Image
                    accessibilityLabel="待使用的副本封面"
                    resizeMode="cover"
                    source={{ uri: `file://${composerCoverPath}` }}
                    style={styles.coverPreview}
                  />
                ) : (
                  <View
                    style={[
                      styles.coverDefault,
                      { backgroundColor: colors.surfaceWarm },
                    ]}
                  >
                    <Text
                      style={[
                        styles.coverDefaultText,
                        { color: colors.textFaint },
                      ]}
                    >
                      默认纸页封面
                    </Text>
                  </View>
                )}
                <View style={styles.coverActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="选择副本封面"
                    onPress={() => chooseComposerCover().catch(() => undefined)}
                  >
                    <Text
                      style={[styles.coverActionText, { color: colors.accent }]}
                    >
                      {composerCoverPath ? '更换封面' : '从相册选择封面'}
                    </Text>
                  </Pressable>
                  {composerCoverPath ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="移除副本封面"
                      onPress={() => {
                        removeMediaFile(composerCoverPath).catch(
                          () => undefined,
                        );
                        setComposerCoverPath(undefined);
                      }}
                    >
                      <Text
                        style={[
                          styles.coverRemoveText,
                          { color: colors.textFaint },
                        ]}
                      >
                        使用默认
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="确认创建"
              disabled={composerSaving}
              onPress={() => submitComposer().catch(() => undefined)}
              style={[
                styles.composerAction,
                composerSaving && styles.disabled,
                {
                  backgroundColor: colors.accent,
                },
              ]}
            >
              <Text style={styles.composerActionText}>
                {composerSaving ? '正在落下…' : '落下'}
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
  chapter: {
    paddingTop: 18,
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  chapterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  chapterHeadText: {
    color: '#B4A58F',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 9,
    letterSpacing: 3,
  },
  chapterTitle: {
    color: '#3A332D',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 2,
  },
  chapterAccent: { color: '#B85C38' },
  chapterSubtitle: {
    marginTop: 3,
    color: '#B4A58F',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  chapterLine: {
    height: 1,
    marginTop: 12,
    backgroundColor: 'rgba(58,51,45,0.1)',
  },
  chapterLineAccent: {
    width: 40,
    height: 1.5,
    backgroundColor: '#B85C38',
  },
  templateCards: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  templateCard: {
    position: 'relative',
    width: 100,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderRadius: 3,
    backgroundColor: '#F5EDE0',
    boxShadow: '1px 2px 6px rgba(0,0,0,0.08)',
  },
  templateMiniature: {
    height: 48,
    marginBottom: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#EDE4D0',
  },
  templateCoverImage: {
    width: '100%',
    height: 48,
    marginBottom: 6,
    borderRadius: 2,
  },
  miniJournalRow: {
    height: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  miniJournalIndex: {
    width: 12,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 6,
  },
  miniJournalRule: {
    flex: 1,
    height: 0.5,
    opacity: 0.35,
  },
  templateCardTitle: {
    color: '#3A332D',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 11,
    lineHeight: 14.3,
    letterSpacing: 0.5,
  },
  templateCardMeta: {
    marginTop: 2,
    color: '#B4A58F',
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  newTemplateCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(139,115,85,0.4)',
    backgroundColor: 'rgba(255,255,255,0.3)',
    boxShadow: 'none',
  },
  newTemplateMark: {
    height: 48,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newTemplatePlus: {
    color: 'rgba(139,115,85,0.5)',
    fontFamily: fontFamilies.sans,
    fontSize: 28,
  },
  newTemplateTitle: {
    color: 'rgba(139,115,85,0.7)',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    lineHeight: 14.3,
    letterSpacing: 0.5,
  },
  stateText: {
    padding: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
  },
  headingRow: {
    paddingHorizontal: spacing.page,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { fontFamily: fontFamilies.serifMedium, fontSize: 18 },
  addText: { fontFamily: fontFamilies.sans, fontSize: 12 },
  cards: { gap: spacing.md, paddingHorizontal: spacing.page },
  card: {
    position: 'relative',
    width: 144,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.paper,
  },
  cardPointer: {
    position: 'absolute',
    bottom: -7,
    left: 64,
    width: 12,
    height: 12,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  miniature: { height: 64, position: 'relative' },
  miniNode: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: radius.round,
  },
  cardTitle: { fontFamily: fontFamilies.serifMedium, fontSize: 14 },
  cardMeta: { marginTop: 4, fontFamily: fontFamilies.sans, fontSize: 10 },
  board: { marginTop: spacing.lg, marginHorizontal: spacing.page },
  journalToolbar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 0.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.paper,
    borderTopRightRadius: radius.paper,
  },
  journalHeading: {
    minWidth: 0,
    flex: 1,
  },
  journalTitle: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 15,
  },
  journalMeta: {
    marginTop: 3,
    fontFamily: fontFamilies.sans,
    fontSize: 9,
  },
  addNodeAction: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNodeActionText: {
    color: '#FFF9ED',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 11,
  },
  journalCanvas: {
    position: 'relative',
    minHeight: 260,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 18,
    paddingLeft: 34,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderBottomLeftRadius: radius.paper,
    borderBottomRightRadius: radius.paper,
  },
  journalMarginLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 25,
    width: 1,
    backgroundColor: 'rgba(184,92,56,0.16)',
  },
  journalRules: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    paddingTop: 23,
  },
  journalRule: {
    height: 0.5,
    marginBottom: 47.5,
    opacity: 0.36,
  },
  journalNodeRow: {
    zIndex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(139,115,85,0.12)',
  },
  journalNodeIndex: {
    width: 28,
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 11,
  },
  journalNodeMark: {
    width: 26,
    height: 26,
    marginRight: 9,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,249,237,0.72)',
    transform: [{ rotate: '-1deg' }],
  },
  journalNodeIcon: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 11,
  },
  journalNodeTitle: {
    minWidth: 0,
    flex: 1,
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 13,
  },
  journalNodeMeta: {
    marginLeft: 8,
    color: '#B4A58F',
    fontFamily: fontFamilies.sans,
    fontSize: 9,
  },
  nodeDeleteText: {
    fontFamily: fontFamilies.sans,
    fontSize: 9,
  },
  emptyJournal: {
    zIndex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyJournalText: {
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  pressed: { opacity: 0.68 },
  toolbar: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
    padding: 4,
    borderWidth: 0.5,
    borderRadius: radius.pill,
    flexDirection: 'row',
  },
  tool: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { fontFamily: fontFamilies.sans, fontSize: 11 },
  toolbarDivider: {
    width: 0.5,
    marginHorizontal: spacing.xs,
    marginVertical: 6,
  },
  toolbarTitle: {
    maxWidth: 96,
    alignSelf: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 10,
  },
  deleteQuestAction: {
    minHeight: 36,
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteQuestText: { fontFamily: fontFamilies.sans, fontSize: 9 },
  canvasViewport: { maxHeight: 520 },
  canvas: { position: 'relative', overflow: 'hidden' },
  nodeWrap: { position: 'absolute', width: 76, alignItems: 'center' },
  node: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeIcon: { fontFamily: fontFamilies.serifMedium, fontSize: 16 },
  nodeBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeBadgeText: {
    color: '#FFF9ED',
    fontFamily: fontFamilies.sans,
    fontSize: 8,
  },
  nodeLabel: {
    width: 76,
    marginTop: 5,
    textAlign: 'center',
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    color: '#5C5148',
  },
  popover: {
    position: 'absolute',
    zIndex: 5,
    width: 220,
    maxHeight: 240,
    padding: spacing.md,
    borderWidth: 0.5,
    borderRadius: radius.paper,
  },
  popoverTitle: { fontFamily: fontFamilies.serifMedium, fontSize: 14 },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popoverCount: { fontFamily: fontFamilies.sans, fontSize: 9 },
  nodeModalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 54,
  },
  nodeModalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: journalDetailBackdropColor,
  },
  nodePaper: {
    width: '94%',
    maxWidth: 342,
    maxHeight: '78%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: journalDetailBorderColor,
    borderRadius: 3,
    transform: [{ rotate: '-0.7deg' }],
  },
  nodePaperContent: {
    paddingTop: 34,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  nodePaperTape: {
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
  nodePaperFold: {
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
  nodeCloseText: {
    fontFamily: fontFamilies.sans,
    fontSize: 15,
  },
  stickyList: { marginTop: spacing.lg, gap: 10 },
  sticky: {
    minHeight: 58,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(116,91,66,0.14)',
    borderRadius: 1,
    boxShadow: '0 2px 5px rgba(72,55,39,0.08)',
  },
  stickyTape: {
    position: 'absolute',
    top: -5,
    left: '37%',
    width: 54,
    height: 12,
    backgroundColor: 'rgba(255,250,235,0.56)',
    transform: [{ rotate: '-1deg' }],
  },
  stickyText: {
    flex: 1,
    fontFamily: fontFamilies.serif,
    fontSize: 13.5,
    lineHeight: 21,
  },
  stickyDelete: { fontFamily: fontFamilies.sans, fontSize: 15 },
  stickyEmpty: {
    paddingVertical: spacing.xl,
    fontFamily: fontFamilies.serif,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'center',
  },
  stickyPalette: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  stickySwatch: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderRadius: radius.round,
  },
  stickyComposer: {
    minHeight: 48,
    marginTop: spacing.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(116,91,66,0.22)',
    borderRadius: 2,
    backgroundColor: 'rgba(255,252,243,0.34)',
  },
  stickyInput: {
    minHeight: 36,
    flex: 1,
    padding: 0,
    fontFamily: fontFamilies.serif,
    fontSize: 13,
  },
  stickySubmit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDeleteAction: {
    minHeight: 44,
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    marginHorizontal: spacing.page,
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
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(30,25,20,0.45)',
  },
  composer: {
    width: '82%',
    padding: spacing.xl,
    borderWidth: 0.5,
    borderRadius: radius.cardLarge,
  },
  composerTitle: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: fontSizes.title,
  },
  composerInput: {
    height: 48,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 0.5,
    borderRadius: radius.paper,
    fontFamily: fontFamilies.serif,
    fontSize: 15,
  },
  coverPicker: {
    marginTop: spacing.md,
  },
  coverPreview: {
    width: '100%',
    height: 104,
    borderRadius: radius.paper,
  },
  coverDefault: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.paper,
  },
  coverDefaultText: {
    fontFamily: fontFamilies.serif,
    fontSize: 11,
    letterSpacing: 1,
  },
  coverActions: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coverActionText: {
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  coverRemoveText: {
    fontFamily: fontFamilies.sans,
    fontSize: 10,
  },
  composerAction: {
    minHeight: 44,
    marginTop: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerActionText: {
    color: '#FFF9ED',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 14,
  },
  disabled: { opacity: 0.35 },
});
