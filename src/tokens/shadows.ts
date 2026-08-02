import {Platform, ViewStyle} from 'react-native';

export const shadows: Record<'paper' | 'deep' | 'seal', ViewStyle> = {
  paper: Platform.select({
    ios: {
      shadowColor: '#3A332D',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    android: {elevation: 2},
    default: {},
  }),
  deep: Platform.select({
    ios: {
      shadowColor: '#3A332D',
      shadowOffset: {width: 0, height: 6},
      shadowOpacity: 0.1,
      shadowRadius: 12,
    },
    android: {elevation: 5},
    default: {},
  }),
  seal: Platform.select({
    ios: {
      shadowColor: '#C0392B',
      shadowOffset: {width: 0, height: 3},
      shadowOpacity: 0.25,
      shadowRadius: 6,
    },
    android: {elevation: 6},
    default: {},
  }),
};
