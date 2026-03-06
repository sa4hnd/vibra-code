import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';

import * as DevMenu from './DevMenuModule';
import { VibraColors } from '../constants/VibraColors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FloatingMenuButtonProps {
  visible?: boolean;
}

export const FloatingMenuButton: React.FC<FloatingMenuButtonProps> = ({ visible = false }) => {
  console.log('FloatingMenuButton render: visible =', visible);

  const [buttonWidth, setButtonWidth] = useState(60);
  const [buttonHeight, setButtonHeight] = useState(40);
  const [isDocked, setIsDocked] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(screenHeight / 2 - 40)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    // Force visible for testing
    opacity.setValue(1);
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDocked(false);
        Animated.spring(scale, {
          toValue: 1.1,
          useNativeDriver: true,
        }).start();
        setButtonWidth(60);
        setButtonHeight(40);
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
        translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();

        let finalX = gestureState.dx;
        const finalY = gestureState.dy;

        // Dock to edges if close enough
        if (gestureState.moveX < 50) {
          finalX = -screenWidth / 2 + 30;
          setButtonWidth(20);
          setButtonHeight(80);
          setIsDocked(true);
        } else if (gestureState.moveX > screenWidth - 50) {
          finalX = screenWidth / 2 - 30;
          setButtonWidth(20);
          setButtonHeight(80);
          setIsDocked(true);
        } else {
          setIsDocked(false);
        }

        Animated.parallel([
          Animated.spring(translateX, {
            toValue: finalX,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: finalY,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  const handlePress = async () => {
    try {
      await DevMenu.openAsync();
    } catch (error) {
      console.error('Failed to open dev menu:', error);
    }
  };

  if (false) {
    // Always show for testing
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX }, { translateY }, { scale }],
          opacity,
        },
      ]}
      pointerEvents="auto"
      {...panResponder.panHandlers}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            width: buttonWidth,
            height: buttonHeight,
            borderRadius: isDocked && buttonWidth < buttonHeight ? 10 : 20,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}>
        <LinearGradient
          colors={[VibraColors.accent.purple, VibraColors.accent.blue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.buttonGradient,
            {
              borderRadius: isDocked && buttonWidth < buttonHeight ? 10 : 20,
            },
          ]}>
          {!isDocked || buttonWidth >= buttonHeight ? (
            <Text style={styles.text}>MENU</Text>
          ) : (
            <View style={styles.dockedLine} />
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: screenWidth / 2 - 30,
    top: screenHeight / 2 - 20,
    zIndex: 999,
    backgroundColor: 'rgba(255,0,0,0.3)', // Debug background
  },
  button: {
    elevation: 8,
    shadowColor: VibraColors.accent.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dockedLine: {
    width: 2,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
});

export default FloatingMenuButton;
