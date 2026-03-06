// CUSTOM TAB BAR - COMMENTED OUT - USING NATIVE TAB BAR INSTEAD
/*
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, User, Rocket } from 'lucide-react-native';
import { HomeStackScreen } from './Navigation';
import { VibraCreateAppScreen } from '../screens/VibraCreateAppScreen';
import { VibraProfileScreen } from '../screens/VibraProfileScreen';
import { VibraColors } from '../constants/VibraColors';

const Tab = createBottomTabNavigator();


export function VibraTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: VibraColors.neutral.text,
        tabBarInactiveTintColor: VibraColors.neutral.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: 3,
        },
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          height: 75,
          backgroundColor: VibraColors.surface.card,
          borderTopWidth: 1,
          borderTopColor: VibraColors.neutral.border,
          paddingBottom: 28,
          paddingTop: 6,
          paddingHorizontal: 20,
          shadowColor: VibraColors.shadow.card,
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 10,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
      }}
      initialRouteName="Home"
    >
      <Tab.Screen
        name="Home"
        component={HomeStackScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[
              styles.tabIconContainer,
              { backgroundColor: focused ? VibraColors.neutral.text + '15' : 'transparent' }
            ]}>
              <Home 
                size={22} 
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="CreateApp"
        component={VibraCreateAppScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: VibraColors.neutral.text,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
                borderWidth: 1,
                borderColor: VibraColors.neutral.border,
              }}
            >
              <Rocket 
                size={24} 
                color={VibraColors.neutral.background}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={VibraProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[
              styles.tabIconContainer,
              { backgroundColor: focused ? VibraColors.neutral.text + '15' : 'transparent' }
            ]}>
              <User 
                size={22} 
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
});

export default VibraTabNavigator;
*/
