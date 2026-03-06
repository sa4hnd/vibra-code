import { v } from 'convex/values';

import { internal } from './_generated/api';
import { mutation, action, internalMutation, internalQuery } from './_generated/server';

/**
 * MIGRATIONS - Single responsibility: Database migrations and data fixes
 * This file ONLY handles data migrations and fixes
 */

/**
 * Migrate users from old billing schema to new billing schema
 * This removes old grace period fields and adds new billing period fields
 */
export const migrateBillingSchema = mutation({
  args: {},
  handler: async (ctx) => {
    console.log('🔄 Starting billing schema migration...');

    // Get all users with old billing fields
    const users = await ctx.db.query('users').collect();
    const usersToMigrate = users.filter(
      (user) => user.gracePeriodDays !== undefined || user.isInGracePeriod !== undefined
    );

    console.log(`📊 Found ${usersToMigrate.length} users to migrate`);

    let migratedCount = 0;

    for (const user of usersToMigrate) {
      try {
        // Create update object with only the fields we want to keep
        const updateData: any = {
          // Remove old fields by setting them to undefined
          gracePeriodDays: undefined,
          isInGracePeriod: undefined,
        };

        // If user was in grace period, convert to new billing period system
        if (user.isInGracePeriod && user.accessExpiresAt) {
          updateData.isCanceled = true;
          updateData.cancellationDate = user.lastCostUpdate || Date.now();
          updateData.billingPeriodEnd = user.accessExpiresAt;
        }

        await ctx.db.patch(user._id, updateData);
        migratedCount++;
        console.log(`✅ Migrated user ${user.clerkId}`);
      } catch (error) {
        console.error(`❌ Error migrating user ${user.clerkId}:`, error);
      }
    }

    console.log(`🎉 Migration completed! Migrated ${migratedCount} users`);
    return { migratedCount, totalUsers: usersToMigrate.length };
  },
});

/**
 * Backfill payment transactions for existing users with subscriptions
 * This creates transaction records for users who already have subscriptions
 * but don't have payment transaction records yet
 */
export const backfillPaymentTransactions = mutation({
  args: {},
  handler: async (ctx) => {
    console.log('🔄 Starting payment transactions backfill...');

    // Get all users with subscriptions
    const users = await ctx.db.query('users').collect();
    const usersWithSubscriptions = users.filter(
      (user) => user.subscriptionPlan && user.subscriptionPlan !== 'free' && user.subscriptionId
    );

    console.log(`📊 Found ${usersWithSubscriptions.length} users with subscriptions`);

    let createdCount = 0;

    for (const user of usersWithSubscriptions) {
      try {
        // Check if user already has payment transactions
        const existingTransactions = await ctx.db
          .query('paymentTransactions')
          .withIndex('by_userId', (q) => q.eq('userId', user.clerkId))
          .collect();

        if (existingTransactions.length > 0) {
          console.log(
            `⏭️ User ${user.clerkId} already has ${existingTransactions.length} transactions, skipping`
          );
          continue;
        }

        // Create a backfilled payment transaction
        const plan = user.subscriptionPlan || 'pro';
        const amount = plan === 'pro' ? 20 : 10; // Estimated amounts
        const creditsAdded = plan === 'pro' ? 40 : 5;

        await ctx.db.insert('paymentTransactions', {
          userId: user.clerkId,
          transactionId: `backfill_${user.subscriptionId || user._id}`,
          type: 'payment',
          amount,
          currency: 'usd',
          status: 'succeeded',
          description: `Backfilled subscription payment for ${plan} plan`,
          creditsAdded,
          subscriptionPlan: plan,
          processedAt: user.lastCostUpdate || Date.now(),
          createdAt: Date.now(),
          metadata: {
            backfilled: true,
            originalSubscriptionId: user.subscriptionId,
            migrationDate: Date.now(),
          },
        });

        createdCount++;
        console.log(`✅ Created backfill transaction for user ${user.clerkId} (${plan} plan)`);
      } catch (error) {
        console.error(`❌ Error creating transaction for user ${user.clerkId}:`, error);
      }
    }

    console.log(`🎉 Backfill completed! Created ${createdCount} payment transactions`);
    return { createdCount, totalUsers: usersWithSubscriptions.length };
  },
});

