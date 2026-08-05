import React, {
  createContext,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

type OverlayEntry = {
  key: string;
  node: ReactNode;
  blurBackground?: boolean;
  onRequestClose?: () => void;
};

type OverlayHostContextValue = {
  dismiss: (key: string) => void;
  present: (entry: OverlayEntry) => void;
};

const OverlayHostContext = createContext<OverlayHostContextValue | null>(null);

export function OverlayHostProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<OverlayEntry[]>([]);

  const present = useCallback((entry: OverlayEntry) => {
    setEntries(current => {
      const index = current.findIndex(item => item.key === entry.key);
      if (index < 0) {
        return [...current, entry];
      }
      const next = [...current];
      next[index] = entry;
      return next;
    });
  }, []);

  const dismiss = useCallback((key: string) => {
    setEntries(current => current.filter(item => item.key !== key));
  }, []);

  useEffect(() => {
    if (!entries.length) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        const top = entries[entries.length - 1];
        top.onRequestClose?.();
        return true;
      },
    );
    return () => subscription.remove();
  }, [entries]);

  const value = useMemo(() => ({ dismiss, present }), [dismiss, present]);

  return (
    <OverlayHostContext.Provider value={value}>
      <View style={styles.root}>
        <View
          pointerEvents={entries.length ? 'none' : 'auto'}
          style={[
            styles.content,
            entries.some(entry => entry.blurBackground) &&
              styles.blurredContent,
          ]}
        >
          {children}
        </View>
        {entries.map((entry, index) => (
          <View
            accessibilityViewIsModal={index === entries.length - 1}
            key={entry.key}
            pointerEvents="box-none"
            style={[styles.layer, { zIndex: 1000 + index }]}
          >
            {entry.node}
          </View>
        ))}
      </View>
    </OverlayHostContext.Provider>
  );
}

export function OverlayPortal({
  blurBackground = false,
  children,
  name,
  onRequestClose,
  visible,
}: PropsWithChildren<{
  name: string;
  blurBackground?: boolean;
  onRequestClose?: () => void;
  visible: boolean;
}>) {
  const host = useContext(OverlayHostContext);

  if (!host) {
    throw new Error('OverlayPortal 必须在 OverlayHostProvider 内使用');
  }

  useLayoutEffect(() => {
    if (visible) {
      host.present({
        key: name,
        node: children,
        blurBackground,
        onRequestClose,
      });
    } else {
      host.dismiss(name);
    }
  }, [blurBackground, children, host, name, onRequestClose, visible]);

  useEffect(
    () => () => {
      host.dismiss(name);
    },
    [host, name],
  );

  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  blurredContent: {
    filter: [{ blur: 5 }],
    transform: [{ scale: 1.012 }],
  },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
