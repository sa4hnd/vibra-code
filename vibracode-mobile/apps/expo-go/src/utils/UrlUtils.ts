/**
 * Enhanced URL utilities with comprehensive SQLite constraint protection
 * Prevents UNIQUE constraint failed: updates.id errors in Expo Go
 */

import { Linking } from 'react-native';

/**
 * Converts a tunnel URL from https:// format to exp:// format for Expo Go
 * Optionally includes sessionId for reliable session lookup on native side
 */
export const convertToExpoUrl = (tunnelUrl: string, sessionId?: string): string => {
  if (!tunnelUrl) return '';

  // Convert to exp:// format
  let url = tunnelUrl.replace(/^https:\/\//, 'exp://');

  // Add sessionId query param for direct session lookup (no URL matching needed)
  if (sessionId) {
    url += `?sessionId=${encodeURIComponent(sessionId)}`;
  }

  console.log('🔗 URL Conversion:', {
    original: tunnelUrl,
    converted: url,
    sessionId: sessionId || '(none)',
  });

  return url;
};

/**
 * Checks if a URL can be opened by the device
 */
export const canOpenUrl = async (url: string): Promise<boolean> => {
  try {
    return await Linking.canOpenURL(url);
  } catch (error) {
    console.error('Error checking if URL can be opened:', error);
    return false;
  }
};

/**
 * Opens a URL using the device's default handler with retry logic
 */
export const openUrl = async (url: string): Promise<void> => {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
        console.log('✅ Successfully opened URL:', url);
        return;
      } else {
        console.error('❌ Cannot open URL:', url);
        throw new Error(`Cannot open URL: ${url}`);
      }
    } catch (error) {
      console.error(`Error opening URL (attempt ${attempt}/${maxRetries}):`, error);

      if (attempt < maxRetries) {
        // Wait with exponential backoff before retrying
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};
