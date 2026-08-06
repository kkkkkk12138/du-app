import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
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
import { Book, BookPage } from '../../db/models';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { removeMediaFile } from '../../services/mediaStorage';
import { pickPhotoFromLibrary } from '../../services/photoLibrary';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../tokens/radius';
import { spacing } from '../../tokens/spacing';
import { fontFamilies } from '../../tokens/typography';
import {
  BindableSource,
  appendWritingToBook,
  bookCoverTemplates,
  bookContentPages,
  BookCoverTemplate,
  bookMatchesFilter,
  BookWithPages,
  categoriesOf,
  createBook,
  deleteBook,
  deleteBookPage,
  getBindableSources,
  getBooks,
  updateBookProgress,
  suggestedBookCategories,
} from './bookshelfRepository';

export function BookshelfScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const userId = useSettingsStore(state => state.anonymousId);
  const toast = useToast();
  const [items, setItems] = useState<BookWithPages[]>([]);
  const [filter, setFilter] = useState('all');
  const [reader, setReader] = useState<BookWithPages>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await getBooks(userId ?? undefined));
    } catch (error) {
      console.error('书架读取失败', error);
      toast.show('书架暂时没有展开');
    } finally {
      setLoading(false);
    }
  }, [toast, userId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const visible = useMemo(
    () => items.filter(item => bookMatchesFilter(item.book, filter)),
    [filter, items],
  );
  const filters = useMemo(
    () => [
      'all',
      ...Array.from(
        new Set([
          ...suggestedBookCategories,
          ...items.flatMap(item => categoriesOf(item.book)),
        ]),
      ),
    ],
    [items],
  );

  const removeBook = (book: Book) => {
    Alert.alert(
      '删除这本书？',
      '书中的装订页会删除，原来的日迹和信不受影响。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            deleteBook(book.id)
              .then(load)
              .catch(() => toast.show('这本书没有删除'));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, styles.safeAreaPaper]}
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回个人页"
          hitSlop={12}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.back, { color: colors.textMuted }]}>收回</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.text }]}>书架</Text>
          <Text style={styles.subtitle}>Words bound in time</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={managing ? '完成管理书架' : '管理书架'}
          hitSlop={10}
          onPress={() => setManaging(value => !value)}
          style={styles.manageButton}
        >
          <Text
            style={[
              styles.manageText,
              managing ? styles.manageTextActive : null,
            ]}
          >
            {managing ? '完成' : '管理'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={styles.filters}
        showsHorizontalScrollIndicator={false}
      >
        {filters.map(item => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item }}
            key={item}
            onPress={() => setFilter(item)}
            style={styles.filter}
          >
            <Text
              style={[
                styles.filterText,
                filter === item
                  ? styles.filterTextActive
                  : styles.filterTextInactive,
              ]}
            >
              {item === 'all' ? '全部' : item}
            </Text>
            {filter === item ? <View style={styles.filterMark} /> : null}
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {visible.map(item => (
          <View key={item.book.id} style={styles.bookItem}>
            <BookCover item={item} onPress={() => setReader(item)} />
            {managing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`删除《${item.book.title}》`}
                onPress={() => removeBook(item.book)}
                style={styles.deleteBookButton}
              >
                <Text style={styles.deleteBookText}>删除</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {!loading && !visible.length ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              还没有装订过书
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              从写过的日迹和信里选几页，把一段日子收进封面。
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="订新册"
        disabled={!userId}
        onPress={() => setComposerOpen(true)}
        style={({ pressed }) => [
          styles.fab,
          { opacity: pressed || !userId ? 0.68 : 1 },
        ]}
      >
        <Text style={styles.fabPlus}>＋</Text>
        <Text style={styles.fabText}>订新册</Text>
      </Pressable>

      <OverlayPortal
        blurBackground
        name="bookshelf-reader"
        onRequestClose={() => setReader(undefined)}
        visible={Boolean(reader)}
      >
        {reader ? (
          <BookReader
            item={reader}
            onClose={() => setReader(undefined)}
            onContinued={() => {
              setReader(undefined);
              load().catch(() => undefined);
            }}
            onDeletePage={page => {
              Alert.alert('删除这一页？', '原始日迹或信件不会被删除。', [
                { text: '取消', style: 'cancel' },
                {
                  text: '删除',
                  style: 'destructive',
                  onPress: () => {
                    deleteBookPage(reader.book.id, page.id)
                      .then(() => {
                        setReader(undefined);
                        return load();
                      })
                      .catch(() => toast.show('这一页没有删除'));
                  },
                },
              ]);
            }}
          />
        ) : null}
      </OverlayPortal>
      <OverlayPortal
        blurBackground
        name="bookshelf-composer"
        onRequestClose={() => setComposerOpen(false)}
        visible={composerOpen}
      >
        <BookComposer
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

function BookCover({
  item,
  onPress,
}: {
  item: BookWithPages;
  onPress: () => void;
}) {
  const { book, pages } = item;
  const contentCount = bookContentPages(pages).length;
  const progress = pages.length
    ? Math.min(1, book.currentPage / Math.max(1, pages.length - 1))
    : 0;
  return (
    <Pressable
      accessibilityLabel={`${book.title}，${contentCount}页内容`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.cover,
        {
          backgroundColor: book.coverBg,
          shadowOpacity: pressed ? 0.15 : 0.08,
          transform: [{ scale: pressed ? 1.02 : 1 }],
        },
      ]}
    >
      {book.coverImagePath ? (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={{ uri: `file://${book.coverImagePath}` }}
          style={styles.coverImage}
        />
      ) : null}
      <View
        style={[
          styles.spine,
          { backgroundColor: book.coverAccent, width: book.spineWidth },
        ]}
      />
      <CoverDecoration
        accent={book.coverAccent}
        template={book.coverTemplate}
      />
      <Text style={[styles.coverTitle, { color: book.coverText }]}>
        {book.title}
      </Text>
      <Text style={[styles.coverSubtitle, { color: book.coverText }]}>
        {book.subtitle}
      </Text>
      <View style={styles.coverMeta}>
        <Text style={[styles.coverSource, { color: book.coverText }]}>
          {contentCount ? book.source : '空册'}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}

function CoverDecoration({
  template,
  accent,
}: {
  template: string;
  accent: string;
}) {
  if (template === 'travel') {
    return (
      <View style={styles.mountainWrap}>
        <View style={[styles.mountain, { borderBottomColor: accent }]} />
        <View
          style={[
            styles.mountain,
            styles.mountainTwo,
            { borderBottomColor: accent },
          ]}
        />
      </View>
    );
  }
  if (template === 'fragment') {
    return (
      <>
        <View style={[styles.coverBand, { backgroundColor: accent }]} />
        <View
          style={[
            styles.coverBand,
            styles.coverBandTwo,
            { backgroundColor: accent },
          ]}
        />
      </>
    );
  }
  return (
    <>
      <View style={[styles.coverCircle, { borderColor: accent }]} />
      <View style={[styles.coverLine, { backgroundColor: accent }]} />
    </>
  );
}

function BookReader({
  item,
  onClose,
  onDeletePage,
  onContinued,
}: {
  item: BookWithPages;
  onClose: () => void;
  onDeletePage: (page: BookPage) => void;
  onContinued: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const toast = useToast();
  const initialPage = Math.min(
    Math.max(0, item.book.currentPage),
    Math.max(0, item.pages.length - 1),
  );
  const [index, setIndex] = useState(initialPage);
  const [turningTo, setTurningTo] = useState<number>();
  const turn = useRef(new Animated.Value(0)).current;
  const flipping = useRef(false);
  const indexRef = useRef(initialPage);
  const continuationText = useRef('');
  const continuationEyebrow = useRef('');
  const [continuationOpen, setContinuationOpen] = useState(false);
  const [continuationPlacement, setContinuationPlacement] = useState<
    'current-page' | 'new-page'
  >('new-page');
  const [savingContinuation, setSavingContinuation] = useState(false);
  const page = item.pages[index];

  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(
    () => () => {
      updateBookProgress(item.book.id, indexRef.current).catch(() => undefined);
    },
    [item.book.id],
  );

  const move = useCallback(
    (direction: 1 | -1) => {
      const next = Math.min(
        Math.max(0, index + direction),
        item.pages.length - 1,
      );
      if (next === index || flipping.current) {
        return;
      }
      if (reduceMotion) {
        setIndex(next);
        updateBookProgress(item.book.id, next).catch(() => undefined);
        return;
      }
      flipping.current = true;
      setTurningTo(next);
      turn.setValue(0);
      Animated.timing(turn, {
        toValue: direction,
        duration: 700,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIndex(next);
          updateBookProgress(item.book.id, next).catch(() => undefined);
        }
        setTurningTo(undefined);
        turn.setValue(0);
        flipping.current = false;
      });
    },
    [index, item.book.id, item.pages.length, reduceMotion, turn],
  );
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, state) => Math.abs(state.dx) > 12,
        onPanResponderRelease: (_, state) => {
          if (state.dx < -40) {
            move(1);
          } else if (state.dx > 40) {
            move(-1);
          }
        },
      }),
    [move],
  );
  const rotate = turn.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['180deg', '0deg', '-180deg'],
  });
  const saveContinuation = async () => {
    if (savingContinuation) {
      return;
    }
    setSavingContinuation(true);
    try {
      await appendWritingToBook({
        bookId: item.book.id,
        eyebrow: continuationEyebrow.current,
        pageId: page?.id,
        placement: continuationPlacement,
        text: continuationText.current,
      });
      toast.show(
        continuationPlacement === 'current-page'
          ? '内容已经续在这一页'
          : '新一页已经夹进书里',
      );
      onContinued();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : '续写没有保存');
    } finally {
      setSavingContinuation(false);
    }
  };

  return (
    <View style={styles.readerBackdrop}>
      <View style={styles.readerTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="放回书架"
          onPress={onClose}
        >
          <Text style={styles.readerBack}>‹ 放回书架</Text>
        </Pressable>
        <Text style={styles.pageNumber}>
          {index + 1} / {item.pages.length}
        </Text>
        <View style={styles.readerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`续写《${item.book.title}》`}
            onPress={() => {
              continuationText.current = '';
              continuationEyebrow.current = '';
              setContinuationPlacement(
                page?.type === 'content' ? 'current-page' : 'new-page',
              );
              setContinuationOpen(true);
            }}
          >
            <Text style={styles.readerContinue}>续写</Text>
          </Pressable>
          {page && ['content', 'quote'].includes(page.type) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="删除当前书页"
              onPress={() => onDeletePage(page)}
            >
              <Text style={styles.readerDelete}>删除本页</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.stage} {...panResponder.panHandlers}>
        <View style={[styles.readerPaper, styles.pageUnder]}>
          <ReaderPage book={item.book} page={item.pages[turningTo ?? index]} />
        </View>
        <Animated.View
          style={[
            styles.readerPaper,
            styles.turningPage,
            {
              transform: [{ perspective: 1200 }, { rotateY: rotate }],
            },
          ]}
        >
          <View style={styles.pageFront}>
            <ReaderPage
              book={item.book}
              emptyBook={!bookContentPages(item.pages).length}
              page={page}
            />
          </View>
          {turningTo !== undefined ? (
            <View style={styles.pageBack}>
              <ReaderPage book={item.book} page={item.pages[turningTo]} />
            </View>
          ) : null}
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="上一页"
          onPress={() => move(-1)}
          style={[styles.hitArea, styles.leftHit]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="下一页"
          onPress={() => move(1)}
          style={[styles.hitArea, styles.rightHit]}
        />
      </View>
      <View style={styles.readerProgress}>
        <View style={styles.readerProgressTrack}>
          <View
            style={[
              styles.readerProgressFill,
              {
                width: `${Math.round(
                  ((index + 1) / Math.max(1, item.pages.length)) * 100,
                )}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.readerProgressText}>已读 {index + 1} 页</Text>
      </View>
      {continuationOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭续写窗口"
          onPress={() => setContinuationOpen(false)}
          style={styles.continuationBackdrop}
        >
          <Pressable onPress={() => undefined} style={styles.continuationSheet}>
            <View style={styles.continuationHandle} />
            <Text style={styles.continuationTitle}>
              续写《{item.book.title}》
            </Text>
            <View style={styles.continuationPlacement}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="续在本页"
                disabled={page?.type !== 'content'}
                onPress={() => setContinuationPlacement('current-page')}
                style={[
                  styles.continuationPlacementOption,
                  continuationPlacement === 'current-page'
                    ? styles.continuationPlacementOptionActive
                    : null,
                  page?.type !== 'content'
                    ? styles.continuationPlacementOptionDisabled
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.continuationPlacementText,
                    continuationPlacement === 'current-page'
                      ? styles.continuationPlacementTextActive
                      : null,
                  ]}
                >
                  续在本页
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="另起一页"
                onPress={() => setContinuationPlacement('new-page')}
                style={[
                  styles.continuationPlacementOption,
                  continuationPlacement === 'new-page'
                    ? styles.continuationPlacementOptionActive
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.continuationPlacementText,
                    continuationPlacement === 'new-page'
                      ? styles.continuationPlacementTextActive
                      : null,
                  ]}
                >
                  另起一页
                </Text>
              </Pressable>
            </View>
            <Text style={styles.continuationHint}>
              {continuationPlacement === 'current-page'
                ? '内容会接在当前页末尾，不改变原有眉头。'
                : '新页会接在当前阅读位置，眉头可以填写，也可以留空。'}
            </Text>
            {continuationPlacement === 'new-page' ? (
              <TextInput
                accessibilityLabel="新页眉头"
                key="continuation-eyebrow"
                onChangeText={value => {
                  continuationEyebrow.current = value;
                }}
                placeholder="眉头（可选）"
                placeholderTextColor="rgba(58,51,45,0.3)"
                style={styles.continuationEyebrowInput}
              />
            ) : null}
            <TextInput
              accessibilityLabel="续写内容"
              autoFocus
              key="continuation-body"
              multiline
              onChangeText={value => {
                continuationText.current = value;
              }}
              placeholder="继续写下去……"
              placeholderTextColor="rgba(58,51,45,0.3)"
              style={styles.continuationInput}
              textAlignVertical="top"
            />
            <View style={styles.continuationButtons}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setContinuationOpen(false)}
                style={styles.continuationCancel}
              >
                <Text style={styles.continuationCancelText}>先不写</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={savingContinuation}
                onPress={() => saveContinuation().catch(() => undefined)}
                style={styles.continuationSave}
              >
                <Text style={styles.continuationSaveText}>
                  {savingContinuation ? '正在夹入…' : '夹进书里'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

function ReaderPage({
  book,
  page,
  emptyBook = false,
}: {
  book: Book;
  page?: BookPage;
  emptyBook?: boolean;
}) {
  if (!page) {
    return null;
  }
  if (page.type === 'cover') {
    return (
      <View style={[styles.innerCover, { backgroundColor: book.coverBg }]}>
        {book.coverImagePath ? (
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={{ uri: `file://${book.coverImagePath}` }}
            style={styles.innerCoverImage}
          />
        ) : null}
        <CoverDecoration
          accent={book.coverAccent}
          template={book.coverTemplate}
        />
        <Text style={[styles.innerCoverTitle, { color: book.coverText }]}>
          {book.title}
        </Text>
        <Text style={[styles.innerCoverSub, { color: book.coverText }]}>
          {book.subtitle}
        </Text>
      </View>
    );
  }
  if (page.type === 'title') {
    return (
      <View style={styles.centerPage}>
        <Text style={styles.titlePageText}>{book.title}</Text>
        <View style={styles.titlePageRule} />
        <Text style={styles.titlePageSub}>{book.subtitle}</Text>
        {emptyBook ? (
          <Text style={styles.emptyBookText}>
            这本册子还空着。你可以先留下封面，之后再把散页夹进来。
          </Text>
        ) : null}
      </View>
    );
  }
  if (page.type === 'quote') {
    return (
      <View style={styles.centerPage}>
        <Text style={styles.quoteMark}>“</Text>
        <Text style={styles.quoteText}>{page.quote}</Text>
        <Text style={styles.quoteAuthor}>— {page.author}</Text>
      </View>
    );
  }
  if (page.type === 'back') {
    return (
      <View style={styles.centerPage}>
        <Text style={styles.backMoon}>◯</Text>
        <Text style={styles.backText}>{page.textContent}</Text>
      </View>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={styles.contentPage}
      showsVerticalScrollIndicator={false}
    >
      {page.dateLabel ? (
        <Text style={styles.pageDate}>{page.dateLabel}</Text>
      ) : null}
      {page.textContent
        ?.split(/\n{2,}/u)
        .filter(Boolean)
        .map((paragraph, paragraphIndex) => (
          <Text key={`${page.id}-${paragraphIndex}`} style={styles.pageText}>
            {paragraph}
          </Text>
        ))}
    </ScrollView>
  );
}

function BookComposer({
  userId,
  onClose,
  onSaved,
}: {
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [sources, setSources] = useState<BindableSource[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('2026');
  const [template, setTemplate] = useState<BookCoverTemplate>('spring');
  const [coverPath, setCoverPath] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBindableSources()
      .then(setSources)
      .catch(() => toast.show('旧文字暂时没有铺开'));
  }, [toast]);
  useEffect(
    () => () => {
      if (coverPath) {
        removeMediaFile(coverPath).catch(() => undefined);
      }
    },
    [coverPath],
  );

  const chooseCover = async () => {
    const result = await pickPhotoFromLibrary();
    if (result.status === 'cancelled') {
      return;
    }
    if (result.status === 'error') {
      toast.show(result.message);
      return;
    }
    const previous = coverPath;
    setCoverPath(result.path);
    if (previous) {
      removeMediaFile(previous).catch(() => undefined);
    }
  };

  const save = async () => {
    if (!userId || saving) {
      return;
    }
    setSaving(true);
    try {
      await createBook({
        userId,
        title,
        subtitle,
        category,
        template,
        sourceIds: selected,
        coverImagePath: coverPath,
      });
      setCoverPath(undefined);
      toast.show('新册装订好了');
      onSaved();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : '装订没有完成');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Pressable onPress={onClose} style={styles.sheetBackdrop}>
      <Pressable onPress={() => undefined} style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>订 一 本 新 册</Text>
        <Text style={styles.sheetLabel}>书名</Text>
        <TextInput
          accessibilityLabel="书名"
          maxLength={24}
          onChangeText={setTitle}
          placeholder="例如：二〇二六年春"
          placeholderTextColor="rgba(58,51,45,0.35)"
          style={styles.sheetInput}
          value={title}
        />
        <TextInput
          accessibilityLabel="副标题"
          maxLength={36}
          onChangeText={setSubtitle}
          placeholder="副标题，可不填"
          placeholderTextColor="rgba(58,51,45,0.35)"
          style={styles.sheetInput}
          value={subtitle}
        />
        <Text style={styles.sheetLabel}>分类</Text>
        <TextInput
          accessibilityLabel="书籍分类"
          maxLength={16}
          onChangeText={setCategory}
          placeholder="写一个分类名称"
          placeholderTextColor="rgba(58,51,45,0.35)"
          style={styles.sheetInput}
          value={category}
        />
        <View style={styles.categorySuggestions}>
          {suggestedBookCategories.map(item => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: category === item }}
              key={item}
              onPress={() => setCategory(item)}
              style={[
                styles.categorySuggestion,
                category === item && styles.categorySuggestionActive,
              ]}
            >
              <Text style={styles.categorySuggestionText}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sheetLabel}>选封面</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            coverPath ? '更换书籍封面照片' : '上传书籍封面照片'
          }
          onPress={() => chooseCover().catch(() => undefined)}
          style={styles.coverPicker}
        >
          {coverPath ? (
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={{ uri: `file://${coverPath}` }}
              style={styles.coverPickerImage}
            />
          ) : (
            <Text style={styles.coverPickerText}>上传照片封面（可不选）</Text>
          )}
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.templateRow}>
            {bookCoverTemplates.map(item => {
              const templateStyle = {
                backgroundColor: item.palette.bg,
                borderColor: template === item.id ? '#C0392B' : 'transparent',
              };
              const templateTextStyle = { color: item.palette.text };
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: template === item.id }}
                  key={item.id}
                  onPress={() => setTemplate(item.id)}
                  style={[styles.template, templateStyle]}
                >
                  <Text style={[styles.templateText, templateTextStyle]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <Text style={styles.sheetLabel}>选择要装订的文字</Text>
        <ScrollView style={styles.sourceList}>
          {sources.map(source => {
            const active = selected.includes(source.id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                key={source.id}
                onPress={() =>
                  setSelected(current =>
                    active
                      ? current.filter(id => id !== source.id)
                      : [...current, source.id],
                  )
                }
                style={[styles.sourceRow, active && styles.sourceRowActive]}
              >
                <View
                  style={[
                    styles.sourceCheck,
                    active && styles.sourceCheckActive,
                  ]}
                >
                  <Text style={styles.sourceCheckText}>
                    {active ? '✓' : ''}
                  </Text>
                </View>
                <View style={styles.sourceCopy}>
                  <Text numberOfLines={1} style={styles.sourceTitle}>
                    {source.title}
                  </Text>
                  <Text numberOfLines={2} style={styles.sourceExcerpt}>
                    {source.excerpt}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => save().catch(() => undefined)}
          style={({ pressed }) => [
            styles.bindButton,
            { opacity: pressed || saving ? 0.68 : 1 },
          ]}
        >
          <Text style={styles.bindButtonText}>
            {saving
              ? '装订中…'
              : selected.length
              ? `装订 ${selected.length} 页`
              : '建立空白册'}
          </Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const screenWidth = Dimensions.get('window').width;
const coverWidth = (screenWidth - 56) / 2;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  safeAreaPaper: { backgroundColor: '#FAF7F2' },
  topBar: {
    height: 74,
    paddingHorizontal: spacing.page,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: { fontFamily: fontFamilies.serif, fontSize: 13 },
  heading: { flex: 1, alignItems: 'center' },
  title: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 24,
    letterSpacing: 5,
  },
  subtitle: {
    marginTop: 2,
    color: 'rgba(58,51,45,0.45)',
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 11,
    letterSpacing: 1,
  },
  manageButton: {
    minWidth: 44,
    minHeight: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  manageText: {
    color: 'rgba(58,51,45,0.55)',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  manageTextActive: { color: '#A94A3D' },
  filters: { paddingHorizontal: spacing.page, height: 42 },
  filter: { height: 36, marginRight: 22, justifyContent: 'center' },
  filterText: { fontFamily: fontFamilies.serif, fontSize: 12 },
  filterTextActive: { color: '#3A332D' },
  filterTextInactive: { color: 'rgba(58,51,45,0.45)' },
  filterMark: { height: 2, marginTop: 5, backgroundColor: '#C0392B' },
  grid: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: 130,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  bookItem: { width: coverWidth, alignItems: 'center' },
  cover: {
    width: coverWidth,
    aspectRatio: 3 / 4.2,
    borderRadius: radius.paper,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#3A332D',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  coverImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 'auto',
    height: 'auto',
    opacity: 0.72,
  },
  deleteBookButton: {
    minWidth: 72,
    minHeight: 36,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,74,61,0.3)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBookText: {
    color: '#A94A3D',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.75 },
  coverCircle: {
    position: 'absolute',
    right: -20,
    top: 22,
    width: 76,
    height: 76,
    borderWidth: 1,
    borderRadius: 38,
    opacity: 0.25,
  },
  coverLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 64,
    height: StyleSheet.hairlineWidth,
    opacity: 0.38,
  },
  coverBand: {
    position: 'absolute',
    width: 160,
    height: 18,
    top: 34,
    left: -20,
    opacity: 0.22,
    transform: [{ rotate: '-8deg' }],
  },
  coverBandTwo: { top: 72, left: 30, opacity: 0.12 },
  mountainWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 26,
    height: 80,
  },
  mountain: {
    position: 'absolute',
    left: 16,
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 58,
    borderRightWidth: 58,
    borderBottomWidth: 58,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    opacity: 0.16,
  },
  mountainTwo: { left: 68, bottom: -6, opacity: 0.1 },
  coverTitle: {
    marginTop: 32,
    fontFamily: fontFamilies.serifMedium,
    fontSize: 21,
    letterSpacing: 4,
  },
  coverSubtitle: {
    marginTop: 8,
    opacity: 0.7,
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 11,
    letterSpacing: 1,
  },
  coverMeta: { position: 'absolute', left: 18, right: 16, bottom: 14 },
  coverSource: { fontFamily: fontFamilies.serif, fontSize: 9, opacity: 0.55 },
  progressTrack: {
    height: 2,
    marginTop: 7,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: { height: 2, backgroundColor: '#C4A77D', opacity: 0.7 },
  empty: { width: '100%', paddingTop: 120, alignItems: 'center' },
  emptyTitle: { fontFamily: fontFamilies.serifMedium, fontSize: 17 },
  emptyBody: {
    maxWidth: 250,
    marginTop: 12,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    minWidth: 104,
    height: 48,
    paddingHorizontal: 15,
    borderRadius: 24,
    backgroundColor: '#3A332D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fabPlus: { color: '#FFF', fontSize: 20, fontWeight: '300' },
  fabText: { color: '#FFF', fontFamily: fontFamilies.serif, fontSize: 12 },
  readerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(38,31,26,0.82)',
    paddingTop: 54,
    paddingBottom: 28,
  },
  readerTop: {
    height: 50,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readerBack: {
    color: '#F8F0E5',
    fontFamily: fontFamilies.serif,
    fontSize: 13,
  },
  pageNumber: {
    color: 'rgba(248,240,229,0.72)',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 12,
  },
  readerActions: {
    minWidth: 68,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
  },
  readerContinue: {
    color: '#E7C795',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 12,
  },
  readerDelete: {
    color: '#F0B2A8',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  readerPaper: {
    width: Math.min(326, screenWidth - 50),
    height: Math.min(500, Dimensions.get('window').height - 210),
    backgroundColor: '#FAF7F0',
    borderRadius: 3,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  pageUnder: { position: 'absolute', overflow: 'hidden' },
  turningPage: {
    transformOrigin: 'left center',
  },
  pageFront: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  pageBack: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: '#F7F0E2',
    backfaceVisibility: 'hidden',
    transform: [{ rotateY: '180deg' }],
  },
  hitArea: { position: 'absolute', top: 0, bottom: 0, width: '50%' },
  leftHit: { left: 0 },
  rightHit: { right: 0 },
  innerCover: { flex: 1, padding: 30, justifyContent: 'center' },
  innerCoverImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 'auto',
    height: 'auto',
    opacity: 0.72,
  },
  innerCoverTitle: {
    fontFamily: fontFamilies.serifMedium,
    fontSize: 28,
    letterSpacing: 7,
  },
  innerCoverSub: {
    marginTop: 14,
    opacity: 0.7,
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 14,
  },
  centerPage: {
    flex: 1,
    padding: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePageText: {
    color: '#3A332D',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 26,
    letterSpacing: 6,
  },
  titlePageRule: {
    width: 60,
    height: 1,
    marginVertical: 24,
    backgroundColor: '#C4A77D',
  },
  titlePageSub: {
    color: 'rgba(58,51,45,0.55)',
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 13,
  },
  emptyBookText: {
    maxWidth: 210,
    marginTop: 38,
    color: 'rgba(58,51,45,0.46)',
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 22,
  },
  quoteMark: {
    color: 'rgba(196,167,125,0.5)',
    fontFamily: fontFamilies.englishSerif,
    fontSize: 56,
    lineHeight: 58,
  },
  quoteText: {
    color: '#3A332D',
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 18,
    lineHeight: 31,
  },
  quoteAuthor: {
    marginTop: 24,
    color: 'rgba(58,51,45,0.5)',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  contentPage: { padding: 32, paddingBottom: 48 },
  pageDate: {
    marginBottom: 24,
    color: 'rgba(58,51,45,0.45)',
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 12,
  },
  pageText: {
    marginBottom: 18,
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 15,
    lineHeight: 29,
    letterSpacing: 0.3,
  },
  backMoon: { color: '#C4A77D', fontSize: 42 },
  backText: {
    marginTop: 20,
    color: 'rgba(58,51,45,0.52)',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    letterSpacing: 3,
  },
  readerProgress: { paddingHorizontal: 36 },
  readerProgressTrack: {
    height: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  readerProgressFill: { height: 2, backgroundColor: '#C4A77D' },
  readerProgressText: {
    marginTop: 8,
    color: 'rgba(248,240,229,0.58)',
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 10,
  },
  continuationBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    backgroundColor: 'rgba(25,20,17,0.42)',
    justifyContent: 'flex-end',
  },
  continuationSheet: {
    padding: 24,
    paddingBottom: 36,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#FAF7F0',
  },
  continuationHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(58,51,45,0.18)',
  },
  continuationTitle: {
    marginTop: 18,
    color: '#3A332D',
    textAlign: 'center',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 17,
  },
  continuationPlacement: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 3,
    borderRadius: 18,
    backgroundColor: 'rgba(58,51,45,0.06)',
    flexDirection: 'row',
  },
  continuationPlacementOption: {
    minWidth: 88,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continuationPlacementOptionActive: {
    backgroundColor: '#3A332D',
  },
  continuationPlacementOptionDisabled: {
    opacity: 0.28,
  },
  continuationPlacementText: {
    color: 'rgba(58,51,45,0.58)',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  continuationPlacementTextActive: {
    color: '#FFF',
  },
  continuationHint: {
    marginTop: 10,
    color: 'rgba(58,51,45,0.45)',
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  continuationEyebrowInput: {
    height: 44,
    marginTop: 18,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58,51,45,0.22)',
    color: '#3A332D',
    fontFamily: fontFamilies.englishSerifItalic,
    fontSize: 13,
  },
  continuationInput: {
    minHeight: 190,
    maxHeight: 300,
    marginTop: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.14)',
    borderRadius: radius.paper,
    backgroundColor: '#FFFBF3',
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 15,
    lineHeight: 27,
    letterSpacing: 0.3,
  },
  continuationButtons: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  continuationCancel: {
    flex: 1,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.18)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continuationCancelText: {
    color: 'rgba(58,51,45,0.62)',
    fontFamily: fontFamilies.serif,
    fontSize: 12,
  },
  continuationSave: {
    flex: 1.3,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3A332D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continuationSaveText: {
    color: '#FFF',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 12,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(58,51,45,0.5)',
  },
  sheet: {
    maxHeight: '88%',
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
    letterSpacing: 4,
  },
  sheetLabel: {
    marginTop: 18,
    marginBottom: 8,
    color: 'rgba(58,51,45,0.55)',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  sheetInput: {
    height: 44,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.16)',
    borderRadius: radius.paper,
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
  },
  categorySuggestions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  categorySuggestion: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.16)',
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySuggestionActive: {
    borderColor: '#C4A77D',
    backgroundColor: '#FFF8E8',
  },
  categorySuggestionText: {
    color: '#3A332D',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  coverPicker: {
    height: 58,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.16)',
    borderRadius: radius.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPickerImage: { width: '100%', height: '100%' },
  coverPickerText: {
    color: 'rgba(58,51,45,0.48)',
    fontFamily: fontFamilies.serif,
    fontSize: 11,
  },
  templateRow: { flexDirection: 'row', gap: 10 },
  template: {
    width: 58,
    height: 78,
    borderWidth: 2,
    borderRadius: radius.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateText: { fontFamily: fontFamilies.serif, fontSize: 11 },
  sourceList: { maxHeight: 220 },
  sourceRow: {
    minHeight: 68,
    marginBottom: 8,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(58,51,45,0.12)',
    borderRadius: radius.paper,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceRowActive: { borderColor: '#C4A77D', backgroundColor: '#FFF9EC' },
  sourceCheck: {
    width: 20,
    height: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(58,51,45,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceCheckActive: { borderColor: '#C0392B', backgroundColor: '#C0392B' },
  sourceCheckText: { color: '#FFF', fontSize: 11 },
  sourceCopy: { flex: 1 },
  sourceTitle: {
    color: '#3A332D',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 12,
  },
  sourceExcerpt: {
    marginTop: 4,
    color: 'rgba(58,51,45,0.48)',
    fontFamily: fontFamilies.serif,
    fontSize: 10,
    lineHeight: 16,
  },
  bindButton: {
    height: 48,
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: '#3A332D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bindButtonText: {
    color: '#FFF',
    fontFamily: fontFamilies.serifMedium,
    fontSize: 13,
  },
});
