import { v } from 'convex/values';

import { mutation, query, MutationCtx } from './_generated/server';
import { getMessagesForPlan, getCreditsForPlan } from '../lib/plans';
import { getProductMultiplier } from '../lib/revenuecat/product-mapping';

// ============================================================================
// STANDARDIZED USER CREATION HELPER
// ============================================================================

/**
 * Creates a new user with all required default fields.
 * This is the SINGLE source of truth for user creation.
 * ALL user creation paths MUST use this helper to ensure consistency.
 */
interface CreateUserOptions {
  clerkId: string;
  // Profile fields
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  imageUrl?: string;
  // Subscription overrides
  subscriptionPlan?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
  messagesRemaining?: number;
  accessExpiresAt?: number;
  isTrialPeriod?: boolean;
  willRenew?: boolean;
  originalProductId?: string;
  lastGrantedTransactionId?: string;
}

async function createUserWithDefaults(ctx: MutationCtx, options: CreateUserOptions) {
  // Get global agent type from config
  const config = await ctx.db
    .query('globalConfig')
    .withIndex('by_key', (q) => q.eq('key', 'agentType'))
    .first();
  const agentType = (config?.value as 'cursor' | 'claude' | 'gemini') || 'cursor';
  const billingMode = agentType === 'cursor' ? 'tokens' : 'credits';

  // Calculate defaults based on plan
  const plan = options.subscriptionPlan || 'free';
  const messagesPerMonth = options.messagesRemaining ?? getMessagesForPlan(plan);
  const creditsForPlan = getCreditsForPlan(plan);

  console.log(
    `📝 Creating user with defaults: plan=${plan}, messages=${messagesPerMonth}, credits=$${creditsForPlan}, agentType=${agentType}`
  );

  const userId = await ctx.db.insert('users', {
    // Required field
    clerkId: options.clerkId,
    // Profile fields
    firstName: options.firstName,
    lastName: options.lastName,
    fullName: options.fullName,
    email: options.email,
    imageUrl: options.imageUrl,
    // Subscription fields
    subscriptionPlan: plan,
    subscriptionId: options.subscriptionId,
    subscriptionStatus: options.subscriptionStatus || (plan === 'free' ? 'inactive' : 'active'),
    // Message system (token mode)
    messagesRemaining: messagesPerMonth,
    messagesUsed: 0,
    lastMessageReset: Date.now(),
    // Credit system (credit mode)
    creditsUSD: creditsForPlan,
    creditsUsed: 0,
    realCostUSD: 0,
    profitUSD: 0,
    totalPaidUSD: 0,
    // Agent type and billing mode
    agentType,
    billingMode,
    // Additional subscription fields
    accessExpiresAt: options.accessExpiresAt,
    isTrialPeriod: options.isTrialPeriod,
    willRenew: options.willRenew,
    originalProductId: options.originalProductId,
    lastGrantedTransactionId: options.lastGrantedTransactionId,
  });

  return userId;
}

// Get user's message information
export const getUserMessages = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    return user;
  },
});

// Create user with free plan (called from client)
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    fullName: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log(`🔄 Creating user for clerkId: ${args.clerkId}`);

    // Double-check for existing user to prevent race conditions
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (existingUser) {
      console.log(`✅ User already exists: ${existingUser._id}`);
      // Always sync profile info from Clerk if provided and different
      const profileUpdates: Record<string, string | undefined> = {};
      if (args.firstName && args.firstName !== existingUser.firstName) {
        profileUpdates.firstName = args.firstName;
      }
      if (args.lastName && args.lastName !== existingUser.lastName) {
        profileUpdates.lastName = args.lastName;
      }
      if (args.fullName && args.fullName !== existingUser.fullName) {
        profileUpdates.fullName = args.fullName;
      }
      if (args.email && args.email !== existingUser.email) {
        profileUpdates.email = args.email;
      }
      if (args.imageUrl && args.imageUrl !== existingUser.imageUrl) {
        profileUpdates.imageUrl = args.imageUrl;
      }

      if (Object.keys(profileUpdates).length > 0) {
        await ctx.db.patch(existingUser._id, profileUpdates);
        console.log(`📝 Synced profile from Clerk for user: ${existingUser._id}`, profileUpdates);
      }
      return existingUser;
    }

    try {
      // Use standardized helper for consistent user creation
      const userId = await createUserWithDefaults(ctx, {
        clerkId: args.clerkId,
        firstName: args.firstName,
        lastName: args.lastName,
        fullName: args.fullName,
        email: args.email,
        imageUrl: args.imageUrl,
      });

      const newUser = await ctx.db.get(userId);
      console.log(`✅ New user created: ${userId}`);
      return newUser;
    } catch (error) {
      console.error(`❌ Error creating user: ${error}`);

      // If there's a race condition and user was created by another request,
      // try to fetch the existing user
      const existingUser = await ctx.db
        .query('users')
        .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
        .first();

      if (existingUser) {
        console.log(`✅ Found existing user after race condition: ${existingUser._id}`);
        return existingUser;
      }

      throw error;
    }
  },
});

