import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {ToastProvider} from './src/components/Toast';
import {RootNavigator} from './src/navigation/RootNavigator';
import {ThemeProvider} from './src/theme/ThemeProvider';

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