/**
 * SECRET: Initialize credit system for existing users
 */
export const initializeUserCredits = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (existingUser) {
      // Update existing user with credit fields if they don't exist
      await ctx.db.patch(existingUser._id, {
        creditsUSD: existingUser.creditsUSD || 5, // $5 default credits
        creditsUsed: existingUser.creditsUsed || 0,
        totalPaidUSD: existingUser.totalPaidUSD || 0,
        realCostUSD: existingUser.realCostUSD || 0,
        profitUSD: existingUser.profitUSD || 0,
      });

      return existingUser._id;
    }

    // Create new user with credit system
    const userId = await ctx.db.insert('users', {
      clerkId: args.clerkId,
      creditsUSD: 5, // $5 default credits
      creditsUsed: 0,
      totalPaidUSD: 0,
      realCostUSD: 0,
      profitUSD: 0,
      // Legacy fields
      subscriptionPlan: 'free',
      tokensRemaining: 0,
      tokensUsed: 0,
      lastTokenReset: Date.now(),
    });

    return userId;
  },
});

/**
 * SECRET: Migrate field names from old schema to new schema
 */
export const migrateFieldNames = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    let migratedCount = 0;

    for (const user of users) {
      const updates: any = {};

      // Migrate actualCostUSD to realCostUSD
      if (user.actualCostUSD !== undefined) {
        updates.realCostUSD = user.actualCostUSD;
      }

      // totalCostUSD was redundant with actualCostUSD, so it's effectively removed
      // by not including it in updates

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(user._id, updates);
        migratedCount++;
      }
    }

    return {
      migratedCount,
      totalUsers: users.length,
    };
  },
});

/**
 * SECRET: Migrate existing users from tokens to credits
 */
export const migrateTokensToCredits = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    let migratedCount = 0;

    for (const user of users) {
      // Only migrate users who haven't been migrated yet
      if (user.creditsUSD === undefined && user.tokensRemaining !== undefined) {
        const tokensRemaining = user.tokensRemaining || 0;
        // Convert tokens to credits (1 token = $0.40 credit)
        const creditsUSD = tokensRemaining * 0.4;

        await ctx.db.patch(user._id, {
          creditsUSD,
          creditsUsed: user.tokensUsed || 0,
          totalPaidUSD: 0, // Unknown for existing users
          realCostUSD: 0,
          profitUSD: 0, // Will be set when they make their first payment
        });

        migratedCount++;
      }
    }

    return {
      migratedCount,
      totalUsers: users.length,
    };
  },
});

/**
 * SECRET: Fix free users who have $40 credits (should be $5)
 */
export const fixFreeUserCredits = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    let fixedCount = 0;

    for (const user of users) {
      // Fix free users who have $40 credits (should be $5)
      if (user.subscriptionPlan === 'free' && user.creditsUSD === 40) {
        await ctx.db.patch(user._id, {
          creditsUSD: 5, // Fix to $5 for free users
        });
        fixedCount++;
      }
    }

    return {
      fixedCount,
      totalUsers: users.length,
    };
  },
});

/**
 * Migrate a specific user from token mode to credit mode
 * Called when user switches agent type from cursor to claude/gemini
 *
 * Conversion formula:
 * - Assume average message cost: $0.05
 * - Cost ratio (margin): 0.25 (user pays 4x real cost)
 * - creditEquivalent = messagesRemaining × $0.05 / 0.25
 *
 * Example: 100 messages → 100 × 0.05 / 0.25 = $20 credits
 */