// Update user profile (syncs data from Clerk)
export const updateUserProfile = mutation({
  args: {
    clerkId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    fullName: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      // Create user if doesn't exist - use standardized helper
      console.log(`📝 User not found, creating via updateUserProfile for clerkId: ${args.clerkId}`);
      return await createUserWithDefaults(ctx, {
        clerkId: args.clerkId,
        firstName: args.firstName,
        lastName: args.lastName,
        fullName: args.fullName,
        email: args.email,
        imageUrl: args.imageUrl,
      });
    }

    // Update existing user's profile
    const updates: Record<string, string | undefined> = {};
    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.fullName !== undefined) updates.fullName = args.fullName;
    if (args.email !== undefined) updates.email = args.email;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(user._id, updates);
      console.log(`✅ Updated profile for user ${args.clerkId}`);
    }

    return user._id;
  },
});

// Check if user has messages available
export const hasMessages = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) return false;
    return (user.messagesRemaining || 0) > 0;
  },
});

// Consume a message (when user sends a message)
export const consumeMessage = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    const messagesRemaining = user.messagesRemaining || 0;
    if (messagesRemaining <= 0) {
      throw new Error('No messages remaining');
    }

    await ctx.db.patch(user._id, {
      messagesRemaining: messagesRemaining - 1,
      messagesUsed: (user.messagesUsed || 0) + 1,
    });

    return messagesRemaining - 1;
  },
});

// Update user subscription (called from webhook)
// SIMPLE: If RevenueCat says user is Pro, make them Pro with their messages
export const updateUserSubscription = mutation({
  args: {
    clerkId: v.string(),
    subscriptionPlan: v.string(),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    const messagesPerMonth = getMessagesForPlan(args.subscriptionPlan);
    const newPlan = (args.subscriptionPlan || 'free').toLowerCase();

    if (!user) {
      console.log(`📝 New user from webhook: ${args.clerkId}, plan: ${newPlan}`);
      return await createUserWithDefaults(ctx, {
        clerkId: args.clerkId,
        subscriptionPlan: args.subscriptionPlan,
        subscriptionId: args.subscriptionId,
        subscriptionStatus: args.subscriptionStatus,
        messagesRemaining: messagesPerMonth,
      });
    }

    const oldPlan = (user.subscriptionPlan || 'free').toLowerCase();
    const planChanged = oldPlan !== newPlan;

    // Grant messages if upgrading from free or plan changed to paid
    const shouldGrantMessages = newPlan !== 'free' && (oldPlan === 'free' || planChanged);

    if (shouldGrantMessages) {
      console.log(`✅ Webhook: ${oldPlan} → ${newPlan}, granting ${messagesPerMonth} messages`);
      await ctx.db.patch(user._id, {
        subscriptionPlan: args.subscriptionPlan,
        subscriptionId: args.subscriptionId,
        subscriptionStatus: args.subscriptionStatus,
        messagesRemaining: messagesPerMonth,
        messagesUsed: 0,
        lastMessageReset: Date.now(),
      });
    } else {
      console.log(`ℹ️ Webhook: ${oldPlan} → ${newPlan}, no change needed`);
      await ctx.db.patch(user._id, {
        subscriptionPlan: args.subscriptionPlan,
        subscriptionId: args.subscriptionId,
        subscriptionStatus: args.subscriptionStatus,
      });
    }

    return user._id;
  },
});

