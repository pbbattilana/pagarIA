/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import BubbleRoot from './src/bubble/BubbleRoot';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('SplitPayBubble', () => BubbleRoot);