import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";

/**
 * Hook for managing payment transactions
 */
export function usePaymentTransactions() {
  const { user } = useUser();
  const userId = user?.id || "";

  // Get user's payment transactions
  const transactions = useQuery(
    api.paymentTransactions.getUserTransactions,
    userId ? { userId, limit: 50 } : "skip"
  );

  // Get revenue analytics (admin only)
  const revenueAnalytics = useQuery(
    api.paymentTransactions.getRevenueAnalytics,
    {} // No date range for now
  );

  // Mutations
  const createTransaction = useMutation(api.paymentTransactions.createTransaction);
  const updateTransactionStatus = useMutation(api.paymentTransactions.updateTransactionStatus);

  return {
    transactions: transactions || [],
    revenueAnalytics: revenueAnalytics || null,
    createTransaction,
    updateTransactionStatus,
    isLoading: transactions === undefined,
  };
}

/**
 * Hook for getting transaction by ID
 */
export function useTransactionById(transactionId: string) {
  const transaction = useQuery(
    api.paymentTransactions.getTransactionById,
    transactionId ? { transactionId } : "skip"
  );

  return {
    transaction: transaction || null,
    isLoading: transaction === undefined,
  };
}

/**
 * Hook for getting transactions by type
 */
export function useTransactionsByType(type: "payment" | "refund" | "chargeback" | "adjustment" | "subscription_change" | "failed_payment") {
  const transactions = useQuery(
    api.paymentTransactions.getTransactionsByType,
    { type, limit: 100 }
  );

  return {
    transactions: transactions || [],
    isLoading: transactions === undefined,
  };
}

/**
 * Hook for getting transactions by status
 */
export function useTransactionsByStatus(status: "pending" | "succeeded" | "failed" | "refunded" | "disputed") {
  const transactions = useQuery(
    api.paymentTransactions.getTransactionsByStatus,
    { status, limit: 100 }
  );

  return {
    transactions: transactions || [],
    isLoading: transactions === undefined,
  };
}

/**
 * Format transaction amount for display
 */
export function formatTransactionAmount(amount: number, currency: string = "usd"): string {
  const sign = amount >= 0 ? "+" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)} ${currency.toUpperCase()}`;
}

/**
 * Get transaction type display name
 */
export function getTransactionTypeDisplayName(type: string): string {
  const typeMap: Record<string, string> = {
    payment: "Payment",
    refund: "Refund",
    chargeback: "Chargeback",
    adjustment: "Adjustment",
    subscription_change: "Plan Change",
    failed_payment: "Failed Payment",
  };
  
  return typeMap[type] || type;
}

/**
 * Get transaction status display name and color
 */
export function getTransactionStatusDisplay(status: string): { name: string; color: string } {
  const statusMap: Record<string, { name: string; color: string }> = {
    pending: { name: "Pending", color: "text-yellow-600" },
    succeeded: { name: "Success", color: "text-green-600" },
    failed: { name: "Failed", color: "text-red-600" },
    refunded: { name: "Refunded", color: "text-blue-600" },
    disputed: { name: "Disputed", color: "text-orange-600" },
  };
  
  return statusMap[status] || { name: status, color: "text-gray-600" };
}