export const migrateUserToCredits = mutation({
  args: {
    clerkId: v.string(),
    avgMessageCost: v.optional(v.number()), // Default: $0.05
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Configuration
    const AVG_MESSAGE_COST = args.avgMessageCost || 0.05; // Default $0.05 per message
    const COST_RATIO = 0.25; // 25% margin (user pays 4x real cost in credits)

    const messagesRemaining = user.messagesRemaining || 0;

    // Calculate credit equivalent of remaining tokens
    const creditEquivalent = (messagesRemaining * AVG_MESSAGE_COST) / COST_RATIO;

    // Add to existing credits (if any)
    const currentCredits = user.creditsUSD || 0;
    const newCredits = currentCredits + creditEquivalent;

    console.log(`💰 Migrating user ${user.clerkId} from tokens to credits:`);
    console.log(`   Messages remaining: ${messagesRemaining}`);
    console.log(`   Avg message cost: $${AVG_MESSAGE_COST}`);
    console.log(`   Credit equivalent: $${creditEquivalent.toFixed(2)}`);
    console.log(`   Current credits: $${currentCredits.toFixed(2)}`);
    console.log(`   New credit balance: $${newCredits.toFixed(2)}`);

    await ctx.db.patch(user._id, {
      creditsUSD: newCredits,
      // Keep messages for potential rollback
      // messagesRemaining stays as-is
    });

    return {
      success: true,
      tokensMigrated: messagesRemaining,
      creditsAdded: creditEquivalent,
      newBalance: newCredits,
      avgMessageCost: AVG_MESSAGE_COST,
      costRatio: COST_RATIO,
    };
  },
});

/**
 * Batch migrate all users to credit mode
 * Admin function to migrate entire user base when switching default agent type
 */
export const batchMigrateToCredits = mutation({
  args: {
    agentType: v.union(v.literal('claude'), v.literal('gemini')),
    avgMessageCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query('users').collect();
    let migratedCount = 0;
    let totalCreditsAdded = 0;

    const AVG_MESSAGE_COST = args.avgMessageCost || 0.05;
    const COST_RATIO = 0.25;

    for (const user of users) {
      // Only migrate users currently on cursor (token mode)
      if (user.agentType && user.agentType !== 'cursor') {
        console.log(`⏭️ Skipping user ${user.clerkId} - already on ${user.agentType}`);
        continue;
      }

      const messagesRemaining = user.messagesRemaining || 0;
      const creditEquivalent = (messagesRemaining * AVG_MESSAGE_COST) / COST_RATIO;
      const currentCredits = user.creditsUSD || 0;
      const newCredits = currentCredits + creditEquivalent;

      await ctx.db.patch(user._id, {
        agentType: args.agentType,
        billingMode: 'credits',
        creditsUSD: newCredits,
      });

      migratedCount++;
      totalCreditsAdded += creditEquivalent;
      console.log(
        `✅ Migrated user ${user.clerkId}: ${messagesRemaining} tokens → $${creditEquivalent.toFixed(2)} credits`
      );
    }

    console.log(
      `🎉 Batch migration complete! Migrated ${migratedCount} users, added $${totalCreditsAdded.toFixed(2)} total credits`
    );

    return {
      migratedCount,
      totalUsers: users.length,
      totalCreditsAdded,
      targetAgentType: args.agentType,
    };
  },
});

/**
 * Initialize agent type and billing mode for all users
 * Sets based on GLOBAL config for users who don't have it set
 */
export const initializeAgentTypes = mutation({
  args: {},
  handler: async (ctx) => {
    // Get GLOBAL agent type from config
    const config = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'agentType'))
      .first();
    const globalAgentType = (config?.value as 'cursor' | 'claude' | 'gemini') || 'cursor';
    const globalBillingMode = globalAgentType === 'cursor' ? 'tokens' : 'credits';

    console.log(
      `🔧 Using global config: agentType=${globalAgentType}, billingMode=${globalBillingMode}`
    );

    const users = await ctx.db.query('users').collect();
    let updatedCount = 0;

    for (const user of users) {
      if (!user.agentType || !user.billingMode) {
        await ctx.db.patch(user._id, {
          agentType: user.agentType || globalAgentType,
          billingMode: user.billingMode || globalBillingMode,
        });
        updatedCount++;
        console.log(
          `✅ Initialized agent type for user ${user.clerkId}: ${globalAgentType}/${globalBillingMode}`
        );
      }
    }

    console.log(`🎉 Initialized agent types for ${updatedCount} users`);

    return {
      updatedCount,
      totalUsers: users.length,
      globalAgentType,
      globalBillingMode,
    };
  },
});

