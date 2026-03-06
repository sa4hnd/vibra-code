import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

/**
 * PUBLIC: Hook to get user's credit balance (what they can see)
 * SECRET: Never exposes actual costs or profit data
 */
export function useUserCredits() {
  const { user } = useUser();
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  const credits = useQuery(
    api.credits.getUserCredits,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const createUser = useMutation(api.usage.createUser);

  // Create user if they don't exist (same logic as useUsage)
  useEffect(() => {
    if (user?.id && credits === null && !isCreatingUser) {
      setIsCreatingUser(true);
      createUser({ clerkId: user.id }).finally(() => {
        setIsCreatingUser(false);
      });
    }
    
    // Cleanup function to reset creating state
    return () => {
      setIsCreatingUser(false);
    };
  }, [user?.id, credits, createUser, isCreatingUser]);

  return {
    credits,
    isLoading: credits === undefined,
    balance: credits?.creditsUSD || 0,
    used: credits?.creditsUsed || 0,
    totalPaid: credits?.totalPaidUSD || 0,
    hasCredits: credits?.hasCredits || false,
    canSendMessage: credits?.hasCredits || false,
  };
}

/**
 * PUBLIC: Format credit amount for display
 */
export function formatCredits(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * PUBLIC: Format credit amount in a more readable way
 */
export function formatCreditsReadable(amount: number): string {
  if (amount < 0.01) {
    return '$0.00';
  } else if (amount < 1) {
    return `$${amount.toFixed(3)}`;
  } else {
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * PUBLIC: Check if user has enough credits for a message
 */
export function hasEnoughCredits(balance: number, messageCost: number): boolean {
  // SECRET: This uses the internal cost ratio but user never sees it
  const creditCost = messageCost / 0.25; // 4x multiplier
  return balance >= creditCost;
}

/**
 * PUBLIC: Calculate credit cost for display (estimated)
 * SECRET: This is just an estimate, real cost is hidden
 */
export function estimateCreditCost(messageLength: number): number {
  // Rough estimate based on message length
  // SECRET: Real cost calculation is hidden in backend
  const baseCost = 0.01; // $0.01 base cost
  const lengthMultiplier = Math.max(1, messageLength / 100); // $0.01 per 100 chars
  return baseCost * lengthMultiplier * 4; // Show 4x estimate to user
}
