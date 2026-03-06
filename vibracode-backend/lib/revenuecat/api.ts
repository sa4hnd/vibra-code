/**
 * RevenueCat REST API Client
 *
 * Calls the GET /v1/subscribers/{app_user_id} endpoint
 * @see https://www.revenuecat.com/docs/api-v1
 */

import { RevenueCatSubscriberResponse } from './types';

const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';

/**
 * Fetch subscriber data from RevenueCat REST API
 *
 * This is the recommended approach per RevenueCat docs:
 * "We recommend calling the GET /subscribers REST API endpoint after
 * receiving any webhook. That way, the customer's information is always
 * in the same format and is easily synced to your database."
 */
export async function getSubscriber(appUserId: string): Promise<RevenueCatSubscriberResponse> {
  const apiKey = process.env.REVENUECAT_API_KEY;

  if (!apiKey) {
    console.warn('RevenueCat not configured - REVENUECAT_API_KEY not set');
    throw new Error('REVENUECAT_API_KEY environment variable not set');
  }

  const url = `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`;

  console.log(`[RevenueCat API] Fetching subscriber: ${appUserId}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Note: Do NOT include X-Platform header with secret keys
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[RevenueCat API] Error ${response.status}: ${errorText}`);
    throw new Error(`RevenueCat API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[RevenueCat API] Successfully fetched subscriber: ${appUserId}`);

  return data;
}

/**
 * Fetch subscriber with retry logic
 * Useful when called immediately after a webhook (data may not be fully processed)
 */
export async function getSubscriberWithRetry(
  appUserId: string,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<RevenueCatSubscriberResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await getSubscriber(appUserId);
    } catch (error) {
      lastError = error as Error;
      console.warn(`[RevenueCat API] Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError || new Error('Failed to fetch subscriber after retries');
}
