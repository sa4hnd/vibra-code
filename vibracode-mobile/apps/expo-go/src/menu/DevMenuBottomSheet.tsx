import BottomSheet, { BottomSheetView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TouchableWithoutFeedback, Keyboard } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import DevMenuBottomSheetContext from './DevMenuBottomSheetContext';
import * as DevMenu from './DevMenuModule';
import { VibraBorderRadius } from '../constants/VibraColors';

type Props = {
  uuid: string;
  children?: React.ReactNode;
};

function Backdrop({ onPress }: { onPress: () => void }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(0.5, { duration: 350 });
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <Animated.View style={[styles.backdrop, animatedStyle]} />
    </TouchableWithoutFeedback>
  );
}

function DevMenuBottomSheet({ children, uuid }: Props) {
  const bottomSheetRef = useRef<BottomSheet | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
      // Force expand to full screen when keyboard opens
      setTimeout(() => {
        bottomSheetRef.current?.expand();
      }, 200);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
      // Collapse to normal size when keyboard closes
      setTimeout(() => {
        bottomSheetRef.current?.snapToIndex(0);
      }, 200);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const onCollapse = useCallback(
    () =>
      new Promise<void>((resolve) => {
        bottomSheetRef.current?.close();

        setTimeout(() => {
          resolve();
          DevMenu.closeAsync();
        }, 300);
      }),
    []
  );

  const onExpand = useCallback(
    () =>
      new Promise<void>((resolve) => {
        bottomSheetRef.current?.expand();
        setTimeout(() => {
          resolve();
        }, 300);
      }),
    []
  );

  const onChange = useCallback((index: number) => {
    if (index === -1) {
      DevMenu.closeAsync();
    }
  }, []);

  useEffect(() => {
    const closeSubscription = DevMenu.listenForCloseRequests(() => {
      bottomSheetRef.current?.collapse();
      return new Promise<void>((resolve) => {
        resolve();
      });
    });
    return () => {
      closeSubscription.remove();
    };
  }, []);

  const onBackdropPress = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  const animationConfigs = useBottomSheetSpringConfigs({
    duration: 350,
    dampingRatio: 0.8,
    overshootClamping: true,
    stiffness: 250,
  });

  // Multiple snap points - we'll programmatically snap to different indices
  const snapPoints = ['85%', '100%'];

  return (
    <View style={styles.bottomSheetContainer}>
      <Backdrop onPress={onBackdropPress} />
      <BottomSheet
        key={uuid}
        snapPoints={snapPoints}
        index={0}
        ref={bottomSheetRef}
        handleComponent={null}
        animationConfigs={animationConfigs}
        backgroundStyle={styles.bottomSheetBackground}
        enablePanDownToClose
        keyboardBehavior="none"
        android_keyboardInputMode="adjustResize"
        onChange={onChange}>
        <DevMenuBottomSheetContext.Provider value={{ collapse: onCollapse, expand: onExpand }}>
          <BottomSheetView style={styles.contentContainerStyle}>
            <LinearGradient
              colors={[
                '#0A0A0F', // Deep dark base
                '#1A1A20', // Slightly lighter
                '#2A2A35', // Medium dark
                '#1A1A20', // Back to lighter
                '#0A0A0F', // Deep dark again
              ]}
              locations={[0, 0.2, 0.5, 0.8, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientBackground}>
              <View style={styles.glassOverlay} />
              {children}
            </LinearGradient>
          </BottomSheetView>
        </DevMenuBottomSheetContext.Provider>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  bottomSheetContainer: {
    flex: 1,
  },
  contentContainerStyle: {
    flex: 1,
  },
  bottomSheetBackground: {
    backgroundColor: 'transparent',
  },
  gradientBackground: {
    flex: 1,
    borderTopLeftRadius: VibraBorderRadius['2xl'],
    borderTopRightRadius: VibraBorderRadius['2xl'],
    overflow: 'hidden',
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    shadowColor: 'rgba(255, 255, 255, 0.05)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
    elevation: 0,
  },
});

export default DevMenuBottomSheet;
