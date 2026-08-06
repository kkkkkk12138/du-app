import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {AppText as Text} from "../../components/AppText";
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OverlayPortal } from '../../components/OverlayHost';
import { useToast } from '../../components/Toast';
import { Book, Scrap } from '../../db/models';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../tokens/radius';
import { spacing } from '../../tokens/spacing';
import { fontFamilies } from '../../tokens/typography';
import { getBooks } from './bookshelfRepository';
import {
  archiveScrapInBook,
  createScrap,
  discardScrap,
  getScraps,
  getScrapSources,
  recolorScrap,
  rotateScrap,
  ScrapColor,
  scrapColors,
  ScrapSource,
  ScrapSourceType,
  undoDiscardScrap,
  updateScrapPosition,
} from './scrapsRepository';

const canvasWidth = Dimensions.get('window').width;
const viewportHeight = Dimensions.get('window').height;
const paperColors: Record<ScrapColor, string> = {
  white: '#FFFBF3',
  yellow: '#FFF8E8',
  pink: '#FFF0EE',
  blue: '#F0F4F8',
  green: '#F0F5EE',
};

export function ScrapsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const userId = useSettingsStore(state => state.anonymousId);
  const toast = useToast();
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [reading, setReading] = useState<Scrap>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [discardedId, setDiscardedId] = useState<string>();
  const [draggingId, setDraggingId] = useState<string>();
  const [trashHot, setTrashHot] = useState(false);
  const [managing, setManaging] = useState(false);

  const load = useCallback(async () => {
    try {
      setScraps(await getScraps(userId ?? undefined));
    } catch (error) {
      console.error('散页读取失败', error);
      toast.show('散页暂时没有铺开');
    }
  }, [toast, userId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const canvasHeight = useMemo(
    () => Math.max(1400, ...scraps.map(scrap => scrap.y + 260)),
    [scraps],
  );
  useEffect(() => {
    if (!discardedId) {
      return undefined;
    }
    const timer = setTimeout(() => setDiscardedId(undefined), 5000);
    return () => clearTimeout(timer);
  }, [discardedId]);
  const selectScrap = (scrap: Scrap) => {
    setEditingId(undefined);
    if (selectedId === scrap.id) {
      setReading(scrap);
      setSelectedId(undefined);
    } else {
      setSelectedId(scrap.id);
    }
  };

  const editScrap = async (
    action: 'rotate' | ScrapColor | 'discard',
    scrap: Scrap,
  ) => {
    try {
      if (action === 'rotate') {
        await rotateScrap(scrap.id);
      } else if (action === 'discard') {
        await discardScrap(scrap.id);
        setDiscardedId(scrap.id);
        setSelectedId(undefined);
        setEditingId(undefined);
      } else {
        await recolorScrap(scrap.id, action);
      }
      await load();
    } catch {
      toast.show('这张纸没有改好');
    }
  };

  const gather = async () => {
    const ordered = [...scraps].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
    await Promise.all(
      ordered.map((scrap, index) =>
        updateScrapPosition(
          scrap.id,
          20 + (index % 2) * Math.max(150, canvasWidth / 2 - 18),
          56 + Math.floor(index / 2) * 190,
        ),
      ),
    );
    await load();
    toast.show('散页拢齐了');
  };
  const dropInTrash = async (scrap: Scrap) => {
    try {
      await discardScrap(scrap.id);
      setDiscardedId(scrap.id);
      setSelectedId(undefined);
      setEditingId(undefined);
      await load();
    } catch {
      toast.show('这张散页没有丢进废纸篓');
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, styles.safeAreaPaper]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回个人页"
          hitSlop={12}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.back, { color: colors.textMuted }]}>收回</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.text }]}>散页</Text>
          <Text style={styles.subtitle}>剪下来的字</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={managing ? '完成管理散页' : '管理散页'}
            hitSlop={8}
            onPress={() => {
              setManaging(value => !value);
              setSelectedId(undefined);
              setEditingId(undefined);
            }}
          >
            <Text
              style={[
                styles.headerAction,
                managing ? styles.headerActionActive : null,
              ]}
            >
              {managing ? '完成' : '管理'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="拢齐散页"
            hitSlop={8}
            onPress={() => gather().catch(() => undefined)}
          >
            <Text style={styles.headerAction}>拢齐</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ minHeight: canvasHeight }}
        onTouchStart={() => {
          setSelectedId(undefined);
          setEditingId(undefined);
        }}
        scrollEnabled={!draggingId}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.canvas, { height: canvasHeight }]}>
          {scraps.map(scrap => (
            <ScrapCard
              dimmed={Boolean(selectedId && selectedId !== scrap.id)}
              dragging={draggingId === scrap.id}
              key={scrap.id}
              managing={managing}
              onDiscard={() => dropInTrash(scrap).catch(() => undefined)}
              onDragEnd={() => {
                setDraggingId(undefined);
                setTrashHot(false);
              }}
              onDragMove={setTrashHot}
              onDragStart={() => {
                setDraggingId(scrap.id);
                setEditingId(undefined);
              }}
              onLongPress={() => {
                setSelectedId(scrap.id);
                setEditingId(scrap.id);
              }}
              onMove={(x, y) => {
                updateScrapPosition(scrap.id, x, y)
                  .then(load)
                  .catch(() => toast.show('散页位置没有保存'));
              }}
              onPress={() => selectScrap(scrap)}
              scrap={scrap}
              selected={selectedId === scrap.id}
            />
          ))}
          {editingId ? (
            <ScrapPopover
              onAction={action => {
                const scrap = scraps.find(item => item.id === editingId);
                if (scrap) {
                  editScrap(action, scrap).catch(() => undefined);
                }
              }}
              scrap={scraps.find(item => item.id === editingId)}
            />
          ) : null}
          {!scraps.length ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>从你的文字里剪一段吧</Text>
              <Text style={styles.emptyBody}>
                日迹、信和书里的句子，都可以重新落到这张大纸上。
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="添加散页"
        disabled={!userId}
        onPress={() => setComposerOpen(true)}
        style={({ pressed }) => [
          styles.fab,
          {
            opacity: draggingId ? 0 : pressed || !userId ? 0.68 : 1,
          },
        ]}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
      {draggingId ? (
        <View
          accessibilityLabel={trashHot ? '松手删除散页' : '废纸篓'}
          accessibilityLiveRegion="polite"
          style={[styles.trashZone, trashHot && styles.trashZoneHot]}
        >
          <View style={styles.trashLid} />
          <View style={styles.trashBin}>
            <View style={styles.trashLine} />
            <View style={styles.trashLine} />
          </View>
          <Text style={styles.trashText}>
            {trashHot ? '松手丢弃' : '拖进废纸篓'}
          </Text>
        </View>
      ) : null}

      {discardedId ? (
        <View style={styles.undoBar}>
          <Text style={styles.undoText}>已丢弃</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="撤销丢弃散页"
            onPress={() => {
              undoDiscardScrap(discardedId)
                .then(() => {
                  setDiscardedId(undefined);
                  return load();
                })
                .catch(() => toast.show('没有撤销成功'));
            }}
          >
            <Text style={styles.undoAction}>撤销</Text>
          </Pressable>
        </View>
      ) : null}

      <OverlayPortal
        blurBackground
        name="scrap-reader"
        onRequestClose={() => setReading(undefined)}
        visible={Boolean(reading)}
      >
        {reading ? (
          <ScrapReader
            onArchived={() => {
              setReading(undefined);
              load().catch(() => undefined);
            }}
            onClose={() => setReading(undefined)}
            onDiscard={() => {
              setDiscardedId(reading.id);
              setReading(undefined);
              load().catch(() => undefined);
            }}
            scrap={reading}
          />
        ) : null}
      </OverlayPortal>
      <OverlayPortal
        blurBackground
        name="scrap-composer"
        onRequestClose={() => setComposerOpen(false)}
        visible={composerOpen}
      >
        <ScrapComposer
          onClose={() => setComposerOpen(false)}
          onSaved={() => {
            setComposerOpen(false);
            load().catch(() => undefined);
          }}
          userId={userId}
        />
      </OverlayPortal>
    </SafeAreaView>
  );
}

