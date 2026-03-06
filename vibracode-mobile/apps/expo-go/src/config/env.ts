// Environment configuration for Vibra Expo Go app
// Make sure to set these environment variables in your .env file

export const ENV = {
  // Clerk Authentication - Use SAME Clerk instance as v0-clone
  CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '',

  // Convex Database - Use SAME Convex database as v0-clone
  CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL || '',

  // Convex OAuth - Use SAME OAuth credentials as v0-clone
  CONVEX_OAUTH_CLIENT_ID: process.env.EXPO_PUBLIC_CONVEX_OAUTH_CLIENT_ID || '',

  // V0-Clone API - Backend API for creating sessions
  V0_API_URL: process.env.EXPO_PUBLIC_V0_API_URL || '',
} as const;

// Validate required environment variables
if (!ENV.CLERK_PUBLISHABLE_KEY) {
  console.warn('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Authentication will not work.');
}

if (!ENV.CONVEX_URL) {
  console.warn('EXPO_PUBLIC_CONVEX_URL is not set. Database will not work.');
}

if (!ENV.V0_API_URL) {
  console.warn('EXPO_PUBLIC_V0_API_URL is not set. v0-clone backend will not work.');
}

// Debug logging
console.log('🔧 Environment Configuration:', {
  CLERK_PUBLISHABLE_KEY: ENV.CLERK_PUBLISHABLE_KEY ? '✅ Set' : '❌ Missing',
  CONVEX_URL: ENV.CONVEX_URL ? '✅ Set' : '❌ Missing',
  V0_API_URL: ENV.V0_API_URL ? '✅ Set' : '❌ Missing',
  V0_API_URL_VALUE: ENV.V0_API_URL,
});
