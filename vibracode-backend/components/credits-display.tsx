import React from 'react';
import { useUsage } from '@/lib/hooks/use-usage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Crown, Zap } from 'lucide-react';

/**
 * PUBLIC: Message balance display (what users see)
 */
export function CreditsDisplay() {
  const { remainingMessages, usedMessages, totalMessages, isPro, planName, isLoading } = useUsage();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <MessageSquare className="w-4 h-4" />
        <span>Loading messages...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isPro ? (
        <Crown className="w-4 h-4 text-yellow-500" />
      ) : (
        <Zap className="w-4 h-4 text-blue-500" />
      )}
      <span className="font-semibold text-green-600">
        {remainingMessages}/{totalMessages}
      </span>
      <Badge variant="outline" className="text-xs">
        Messages
      </Badge>
    </div>
  );
}

/**
 * PUBLIC: Detailed message information card
 */
export function CreditsCard() {
  const { remainingMessages, usedMessages, totalMessages, isPro, planName, isLoading } = useUsage();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isPro ? (
            <Crown className="w-5 h-5 text-yellow-500" />
          ) : (
            <Zap className="w-5 h-5 text-blue-500" />
          )}
          Messages
          <Badge variant={isPro ? "default" : "secondary"}>
            {planName}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Remaining</div>
            <div className="text-2xl font-bold text-green-600">
              {remainingMessages}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Used</div>
            <div className="text-2xl font-bold text-blue-600">
              {usedMessages}
            </div>
          </div>
        </div>
        
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="w-4 h-4" />
            <span>Total messages: {totalMessages}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * PUBLIC: Message status indicator
 */
export function CreditStatus() {
  const { remainingMessages, canSendMessage } = useUsage();

  if (canSendMessage) {
    return (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <MessageSquare className="w-3 h-3 mr-1" />
        {remainingMessages} messages available
      </Badge>
    );
  }

  return (
    <Badge variant="destructive">
      <MessageSquare className="w-3 h-3 mr-1" />
      No messages remaining
    </Badge>
  );
}

/**
 * PUBLIC: Message usage indicator
 */
export function MessageCostEstimator({ messageLength }: { messageLength: number }) {
  const { remainingMessages, canSendMessage } = useUsage();
  
  // Simple message usage indicator
  const willConsumeMessage = messageLength > 0;

  return (
    <div className="text-xs text-muted-foreground">
      <span className={canSendMessage ? "text-green-600" : "text-red-600"}>
        {willConsumeMessage ? "Will use 1 message" : "No message needed"}
      </span>
      {!canSendMessage && (
        <span className="ml-2 text-red-600">
          (No messages remaining)
        </span>
      )}
    </div>
  );
}

