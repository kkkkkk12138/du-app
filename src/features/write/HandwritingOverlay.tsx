import React, {useMemo, useRef, useState} from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Path} from 'react-native-svg';
import {captureRef} from 'react-native-view-shot';

import {archiveMediaFile} from '../../services/mediaStorage';
import {fontFamilies} from '../../tokens/typography';

type Stroke = {
  color: string;
  width: number;
  path: string;
};

type HandwritingOverlayProps = {
  onCancel: () => void;
  onComplete: (path: string) => void;
  onError: (message: string) => void;
};

export function HandwritingOverlay({
  onCancel,
  onComplete,
  onError,
}: HandwritingOverlayProps) {
  const canvas = useRef<View>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState('#3A332D');
  const [width, setWidth] = useState(2.2);
  const [saving, setSaving] = useState(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: event => {
          const {locationX, locationY} = event.nativeEvent;
          strokesRef.current = [
            ...strokesRef.current,
            {color, width, path: `M ${locationX} ${locationY}`},
          ];
          setStrokes(strokesRef.current);
        },
        onPanResponderMove: event => {
          const {locationX, locationY} = event.nativeEvent;
          const next = [...strokesRef.current];
          const last = next[next.length - 1];
          if (!last) {
            return;
          }
          next[next.length - 1] = {
            ...last,
            path: `${last.path} L ${locationX} ${locationY}`,
          };
          strokesRef.current = next;
          setStrokes(next);
        },
      }),
    [color, width],
  );

  const undo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokes(strokesRef.current);
  };

  const clear = () => {
    strokesRef.current = [];
    setStrokes([]);
  };

  const complete = async () => {
    if (!strokes.length || !canvas.current || saving) {
      return;
    }
    setSaving(true);
    try {
      const temporaryPath = await captureRef(canvas, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      onComplete(await archiveMediaFile(temporaryPath, 'ink', 'png'));
    } catch {
      onError('手书没有保存下来，请再试一次');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="取消手书"
          onPress={onCancel}>
          <Text style={styles.cancel}>取消</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="落下手书"
          disabled={!strokes.length || saving}
          onPress={complete}>
          <Text
            style={[
              styles.done,
              (!strokes.length || saving) && styles.disabled,
            ]}>
            落纸
          </Text>
        </Pressable>
      </View>
      <View
        ref={canvas}
        collapsable={false}
        style={styles.canvas}
        {...responder.panHandlers}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {Array.from({length: 18}, (_, index) => (
            <View key={index} style={[styles.rule, {top: 36 * (index + 1)}]} />
          ))}
        </View>
        <Svg height="100%" width="100%" pointerEvents="none">
          {strokes.map((stroke, index) => (
            <Path
              key={index}
              d={stroke.path}
              fill="none"
              stroke={stroke.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={stroke.width}
            />
          ))}
        </Svg>
      </View>
      <View style={styles.tools}>
        <Text style={styles.hint}>手指在纸上涂画</Text>
        <View style={styles.actions}>
          <Pressable accessibilityLabel="撤销一笔" onPress={undo}>
            <Text style={styles.actionText}>撤销</Text>
          </Pressable>
          <Pressable accessibilityLabel="清空手书" onPress={clear}>
            <Text style={styles.actionText}>清空</Text>
          </Pressable>
          {[
            ['#3A332D', '墨'],
            ['#C0392B', '朱'],
          ].map(([value, label]) => (
            <Pressable
              accessibilityLabel={`${label}色`}
              key={value}
              onPress={() => setColor(value)}
              style={[
                styles.color,
                {backgroundColor: value},
                color === value && styles.selectedColor,
              ]}
            />
          ))}
          <Pressable
            accessibilityLabel={width > 3 ? '切换细笔' : '切换毛笔'}
            onPress={() => setWidth(current => (current > 3 ? 2.2 : 4.5))}>
            <Text style={styles.actionText}>{width > 3 ? '毛' : '细'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F5F0E4'},
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  cancel: {color: '#9B8E82', fontFamily: fontFamilies.sans, fontSize: 14},
  done: {
    color: '#C0392B',
    fontFamily: fontFamilies.serif,
    fontSize: 14,
    letterSpacing: 2,
  },
  disabled: {opacity: 0.35},
  canvas: {
    flex: 1,
    marginHorizontal: 16,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#FEFCF5',
  },
  rule: {
    position: 'absolute',
    right: 0,
    left: 0,
    height: 0.5,
    backgroundColor: 'rgba(58,51,45,0.04)',
  },
  tools: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  hint: {color: '#9B8E82', fontFamily: fontFamilies.sans, fontSize: 11},
  actions: {flexDirection: 'row', alignItems: 'center', gap: 14},
  actionText: {color: '#6B5F55', fontFamily: fontFamilies.sans, fontSize: 12},
  color: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FEFCF5',
  },
  selectedColor: {outlineColor: 'rgba(58,51,45,0.35)', outlineWidth: 1},
});
