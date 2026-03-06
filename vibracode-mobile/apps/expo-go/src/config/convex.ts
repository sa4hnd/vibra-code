import { ConvexReactClient } from 'convex/react';

import { ENV } from './env';

// Create Convex client using the same URL as v0-clone
const convex = new ConvexReactClient(ENV.CONVEX_URL!);

export default convex;
