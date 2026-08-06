/**
 * @format
 */

import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { configureNativeText } from './src/platform/configureNativeText';

configureNativeText();

AppRegistry.registerComponent(appName, () => App);
