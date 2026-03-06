/**
 * PLAN FEATURES & LIMITS
 * 
 * This file handles feature gating and usage limits based on user's subscription plan.
 * Use these functions throughout your app to check if users have access to features.
 */

import { getPlanConfig, hasFeatureAccess, getUsageLimit } from './plans';

/**
 * Check if user has access to a specific feature
 */
export function checkFeatureAccess(userPlan: string, feature: string): boolean {
  const plan = getPlanConfig(userPlan);
  if (!plan) return false;

  switch (feature) {
    case 'unlimited_sessions':
      return plan.limits.sessionsPerDay === -1;
    
    case 'priority_support':
      return plan.limits.prioritySupport === true;
    
    case 'custom_templates':
      return plan.limits.customTemplates === true;
    
    case 'api_access':
      return plan.limits.apiAccess === true;
    
    case 'advanced_analytics':
      return ['pro', 'business', 'enterprise'].includes(userPlan);
    
    case 'team_collaboration':
      return ['business', 'enterprise'].includes(userPlan);
    
    case 'white_label':
      return userPlan === 'enterprise';
    
    case 'dedicated_support':
      return ['business', 'enterprise'].includes(userPlan);
    
    case '24_7_support':
      return userPlan === 'enterprise';
    
    default:
      return false;
  }
}

/**
 * Get usage limit for a specific feature
 */
export function getFeatureLimit(userPlan: string, feature: string): number {
  const plan = getPlanConfig(userPlan);
  if (!plan) return 0;

  switch (feature) {
    case 'sessions_per_day':
      return plan.limits.sessionsPerDay || 0;
    
    case 'max_sessions':
      return plan.limits.maxSessions || 0;
    
    case 'tokens_per_session':
      return plan.limits.maxTokensPerSession || 0;
    
    case 'monthly_credits':
      return plan.creditsUSD || 0;
    
    default:
      return 0;
  }
}

/**
 * Check if user can perform an action
 */
export function canPerformAction(userPlan: string, action: string): boolean {
  switch (action) {
    case 'create_session':
      return checkFeatureAccess(userPlan, 'unlimited_sessions') || 
             getFeatureLimit(userPlan, 'sessions_per_day') > 0;
    
    case 'use_custom_template':
      return checkFeatureAccess(userPlan, 'custom_templates');
    
    case 'access_api':
      return checkFeatureAccess(userPlan, 'api_access');
    
    case 'get_priority_support':
      return checkFeatureAccess(userPlan, 'priority_support');
    
    case 'use_advanced_analytics':
      return checkFeatureAccess(userPlan, 'advanced_analytics');
    
    case 'invite_team_members':
      return checkFeatureAccess(userPlan, 'team_collaboration');
    
    case 'white_label_dashboard':
      return checkFeatureAccess(userPlan, 'white_label');
    
    default:
      return false;
  }
}

/**
 * Get plan-specific messaging
 */
export function getPlanMessage(userPlan: string, feature: string): string {
  const plan = getPlanConfig(userPlan);
  if (!plan) return 'This feature is not available.';

  switch (feature) {
    case 'upgrade_required':
      return `This feature requires ${plan.displayName} plan or higher.`;
    
    case 'limit_reached':
      return `You've reached your ${plan.displayName} plan limit. Upgrade for more.`;
    
    case 'feature_unavailable':
      return `This feature is not available in your ${plan.displayName} plan.`;
    
    default:
      return 'This feature is not available.';
  }
}

/**
 * Get upgrade recommendation
 */
export function getUpgradeRecommendation(userPlan: string, feature: string): string {
  switch (userPlan) {
    case 'free':
      return 'Upgrade to Weekly Plus ($9.99/week) to unlock this feature.';
    
    case 'weekly_plus':
      return 'Upgrade to Pro ($19.99/month) for unlimited access.';
    
    case 'pro':
      return 'Upgrade to Business ($49.99/month) for team features.';
    
    case 'business':
      return 'Upgrade to Enterprise ($199.99/month) for advanced features.';
    
    default:
      return 'Contact support for upgrade options.';
  }
}

/**
 * Check if user has sufficient credits for an action
 */
export function hasSufficientCredits(userCredits: number, actionCost: number): boolean {
  return userCredits >= actionCost;
}

/**
 * Get plan comparison data
 */
export function getPlanComparison(): Array<{
  plan: string;
  displayName: string;
  price: number;
  credits: number;
  features: string[];
}> {
  return [
    {
      plan: 'weekly_plus',
      displayName: 'Weekly Plus',
      price: 9.99,
      credits: 20,
      features: ['20,000 tokens/week', 'All templates', 'Unlimited sessions', 'Email support']
    },
    {
      plan: 'pro',
      displayName: 'Pro',
      price: 19.99,
      credits: 40,
      features: ['40,000 tokens/month', 'Priority support', 'Advanced analytics', 'Custom templates']
    },
    {
      plan: 'business',
      displayName: 'Business',
      price: 49.99,
      credits: 125,
      features: ['125,000 tokens/month', 'Team collaboration', 'API access', 'Dedicated support']
    },
    {
      plan: 'enterprise',
      displayName: 'Enterprise',
      price: 199.99,
      credits: 600,
      features: ['600,000 tokens/month', '24/7 support', 'White-label', 'Custom SLA']
    }
  ];
}

