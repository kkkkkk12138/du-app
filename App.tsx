import React from 'react';
import {DatabaseProvider} from '@nozbe/watermelondb/react';
import {StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AppBootstrap} from './src/components/AppBootstrap';
import {OverlayHostProvider} from './src/components/OverlayHost';
import {ToastProvider} from './src/components/Toast';
import {database} from './src/db/database';
import {AccountSessionBootstrap} from './src/features/account/AccountSessionBootstrap';
import {RootNavigator} from './src/navigation/RootNavigator';
import {ThemeProvider} from './src/theme/ThemeProvider';

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <DatabaseProvider database={database}>
          <ThemeProvider>
            <ToastProvider>
              <OverlayHostProvider>
                <AppBootstrap>
                  <AccountSessionBootstrap>
                    <RootNavigator />
                  </AccountSessionBootstrap>
                </AppBootstrap>
              </OverlayHostProvider>
            </ToastProvider>
          </ThemeProvider>
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
});

export default App;
