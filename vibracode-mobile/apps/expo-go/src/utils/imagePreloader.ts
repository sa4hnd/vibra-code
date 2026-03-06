import { Image } from 'react-native';

/**
 * Image Preloader Utility
 * Preloads images and caches them for instant display
 */

// List of onboarding image URLs
export const ONBOARDING_IMAGES = {
  screen1: 'https://i.imgur.com/D5S4a22.png',
  screen2: 'https://i.imgur.com/aUVBWTd.png',
  screen3: 'https://i.imgur.com/jfFmH88.png',
  screen4: 'https://i.imgur.com/X03kfCx.png',
} as const;

// Cache to track preloaded images
const preloadedImages = new Set<string>();

/**
 * Preload a single image
 */
export const preloadImage = async (uri: string): Promise<boolean> => {
  try {
    if (preloadedImages.has(uri)) {
      console.log(`✅ Image already preloaded: ${uri}`);
      return true;
    }

    console.log(`🔄 Preloading image: ${uri}`);
    await Image.prefetch(uri);
    preloadedImages.add(uri);
    console.log(`✅ Image preloaded successfully: ${uri}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to preload image: ${uri}`, error);
    return false;
  }
};

/**
 * Preload all onboarding images
 */
export const preloadOnboardingImages = async (): Promise<{
  success: number;
  failed: number;
  total: number;
}> => {
  console.log('🚀 Starting onboarding images preload...');

  const imageUrls = Object.values(ONBOARDING_IMAGES);
  const results = await Promise.allSettled(imageUrls.map((uri) => preloadImage(uri)));

  const success = results.filter(
    (result) => result.status === 'fulfilled' && result.value === true
  ).length;

  const failed = results.length - success;

  console.log(`📊 Preload complete: ${success}/${results.length} images loaded successfully`);

  return {
    success,
    failed,
    total: results.length,
  };
};

/**
 * Check if an image is preloaded
 */
export const isImagePreloaded = (uri: string): boolean => {
  return preloadedImages.has(uri);
};

/**
 * Get preload status for all onboarding images
 */
export const getPreloadStatus = () => {
  return {
    screen1: isImagePreloaded(ONBOARDING_IMAGES.screen1),
    screen2: isImagePreloaded(ONBOARDING_IMAGES.screen2),
    screen3: isImagePreloaded(ONBOARDING_IMAGES.screen3),
    screen4: isImagePreloaded(ONBOARDING_IMAGES.screen4),
  };
};

/**
 * Clear preload cache (useful for testing or memory management)
 */
export const clearPreloadCache = (): void => {
  preloadedImages.clear();
  console.log('🧹 Preload cache cleared');
};
