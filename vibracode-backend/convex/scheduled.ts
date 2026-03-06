import { cronJobs } from 'convex/server';

import { api } from './_generated/api';

/**
 * SCHEDULED JOBS - Single responsibility: Background tasks and maintenance
 * This file handles scheduled jobs for billing, cleanup, and maintenance
 */

const crons = cronJobs();

// Run every day at 2 AM UTC to check for expired billing periods
crons.daily(
  'expire billing periods',
  { hourUTC: 2, minuteUTC: 0 },
  api.billing.expireBillingPeriods
);

export default crons;
