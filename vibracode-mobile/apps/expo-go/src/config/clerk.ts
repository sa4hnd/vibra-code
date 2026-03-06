import { ClerkProvider } from '@clerk/clerk-expo';

import { ENV } from './env';

// Get the publishable key from environment variables
const publishableKey = ENV.CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  console.warn(
    'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env file'
  );
}

export { publishableKey };
export { ClerkProvider };
