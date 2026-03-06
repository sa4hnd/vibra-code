/**
 * Product ID to Plan ID Mapping
 *
 * Centralized mapping from RevenueCat product identifiers to internal plan IDs.
 * Used by both webhook handler and app sync service.
 */

// RevenueCat product ID → Internal plan ID
// Replace 'com.yourcompany.vibracode' with your own bundle ID for distribution
export const PRODUCT_TO_PLAN_MAP: Record<string, string> = {
  // Weekly plans
  'weekly': 'weekly_plus',
  'prodfdec6d07cc': 'weekly_plus',

  // Pro plans (Monthly & Yearly)
  'com.yourcompany.vibracode.monthly': 'pro', // Replace with your RevenueCat product ID
  'com.yourcompany.vibracode.yearly': 'pro', // Replace with your RevenueCat product ID
  'yearly_pro': 'pro',

  // Business plans
  'business_monthly': 'business',
  'com.yourcompany.vibracode.business': 'business', // Replace with your RevenueCat product ID

  // Enterprise plans
  'com.yourcompany.vibracode.enterprise': 'enterprise', // Replace with your RevenueCat product ID
};

/**
 * Get internal plan ID from RevenueCat product ID
 */
export function getPlanIdFromProductId(productId: string | null | undefined): string {
  if (!productId) {
    return 'free';
  }

  const planId = PRODUCT_TO_PLAN_MAP[productId];

  if (!planId) {
    console.warn(
      `[Product Mapping] Unknown product ID: "${productId}". ` +
      `Add it to PRODUCT_TO_PLAN_MAP in lib/revenuecat/product-mapping.ts`
    );
    return 'free';
  }

  return planId;
}

/**
 * RevenueCat entitlement identifier
 * Must match the entitlement ID configured in RevenueCat dashboard
 */
export const ENTITLEMENT_ID = 'Pro';

/**
 * Check if a plan is a paid plan
 */
export function isPaidPlan(planId: string): boolean {
  return planId !== 'free';
}

/**
 * Plan hierarchy for determining upgrades/downgrades
 */
export const PLAN_HIERARCHY = ['free', 'weekly_plus', 'pro', 'business', 'enterprise'] as const;

/**
 * Check if transitioning from oldPlan to newPlan is an upgrade
 */
export function isUpgrade(oldPlan: string, newPlan: string): boolean {
  const oldIndex = PLAN_HIERARCHY.indexOf(oldPlan as typeof PLAN_HIERARCHY[number]);
  const newIndex = PLAN_HIERARCHY.indexOf(newPlan as typeof PLAN_HIERARCHY[number]);
  return newIndex > oldIndex;
}

/**
 * Check if transitioning from oldPlan to newPlan is a downgrade
 */
export function isDowngrade(oldPlan: string, newPlan: string): boolean {
  const oldIndex = PLAN_HIERARCHY.indexOf(oldPlan as typeof PLAN_HIERARCHY[number]);
  const newIndex = PLAN_HIERARCHY.indexOf(newPlan as typeof PLAN_HIERARCHY[number]);
  return newIndex < oldIndex && oldIndex !== -1;
}

/**
 * Yearly product identifiers - these get 12x the monthly allocation
 */
export const YEARLY_PRODUCT_IDS = new Set([
  'com.yourcompany.vibracode.yearly', // Replace with your RevenueCat product ID
  'yearly_pro',
]);

/**
 * Check if a product ID is a yearly subscription
 */
export function isYearlyProduct(productId: string | null | undefined): boolean {
  if (!productId) return false;
  return YEARLY_PRODUCT_IDS.has(productId);
}

/**
 * Get the resource multiplier for a product (1 for monthly/weekly, 12 for yearly)
 */
export function getProductMultiplier(productId: string | null | undefined): number {
  return isYearlyProduct(productId) ? 12 : 1;
}
