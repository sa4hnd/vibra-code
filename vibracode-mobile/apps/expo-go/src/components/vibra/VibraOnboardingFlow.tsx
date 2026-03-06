import { Asset } from 'expo-asset';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, Image } from 'react-native';

import { NewOnboardingScreen0 } from './onboarding/NewOnboardingScreen0';
import { NewOnboardingScreen1 } from './onboarding/NewOnboardingScreen1';
import { NewOnboardingScreen10 } from './onboarding/NewOnboardingScreen10';
import { NewOnboardingScreen11 } from './onboarding/NewOnboardingScreen11';
import { NewOnboardingScreen12 } from './onboarding/NewOnboardingScreen12';
import { NewOnboardingScreen13 } from './onboarding/NewOnboardingScreen13';
import { NewOnboardingScreen14 } from './onboarding/NewOnboardingScreen14';
import { NewOnboardingScreen15 } from './onboarding/NewOnboardingScreen15';
import { NewOnboardingScreen2 } from './onboarding/NewOnboardingScreen2';
import { NewOnboardingScreen3 } from './onboarding/NewOnboardingScreen3';
import { NewOnboardingScreen4 } from './onboarding/NewOnboardingScreen4';
import { NewOnboardingScreen5 } from './onboarding/NewOnboardingScreen5';
import { NewOnboardingScreen6 } from './onboarding/NewOnboardingScreen6';
import { NewOnboardingScreen7 } from './onboarding/NewOnboardingScreen7';
import { NewOnboardingScreen8 } from './onboarding/NewOnboardingScreen8';
import { NewOnboardingScreen9 } from './onboarding/NewOnboardingScreen9';
import { ScreenTransitions, OnboardingColors } from './onboarding/OnboardingConstants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fallback JS bundle assets (for dev/Android or if native asset fails)
const ONBOARDING_IMAGES = [
  require('./onboarding/../../../assets/onboarding/screen4/state1_inspiration.png'),
  require('./onboarding/../../../assets/onboarding/screen4/state2_rough_idea.png'),
  require('./onboarding/../../../assets/onboarding/screen4/state3_ready.png'),
  require('./onboarding/../../../assets/onboarding/screen5/IMG_5333.jpg'),
];

interface VibraOnboardingFlowProps {
  onComplete: () => void;
}

