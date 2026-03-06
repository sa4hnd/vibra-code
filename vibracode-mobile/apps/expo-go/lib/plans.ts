/**
 * SUBSCRIPTION PLANS CONFIGURATION
 *
 * This file defines all subscription plans, their pricing, credits, and features.
 * Used across the application for billing, credit allocation, and feature gating.
 */

export interface PlanConfig {
  id: string;
  name: string;
  displayName: string;
  price: number; // Monthly price in USD
  messagesPerMonth: number; // Messages given to user per month
  description: string;
  features: string[];
  stripePriceId?: string; // Stripe price ID for billing
  clerkPlanId?: string; // Clerk plan ID
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    id: 'free',
    name: 'free',
    displayName: 'Free',
    price: 0,
    messagesPerMonth: 5,
    description: 'Perfect for trying out our platform',
    features: ['5 messages per month', 'Basic templates', 'Community support'],
  },

  weekly_plus: {
    id: 'weekly_plus',
    name: 'weekly_plus',
    displayName: 'Weekly Plus',
    price: 9.99,
    messagesPerMonth: 25, // 25 messages per week
    description: 'Perfect for short-term projects',
    features: ['25 messages per week', 'All templates', 'Email support'],
  },

  pro: {
    id: 'pro',
    name: 'pro',
    displayName: 'Pro',
    price: 19.99,
    messagesPerMonth: 100,
    description: 'Perfect for professionals and regular users',
    features: [
      '100 messages per month',
      'All templates + premium',
      'Priority support',
      'Advanced analytics',
      'Custom templates',
    ],
  },

  business: {
    id: 'business',
    name: 'business',
    displayName: 'Business',
    price: 49.99,
    messagesPerMonth: 300,
    description: 'Ideal for teams and agencies',
    features: [
      '300 messages per month',
      'All features',
      'Team collaboration',
      'Dedicated support',
      'Advanced analytics',
      'API access',
      'Custom integrations',
    ],
  },

  enterprise: {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    price: 199.99,
    messagesPerMonth: 1000,
    description: 'For large teams with high-volume needs',
    features: [
      '1000 messages per month',
      'Everything in Business',
      'Unlimited team members',
      '24/7 phone support',
      'Custom SLA',
      'On-premise deployment',
      'White-label options',
    ],
  },
};

/**
 * Get plan configuration by plan ID
 */
export function getPlanConfig(planId: string): PlanConfig | null {
  return PLANS[planId] || null;
}

/**
 * Get all available plans
 */
export function getAllPlans(): PlanConfig[] {
  return Object.values(PLANS);
}

/**
 * Get paid plans only (excludes free)
 */
export function getPaidPlans(): PlanConfig[] {
  return Object.values(PLANS).filter((plan) => plan.price > 0);
}

/**
 * Get plan by price (useful for webhook processing)
 */
export function getPlanByPrice(priceInCents: number): PlanConfig | null {
  const priceInDollars = priceInCents / 100;
  return Object.values(PLANS).find((plan) => plan.price === priceInDollars) || null;
}

/**
 * Get messages per month for a given plan
 */
export function getMessagesForPlan(planId: string): number {
  const plan = getPlanConfig(planId);
  if (!plan) return 0;

  return plan.messagesPerMonth;
}

/**
 * Check if user has access to a feature based on their plan
 */
export function hasFeatureAccess(planId: string, feature: string): boolean {
  const plan = getPlanConfig(planId);
  if (!plan) return false;

  // Simple feature check based on plan tier
  switch (feature) {
    case 'priority_support':
      return ['pro', 'business', 'enterprise'].includes(planId);
    case 'custom_templates':
      return ['pro', 'business', 'enterprise'].includes(planId);
    case 'api_access':
      return ['business', 'enterprise'].includes(planId);
    case 'team_collaboration':
      return ['business', 'enterprise'].includes(planId);
    case 'white_label':
      return planId === 'enterprise';
    case '24_7_support':
      return planId === 'enterprise';
    default:
      return false;
  }
}

/**
 * Get plan recommendations based on monthly message usage
 */
export function getRecommendedPlan(monthlyMessageUsage: number): PlanConfig {
  if (monthlyMessageUsage <= 5) return PLANS.free;
  if (monthlyMessageUsage <= 25) return PLANS.weekly_plus;
  if (monthlyMessageUsage <= 100) return PLANS.pro;
  if (monthlyMessageUsage <= 300) return PLANS.business;
  return PLANS.enterprise;
}
