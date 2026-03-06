import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { useEffect, useState } from 'react';

import { api } from '../../convex/_generated/api';
import { getPlanConfig, PLANS } from '../../lib/plans';

export function useUsage() {
  const { user } = useUser();
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const userTokens = useQuery(api.usage.getUserMessages, {
    clerkId: user?.id || '',
  });

  // Get billing status (includes global agent type and billing mode)
  const billingStatus = useQuery(api.billingSwitch.getBillingStatus, {
    clerkId: user?.id || '',
  });

  const hasTokens = useQuery(api.usage.hasMessages, {
    clerkId: user?.id || '',
  });

  const consumeToken = useMutation(api.usage.consumeMessage);
  const createUser = useMutation(api.usage.createUser);

  // Create user if they don't exist
  useEffect(() => {
    if (user?.id && userTokens === null && !isCreatingUser) {
      console.log('🔄 Creating user for clerkId:', user.id);
      setIsCreatingUser(true);
      createUser({ clerkId: user.id })
        .then((result) => {
          console.log('✅ User created/found:', result);
        })
        .catch((error) => {
          console.error('❌ Error creating user:', error);
        })
        .finally(() => {
          setIsCreatingUser(false);
        });
    }
  }, [user?.id, userTokens, createUser, isCreatingUser]);

  // Get billing mode from global config
  const billingMode = billingStatus?.billingMode || 'tokens';
  const agentType = billingStatus?.agentType || 'cursor';

  // TOKEN MODE values
  const tokensRemaining = Math.floor(userTokens?.messagesRemaining || 0);
  const tokensUsed = Math.floor(userTokens?.messagesUsed || 0);
  const actualTotalTokens = tokensRemaining + tokensUsed;

  // CREDIT MODE values
  const creditsRemaining = userTokens?.creditsUSD || 0;
  const creditsUsed = userTokens?.creditsUsed || 0;
  const totalCredits = creditsRemaining + creditsUsed;

  // Can send message based on billing mode
  const canSendMessage = billingMode === 'tokens' ? hasTokens === true : creditsRemaining >= 0.01;

  // Get plan info from the actual plans configuration
  const subscriptionPlanId = userTokens?.subscriptionPlan || 'free';
  const planConfig = getPlanConfig(subscriptionPlanId) || PLANS.free;

  const isPro = subscriptionPlanId !== 'free';
  const planName = planConfig.displayName;
  const planTotalMessages = planConfig.messagesPerMonth;
  const planTotalCredits = planConfig.creditsUSD; // Use actual plan config, not estimate

  // Use actual total if available, otherwise fall back to plan total
  const totalTokens = actualTotalTokens > 0 ? actualTotalTokens : planTotalMessages;
  const totalCreditsAmount = totalCredits > 0 ? totalCredits : planTotalCredits;

  // Unified values based on billing mode
  const remainingMessages = billingMode === 'tokens' ? tokensRemaining : creditsRemaining;
  const usedMessages = billingMode === 'tokens' ? tokensUsed : creditsUsed;
  const totalMessages = billingMode === 'tokens' ? totalTokens : totalCreditsAmount;

  const sendMessage = async () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    if (!canSendMessage) {
      throw new Error(billingMode === 'tokens' ? 'No tokens remaining' : 'Insufficient credits');
    }

    try {
      const newRemainingTokens = await consumeToken({ clerkId: user.id });
      return newRemainingTokens;
    } catch (error) {
      throw error;
    }
  };

  return {
    userTokens,
    canSendMessage,
    isPro,
    remainingMessages,
    usedMessages,
    totalMessages,
    planName,
    sendMessage,
    isLoading: userTokens === undefined || billingStatus === undefined,
    // New billing mode fields
    billingMode,
    agentType,
    // Raw token values (for backwards compatibility)
    tokensRemaining,
    tokensUsed,
    // Raw credit values
    creditsRemaining,
    creditsUsed,
  };
}
