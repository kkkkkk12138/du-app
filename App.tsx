import React from 'react';
import {DatabaseProvider} from '@nozbe/watermelondb/react';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AppBootstrap} from './src/components/AppBootstrap';
import {ToastProvider} from './src/components/Toast';
import {database} from './src/db/database';
import {RootNavigator} from './src/navigation/RootNavigator';
import {ThemeProvider} from './src/theme/ThemeProvider';

function App() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider database={database}>
        <ThemeProvider>
          <ToastProvider>
            <AppBootstrap>
              <RootNavigator />
            </AppBootstrap>
          </ToastProvider>
        </ThemeProvider>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

export default App;
