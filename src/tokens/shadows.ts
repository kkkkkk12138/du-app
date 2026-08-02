import {ViewStyle} from 'react-native';

type ShadowName = 'paper' | 'deep' | 'seal' | 'fab' | 'letter';

export const shadows: Record<ShadowName, ViewStyle> = {
  paper: {
    boxShadow:
      '0 1px 3px rgba(58,51,45,0.06), 0 4px 12px rgba(58,51,45,0.04)',
  },
  deep: {
    boxShadow:
      '0 2px 8px rgba(58,51,45,0.08), 0 8px 24px rgba(58,51,45,0.06)',
  },
  seal: {
    boxShadow:
      '0 3px 12px rgba(192,57,43,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  fab: {
    boxShadow: '0 6px 20px rgba(184,92,56,0.4)',
  },
  letter: {
    boxShadow:
      '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
  },
};
