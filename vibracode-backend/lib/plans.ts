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
  messagesPerMonth: number; // Messages given to user per month (TOKEN MODE - Cursor)
  creditsUSD: number; // Credits given to user (CREDIT MODE - Claude, 2x multiplier)
  maxSpendUSD: number; // Internal: max API cost we'll spend (75% of price for 25% profit)
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
    creditsUSD: 5, // $5 free credits for Claude mode
    maxSpendUSD: 2.50, // 50% spend limit for free tier
    description: 'Perfect for trying out our platform',
    features: [
      '5 messages per month',
      'Basic templates',
      'Community support'
    ]
  },

  weekly_plus: {
    id: 'weekly_plus',
    name: 'weekly_plus',
    displayName: 'Weekly Plus',
    price: 7.99,
    messagesPerMonth: 25, // 25 messages per week
    creditsUSD: 16, // ~$8 * 2 = $16 credits
    maxSpendUSD: 6, // ~75% of $7.99
    description: 'Perfect for short-term projects',
    features: [
      '25 messages per week',
      'All templates',
      'Email support'
    ]
  },

  pro: {
    id: 'pro',
    name: 'pro',
    displayName: 'Pro',
    price: 19.99,
    messagesPerMonth: 100,
    creditsUSD: 40, // $20 * 2 = $40 credits
    maxSpendUSD: 15, // 75% of $19.99
    description: 'Perfect for professionals and regular users',
    features: [
      '100 messages per month',
      'All templates + premium',
      'Priority support',
      'Advanced analytics',
      'Custom templates'
    ]
  },

  business: {
    id: 'business',
    name: 'business',
    displayName: 'Business',
    price: 49.99,
    messagesPerMonth: 300,
    creditsUSD: 100, // $50 * 2 = $100 credits
    maxSpendUSD: 37.50, // 75% of $49.99
    description: 'Ideal for teams and agencies',
    features: [
      '300 messages per month',
      'All features',
      'Team collaboration',
      'Dedicated support',
      'Advanced analytics',
      'API access',
      'Custom integrations'
    ]
  },

  enterprise: {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    price: 199.99,
    messagesPerMonth: 1000,
    creditsUSD: 400, // $200 * 2 = $400 credits
    maxSpendUSD: 150, // 75% of $199.99
    description: 'For large teams with high-volume needs',
    features: [
      '1000 messages per month',
      'Everything in Business',
      'Unlimited team members',
      '24/7 phone support',
      'Custom SLA',
      'On-premise deployment',
      'White-label options'
    ]
  }
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
  return Object.values(PLANS).filter(plan => plan.price > 0);
}

/**
 * Get plan by price (useful for webhook processing)
 */
export function getPlanByPrice(priceInCents: number): PlanConfig | null {
  const priceInDollars = priceInCents / 100;
  return Object.values(PLANS).find(plan => plan.price === priceInDollars) || null;
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

/**
 * Get credits allocation for a given plan (CREDIT MODE - Claude agent)
 */
export function getCreditsForPlan(planId: string): number {
  const plan = getPlanConfig(planId);
  if (!plan) return 0;

  return plan.creditsUSD;
}

/**
 * Get max spend limit for a given plan (internal - 75% of price for 25% profit)
 */
export function getMaxSpendForPlan(planId: string): number {
  const plan = getPlanConfig(planId);
  if (!plan) return 0;

  return plan.maxSpendUSD;
}

/**
 * Determine billing mode based on agent type
 */
export function getBillingModeForAgent(agentType: string): 'tokens' | 'credits' {
  return agentType === 'cursor' ? 'tokens' : 'credits';
}

/**
 * Get resource allocation based on agent type and plan
 * Returns either messages (tokens) or credits depending on billing mode
 */
export function getResourceAllocationForPlan(planId: string, agentType: string): {
  type: 'tokens' | 'credits';
  amount: number;
  maxSpend?: number;
} {
  const plan = getPlanConfig(planId);
  if (!plan) {
    return { type: 'tokens', amount: 0 };
  }

  const billingMode = getBillingModeForAgent(agentType);

  if (billingMode === 'tokens') {
    return {
      type: 'tokens',
      amount: plan.messagesPerMonth,
    };
  } else {
    return {
      type: 'credits',
      amount: plan.creditsUSD,
      maxSpend: plan.maxSpendUSD,
    };
  }
}
