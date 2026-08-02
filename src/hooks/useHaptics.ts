import {useCallback} from 'react';
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';

export type DuHaptic =
  | 'button'
  | 'card'
  | 'seal'
  | 'envelopeOpen'
  | 'record'
  | 'letterArrived'
  | 'selection';

const hapticMap: Record<DuHaptic, HapticFeedbackTypes> = {
  button: HapticFeedbackTypes.impactLight,
  card: HapticFeedbackTypes.impactLight,
  seal: HapticFeedbackTypes.impactHeavy,
  envelopeOpen: HapticFeedbackTypes.notificationSuccess,
  record: HapticFeedbackTypes.impactMedium,
  letterArrived: HapticFeedbackTypes.notificationSuccess,
  selection: HapticFeedbackTypes.selection,
};

const options = {
  enableVibrateFallback: false,
  ignoreAndroidSystemSettings: false,
};

export function useHaptics() {
  const trigger = useCallback((type: DuHaptic) => {
    ReactNativeHapticFeedback.trigger(hapticMap[type], options);
  }, []);

  return {trigger};
}
