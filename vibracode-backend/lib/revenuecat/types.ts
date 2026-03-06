/**
 * RevenueCat API Response Types
 *
 * Types for the GET /v1/subscribers/{app_user_id} endpoint
 * @see https://www.revenuecat.com/docs/api-v1
 */

// Response from GET /v1/subscribers/{app_user_id}
export interface RevenueCatSubscriberResponse {
  request_date: string;
  request_date_ms: number;
  subscriber: RevenueCatSubscriber;
}

export interface RevenueCatSubscriber {
  entitlements: Record<string, RevenueCatEntitlement>;
  subscriptions: Record<string, RevenueCatSubscription>;
  non_subscriptions: Record<string, RevenueCatNonSubscription[]>;
  original_app_user_id: string;
  first_seen: string;
  last_seen?: string;
  original_application_version?: string | null;
  original_purchase_date?: string;
  management_url?: string | null;
  subscriber_attributes?: Record<string, { value: string; updated_at_ms: number }>;
}

export interface RevenueCatEntitlement {
  expires_date: string | null;
  grace_period_expires_date: string | null;
  product_identifier: string;
  product_plan_identifier?: string;
  purchase_date: string;
}

export interface RevenueCatSubscription {
  expires_date: string;
  original_purchase_date: string;
  purchase_date: string;
  original_transaction_id: string;
  store: 'app_store' | 'play_store' | 'stripe' | 'promotional' | 'amazon' | 'rc_billing';
  is_sandbox: boolean;
  unsubscribe_detected_at: string | null;
  billing_issues_detected_at: string | null;
  grace_period_expires_date: string | null;
  refunded_at?: string | null;
  ownership_type?: 'PURCHASED' | 'FAMILY_SHARED';
  period_type?: 'normal' | 'trial' | 'intro';
  auto_resume_date?: string | null;
}

export interface RevenueCatNonSubscription {
  id: string;
  is_sandbox: boolean;
  original_purchase_date: string;
  purchase_date: string;
  store: string;
}

// Internal sync result type
export interface SyncResult {
  userId: string;
  plan: string;
  status: 'active' | 'canceled' | 'expired' | 'past_due' | 'paused' | 'inactive';
  expiresAt: number | null;
  transactionId: string | null;
  willRenew: boolean;
  isTrialPeriod: boolean;
  productId: string | null;
  tokensGranted?: boolean;
  oldPlan?: string;
}

// Parsed subscriber data (before database sync)
export type ParsedSubscriberData = Omit<SyncResult, 'tokensGranted' | 'oldPlan'>;