function ScrapCard({
  scrap,
  selected,
  dimmed,
  dragging,
  managing,
  onPress,
  onLongPress,
  onMove,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDiscard,
}: {
  scrap: Scrap;
  selected: boolean;
  dimmed: boolean;
  dragging: boolean;
  managing: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMove: (x: number, y: number) => void;
  onDragStart: () => void;
  onDragMove: (overTrash: boolean) => void;
  onDragEnd: () => void;
  onDiscard: () => void;
}) {
  const position = useRef({ x: scrap.x, y: scrap.y });
  const start = useRef({ x: scrap.x, y: scrap.y });
  const moved = useRef(false);
  const trashState = useRef(false);
  const translate = useRef(new Animated.ValueXY()).current;
  const callbacks = useRef({
    onDiscard,
    onDragEnd,
    onDragMove,
    onDragStart,
    onMove,
  });
  callbacks.current = {
    onDiscard,
    onDragEnd,
    onDragMove,
    onDragStart,
    onMove,
  };
  const isOverTrash = (moveX: number, moveY: number) =>
    moveY >= viewportHeight - 132 &&
    moveX >= canvasWidth / 2 - 96 &&
    moveX <= canvasWidth / 2 + 96;
  useEffect(() => {
    position.current = { x: scrap.x, y: scrap.y };
    start.current = { x: scrap.x, y: scrap.y };
    translate.setValue({ x: 0, y: 0 });
  }, [scrap.x, scrap.y, translate]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, state) =>
          Math.hypot(state.dx, state.dy) >= 5,
        onMoveShouldSetPanResponderCapture: (_, state) =>
          Math.hypot(state.dx, state.dy) >= 5,
        onPanResponderGrant: () => {
          start.current = position.current;
          moved.current = true;
          trashState.current = false;
          callbacks.current.onDragStart();
        },
        onPanResponderMove: (_, state) => {
          moved.current = Math.hypot(state.dx, state.dy) >= 5;
          translate.setValue({ x: state.dx, y: state.dy });
          const nextTrashState = isOverTrash(state.moveX, state.moveY);
          if (nextTrashState !== trashState.current) {
            trashState.current = nextTrashState;
            callbacks.current.onDragMove(nextTrashState);
          }
        },
        onPanResponderRelease: (_, state) => {
          if (moved.current) {
            if (isOverTrash(state.moveX, state.moveY)) {
              translate.setValue({ x: 0, y: 0 });
              callbacks.current.onDiscard();
            } else {
              const nextX = Math.max(
                8,
                Math.min(canvasWidth - 82, start.current.x + state.dx),
              );
              const nextY = Math.max(24, start.current.y + state.dy);
              position.current = { x: nextX, y: nextY };
              translate.setValue({ x: 0, y: 0 });
              callbacks.current.onMove(nextX, nextY);
            }
          }
          callbacks.current.onDragEnd();
        },
        onPanResponderTerminate: () => {
          translate.setValue({ x: 0, y: 0 });
          moved.current = false;
          callbacks.current.onDragEnd();
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [translate],
  );
  const sizeStyle =
    scrap.cardType === 'tag'
      ? styles.tagCard
      : scrap.cardType === 'line'
      ? styles.lineCard
      : scrap.cardType === 'quote'
      ? styles.quoteCard
      : styles.paraCard;
  const top = scrap.y;
  const left = Math.min(scrap.x, canvasWidth - 90);
  const cardStateStyle = {
    opacity: dimmed ? 0.48 : 1,
    zIndex: dragging ? 700 : selected ? 100 : 1,
    backgroundColor: paperColors[(scrap.color as ScrapColor) ?? 'white'],
    borderColor: selected ? '#C4A77D' : 'rgba(58,51,45,0.08)',
    borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
    shadowOpacity: dragging ? 0.16 : 0.08,
  };
  const tapeStyle = scrap.tapeColor
    ? {
        backgroundColor:
          scrap.tapeColor === 'blue'
            ? 'rgba(155,176,196,0.5)'
            : scrap.tapeColor === 'pink'
            ? 'rgba(240,180,180,0.5)'
            : 'rgba(240,220,160,0.6)',
      }
    : undefined;
  return (
    <Animated.View
      {...pan.panHandlers}
      style={[
        styles.card,
        sizeStyle,
        cardStateStyle,
        {
          left,
          top,
          transform: [
            { translateX: translate.x },
            { translateY: translate.y },
            { rotate: `${scrap.rotation}deg` },
            { scale: dragging || selected ? 1.02 : 1 },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityHint="再次点击放大阅读，长按编辑"
        accessibilityLabel={`${scrap.sourceLabel || '散页'}：${
          scrap.textContent
        }`}
        accessibilityRole="button"
        delayLongPress={600}
        onLongPress={onLongPress}
        onPress={onPress}
        style={styles.cardPress}
      >
        {scrap.tapeColor ? <View style={[styles.tape, tapeStyle]} /> : null}
        {scrap.hasLetterLine ? <View style={styles.letterLine} /> : null}
        <Text
          numberOfLines={scrap.cardType === 'line' ? 1 : undefined}
          style={[
            styles.cardText,
            scrap.cardType === 'quote' && styles.quoteText,
            scrap.cardType === 'tag' && styles.tagText,
          ]}
        >
          {scrap.textContent}
        </Text>
        {scrap.sourceLabel ? (
          <Text style={styles.cardSource}>{scrap.sourceLabel}</Text>
        ) : null}
      </Pressable>
      {managing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`删除散页：${scrap.textContent}`}
          hitSlop={8}
          onPress={onDiscard}
          style={styles.cardDeleteButton}
        >
          <Text style={styles.cardDeleteText}>删除</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function ScrapPopover({
  scrap,
  onAction,
}: {
  scrap?: Scrap;
  onAction: (action: 'rotate' | ScrapColor | 'discard') => void;
}) {
  if (!scrap) {
    return null;
  }
  const popoverLeft =
    scrap.x > canvasWidth / 2 ? 18 : Math.min(scrap.x + 150, canvasWidth - 210);
  const popoverTop = Math.max(20, scrap.y - 52);
  return (
    <View style={[styles.popover, { left: popoverLeft, top: popoverTop }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="旋转散页"
        onPress={() => onAction('rotate')}
        style={styles.popoverButton}
      >
        <Text style={styles.popoverButtonText}>转</Text>
      </Pressable>
      {scrapColors.map(color => {
        const colorStyle = {
          backgroundColor: paperColors[color],
          borderColor:
            scrap.color === color ? '#C4A77D' : 'rgba(58,51,45,0.14)',
        };
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`换成${color}纸`}
            key={color}
            onPress={() => onAction(color)}
            style={[styles.colorDot, colorStyle]}
          />
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="丢弃散页"
        onPress={() => onAction('discard')}
        style={styles.popoverButton}
      >
        <Text style={[styles.popoverButtonText, styles.discardText]}>丢</Text>
      </Pressable>
    </View>
  );
}

function ScrapReader({
  scrap,
  onClose,
  onArchived,
  onDiscard,
}: {
  scrap: Scrap;
  onClose: () => void;
  onArchived: () => void;
  onDiscard: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const toast = useToast();
  const lift = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const [books, setBooks] = useState<Book[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    if (!reduceMotion) {
      Animated.spring(lift, {
        toValue: 1,
        useNativeDriver: true,
        tension: 52,
        friction: 9,
      }).start();
    }
  }, [lift, reduceMotion]);
  const chooseBook = async () => {
    const items = await getBooks(scrap.userId);
    setBooks(items.map(item => item.book));
    setPickerOpen(true);
  };
  return (
    <Pressable onPress={onClose} style={styles.readBackdrop}>
      <Animated.View
        style={[
          styles.readCard,
          {
            backgroundColor:
              paperColors[(scrap.color as ScrapColor) ?? 'white'],
            opacity: lift,
            transform: [
              {
                translateY: lift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
              {
                scale: lift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.94, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable onPress={() => undefined}>
          <Text style={styles.readText}>{scrap.textContent}</Text>
          <Text style={styles.readSource}>{scrap.sourceLabel}</Text>
          {pickerOpen ? (
            <View style={styles.bookPicker}>
              <Text style={styles.bookPickerTitle}>夹回哪本书？</Text>
              {books.map(book => (
                <Pressable
                  accessibilityRole="button"
                  key={book.id}
                  onPress={() => {
                    archiveScrapInBook(scrap.id, book.id)
                      .then(() => {
                        toast.show(`夹回《${book.title}》了`);
                        onArchived();
                      })
                      .catch(() => toast.show('没有夹回书里'));
                  }}
                  style={styles.bookChoice}
                >
                  <View
                    style={[
                      styles.bookChoiceMark,
                      { backgroundColor: book.coverBg },
                    ]}
                  />
                  <Text style={styles.bookChoiceText}>{book.title}</Text>
                </Pressable>
              ))}
              {!books.length ? (
                <Text style={styles.noBooks}>先去书架订一本册子</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.readActions}>
              <Pressable onPress={onClose} style={styles.readButton}>
                <Text style={styles.readButtonText}>放回原位</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  chooseBook().catch(() => toast.show('书架没有展开'))
                }
                style={[styles.readButton, styles.archiveButton]}
              >
                <Text style={[styles.readButtonText, styles.archiveButtonText]}>
                  夹回书里
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="丢弃这张散页"
                onPress={() => {
                  discardScrap(scrap.id)
                    .then(onDiscard)
                    .catch(() => toast.show('这张散页没有丢弃'));
                }}
                style={[styles.readButton, styles.discardReadButton]}
              >
                <Text style={[styles.readButtonText, styles.discardReadText]}>
                  丢弃
                </Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

function ScrapComposer({
  userId,
  onClose,
  onSaved,
}: {
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [sourceType, setSourceType] = useState<ScrapSourceType>('manual');
  const [sources, setSources] = useState<ScrapSource[]>([]);
  const [selected, setSelected] = useState<ScrapSource>();
  const [text, setText] = useState('');
  const [color, setColor] = useState<ScrapColor>('white');
  const [saving, setSaving] = useState(false);
  const sourceTypes: Array<{ id: ScrapSourceType; label: string }> = [
    { id: 'diary', label: '日迹' },
    { id: 'letter', label: '信' },
    { id: 'book', label: '书架' },
    { id: 'manual', label: '直接写' },
  ];

  const chooseType = async (next: ScrapSourceType) => {
    setSourceType(next);
    setSelected(undefined);
    setText('');
    if (next === 'manual') {
      setSources([]);
      return;
    }
    try {
      setSources(await getScrapSources(next));
    } catch {
      toast.show('旧文字暂时没有展开');
    }
  };

  const save = async () => {
    if (!userId || saving) {
      return;
    }
    setSaving(true);
    try {
      await createScrap({
        userId,
        text: selected?.text ?? text,
        sourceLabel: selected?.label ?? (sourceType === 'manual' ? '手写' : ''),
        sourceType,
        sourceId: selected?.id,
        color,
        availableWidth: canvasWidth,
      });
      toast.show('剪下来了，已放到空位');
      onSaved();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : '没有剪下来');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Pressable onPress={onClose} style={styles.sheetBackdrop}>
      <Pressable onPress={() => undefined} style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>剪 一 段</Text>
        <Text style={styles.sheetLabel}>从哪里剪？</Text>
        <View style={styles.sourceChips}>
          {sourceTypes.map(item => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: sourceType === item.id }}
              key={item.id}
              onPress={() => chooseType(item.id).catch(() => undefined)}
              style={[
                styles.sourceChip,
                sourceType === item.id && styles.sourceChipActive,
              ]}
            >
              <Text
                style={[
                  styles.sourceChipText,
                  sourceType === item.id && styles.sourceChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {sourceType === 'manual' ? (
          <TextInput
            accessibilityLabel="散页内容"
            maxLength={600}
            multiline
            onChangeText={setText}
            placeholder="写下你想留下的句子……"
            placeholderTextColor="rgba(58,51,45,0.32)"
            style={styles.textarea}
            textAlignVertical="top"
            value={text}
          />
        ) : (
          <ScrollView style={styles.sourceList}>
            {sources.map(source => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selected?.id === source.id }}
                key={source.id}
                onPress={() => setSelected(source)}
                style={[
                  styles.sourceRow,
                  selected?.id === source.id && styles.sourceRowActive,
                ]}
              >
                <Text numberOfLines={3} style={styles.sourceRowText}>
                  {source.text}
                </Text>
                <Text style={styles.sourceRowLabel}>{source.label}</Text>
              </Pressable>
            ))}
            {!sources.length ? (
              <Text style={styles.noSource}>这里还没有可以剪下来的文字</Text>
            ) : null}
          </ScrollView>
        )}
        <Text style={styles.sheetLabel}>选一张纸</Text>
        <View style={styles.colorPicker}>
          {scrapColors.map(item => {
            const colorStyle = {
              backgroundColor: paperColors[item],
              borderColor: color === item ? '#C4A77D' : 'rgba(58,51,45,0.12)',
            };
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`选择${item}纸`}
                accessibilityState={{ selected: color === item }}
                key={item}
                onPress={() => setColor(item)}
                style={[styles.sheetColor, colorStyle]}
              />
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => save().catch(() => undefined)}
          style={({ pressed }) => [
            styles.cutButton,
            { opacity: pressed || saving ? 0.68 : 1 },
          ]}
        >
          <Text style={styles.cutButtonText}>
            {saving ? '正在剪…' : '剪 下 来'}
          </Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  safeAreaPaper: { backgroundColor: '#FAF6EE' },
  header: {
    height: 76,
    paddingHorizontal: spacing.page,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  back: { fontFamily: fontFamilies.serif, fontSize: 13 },
  heading: { flex: 1, marginLeft: 22 },
  title: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 24,
    letterSpacing: 5,
  },
  subtitle: {
    marginTop: 2,
    color: 'rgba(58,51,45,0.45)',
    fontFamily: fontFamilies.serif,
    fontSize: 10,
    letterSpacing: 2,
  },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerAction: {
    color: 'rgba(58,51,45,0.55)',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  headerActionActive: { color: '#A94A3D' },
  canvas: {
    position: 'relative',
    width: canvasWidth,
    minHeight: 1400,
    backgroundColor: '#FAF6EE',
  },
  card: {
    position: 'absolute',
    borderRadius: radius.paper,
    shadowColor: '#3A332D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  quoteCard: { width: 156, minHeight: 128 },
  paraCard: { width: 184, minHeight: 150 },
  lineCard: { width: 164, height: 48 },
  tagCard: { width: 82, height: 82 },
  cardPress: { flex: 1, padding: 14, overflow: 'hidden' },
  cardDeleteButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    minWidth: 48,
    height: 30,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,74,61,0.35)',
    borderRadius: 15,
    backgroundColor: '#FFF9F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A332D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDeleteText: {
    color: '#A94A3D',
    fontFamily: fontFamilies.serif,
    fontSize: 10,
  },
  tape: {
    position: 'absolute',
    top: 2,
    left: '42%',
    width: 24,
    height: 5,
    transform: [{ rotate: '-8deg' }],
  },
  letterLine: {
    position: 'absolute',
    left: 7,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: '#9BB0C4',
  },
  cardText: {
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 13,
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  quoteText: { fontSize: 17, lineHeight: 26 },
  tagText: { fontSize: 20, lineHeight: 28, textAlign: 'center' },
  cardSource: {
    marginTop: 'auto',
    paddingTop: 8,
    color: 'rgba(58,51,45,0.4)',
    textAlign: 'right',
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 10,
  },
  popover: {
    position: 'absolute',
    zIndex: 600,
    minWidth: 190,
    height: 42,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.14)',
    borderRadius: 21,
    backgroundColor: '#FFFCF6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    shadowColor: '#3A332D',
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  popoverButton: {
    width: 24,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popoverButtonText: {
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  discardText: { color: '#C0392B' },
  colorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  empty: { paddingTop: 180, alignItems: 'center' },
  emptyTitle: {
    color: '#3A332D',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 17,
  },
  emptyBody: {
    maxWidth: 250,
    marginTop: 12,
    color: 'rgba(58,51,45,0.48)',
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3A332D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: '#FFF', fontSize: 26, fontWeight: '300' },
  trashZone: {
    position: 'absolute',
    zIndex: 900,
    left: '50%',
    bottom: 22,
    width: 170,
    height: 88,
    marginLeft: -85,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.22)',
    borderRadius: 18,
    backgroundColor: 'rgba(250,247,240,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A332D',
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  trashZoneHot: {
    borderColor: '#B85C38',
    backgroundColor: '#F7E4DD',
    transform: [{ scale: 1.04 }],
  },
  trashLid: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#6B5F55',
  },
  trashBin: {
    width: 24,
    height: 26,
    marginTop: 3,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#6B5F55',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  trashLine: {
    width: StyleSheet.hairlineWidth,
    height: 16,
    backgroundColor: '#6B5F55',
  },
  trashText: {
    marginTop: 5,
    color: '#6B5F55',
    fontFamily: fontFamilies.serif,
    fontSize: 10,
  },
  undoBar: {
    position: 'absolute',
    left: 20,
    bottom: 30,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: '#3A332D',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  undoText: { color: '#F8F0E5', fontFamily: fontFamilies.serif, fontSize: 11 },
  undoAction: {
    color: '#E7C795',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 11,
  },
  readBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(58,51,45,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  readCard: {
    width: '100%',
    maxWidth: 350,
    minHeight: 280,
    padding: 28,
    borderRadius: radius.paper,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  readText: {
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 18,
    lineHeight: 32,
    letterSpacing: 0.3,
  },
  readSource: {
    marginTop: 22,
    color: 'rgba(58,51,45,0.42)',
    textAlign: 'right',
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 12,
  },
  readActions: { marginTop: 28, flexDirection: 'row', gap: 10 },
  readButton: {
    flex: 1,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.2)',
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveButton: { backgroundColor: '#3A332D', borderColor: '#3A332D' },
  discardReadButton: { flex: 0.72, borderColor: 'rgba(192,57,43,0.3)' },
  readButtonText: {
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  archiveButtonText: { color: '#FFF' },
  discardReadText: { color: '#A94A3D' },
  bookPicker: { marginTop: 24 },
  bookPickerTitle: {
    marginBottom: 10,
    color: 'rgba(58,51,45,0.48)',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  bookChoice: {
    height: 42,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58,51,45,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookChoiceMark: { width: 18, height: 24, marginRight: 10, borderRadius: 2 },
  bookChoiceText: {
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  noBooks: {
    color: 'rgba(58,51,45,0.45)',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(58,51,45,0.5)',
  },
  sheet: {
    maxHeight: '86%',
    padding: 20,
    paddingBottom: 34,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#FAF7F0',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(58,51,45,0.18)',
  },
  sheetTitle: {
    marginTop: 18,
    color: '#3A332D',
    textAlign: 'center',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 18,
    letterSpacing: 5,
  },
  sheetLabel: {
    marginTop: 18,
    marginBottom: 9,
    color: 'rgba(58,51,45,0.5)',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  sourceChips: { flexDirection: 'row', gap: 8 },
  sourceChip: {
    flex: 1,
    height: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.16)',
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceChipActive: { borderColor: '#C0392B', backgroundColor: '#FFF8EE' },
  sourceChipText: {
    color: 'rgba(58,51,45,0.5)',
    fontFamily: fontFamilies.serif,
    fontSize: 10,
  },
  sourceChipTextActive: { color: '#3A332D' },
  textarea: {
    height: 130,
    marginTop: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.14)',
    borderRadius: radius.paper,
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    lineHeight: 24,
  },
  sourceList: { maxHeight: 220, marginTop: 12 },
  sourceRow: {
    marginBottom: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.12)',
    borderRadius: radius.paper,
  },
  sourceRowActive: { borderColor: '#C4A77D', backgroundColor: '#FFF9EC' },
  sourceRowText: {
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 20,
  },
  sourceRowLabel: {
    marginTop: 5,
    color: 'rgba(58,51,45,0.4)',
    textAlign: 'right',
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 10,
  },
  noSource: {
    padding: 30,
    color: 'rgba(58,51,45,0.4)',
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  colorPicker: { flexDirection: 'row', gap: 14 },
  sheetColor: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  cutButton: {
    height: 48,
    marginTop: 20,
    borderRadius: 24,
    backgroundColor: '#3A332D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutButtonText: {
    color: '#FFF',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 13,
    letterSpacing: 4,
  },
});
