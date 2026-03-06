import { useEffect, useState } from 'react';

import {
  preloadOnboardingImages,
  getPreloadStatus,
  ONBOARDING_IMAGES,
} from '../utils/imagePreloader';

/**
 * Hook to manage onboarding image preloading
 */
export const useOnboardingImagePreloader = () => {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadComplete, setPreloadComplete] = useState(false);
  const [preloadError, setPreloadError] = useState<string | null>(null);

  const startPreloading = async () => {
    if (isPreloading || preloadComplete) return;

    setIsPreloading(true);
    setPreloadError(null);
    setPreloadProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setPreloadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const result = await preloadOnboardingImages();

      clearInterval(progressInterval);
      setPreloadProgress(100);

      if (result.failed > 0) {
        setPreloadError(`${result.failed} images failed to load`);
      }

      setPreloadComplete(true);
    } catch (error) {
      setPreloadError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsPreloading(false);
    }
  };

  const getImageUri = (screen: keyof typeof ONBOARDING_IMAGES) => {
    return ONBOARDING_IMAGES[screen];
  };

  const isImageReady = (screen: keyof typeof ONBOARDING_IMAGES) => {
    const status = getPreloadStatus();
    return status[screen];
  };

  return {
    isPreloading,
    preloadProgress,
    preloadComplete,
    preloadError,
    startPreloading,
    getImageUri,
    isImageReady,
  };
};