export const VibraOnboardingFlow: React.FC<VibraOnboardingFlowProps> = ({ onComplete }) => {
  // Start at screen 0 (Welcome/Login screen)
  const [currentScreen, setCurrentScreen] = useState(0);
  // Track the previous screen for outgoing animation
  const [previousScreen, setPreviousScreen] = useState<number | null>(null);
  // Store session data from screen 12
  const [sessionData, setSessionData] = useState<{ sessionId: string; prompt: string } | null>(
    null
  );
  // Store app name from screen 13
  const [appName, setAppName] = useState<string>('');

  // Preload images on mount
  useEffect(() => {
    const preloadImages = async () => {
      try {
        // Use Asset.loadAsync for all images
        await Asset.loadAsync(ONBOARDING_IMAGES);
        // Also prefetch with Image.prefetch for additional caching
        const imageUris = ONBOARDING_IMAGES.map((img) => Image.resolveAssetSource(img).uri);
        await Promise.all(imageUris.map((uri) => Image.prefetch(uri)));
      } catch (error) {
        console.warn('Failed to preload onboarding images:', error);
      }
    };
    preloadImages();
  }, []);

  // Animation values for incoming screen
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Animation values for outgoing screen
  const outgoingSlideAnim = useRef(new Animated.Value(0)).current;
  const outgoingOpacity = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);

  // Get transition type for a screen
  const getTransitionType = (screenNumber: number) => {
    const transition = ScreenTransitions[screenNumber] || 'slide';
    return transition;
  };

  // Animate screen transition with both incoming and outgoing animations
  const animateTransition = useCallback(
    (toScreen: number, fromScreen: number, isGoingBack: boolean, callback: () => void) => {
      if (isAnimating.current) return;
      isAnimating.current = true;

      const transition = getTransitionType(toScreen);

      // Reset outgoing animation values
      outgoingSlideAnim.setValue(0);
      outgoingOpacity.setValue(1);

      if (transition === 'slideUp') {
        // Slide up from bottom - incoming starts below screen
        slideAnim.setValue(SCREEN_HEIGHT);

        // Animate both screens together
        Animated.parallel([
          // Incoming screen slides up
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 50,
            friction: 10,
            useNativeDriver: true,
          }),
          // Outgoing screen fades and scales slightly
          Animated.timing(outgoingOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          isAnimating.current = false;
          setPreviousScreen(null);
          callback();
        });
      } else {
        // Horizontal swipe
        const incomingStartX = isGoingBack ? -SCREEN_WIDTH : SCREEN_WIDTH;
        const outgoingEndX = isGoingBack ? SCREEN_WIDTH * 0.3 : -SCREEN_WIDTH * 0.3;

        slideAnim.setValue(incomingStartX);

        // Animate both screens together
        Animated.parallel([
          // Incoming screen slides in
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }),
          // Outgoing screen slides out slightly and fades
          Animated.timing(outgoingSlideAnim, {
            toValue: outgoingEndX,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(outgoingOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          isAnimating.current = false;
          setPreviousScreen(null);
          callback();
        });
      }
    },
    [slideAnim, outgoingSlideAnim, outgoingOpacity]
  );

  const handleNext = useCallback(() => {
    if (currentScreen < 15) {
      const nextScreen = currentScreen + 1;
      setPreviousScreen(currentScreen);
      setCurrentScreen(nextScreen);
      animateTransition(nextScreen, currentScreen, false, () => {});
    } else {
      onComplete();
    }
  }, [currentScreen, animateTransition, onComplete]);

  const handleBack = useCallback(() => {
    // Don't allow going back from screen 1 to screen 0 (login)
    if (currentScreen > 1) {
      const prevScreen = currentScreen - 1;
      setPreviousScreen(currentScreen);
      setCurrentScreen(prevScreen);
      animateTransition(prevScreen, currentScreen, true, () => {});
    }
  }, [currentScreen, animateTransition]);

  // Handle login completion from screen 0
  const handleLoginComplete = useCallback(
    (isNewUser: boolean) => {
      if (isNewUser) {
        // New user - continue to onboarding screen 1
        setPreviousScreen(0);
        setCurrentScreen(1);
        animateTransition(1, 0, false, () => {});
      } else {
        // Existing user - skip onboarding entirely
        onComplete();
      }
    },
    [animateTransition, onComplete]
  );

  // Handle screen 12 completion - stores session data and moves to next screen
  const handleScreen12Next = useCallback(
    (sessionId: string, prompt: string) => {
      setSessionData({ sessionId, prompt });
      setPreviousScreen(12);
      setCurrentScreen(13);
      animateTransition(13, 12, false, () => {});
    },
    [animateTransition]
  );

  // Handle screen 13 completion - stores app name and moves to next screen
  const handleScreen13Next = useCallback(
    (name: string) => {
      setAppName(name);
      setPreviousScreen(13);
      setCurrentScreen(14);
      animateTransition(14, 13, false, () => {});
    },
    [animateTransition]
  );

  // Handle screen 14 completion - moves to screen 15 (generation)
  const handleScreen14Next = useCallback(() => {
    setPreviousScreen(14);
    setCurrentScreen(15);
    animateTransition(15, 14, false, () => {});
  }, [animateTransition]);

  const renderScreen = (screenNum: number) => {
    switch (screenNum) {
      case 0:
        return <NewOnboardingScreen0 onLoginComplete={handleLoginComplete} />;
      case 1:
        return <NewOnboardingScreen1 onNext={handleNext} onBack={handleBack} />;
      case 2:
        return <NewOnboardingScreen2 onNext={handleNext} onBack={handleBack} />;
      case 3:
        return <NewOnboardingScreen3 onNext={handleNext} onBack={handleBack} />;
      case 4:
        return <NewOnboardingScreen4 onNext={handleNext} onBack={handleBack} />;
      case 5:
        return <NewOnboardingScreen5 onNext={handleNext} onBack={handleBack} />;
      case 6:
        return <NewOnboardingScreen6 onNext={handleNext} onBack={handleBack} />;
      case 7:
        return <NewOnboardingScreen7 onNext={handleNext} onBack={handleBack} />;
      case 8:
        return <NewOnboardingScreen8 onNext={handleNext} onBack={handleBack} />;
      case 9:
        return <NewOnboardingScreen9 onNext={handleNext} onBack={handleBack} />;
      case 10:
        return <NewOnboardingScreen10 onNext={handleNext} onBack={handleBack} />;
      case 11:
        return <NewOnboardingScreen11 onNext={handleNext} onBack={handleBack} />;
      case 12:
        return <NewOnboardingScreen12 onNext={handleScreen12Next} onBack={handleBack} />;
      case 13:
        return (
          <NewOnboardingScreen13
            onNext={handleScreen13Next}
            onBack={handleBack}
            sessionId={sessionData?.sessionId}
            prompt={sessionData?.prompt}
          />
        );
      case 14:
        return <NewOnboardingScreen14 onComplete={handleScreen14Next} onBack={handleBack} />;
      case 15:
        return (
          <NewOnboardingScreen15
            onComplete={onComplete}
            onBack={handleBack}
            sessionId={sessionData?.sessionId}
            prompt={sessionData?.prompt}
            appName={appName}
          />
        );
      default:
        return <NewOnboardingScreen0 onLoginComplete={handleLoginComplete} />;
    }
  };

  // Determine if this is a slideUp screen
  const isSlideUpScreen = [3, 5, 9].includes(currentScreen);

  // Get the appropriate transform based on screen type
  const getTransformStyle = () => {
    if (isSlideUpScreen) {
      return { transform: [{ translateY: slideAnim }] };
    }
    return { transform: [{ translateX: slideAnim }] };
  };

  // Get outgoing transform style
  const getOutgoingTransformStyle = () => {
    if (isSlideUpScreen) {
      return { transform: [{ translateY: outgoingSlideAnim }] };
    }
    return { transform: [{ translateX: outgoingSlideAnim }] };
  };

  return (
    <View style={styles.container}>
      {/* Outgoing screen (previous) - rendered behind */}
      {previousScreen !== null && (
        <Animated.View
          style={[
            styles.screenContainer,
            styles.absoluteFill,
            getOutgoingTransformStyle(),
            { opacity: outgoingOpacity },
          ]}>
          {renderScreen(previousScreen)}
        </Animated.View>
      )}

      {/* Incoming screen (current) - rendered on top */}
      <Animated.View style={[styles.screenContainer, getTransformStyle()]}>
        {renderScreen(currentScreen)}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: OnboardingColors.background.primary,
  },
  screenContainer: {
    flex: 1,
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default VibraOnboardingFlow;