/**
 * FIX: Users with missing/null/zero credits
 *
 * This migration fixes users who were created through broken code paths
 * that didn't properly initialize the credit system.
 *
 * Fixes:
 * 1. Users with creditsUSD = null/undefined → set to $5 (free plan default)
 * 2. Users with creditsUSD = 0 but free plan → set to $5
 * 3. Users missing agentType/billingMode → set from globalConfig
 */
export const fixUsersWithMissingCredits = mutation({
  args: {
    dryRun: v.optional(v.boolean()), // If true, only report what would be fixed
  },
  handler: async (ctx, args) => {
    const isDryRun = args.dryRun ?? false;
    console.log(
      `🔧 ${isDryRun ? '[DRY RUN]' : ''} Starting migration to fix users with missing credits...`
    );

    // Get GLOBAL agent type from config
    const config = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'agentType'))
      .first();
    const globalAgentType = (config?.value as 'cursor' | 'claude' | 'gemini') || 'cursor';
    const globalBillingMode = globalAgentType === 'cursor' ? 'tokens' : 'credits';

    const users = await ctx.db.query('users').collect();
    let fixedCount = 0;
    const fixedUsers: {
      clerkId: string;
      issues: string[];
      creditsBefore: number | null | undefined;
      creditsAfter: number;
    }[] = [];

    // Plan configurations for correct credit amounts
    const PLAN_CREDITS: Record<string, number> = {
      free: 5,
      weekly_plus: 16,
      pro: 40,
      business: 100,
      enterprise: 400,
    };

    for (const user of users) {
      const issues: string[] = [];
      const updates: any = {};

      // Check for missing/null/zero credits
      const hasMissingCredits = user.creditsUSD === undefined || user.creditsUSD === null;
      const hasZeroCredits = user.creditsUSD === 0;
      const plan = user.subscriptionPlan || 'free';
      const correctCredits = PLAN_CREDITS[plan] || 5;

      if (hasMissingCredits) {
        issues.push(`creditsUSD is ${user.creditsUSD === undefined ? 'undefined' : 'null'}`);
        updates.creditsUSD = correctCredits;
      } else if (hasZeroCredits && plan === 'free') {
        // Free users should have $5, not $0
        issues.push('creditsUSD is 0 for free plan (should be $5)');
        updates.creditsUSD = 5;
      }

      // Check for missing creditsUsed
      if (user.creditsUsed === undefined || user.creditsUsed === null) {
        issues.push('creditsUsed is missing');
        updates.creditsUsed = 0;
      }

      // Check for missing agentType
      if (!user.agentType) {
        issues.push('agentType is missing');
        updates.agentType = globalAgentType;
      }

      // Check for missing billingMode
      if (!user.billingMode) {
        issues.push('billingMode is missing');
        updates.billingMode = globalBillingMode;
      }

      // Check for missing cost tracking fields
      if (user.realCostUSD === undefined || user.realCostUSD === null) {
        issues.push('realCostUSD is missing');
        updates.realCostUSD = 0;
      }
      if (user.profitUSD === undefined || user.profitUSD === null) {
        issues.push('profitUSD is missing');
        updates.profitUSD = 0;
      }
      if (user.totalPaidUSD === undefined || user.totalPaidUSD === null) {
        issues.push('totalPaidUSD is missing');
        updates.totalPaidUSD = 0;
      }

      // Apply fixes if there are issues
      if (issues.length > 0) {
        fixedUsers.push({
          clerkId: user.clerkId,
          issues,
          creditsBefore: user.creditsUSD,
          creditsAfter: updates.creditsUSD ?? user.creditsUSD ?? 0,
        });

        if (!isDryRun) {
          await ctx.db.patch(user._id, updates);
        }

        fixedCount++;
        console.log(
          `${isDryRun ? '[DRY RUN]' : '✅'} Fixed user ${user.clerkId}: ${issues.join(', ')}`
        );
      }
    }

    console.log(
      `🎉 ${isDryRun ? '[DRY RUN]' : ''} Migration complete! Fixed ${fixedCount}/${users.length} users`
    );

    return {
      dryRun: isDryRun,
      fixedCount,
      totalUsers: users.length,
      globalAgentType,
      globalBillingMode,
      fixedUsers: fixedUsers.slice(0, 50), // Return first 50 for review
    };
  },
});

