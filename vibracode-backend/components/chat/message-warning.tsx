"use client";

import { Lock, Crown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface MessageWarningProps {
  remainingMessages: number;
  totalMessages: number;
  isPro: boolean;
}

export function MessageWarning({ remainingMessages, totalMessages, isPro }: MessageWarningProps) {
  return (
    <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        {isPro ? (
          <Crown className="h-4 w-4 text-yellow-500" />
        ) : (
          <Zap className="h-4 w-4 text-blue-500" />
        )}
        <p className="text-sm text-destructive font-medium">
          {isPro ? 'Monthly messages exhausted' : 'Free messages exhausted'}
        </p>
      </div>
      <p className="text-xs text-destructive/80 mb-2">
        You've used all {totalMessages} messages for this month. Upgrade your plan or wait for the monthly reset.
      </p>
      <Link href="/billing">
        <Button variant="outline" size="sm" className="h-7">
          <Lock className="h-3 w-3 mr-1" />
          {isPro ? 'Manage Subscription' : 'Upgrade to Pro'}
        </Button>
      </Link>
    </div>
  );
}

