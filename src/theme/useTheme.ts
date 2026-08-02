import {useContext} from 'react';

import {ThemeContext} from './ThemeProvider';

export function useTheme() {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useTheme 必须在 ThemeProvider 内使用');
  }

  return theme;
}
