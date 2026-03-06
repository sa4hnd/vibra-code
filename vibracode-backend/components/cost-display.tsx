import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserCostSummary, useSessionCostSummary, useMessageCostSummary, useGlobalCostStats, formatCostReadable, formatTokenCount, formatDuration } from '@/lib/hooks/use-cost-tracking';
import { Id } from '@/convex/_generated/dataModel';

interface CostDisplayProps {
  sessionId?: Id<"sessions">;
  showUserSummary?: boolean;
  showSessionSummary?: boolean;
  compact?: boolean;
}

export function CostDisplay({ 
  sessionId, 
  showUserSummary = true, 
  showSessionSummary = true,
  compact = false 
}: CostDisplayProps) {
  const { costSummary: userCost, isLoading: userLoading } = useUserCostSummary();
  const { costSummary: sessionCost, isLoading: sessionLoading } = useSessionCostSummary(sessionId!);

  if (compact) {
    return (
      <div className="flex gap-2 text-sm text-muted-foreground">
        {showUserSummary && (
          <Badge variant="outline">
            User: {formatCostReadable(userCost?.totalCostUSD || 0)}
          </Badge>
        )}
        {showSessionSummary && sessionId && (
          <Badge variant="outline">
            Session: {formatCostReadable(sessionCost?.totalCostUSD || 0)}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showUserSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">💰 User Cost Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {userLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Cost:</span>
                  <span className="font-mono font-bold text-green-600">
                    {formatCostReadable(userCost?.totalCostUSD || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sessions:</span>
                  <span>{userCost?.sessionCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Messages:</span>
                  <span>{userCost?.messageCount || 0}</span>
                </div>
                {userCost?.sessions && userCost.sessions.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Recent Sessions:</h4>
                    <div className="space-y-1">
                      {userCost.sessions.slice(0, 3).map((session) => (
                        <div key={session.id} className="flex justify-between text-sm">
                          <span className="truncate">{session.name}</span>
                          <span className="font-mono">{formatCostReadable(session.totalCostUSD || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showSessionSummary && sessionId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📊 Session Cost Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {sessionLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Cost:</span>
                  <span className="font-mono font-bold text-blue-600">
                    {formatCostReadable(sessionCost?.totalCostUSD || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Messages:</span>
                  <span>{sessionCost?.messageCount || 0}</span>
                </div>
                {sessionCost?.messages && sessionCost.messages.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Message Costs:</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {sessionCost.messages.map((message) => (
                        <div key={message.id} className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Badge variant={message.role === 'assistant' ? 'default' : 'secondary'}>
                              {message.role}
                            </Badge>
                            {message.modelUsed && (
                              <span className="text-xs text-muted-foreground">
                                {message.modelUsed.split('-')[1]} {/* Show just "sonnet" */}
                              </span>
                            )}
                          </span>
                          <span className="font-mono">{formatCostReadable(message.costUSD)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MessageCostBadgeProps {
  messageId: Id<"messages">;
}

export function MessageCostBadge({ messageId }: MessageCostBadgeProps) {
  const { costSummary, isLoading } = useMessageCostSummary(messageId);

  if (isLoading || !costSummary) {
    return null;
  }

  return (
    <Badge variant="outline" className="text-xs">
      {formatCostReadable(costSummary.costUSD)}
    </Badge>
  );
}

interface CostStatsProps {
  className?: string;
}

export function CostStats({ className }: CostStatsProps) {
  const { 
    totalUsers, 
    totalSessions, 
    totalMessages, 
    totalUserCostUSD, 
    averageCostPerUser,
    isLoading 
  } = useGlobalCostStats();

  if (isLoading) {
    return (
      <div className={`text-muted-foreground ${className}`}>
        Loading cost statistics...
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Total Users</div>
          <div className="font-semibold">{totalUsers}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Total Sessions</div>
          <div className="font-semibold">{totalSessions}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Total Messages</div>
          <div className="font-semibold">{totalMessages}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Total Cost</div>
          <div className="font-semibold text-green-600">{formatCostReadable(totalUserCostUSD)}</div>
        </div>
      </div>
      <div className="pt-2 border-t">
        <div className="text-sm text-muted-foreground">
          Average cost per user: <span className="font-semibold">{formatCostReadable(averageCostPerUser)}</span>
        </div>
      </div>
    </div>
  );
}
