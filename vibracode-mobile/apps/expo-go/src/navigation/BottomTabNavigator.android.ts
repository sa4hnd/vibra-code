import { darkTheme, lightTheme } from '@expo/styleguide-native';
import { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { createMaterialBottomTabNavigator } from 'react-native-paper/react-navigation';

import Colors, { ColorTheme } from '../constants/Colors';

const BottomTabNavigator = createMaterialBottomTabNavigator();

export default BottomTabNavigator;

export const getNavigatorProps = (props: {
  theme: ColorTheme;
}): Partial<ComponentProps<typeof BottomTabNavigator.Navigator>> => ({
  shifting: true,
  activeColor: props.theme === 'dark' ? darkTheme.link.default : lightTheme.link.default,
  inactiveColor: props.theme === 'dark' ? darkTheme.icon.default : lightTheme.icon.default,
  barStyle: {
    display: 'none', // Hide the tab bar
  },
});
