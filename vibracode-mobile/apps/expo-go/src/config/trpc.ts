import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';

import { ENV } from './env';

// For now, we'll create a basic AppRouter type
// Later, we'll import the actual type from the Vibra web app
type AppRouter = any;

// Create the tRPC client
export const trpc = createTRPCReact<AppRouter>();

// Get the API URL from environment variables
const API_URL = ENV.API_URL;

export const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      // Add authentication headers here
      headers() {
        return {
          // We'll add the auth token here when we implement auth
        };
      },
    }),
  ],
});