// Sync subscription status - SIMPLE LOGIC
// RevenueCat is the source of truth. If they say user is Pro, user is Pro.
// Grants both messages AND credits based on plan.
export const syncSubscriptionStatus = mutation({
  args: {
    clerkId: v.string(),
    subscriptionPlan: v.string(),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    accessExpiresAt: v.optional(v.number()),
    isTrialPeriod: v.optional(v.boolean()),
    willRenew: v.optional(v.boolean()),
    originalProductId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    // Calculate resources based on plan and product (yearly = 12x)
    const multiplier = getProductMultiplier(args.originalProductId);
    const messagesPerMonth = getMessagesForPlan(args.subscriptionPlan);
    const creditsPerMonth = getCreditsForPlan(args.subscriptionPlan);
    const messagesToGrant = messagesPerMonth * multiplier;
    const creditsToGrant = creditsPerMonth * multiplier;
    const newPlan = (args.subscriptionPlan || 'free').toLowerCase();

    if (!user) {
      // New user - create with their plan
      console.log(
        `📝 New user: ${args.clerkId}, plan: ${newPlan}, messages: ${messagesToGrant}, credits: $${creditsToGrant}`
      );

      const userId = await createUserWithDefaults(ctx, {
        clerkId: args.clerkId,
        subscriptionPlan: args.subscriptionPlan,
        subscriptionId: args.subscriptionId,
        subscriptionStatus: args.subscriptionStatus,
        messagesRemaining: messagesToGrant,
        accessExpiresAt: args.accessExpiresAt,
        isTrialPeriod: args.isTrialPeriod,
        willRenew: args.willRenew,
        originalProductId: args.originalProductId,
      });

      // Also set credits for new user
      if (newPlan !== 'free') {
        await ctx.db.patch(userId, { creditsUSD: creditsToGrant, creditsUsed: 0 });
      }

      return { userId, tokensGranted: newPlan !== 'free', isNewUser: true };
    }

    // Existing user - check what changed
    const oldPlan = (user.subscriptionPlan || 'free').toLowerCase();
    const planChanged = oldPlan !== newPlan;

    console.log(`🔄 Sync: ${args.clerkId}, ${oldPlan} → ${newPlan}, multiplier: ${multiplier}x`);

    // Grant resources if upgrading from free or plan changed to paid
    const shouldGrant = newPlan !== 'free' && (oldPlan === 'free' || planChanged);

    const updateData: Record<string, any> = {
      subscriptionPlan: args.subscriptionPlan,
      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.subscriptionStatus,
    };

    if (args.accessExpiresAt !== undefined) updateData.accessExpiresAt = args.accessExpiresAt;
    if (args.isTrialPeriod !== undefined) updateData.isTrialPeriod = args.isTrialPeriod;
    if (args.willRenew !== undefined) updateData.willRenew = args.willRenew;
    if (args.originalProductId !== undefined) updateData.originalProductId = args.originalProductId;

    if (shouldGrant) {
      console.log(
        `✅ Granting: ${messagesToGrant} messages + $${creditsToGrant} credits for ${newPlan}`
      );
      // Grant both messages AND credits
      updateData.messagesRemaining = messagesToGrant;
      updateData.messagesUsed = 0;
      updateData.creditsUSD = creditsToGrant;
      updateData.creditsUsed = 0;
      updateData.lastMessageReset = Date.now();
    }

    await ctx.db.patch(user._id, updateData);

    return { userId: user._id, tokensGranted: shouldGrant, planChanged };
  },
});

// Reset messages (for monthly reset)
export const resetMessages = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) return;

    const messagesPerMonth = getMessagesForPlan(user.subscriptionPlan || 'free');

    await ctx.db.patch(user._id, {
      messagesRemaining: messagesPerMonth,
      messagesUsed: 0,
      lastMessageReset: Date.now(),
    });
  },
});

// Get all users for monthly reset (admin function)
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('users').collect();
  },
});

// Get user by Clerk ID (for compatibility)
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();
  },
});

// Get user's current subscription state (for detecting purchases/renewals)
export const getUserSubscriptionState = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      return null;
    }

    return {
      subscriptionPlan: user.subscriptionPlan || 'free',
      subscriptionId: user.subscriptionId || null,
      subscriptionStatus: user.subscriptionStatus || 'inactive',
    };
  },
});

// Update user's Stripe customer ID
export const updateUserStripeCustomer = mutation({
  args: {
    clerkId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
    });

    return {
      success: true,
      stripeCustomerId: args.stripeCustomerId,
    };
  },
});

// Legacy function for compatibility (now just calls updateUserSubscription)
export const updateUserCredits = mutation({
  args: {
    clerkId: v.string(),
    creditsUSD: v.number(),
    totalPaidUSD: v.number(),
  },
  handler: async (ctx, args) => {
    // This function is deprecated - just update the subscription to allocate messages
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Just return success - the message system handles allocation
    return {
      success: true,
      message: 'Credits system deprecated - using message system',
    };
  },
});

