"use client";

import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreditDisplayProps {
  balance: number;
  used: number;
  totalPaid: number;
  canSendMessage: boolean;
  isLoading: boolean;
}

export function CreditDisplay({ 
  balance, 
  used, 
  totalPaid, 
  canSendMessage, 
  isLoading 
}: CreditDisplayProps) {
  // Always render the same structure to prevent hydration mismatch
  return (
    <Button variant="outline" className="h-8" disabled={isLoading}>
      <CreditCard className="h-4 w-4" />
      {isLoading ? (
        balance === 0 && used === 0 && totalPaid === 0 ? 'Sign in to view credits' : 'Loading...'
      ) : (
        `$${balance.toFixed(2)}`
      )}
    </Button>
  );
}