// ============================================================================
// CLERK PROFILE SYNC
// ============================================================================

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

/**
 * Internal mutation to update a single user's profile
 */
export const updateUserProfileInternal = internalMutation({
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
      console.log(`⚠️ User not found for clerkId: ${args.clerkId}`);
      return null;
    }

    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      fullName: args.fullName,
      email: args.email,
      imageUrl: args.imageUrl,
    });

    return user._id;
  },
});

/**
 * Action to fetch user profile from Clerk and update Convex
 * This makes HTTP calls to Clerk API
 */
export const syncUserProfileFromClerk = action({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY not configured');
    }

    try {
      const response = await fetch(`https://api.clerk.com/v1/users/${args.clerkId}`, {
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Clerk API error: ${response.status}`);
      }

      const clerkUser = await response.json();

      // Extract profile data
      const firstName = clerkUser.first_name || undefined;
      const lastName = clerkUser.last_name || undefined;
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || undefined;
      const email = clerkUser.email_addresses?.[0]?.email_address || undefined;
      const imageUrl = clerkUser.image_url || undefined;

      // Update in Convex
      await ctx.runMutation(internal.migrations.updateUserProfileInternal, {
        clerkId: args.clerkId,
        firstName,
        lastName,
        fullName,
        email,
        imageUrl,
      });

      return {
        success: true,
        clerkId: args.clerkId,
        firstName,
        lastName,
        email,
      };
    } catch (error: any) {
      console.error(`❌ Error syncing profile for ${args.clerkId}:`, error.message);
      return {
        success: false,
        clerkId: args.clerkId,
        error: error.message,
      };
    }
  },
});

/**
 * Action to backfill ALL user profiles from Clerk
 * Fetches profile data for all existing users
 */
export const backfillUserProfiles = action({
  args: {},
  handler: async (ctx) => {
    if (!CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY not configured');
    }

    // Get all users from Convex
    const users = await ctx.runQuery(internal.migrations.getAllUsersForBackfill, {});

    console.log(`🔄 Backfilling profiles for ${users.length} users...`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const user of users) {
      // Skip users who already have profile data
      if (user.firstName && user.email) {
        console.log(`⏭️ Skipping ${user.clerkId} - already has profile data`);
        continue;
      }

      try {
        const response = await fetch(`https://api.clerk.com/v1/users/${user.clerkId}`, {
          headers: {
            Authorization: `Bearer ${CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Clerk API error: ${response.status}`);
        }

        const clerkUser = await response.json();

        // Extract profile data
        const firstName = clerkUser.first_name || undefined;
        const lastName = clerkUser.last_name || undefined;
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || undefined;
        const email = clerkUser.email_addresses?.[0]?.email_address || undefined;
        const imageUrl = clerkUser.image_url || undefined;

        // Update in Convex
        await ctx.runMutation(internal.migrations.updateUserProfileInternal, {
          clerkId: user.clerkId,
          firstName,
          lastName,
          fullName,
          email,
          imageUrl,
        });

        successCount++;
        console.log(`✅ Synced profile for ${user.clerkId}: ${fullName || email}`);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        errorCount++;
        errors.push(`${user.clerkId}: ${error.message}`);
        console.error(`❌ Error syncing ${user.clerkId}:`, error.message);
      }
    }

    console.log(`🎉 Backfill complete! Success: ${successCount}, Errors: ${errorCount}`);

    return {
      totalUsers: users.length,
      successCount,
      errorCount,
      errors: errors.slice(0, 10), // Return first 10 errors
    };
  },
});

/**
 * Internal query to get all users for backfill
 */
export const getAllUsersForBackfill = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('users').collect();
  },
});
