import { Platform } from 'react-native';

// Native asset sources for iOS (embedded in app bundle for instant loading)
// These are added to Images.xcassets and load instantly without network
// On Android/dev: falls back to require() assets from JS bundle
export const NATIVE_ONBOARDING_ASSETS = {
  welcomeBg:
    Platform.OS === 'ios'
      ? { uri: 'OnboardingWelcomeBg' }
      : require('../../../assets/onboarding/screen0/welcome_bg.png'),
  state1:
    Platform.OS === 'ios'
      ? { uri: 'OnboardingState1' }
      : require('../../../assets/onboarding/screen4/state1_inspiration.png'),
  state2:
    Platform.OS === 'ios'
      ? { uri: 'OnboardingState2' }
      : require('../../../assets/onboarding/screen4/state2_rough_idea.png'),
  state3:
    Platform.OS === 'ios'
      ? { uri: 'OnboardingState3' }
      : require('../../../assets/onboarding/screen4/state3_ready.png'),
  screen5:
    Platform.OS === 'ios'
      ? { uri: 'OnboardingScreen5' }
      : require('../../../assets/onboarding/screen5/IMG_5333.jpg'),
};
