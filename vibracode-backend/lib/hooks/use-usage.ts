import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useUser } from "@clerk/nextjs"
import { useEffect, useState } from "react"

export function useUsage() {
  const { user } = useUser()
  const [isMigrating, setIsMigrating] = useState(false)

  const userMessages = useQuery(api.usage.getUserMessages, {
    clerkId: user?.id || "",
  })

  const hasMessages = useQuery(api.usage.hasMessages, {
    clerkId: user?.id || "",
  })

  const consumeMessage = useMutation(api.usage.consumeMessage)
  const migrateUser = useMutation(api.usage.migrateUserToMessages)

  // NOTE: User creation is handled by UserInitializer component
  // This hook should ONLY handle migration for existing users with old schema
  useEffect(() => {
    if (user?.id && userMessages && userMessages.messagesRemaining === undefined && !isMigrating) {
      // User exists but needs migration to message system
      setIsMigrating(true)
      migrateUser({ clerkId: user.id }).finally(() => {
        setIsMigrating(false)
      })
    }
  }, [user?.id, userMessages, migrateUser, isMigrating])

  const canSendMessage = hasMessages === true
  const remainingMessages = userMessages?.messagesRemaining || 0
  const usedMessages = userMessages?.messagesUsed || 0
  
  // Get total messages and plan info based on subscription plan
  const getPlanInfo = (plan: string) => {
    switch (plan) {
      case "free": 
        return { totalMessages: 5, isPro: false, planName: "Free Plan" }
      case "weekly_plus": 
        return { totalMessages: 25, isPro: true, planName: "Weekly Plus" }
      case "pro": 
        return { totalMessages: 100, isPro: true, planName: "Pro Plan" }
      case "business": 
        return { totalMessages: 300, isPro: true, planName: "Business Plan" }
      case "enterprise": 
        return { totalMessages: 1000, isPro: true, planName: "Enterprise Plan" }
      default: 
        return { totalMessages: 5, isPro: false, planName: "Free Plan" }
    }
  }
  
  const planInfo = getPlanInfo(userMessages?.subscriptionPlan || "free")
  const { totalMessages, isPro, planName } = planInfo

  const sendMessage = async () => {
    if (!user?.id) {
      throw new Error("User not authenticated")
    }
    
    if (!canSendMessage) {
      throw new Error("No messages remaining")
    }

    try {
      const newRemainingMessages = await consumeMessage({ clerkId: user.id })
      return newRemainingMessages
    } catch (error) {
      throw error
    }
  }

  return {
    userMessages,
    canSendMessage,
    isPro,
    remainingMessages,
    usedMessages,
    totalMessages,
    planName,
    sendMessage,
    isLoading: userMessages === undefined,
  }
}
