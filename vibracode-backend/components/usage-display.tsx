"use client"

import { useUsage } from "@/lib/hooks/use-usage"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Crown, Zap } from "lucide-react"

export function UsageDisplay() {
  const { remainingMessages, usedMessages, totalMessages, canSendMessage, isPro, planName, isLoading } = useUsage()

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
            <div className="h-2 bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const usagePercentage = totalMessages > 0 ? (usedMessages / totalMessages) * 100 : 0

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {isPro ? (
            <Crown className="h-4 w-4 text-yellow-500" />
          ) : (
            <Zap className="h-4 w-4 text-blue-500" />
          )}
          Messages
          <Badge variant={isPro ? "default" : "secondary"}>
            {planName}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Messages Used</span>
            <span className="font-medium">
              {usedMessages} / {totalMessages}
            </span>
          </div>
          
          <Progress value={usagePercentage} className="h-2" />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Remaining: {remainingMessages}</span>
            <span>{Math.round(usagePercentage)}% used</span>
          </div>
          
          {!canSendMessage && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">
                No messages remaining
              </p>
              <p className="text-xs text-destructive/80 mt-1">
                Upgrade to Pro for 100 messages or wait for monthly reset
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}