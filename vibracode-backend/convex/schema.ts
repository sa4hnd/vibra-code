import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),

    // USER PROFILE (from Clerk)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    fullName: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),

    // SUBSCRIPTION & BILLING
    subscriptionPlan: v.optional(v.string()), // 'free', 'weekly_plus', 'pro', 'business', 'enterprise'
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),

    // STRIPE INTEGRATION
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    migrationDate: v.optional(v.number()),
    migrationStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('failed')
      )
    ),

    // BILLING PERIOD & ACCESS CONTROL
    accessExpiresAt: v.optional(v.number()), // When pro access expires (end of billing period)
    billingPeriodEnd: v.optional(v.number()), // When current billing period ends
    isCanceled: v.optional(v.boolean()), // Whether subscription is canceled (but still active until period end)
    cancellationDate: v.optional(v.number()), // When user canceled their subscription
    isTrialPeriod: v.optional(v.boolean()), // Whether subscription is in trial period
    willRenew: v.optional(v.boolean()), // Whether subscription will auto-renew (false = scheduled cancellation)
    originalProductId: v.optional(v.string()), // Original RevenueCat product ID (to differentiate yearly vs monthly)
    lastGrantedTransactionId: v.optional(v.string()), // Last transaction ID that granted tokens (prevents double grants)

    // MESSAGE SYSTEM (what users see - TOKEN MODE for Cursor agent)
    messagesRemaining: v.optional(v.number()), // Messages remaining this month
    messagesUsed: v.optional(v.number()), // Messages used this month
    lastMessageReset: v.optional(v.number()), // When messages were last reset

    // AGENT TYPE & BILLING MODE
    agentType: v.optional(v.union(v.literal('cursor'), v.literal('claude'), v.literal('gemini'))), // Default: cursor
    billingMode: v.optional(v.union(v.literal('tokens'), v.literal('credits'))), // Derived from agentType

    // CREDIT SYSTEM (for Claude agent - tracks real costs with 2x multiplier)
    creditsUSD: v.optional(v.number()), // Available credits (what users see, 2x actual value)
    creditsUsed: v.optional(v.number()), // Total credits consumed
    totalPaidUSD: v.optional(v.number()), // Total money paid by user
    realCostUSD: v.optional(v.number()), // Actual API costs (internal tracking only)
    profitUSD: v.optional(v.number()), // Backend profit calculation (payment - actual cost)
    lastCostUpdate: v.optional(v.number()), // Timestamp of last cost update
    lastPaymentDate: v.optional(v.number()), // Timestamp of last payment

    // MOBILE APP
    notificationsEnabled: v.optional(v.boolean()),
    pushToken: v.optional(v.string()),
  })
    .index('by_clerkId', ['clerkId'])
    .index('by_subscriptionPlan', ['subscriptionPlan'])
    .index('by_messagesRemaining', ['messagesRemaining'])
    .index('by_lastMessageReset', ['lastMessageReset'])
    .index('by_agentType', ['agentType']),

  sessions: defineTable({
    createdBy: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    name: v.string(),
    tunnelUrl: v.optional(v.string()),
    repository: v.optional(v.string()),
    templateId: v.string(),
    pullRequest: v.optional(v.any()),
    // GitHub repository information
    githubRepository: v.optional(v.string()), // Full repository name (owner/repo)
    githubRepositoryUrl: v.optional(v.string()), // GitHub repository URL
    githubPushStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('failed')
      )
    ),
    githubPushDate: v.optional(v.number()), // Timestamp when pushed to GitHub
    status: v.union(
      v.literal('IN_PROGRESS'),
      v.literal('CLONING_REPO'),
      v.literal('INSTALLING_DEPENDENCIES'),
      v.literal('STARTING_DEV_SERVER'),
      v.literal('CREATING_TUNNEL'),
      v.literal('CUSTOM'),
      v.literal('RUNNING'),
      v.literal('CREATING_GITHUB_REPO'),
      v.literal('SETTING_UP_SANDBOX'),
      v.literal('INITIALIZING_GIT'),
      v.literal('ADDING_FILES'),
      v.literal('COMMITTING_CHANGES'),
      v.literal('PUSHING_TO_GITHUB'),
      v.literal('PUSH_COMPLETE'),
      v.literal('PUSH_FAILED'),
      v.literal('AUTO_PUSHING'),
      v.literal('USING_EXISTING_REPO')
    ),
    statusMessage: v.optional(v.string()),
    // Agent control
    agentStopped: v.optional(v.boolean()), // True when user manually stops the agent
    // Cost tracking
    totalCostUSD: v.optional(v.number()), // Total cost for this session
    messageCount: v.optional(v.number()), // Number of messages in this session
    lastCostUpdate: v.optional(v.number()), // Timestamp of last cost update

    // Environment Variables
    envs: v.optional(v.record(v.string(), v.string())), // Key-value pairs for environment variables

    // Convex Project Information
    convexProject: v.optional(
      v.object({
        deploymentName: v.string(),
        deploymentUrl: v.string(),
        adminKey: v.string(),
        projectSlug: v.optional(v.string()),
        teamSlug: v.optional(v.string()),
      })
    ),
  })
    .index('by_createdBy', ['createdBy'])
    .index('by_status', ['status'])
    .index('by_totalCostUSD', ['totalCostUSD'])
    .index('by_templateId', ['templateId']),

  messages: defineTable({
    sessionId: v.id('sessions'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    edits: v.optional(
      v.object({
        filePath: v.string(),
        oldString: v.string(),
        newString: v.string(),
      })
    ),
    todos: v.optional(
      v.array(
        v.object({
          id: v.string(),
          content: v.string(),
          status: v.string(),
          priority: v.string(),
        })
      )
    ),
    read: v.optional(
      v.object({
        filePath: v.string(),
      })
    ),
    bash: v.optional(
      v.object({
        command: v.string(),
        output: v.optional(v.string()),
        exitCode: v.optional(v.number()),
      })
    ),
    webSearch: v.optional(
      v.object({
        query: v.string(),
        results: v.optional(v.string()),
      })
    ),
    mcpTool: v.optional(
      v.object({
        toolName: v.string(),
        input: v.optional(v.any()),
        output: v.optional(v.any()),
        status: v.optional(v.string()),
      })
    ),
    tool: v.optional(
      v.object({
        toolName: v.string(),
        command: v.optional(v.string()),
        output: v.optional(v.string()),
        exitCode: v.optional(v.number()),
        status: v.optional(v.string()),
      })
    ),
    codebaseSearch: v.optional(
      v.object({
        query: v.string(),
        results: v.optional(v.string()),
        targetDirectories: v.optional(v.array(v.string())),
      })
    ),
    grep: v.optional(
      v.object({
        pattern: v.string(),
        filePath: v.string(),
        matches: v.optional(v.array(v.string())),
        lineCount: v.optional(v.number()),
      })
    ),
    searchReplace: v.optional(
      v.object({
        filePath: v.string(),
        oldString: v.string(),
        newString: v.string(),
        replacements: v.optional(v.number()),
      })
    ),
    image: v.optional(
      v.object({
        fileName: v.string(),
        path: v.string(),
        storageId: v.optional(v.id('_storage')),
      })
    ),
    // Multiple images array - paths stored here are NOT visible to users in chat
    // Agent reads from this field to get image paths without displaying them
    images: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          path: v.string(),
          storageId: v.optional(v.id('_storage')),
        })
      )
    ),
    // Multiple audios array - audio files attached to messages
    audios: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          path: v.string(),
          storageId: v.optional(v.id('_storage')),
        })
      )
    ),
    // Multiple videos array - video files attached to messages
    videos: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          path: v.string(),
          storageId: v.optional(v.id('_storage')),
        })
      )
    ),
    checkpoint: v.optional(
      v.object({
        branch: v.string(),
        patch: v.optional(v.string()),
      })
    ),
    content: v.string(),
    // Thinking/reasoning content (from Claude's extended thinking) - kept for backward compatibility
    thinking: v.optional(v.string()),
    // Stream ID for real-time updates - kept for backward compatibility
    streamId: v.optional(v.string()),
    // Cost tracking
    costUSD: v.optional(v.number()), // Cost for this specific message
    modelUsed: v.optional(v.string()), // Model used (e.g., "claude-sonnet-4-20250514")
    inputTokens: v.optional(v.number()), // Input tokens used
    outputTokens: v.optional(v.number()), // Output tokens used
    cacheReadTokens: v.optional(v.number()), // Cache read tokens
    cacheCreationTokens: v.optional(v.number()), // Cache creation tokens
    durationMs: v.optional(v.number()), // Duration in milliseconds
    createdAt: v.optional(v.number()), // Timestamp when message was created
  })
    .index('by_session', ['sessionId'])
    .index('by_createdAt', ['createdAt'])
    .index('by_role', ['role'])
    .index('by_costUSD', ['costUSD'])
    .index('by_modelUsed', ['modelUsed']),

  paymentTransactions: defineTable({
    userId: v.string(), // Clerk user ID
    transactionId: v.string(), // Stripe/Clerk transaction ID
    type: v.union(
      v.literal('payment'), // Successful payment
      v.literal('refund'), // Refund issued
      v.literal('chargeback'), // Chargeback/dispute
      v.literal('adjustment'), // Manual adjustment
      v.literal('subscription_change'), // Plan upgrade/downgrade
      v.literal('failed_payment') // Failed payment attempt
    ),
    amount: v.number(), // Amount in USD (positive for payments, negative for refunds)
    currency: v.string(), // Currency code (e.g., "usd")
    status: v.union(
      v.literal('pending'), // Payment processing
      v.literal('succeeded'), // Payment successful
      v.literal('failed'), // Payment failed
      v.literal('refunded'), // Refunded
      v.literal('disputed') // Under dispute
    ),
    description: v.optional(v.string()), // Human-readable description
    metadata: v.optional(v.any()), // Additional data (Stripe metadata, etc.)
    messagesAdded: v.optional(v.number()), // Messages added from this transaction
    subscriptionPlan: v.optional(v.string()), // Plan associated with transaction
    processedAt: v.number(), // Timestamp when transaction was processed
    createdAt: v.number(), // Timestamp when record was created

    // STRIPE INTEGRATION
    stripePaymentIntentId: v.optional(v.string()),
    stripeInvoiceId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    stripeSessionId: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_transactionId', ['transactionId'])
    .index('by_type', ['type'])
    .index('by_status', ['status'])
    .index('by_processedAt', ['processedAt'])
    .index('by_subscriptionPlan', ['subscriptionPlan']),

  // Global Configuration (admin-controlled settings)
  globalConfig: defineTable({
    key: v.string(), // e.g., "agentType"
    value: v.string(), // e.g., "cursor" | "claude" | "gemini"
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()), // Admin who made the change
  }).index('by_key', ['key']),

  // Convex OAuth credentials storage (same as chef)
  convexProjectCredentials: defineTable({
    userId: v.string(), // Clerk user ID
    projectSlug: v.string(),
    teamSlug: v.string(),
    projectDeployKey: v.string(), // OAuth token for creating projects
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_slugs', ['teamSlug', 'projectSlug']),

  // GitHub OAuth credentials storage
  githubCredentials: defineTable({
    clerkId: v.string(), // Clerk user ID
    accessToken: v.string(), // GitHub OAuth access token
    username: v.string(), // GitHub username
    connectedAt: v.number(), // When the connection was made
    updatedAt: v.number(), // Last token update
  }).index('by_clerkId', ['clerkId']),

  // RevenueCat OAuth credentials storage (for MCP integration)
  revenuecatCredentials: defineTable({
    clerkId: v.string(), // Clerk user ID
    accessToken: v.string(), // RevenueCat OAuth access token
    refreshToken: v.string(), // RevenueCat OAuth refresh token
    expiresAt: v.number(), // When the access token expires
    scope: v.string(), // OAuth scopes granted
    connectedAt: v.number(), // When the connection was made
    updatedAt: v.number(), // Last token update
  }).index('by_clerkId', ['clerkId']),

  // Image Studio - Generated and uploaded images
  generatedImages: defineTable({
    clerkId: v.string(), // User who generated the image
    sessionId: v.optional(v.id('sessions')), // Optional: link to session
    name: v.string(), // Unique name (gen-1, upload-1, etc.)
    prompt: v.optional(v.string()), // Original prompt
    revisedPrompt: v.optional(v.string()), // AI-revised prompt
    storageId: v.optional(v.id('_storage')), // Convex storage ID (optional during generation)
    url: v.optional(v.string()), // Download URL (optional during generation)
    isUploaded: v.optional(v.boolean()), // Whether this was uploaded (vs generated)
    status: v.union(v.literal('generating'), v.literal('completed'), v.literal('error')),
    errorMessage: v.optional(v.string()), // Error message if failed
    createdAt: v.number(), // When the image was created
  })
    .index('by_clerkId', ['clerkId'])
    .index('by_sessionId', ['sessionId'])
    .index('by_status', ['status'])
    .index('by_createdAt', ['createdAt']),

  // Audio Studio - Generated audio files
  generatedAudios: defineTable({
    clerkId: v.string(), // User who generated the audio
    sessionId: v.optional(v.id('sessions')), // Optional: link to session
    name: v.string(), // Unique name (audio-1, audio-2, etc.)
    text: v.optional(v.string()), // Text description for sound effect
    voiceId: v.optional(v.string()), // ElevenLabs voice ID (legacy, optional)
    storageId: v.id('_storage'), // Convex storage ID
    url: v.string(), // Download URL
    status: v.union(v.literal('generating'), v.literal('completed'), v.literal('error')),
    errorMessage: v.optional(v.string()), // Error message if failed
    createdAt: v.number(), // When the audio was created
  })
    .index('by_clerkId', ['clerkId'])
    .index('by_sessionId', ['sessionId'])
    .index('by_status', ['status'])
    .index('by_createdAt', ['createdAt']),

  // Video Studio - Generated video files
  generatedVideos: defineTable({
    clerkId: v.string(), // User who generated the video
    sessionId: v.optional(v.id('sessions')), // Optional: link to session
    name: v.string(), // Unique name (video-1, video-2, etc.)
    prompt: v.optional(v.string()), // Prompt used to generate video
    storageId: v.optional(v.id('_storage')), // Convex storage ID (optional during generation)
    url: v.optional(v.string()), // Download URL (optional during generation)
    status: v.union(v.literal('generating'), v.literal('completed'), v.literal('error')),
    errorMessage: v.optional(v.string()), // Error message if failed
    createdAt: v.number(), // When the video was created
  })
    .index('by_clerkId', ['clerkId'])
    .index('by_sessionId', ['sessionId'])
    .index('by_status', ['status'])
    .index('by_createdAt', ['createdAt']),

  // App Stealer - Stolen app research data
  stolenApps: defineTable({
    sessionId: v.id('sessions'), // Link to session
    clerkId: v.string(), // User who initiated the steal
    input: v.string(), // App name or URL provided
    inputType: v.union(
      v.literal('name'),
      v.literal('appstore'),
      v.literal('playstore'),
      v.literal('website')
    ),
    appData: v.optional(v.any()), // Scraped app data (name, screenshots, features, etc.)
    status: v.union(v.literal('researching'), v.literal('completed'), v.literal('failed')),
    errorMessage: v.optional(v.string()), // Error message if failed
    createdAt: v.number(), // When the steal was initiated
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_clerkId', ['clerkId'])
    .index('by_status', ['status'])
    .index('by_createdAt', ['createdAt']),
});
