import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';

import { api } from '../../convex/_generated/api';

/**
 * Unified Billing Hook for Expo Go
 *
 * This hook provides a unified interface for billing regardless of the billing mode.
 * It automatically switches between TOKEN mode (Cursor) and CREDIT mode (Claude/Gemini)
 * based on the GLOBAL agent type setting (controlled by admin).
 *
 * NOTE: Agent type is now controlled globally by admin via admin.setGlobalAgentType().
 * Users cannot change their own agent type.
 */
export function useBilling() {
  const { user, isLoaded } = useUser();
  const clerkId = user?.id;

  // Get billing status which includes agent type, billing mode, and all balance info
  const billingStatus = useQuery(
    api.billingSwitch.getBillingStatus,
    clerkId ? { clerkId } : 'skip'
  );

  // Get agent type (for UI display) - now reads from global config
  const agentType = useQuery(api.usage.getUserAgentType, clerkId ? { clerkId } : 'skip');

  // Mutations
  const consumeResourceMutation = useMutation(api.billingSwitch.consumeResource);

  // Loading states
  const isLoading = !isLoaded || billingStatus === undefined;

  // Derived values
  const billingMode = billingStatus?.billingMode || 'tokens';
  const canSendMessage = billingStatus?.canSend ?? false;

  // Display values based on billing mode
  const displayBalance = billingStatus?.displayBalance || '0 tokens';
  const remaining =
    billingMode === 'tokens'
      ? billingStatus?.tokensRemaining || 0
      : billingStatus?.creditsRemaining || 0;

  // Consume resource (called after message processing)
  const consumeResource = async (messageCostUSD?: number): Promise<any> => {
    if (!clerkId) {
      throw new Error('User not authenticated');
    }

    const result = await consumeResourceMutation({
      clerkId,
      messageCostUSD,
    });

    return result;
  };

  return {
    // Loading state
    isLoading,

    // Agent type & billing mode (read-only - controlled by admin)
    agentType: agentType || 'cursor',
    billingMode,

    // Can user send a message
    canSendMessage,

    // Display balance (formatted string)
    displayBalance,

    // Raw balance value
    remaining,

    // Token mode specific
    tokensRemaining: billingStatus?.tokensRemaining || 0,
    tokensUsed: billingStatus?.tokensUsed || 0,

    // Credit mode specific
    creditsRemaining: billingStatus?.creditsRemaining || 0,
    creditsUsed: billingStatus?.creditsUsed || 0,

    // Plan info
    subscriptionPlan: billingStatus?.subscriptionPlan || 'free',

    // Actions
    consumeResource,
  };
}

/**
 * Hook to check if user can send a message
 * Lightweight version for components that only need to check send permission
 */
export function useCanSendMessage() {
  const { user } = useUser();
  const clerkId = user?.id;

  const canSend = useQuery(api.billingSwitch.canSendMessage, clerkId ? { clerkId } : 'skip');

  return {
    canSend: canSend?.canSend ?? false,
    billingMode: canSend?.billingMode || 'tokens',
    remaining: canSend?.remaining || 0,
    reason: canSend?.reason || null,
    isLoading: canSend === undefined,
  };
}

/**
 * Hook for displaying current agent type (read-only)
 * Agent type is now controlled globally by admin
 */
export function useAgentType() {
  const { user } = useUser();
  const clerkId = user?.id;

  // Get global agent type (not per-user)
  const agentType = useQuery(api.usage.getUserAgentType, clerkId ? { clerkId } : 'skip');

  return {
    agentType: agentType || 'cursor',
    isLoading: agentType === undefined,
    billingMode: agentType === 'cursor' ? 'tokens' : 'credits',
    // setAgentType removed - controlled globally by admin
  };
}
