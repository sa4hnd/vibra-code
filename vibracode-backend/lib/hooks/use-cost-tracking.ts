import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";

/**
 * Hook to get cost summary for the current user
 */
export function useUserCostSummary() {
  const { user } = useUser();
  
  const costSummary = useQuery(
    api.costs.getUserCostSummary,
    user?.id ? { clerkId: user.id } : "skip"
  );

  return {
    costSummary,
    isLoading: costSummary === undefined,
    totalCostUSD: costSummary?.totalCostUSD || 0,
    sessionCount: costSummary?.sessionCount || 0,
    messageCount: costSummary?.messageCount || 0,
    sessions: costSummary?.sessions || [],
  };
}

/**
 * Hook to get cost summary for a specific session
 */
export function useSessionCostSummary(sessionId: Id<"sessions">) {
  const costSummary = useQuery(api.costs.getSessionCostSummary, { sessionId });

  return {
    costSummary,
    isLoading: costSummary === undefined,
    totalCostUSD: costSummary?.totalCostUSD || 0,
    messageCount: costSummary?.messageCount || 0,
    messages: costSummary?.messages || [],
  };
}

/**
 * Hook to get cost summary for a specific message
 */
export function useMessageCostSummary(messageId: Id<"messages">) {
  const costSummary = useQuery(api.costs.getMessageCostSummary, { messageId });

  return {
    costSummary,
    isLoading: costSummary === undefined,
    costUSD: costSummary?.costUSD || 0,
    modelUsed: costSummary?.modelUsed,
    inputTokens: costSummary?.inputTokens || 0,
    outputTokens: costSummary?.outputTokens || 0,
    durationMs: costSummary?.durationMs || 0,
  };
}

/**
 * Hook to get global cost statistics (admin only)
 */
export function useGlobalCostStats() {
  const stats = useQuery(api.costs.getGlobalCostStats, {});

  return {
    stats,
    isLoading: stats === undefined,
    totalUsers: stats?.totalUsers || 0,
    totalSessions: stats?.totalSessions || 0,
    totalMessages: stats?.totalMessages || 0,
    totalUserCostUSD: stats?.totalUserCostUSD || 0,
    totalSessionCostUSD: stats?.totalSessionCostUSD || 0,
    totalMessageCostUSD: stats?.totalMessageCostUSD || 0,
    averageCostPerUser: stats?.averageCostPerUser || 0,
    averageCostPerSession: stats?.averageCostPerSession || 0,
    averageCostPerMessage: stats?.averageCostPerMessage || 0,
  };
}

/**
 * Utility function to format cost in USD
 */
export function formatCostUSD(cost: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 6, // Show 6 decimal places for precision
    maximumFractionDigits: 6,
  }).format(cost);
}

/**
 * Utility function to format cost in a more readable format
 */
export function formatCostReadable(cost: number): string {
  if (cost < 0.001) {
    return `$${(cost * 1000).toFixed(3)}m`; // Show in millicents
  } else if (cost < 1) {
    return `$${(cost * 100).toFixed(2)}¢`; // Show in cents
  } else {
    return `$${cost.toFixed(2)}`; // Show in dollars
  }
}

/**
 * Utility function to format token count
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  } else {
    return tokens.toString();
  }
}

/**
 * Utility function to format duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    return `${(ms / 60000).toFixed(1)}m`;
  }
}
