"use client";

import { usePaymentTransactions, formatTransactionAmount, getTransactionTypeDisplayName, getTransactionStatusDisplay } from "@/lib/hooks/use-payment-transactions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export function PaymentTransactions() {
  const { transactions, isLoading } = usePaymentTransactions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Loading your payment transactions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>No payment transactions found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Your payment history will appear here once you make a purchase.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((transaction) => {
            const statusDisplay = getTransactionStatusDisplay(transaction.status);
            const typeDisplay = getTransactionTypeDisplayName(transaction.type);
            
            return (
              <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{typeDisplay}</h4>
                    <Badge variant="outline" className={statusDisplay.color}>
                      {statusDisplay.name}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {transaction.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {format(new Date(transaction.processedAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                    {transaction.subscriptionPlan && (
                      <Badge variant="secondary" className="text-xs">
                        {transaction.subscriptionPlan}
                      </Badge>
                    )}
                    {transaction.creditsAdded && (
                      <span>+{transaction.creditsAdded} credits</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${
                    transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatTransactionAmount(transaction.amount, transaction.currency)}
                  </div>
                  {transaction.metadata?.backfilled && (
                    <Badge variant="outline" className="text-xs mt-1">
                      Backfilled
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
