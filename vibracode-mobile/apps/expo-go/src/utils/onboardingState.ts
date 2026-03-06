import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY = 'vibra_onboarding_completed';
const FIRST_LAUNCH_KEY = 'vibra_first_launch';

/**
 * Onboarding State Manager
 * Tracks whether user has completed onboarding and manages first-time user experience
 */

export interface OnboardingState {
  hasCompletedOnboarding: boolean;
  isFirstLaunch: boolean;
  lastCompletedDate?: Date;
}

/**
 * Get current onboarding state
 */
export const getOnboardingState = async (): Promise<OnboardingState> => {
  try {
    const [hasCompleted, isFirstLaunch, lastCompleted] = await Promise.all([
      AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY),
      AsyncStorage.getItem(FIRST_LAUNCH_KEY),
      AsyncStorage.getItem(`${ONBOARDING_COMPLETED_KEY}_date`),
    ]);

    return {
      hasCompletedOnboarding: hasCompleted === 'true',
      isFirstLaunch: isFirstLaunch !== 'false', // Default to true if not set
      lastCompletedDate: lastCompleted ? new Date(lastCompleted) : undefined,
    };
  } catch (error) {
    console.error('Error getting onboarding state:', error);
    return {
      hasCompletedOnboarding: false,
      isFirstLaunch: true,
    };
  }
};

/**
 * Mark onboarding as completed
 */
export const markOnboardingCompleted = async (): Promise<void> => {
  try {
    const now = new Date().toISOString();
    await Promise.all([
      AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true'),
      AsyncStorage.setItem(`${ONBOARDING_COMPLETED_KEY}_date`, now),
      AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'false'),
    ]);
    console.log('✅ Onboarding marked as completed');
  } catch (error) {
    console.error('Error marking onboarding as completed:', error);
  }
};

/**
 * Reset onboarding state (useful for testing)
 */
export const resetOnboardingState = async (): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY),
      AsyncStorage.removeItem(`${ONBOARDING_COMPLETED_KEY}_date`),
      AsyncStorage.removeItem(FIRST_LAUNCH_KEY),
    ]);
    console.log('🔄 Onboarding state reset');
  } catch (error) {
    console.error('Error resetting onboarding state:', error);
  }
};

/**
 * Check if user should see onboarding
 */
export const shouldShowOnboarding = async (): Promise<boolean> => {
  const state = await getOnboardingState();

  // Show onboarding if:
  // 1. It's the first launch, OR
  // 2. User hasn't completed onboarding
  const shouldShow = state.isFirstLaunch || !state.hasCompletedOnboarding;

  console.log('🤔 Should show onboarding?', {
    shouldShow,
    isFirstLaunch: state.isFirstLaunch,
    hasCompleted: state.hasCompletedOnboarding,
  });

  return shouldShow;
};
