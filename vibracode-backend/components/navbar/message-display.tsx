"use client";

import { Crown, Zap, BarChart3, ChevronDown, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

interface MessageDisplayProps {
  remainingMessages: number;
  usedMessages: number;
  totalMessages: number;
  canSendMessage: boolean;
  isPro: boolean;
  isLoading: boolean;
  billingMode?: 'tokens' | 'credits';
  creditsUSD?: number;
  creditsUsed?: number;
}

export function MessageDisplay({
  remainingMessages,
  usedMessages,
  totalMessages,
  canSendMessage,
  isPro,
  isLoading,
  billingMode = 'tokens',
  creditsUSD = 0,
  creditsUsed = 0,
}: MessageDisplayProps) {
  if (isLoading) {
    return (
      <div className="h-8 w-24 bg-muted animate-pulse rounded" />
    );
  }

  const isCreditsMode = billingMode === 'credits';

  // Format display values based on billing mode
  const formatValue = (value: number) => {
    if (value === undefined || value === null) {
      return isCreditsMode ? '$0.00' : '0';
    }
    if (isCreditsMode) {
      return `$${value.toFixed(2)}`;
    }
    return Math.floor(value).toString();
  };

  // Calculate values based on billing mode
  const displayRemaining = isCreditsMode ? creditsUSD : remainingMessages;
  const displayUsed = isCreditsMode ? creditsUsed : usedMessages;
  const displayTotal = isCreditsMode ? (creditsUSD + creditsUsed) : totalMessages;
  const usagePercentage = displayTotal > 0 ? (displayUsed / displayTotal) * 100 : 0;

  const unitLabel = isCreditsMode ? 'credits' : 'messages';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-8 gap-2">
          {isPro ? (
            <Crown className="h-4 w-4 text-yellow-500" />
          ) : (
            <Zap className="h-4 w-4 text-blue-500" />
          )}
          {isCreditsMode ? (
            <DollarSign className="h-4 w-4" />
          ) : (
            <BarChart3 className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">
            {formatValue(displayRemaining)}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isPro ? (
                <>
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">Pro Plan</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Free Plan</span>
                </>
              )}
              <Badge variant={isPro ? "default" : "secondary"}>
                {isPro ? "pro" : "free"}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isCreditsMode ? 'Credits Used' : 'Messages Used'}
              </span>
              <span className="font-medium">
                {formatValue(displayUsed)} / {formatValue(displayTotal)}
              </span>
            </div>

            <Progress value={usagePercentage} className="h-2" />

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Remaining: {formatValue(displayRemaining)}</span>
              <span>{Math.round(usagePercentage)}% used</span>
            </div>

            {displayRemaining <= 0 && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive font-medium">
                  No {unitLabel} remaining
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  {isCreditsMode
                    ? 'Add more credits to continue'
                    : 'Upgrade to Pro for 100 messages'
                  }
                </p>
              </div>
            )}

            <div className="pt-2 border-t">
              <Link href="/billing">
                <Button variant="outline" size="sm" className="w-full">
                  <Crown className="h-4 w-4 mr-2" />
                  Manage Subscription
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
