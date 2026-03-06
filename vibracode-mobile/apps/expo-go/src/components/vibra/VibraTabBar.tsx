import { BlurView } from 'expo-blur';
import { Plus, Home, User } from 'lucide-react-native';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VibraTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export const VibraTabBar: React.FC<VibraTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={80}
      style={[
        styles.tabBarContainer,
        {
          paddingBottom: insets.bottom + 12,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflow: 'hidden',
          backgroundColor: 'transparent',
        },
      ]}>
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          // Special handling for the plus button (middle tab)
          if (route.name === 'CreateApp') {
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.plusButtonContainer}
                activeOpacity={0.8}>
                <View style={styles.plusButton}>
                  <Plus size={28} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
              activeOpacity={0.7}>
              <View style={[styles.tabContent, isFocused && styles.tabContentFocused]}>
                {route.name === 'Home' && (
                  <Home
                    size={24}
                    color={isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)'}
                    strokeWidth={isFocused ? 2.5 : 2}
                  />
                )}
                {route.name === 'Profile' && (
                  <User
                    size={24}
                    color={isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)'}
                    strokeWidth={isFocused ? 2.5 : 2}
                  />
                )}
                <Text
                  style={[
                    styles.tabLabel,
                    isFocused ? styles.tabLabelFocused : styles.tabLabelInactive,
                  ]}>
                  {route.name === 'Home'
                    ? 'Home'
                    : route.name === 'Profile'
                      ? 'Profile'
                      : route.name}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    paddingTop: 12,
    paddingHorizontal: 24,
    borderTopWidth: 0.33,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 60,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 60,
  },
  tabContentFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: -0.1,
  },
  tabLabelFocused: {
    color: '#FFFFFF',
  },
  tabLabelInactive: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  plusButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E90FF', // Blue color to match your theme
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E90FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    // Subtle border for definition
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export default VibraTabBar;