// Migrate existing users to message system (one-time migration)
export const migrateUserToMessages = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user already has message fields
    if (user.messagesRemaining !== undefined) {
      return user; // Already migrated
    }

    // Get messages for their current plan
    const messagesPerMonth = getMessagesForPlan(user.subscriptionPlan || 'free');

    // Update user with message fields
    await ctx.db.patch(user._id, {
      messagesRemaining: messagesPerMonth,
      messagesUsed: 0,
      lastMessageReset: Date.now(),
    });

    // Return updated user
    return await ctx.db.get(user._id);
  },
});

// SECRET: Clean up duplicate users (admin function)
export const cleanupDuplicateUsers = mutation({
  args: {},
  handler: async (ctx) => {
    console.log('🧹 Starting duplicate user cleanup...');

    // Get all users
    const allUsers = await ctx.db.query('users').collect();

    // Group by clerkId
    const userGroups = new Map<string, any[]>();
    for (const user of allUsers) {
      if (!userGroups.has(user.clerkId)) {
        userGroups.set(user.clerkId, []);
      }
      userGroups.get(user.clerkId)!.push(user);
    }

    let duplicatesRemoved = 0;

    // Process each group
    for (const [clerkId, users] of userGroups) {
      if (users.length > 1) {
        console.log(`🔍 Found ${users.length} duplicate users for clerkId: ${clerkId}`);

        // Keep the first user (oldest), delete the rest
        const [keepUser, ...duplicateUsers] = users.sort(
          (a, b) => a._creationTime - b._creationTime
        );

        console.log(
          `✅ Keeping user: ${keepUser._id} (created: ${new Date(keepUser._creationTime)})`
        );

        for (const duplicateUser of duplicateUsers) {
          console.log(
            `🗑️ Deleting duplicate user: ${duplicateUser._id} (created: ${new Date(duplicateUser._creationTime)})`
          );
          await ctx.db.delete(duplicateUser._id);
          duplicatesRemoved++;
        }
      }
    }

    console.log(`✅ Cleanup complete. Removed ${duplicatesRemoved} duplicate users.`);
    return { duplicatesRemoved, totalUsers: allUsers.length };
  },
});

// ============================================================================
// AGENT TYPE MANAGEMENT (NOW READS FROM GLOBAL CONFIG)
// ============================================================================

/**
 * Get the GLOBAL agent type (cursor, claude, or gemini)
 * This is now controlled globally by admin, not per-user
 */
export const getUserAgentType = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Get GLOBAL agent type from config table
    const config = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'agentType'))
      .first();

    return config?.value || 'cursor';
  },
});

/**
 * @deprecated - Use admin.setGlobalAgentType() instead
 * This mutation is kept for backwards compatibility but should not be used.
 * Agent type is now controlled GLOBALLY by admin.
 */
export const setUserAgentType = mutation({
  args: {
    clerkId: v.string(),
    agentType: v.union(v.literal('cursor'), v.literal('claude'), v.literal('gemini')),
  },
  handler: async (ctx, args) => {
    // This is now a no-op - agent type is controlled globally
    console.log(`⚠️ setUserAgentType is deprecated. Use admin.setGlobalAgentType() instead.`);
    console.log(`   Requested: ${args.agentType} for user ${args.clerkId}`);

    // Get current global config for response
    const config = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'agentType'))
      .first();

    const currentAgentType = config?.value || 'cursor';

    return {
      success: false,
      message:
        'Agent type is now controlled globally by admin. Use admin.setGlobalAgentType() instead.',
      agentType: currentAgentType,
      billingMode: currentAgentType === 'cursor' ? 'tokens' : 'credits',
      migrated: false,
    };
  },
});

/**
 * Get user's billing mode based on GLOBAL agent type
 */
export const getUserBillingMode = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    // Get GLOBAL agent type
    const config = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'agentType'))
      .first();

    const agentType = config?.value || 'cursor';
    const billingMode = agentType === 'cursor' ? 'tokens' : 'credits';

    if (!user) {
      return { billingMode, agentType };
    }

    return {
      billingMode,
      agentType,
      // Token mode data
      messagesRemaining: user.messagesRemaining || 0,
      messagesUsed: user.messagesUsed || 0,
      // Credit mode data
      creditsUSD: user.creditsUSD || 0,
      creditsUsed: user.creditsUsed || 0,
    };
  },
});
