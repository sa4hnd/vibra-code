import { NextRequest, NextResponse } from 'next/server'
import { stripe, verifyWebhookSignature, STRIPE_CONFIG } from '@/lib/stripe/client'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
// Removed import to avoid conflict with local function
import { getPlanConfig, getMessagesForPlan, getCreditsForPlan } from '@/lib/plans'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Track processed events to prevent duplicates
const processedEvents = new Set<string>()

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  let event: any = null
  
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      console.error('Missing Stripe signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Missing STRIPE_WEBHOOK_SECRET')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    // Verify webhook signature
    try {
      event = verifyWebhookSignature(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Check for duplicate events
    if (processedEvents.has(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`)
      return NextResponse.json({ received: true })
    }

    console.log(`🔔 Received Stripe webhook: ${event.type}`)
    console.log(`📊 Event ID: ${event.id}`)

    // Process the event
    await processWebhookEvent(event)

    // Mark event as processed
    processedEvents.add(event.id)

    console.log(`✅ Webhook processed successfully: ${event.type} (${event.id})`)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`❌ Webhook processing error for ${event?.type || 'unknown'} (${event?.id || 'unknown'}):`, error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available')
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function processWebhookEvent(event: any) {
  try {
    console.log(`🔄 Processing webhook event: ${event.type} (${event.id})`)
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionWebhook(event.data.object, event)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break

      case 'customer.subscription.paused':
        await handleSubscriptionPaused(event.data.object)
        break

      case 'customer.subscription.resumed':
        await handleSubscriptionResumed(event.data.object)
        break

      case 'customer.subscription.trial_ended':
        await handleTrialEnded(event.data.object)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object)
        break

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object)
        break

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object)
        break

      case 'invoice_payment.paid':
        await handleInvoicePaymentPaid(event.data.object)
        break

      case 'charge.dispute.created':
        await handleChargeDisputeCreated(event.data.object)
        break

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object)
        break

      case 'refund.created':
        await handleRefundCreated(event.data.object)
        break

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error(`Error processing ${event.type}:`, error)
    throw error
  }
}

async function handleCheckoutCompleted(session: any) {
  const clerkId = session.metadata?.clerkId
  const planId = session.metadata?.planId

  if (!clerkId || !planId) {
    console.warn('Missing metadata in checkout session:', session.id)
    return
  }

  console.log(`✅ Checkout completed for user ${clerkId}, plan ${planId}`)

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(session.subscription)

  // Get plan configuration
  const plan = getPlanConfig(planId)
  if (!plan) {
    console.error(`Plan ${planId} not found`)
    return
  }

  // Get user's agent type to determine billing mode
  const user = await convex.query(api.usage.getUserByClerkId, { clerkId })
  const agentType = user?.agentType || process.env.AGENT_TYPE || 'cursor'
  const billingMode = agentType === 'cursor' ? 'tokens' : 'credits'

  console.log(`💳 Billing mode for checkout: ${billingMode} (agent: ${agentType})`)

  if (billingMode === 'tokens') {
    // TOKEN MODE: Allocate messages
    await convex.mutation(api.usage.updateUserSubscription, {
      clerkId,
      subscriptionPlan: planId,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    })
  } else {
    // CREDIT MODE: Allocate credits using billing-switch
    await convex.mutation(api.billingSwitch.allocateResourcesForPlan, {
      clerkId,
      planId,
      transactionId: session.id,
    })

    // Also update subscription status
    await convex.mutation(api.usage.updateUserSubscription, {
      clerkId,
      subscriptionPlan: planId,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    })
  }

  // Create transaction record
  if (plan.price > 0) {
    const resourcesAllocated = billingMode === 'tokens' ? plan.messagesPerMonth : plan.creditsUSD
    await convex.mutation(api.paymentTransactions.createTransaction, {
      userId: clerkId,
      transactionId: session.id,
      type: 'payment',
      amount: plan.price,
      currency: 'usd',
      status: 'succeeded',
      description: `Checkout completed - ${plan.displayName}`,
      messagesAdded: billingMode === 'tokens' ? plan.messagesPerMonth : 0,
      subscriptionPlan: planId,
      processedAt: Date.now(),
      metadata: {
        stripeSessionId: session.id,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: session.customer,
        checkoutCompleted: true,
        billingMode,
        agentType,
        creditsAllocated: billingMode === 'credits' ? plan.creditsUSD : 0,
      },
    })
  }
}

async function handleSubscriptionWebhook(subscription: any, event?: any) {
  const clerkId = subscription.metadata?.clerkId

  console.log(`🔍 Processing subscription webhook:`, {
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: subscription.cancel_at,
    canceledAt: subscription.canceled_at,
    cancellationDetails: subscription.cancellation_details,
    clerkId: clerkId,
    metadata: subscription.metadata
  })

  if (!clerkId) {
    console.warn('No clerkId in subscription metadata:', subscription.id)
    return
  }

  // Check if this is actually a cancellation or just a status update
  // isActuallyCanceled should only be true if cancel_at_period_end is true OR canceled_at exists
  const isActuallyCanceled = subscription.cancel_at_period_end || !!subscription.canceled_at
  const isReactivation = !isActuallyCanceled && subscription.status === 'active' && subscription.cancel_at
  
  console.log(`📊 Subscription analysis:`, {
    isActuallyCanceled,
    isReactivation,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at
  })

  console.log(`✅ Subscription ${subscription.status} for user ${clerkId}`)

  // Determine plan from subscription
  const priceId = subscription.items.data[0]?.price?.id
  const metadataPlanId = subscription.metadata?.planId
  const planId = metadataPlanId || getPlanIdFromPriceId(priceId) || 'free'
  
  console.log(`🔍 Plan determination: priceId=${priceId}, metadataPlanId=${metadataPlanId}, finalPlanId=${planId}`)
  
  // Get plan configuration
  const plan = getPlanConfig(planId)
  const creditsToAdd = plan?.messagesPerMonth || 0

  // Handle different subscription statuses
  let finalPlanId = planId
  let finalStatus = subscription.status

  switch (subscription.status) {
    case 'active':
      // Subscription is active - check if it's scheduled for cancellation
      if (subscription.cancel_at_period_end) {
        // User canceled but keeps access until cancellation date
        // Keep the original plan but mark as canceled
        finalStatus = 'canceled'
        finalPlanId = planId // Keep the current plan (pro/business/etc) until period ends
        const periodEnd = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end
        const cancelDate = periodEnd 
          ? new Date(periodEnd * 1000).toISOString()
          : 'end of billing period'
        console.log(`📅 Subscription scheduled for cancellation at: ${cancelDate} (${subscription.id}) - keeping ${planId} plan`)
      } else {
        // Normal active subscription - check if this is a reactivation
        if (subscription.cancel_at && !subscription.cancel_at_period_end) {
          console.log(`🔄 Subscription reactivated (${subscription.id})`)
        }
        finalStatus = 'active'
        finalPlanId = planId
      }
      break
      
    case 'past_due':
      // Payment failed but subscription still exists
      // Keep access but mark as past due
      finalStatus = 'past_due'
      break
      
    case 'canceled':
      // Subscription was canceled - keep access until period end
      // Only downgrade if cancel_at_period_end is true and period has ended
      if (subscription.cancel_at_period_end && subscription.current_period_end < Math.floor(Date.now() / 1000)) {
        finalPlanId = 'free'
        finalStatus = 'canceled'
        console.log(`🔄 Billing period ended - downgrading to free plan`)
      } else {
        // Keep current plan but mark as canceled (user still has access)
        finalStatus = 'canceled'
        console.log(`⏳ Keeping pro plan - access until billing period ends`)
      }
      break
      
    case 'unpaid':
      // Subscription is unpaid - revoke access
      finalPlanId = 'free'
      finalStatus = 'unpaid'
      break
      
    case 'incomplete':
      // Payment requires action - keep current plan but mark as incomplete
      finalStatus = 'incomplete'
      break
      
    case 'incomplete_expired':
      // Payment failed and expired - downgrade to free
      finalPlanId = 'free'
      finalStatus = 'incomplete_expired'
      break
      
    case 'paused':
      // Subscription is paused - downgrade to free
      finalPlanId = 'free'
      finalStatus = 'paused'
      break
      
    default:
      console.warn(`Unknown subscription status: ${subscription.status}`)
  }

  // Update user subscription in database
  console.log(`💾 Updating user subscription:`, {
    clerkId,
    subscriptionPlan: finalPlanId,
    subscriptionId: subscription.id,
    subscriptionStatus: finalStatus,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: subscription.cancel_at
  })
  
  // Prepare cancellation tracking data
  const cancellationData: any = {
    clerkId,
    subscriptionPlan: finalPlanId,
    subscriptionId: subscription.id,
    subscriptionStatus: finalStatus,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    // Add cancellation tracking - only true if actually canceled
    isCanceled: !!(subscription.cancel_at_period_end || subscription.canceled_at),
    billingPeriodEnd: (subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end) ? 
      (subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end) * 1000 : undefined,
  }

  // Only add optional fields if they have values
  if (subscription.cancel_at_period_end) {
    cancellationData.cancellationDate = Date.now()
    const periodEnd = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end
    cancellationData.accessExpiresAt = periodEnd ? periodEnd * 1000 : undefined
  } else if (subscription.canceled_at) {
    // Handle immediate cancellation
    cancellationData.cancellationDate = subscription.canceled_at * 1000
    cancellationData.accessExpiresAt = subscription.canceled_at * 1000
  } else {
    // Subscription is active and not canceled - clear any previous cancellation data
    // Don't set these fields to null, just omit them
    delete cancellationData.cancellationDate
    delete cancellationData.accessExpiresAt
  }

  console.log(`💾 Updating user subscription with cancellation data:`, cancellationData)
  
  try {
    await convex.mutation(api.usage.updateUserSubscription, cancellationData)
    console.log(`✅ Successfully updated user subscription for ${clerkId}`)
  } catch (error) {
    console.error(`❌ Failed to update user subscription for ${clerkId}:`, error)
    throw error
  }

  // Only add credits for legitimate subscription events, not reactivations
  // Credits should only be added for:
  // 1. Initial subscription creation (handled by checkout.session.completed)
  // 2. Subscription renewals (invoice.payment_succeeded)
  // 3. Plan changes (when subscription items change)
  
  // Check if this is a plan change by comparing current vs previous items
  const isPlanChange = event.previous_attributes?.items || 
                       (event.previous_attributes && Object.keys(event.previous_attributes).length > 0)
  
  // Don't add credits for subscription updates unless it's a plan change
  const shouldAddCredits = false // Disabled for subscription.updated events
  
  console.log(`💰 Credit addition check for subscription.updated:`, {
    hasPlan: !!plan,
    planPrice: plan?.price,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at,
    isPlanChange,
    shouldAddCredits,
    reason: 'Credits only added for checkout.completed, invoice.payment_succeeded, and plan changes'
  })
  
  if (shouldAddCredits && plan) {
    await convex.mutation(api.usage.updateUserCredits, {
      clerkId,
      messagesPerMonth: creditsToAdd,
      totalPaidUSD: plan.price,
    })

    // Create transaction record
    await convex.mutation(api.paymentTransactions.createTransaction, {
      userId: clerkId,
      transactionId: subscription.id,
      type: 'payment',
      amount: plan.price,
      currency: 'usd',
      status: 'succeeded',
      description: `Subscription ${subscription.status} - ${plan.displayName}`,
      messagesAdded: creditsToAdd,
      subscriptionPlan: finalPlanId,
      processedAt: Date.now(),
      metadata: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        stripePriceId: priceId,
        subscriptionStatus: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    })
  } else if (subscription.status === 'canceled' && finalPlanId === 'free') {
    // Only reset credits if the billing period has actually ended
    const periodEnded = subscription.current_period_end < Math.floor(Date.now() / 1000)
    if (periodEnded) {
      console.log(`🔄 Billing period ended - resetting credits for ${clerkId}`)
      await convex.mutation(api.usage.updateUserCredits, {
        clerkId,
        messagesPerMonth: 0,
        totalPaidUSD: 0,
      })
    } else {
      console.log(`⏳ Billing period not ended yet - keeping credits for ${clerkId} until ${new Date(subscription.current_period_end * 1000).toISOString()}`)
    }
  } else if (subscription.status !== 'active' || (subscription.status === 'active' && (subscription.cancel_at_period_end || subscription.cancel_at))) {
    // Create transaction record for non-active status or scheduled cancellation
    const isScheduledCancellation = subscription.status === 'active' && (subscription.cancel_at_period_end || subscription.cancel_at)
    const cancelType = subscription.cancel_at_period_end ? 'period end' : 'specific date'
    const description = isScheduledCancellation 
      ? `Subscription scheduled for cancellation at ${cancelType} - ${plan?.displayName || 'plan'}`
      : `Subscription ${subscription.status} - ${plan?.displayName || 'plan'}${subscription.status === 'canceled' && finalPlanId === 'free' ? ', credits reset' : ''}`
    
    await convex.mutation(api.paymentTransactions.createTransaction, {
      userId: clerkId,
      transactionId: `${subscription.id}_${isScheduledCancellation ? 'scheduled_cancel' : subscription.status}`,
      type: 'subscription_change',
      amount: 0,
      currency: 'usd',
      status: 'succeeded',
      description,
      subscriptionPlan: finalPlanId,
      processedAt: Date.now(),
      metadata: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        subscriptionStatus: subscription.status,
        previousPlan: planId,
        newPlan: finalPlanId,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        cancelAt: subscription.cancel_at,
        creditsReset: subscription.status === 'canceled' && finalPlanId === 'free',
        scheduledCancellation: isScheduledCancellation,
        currentPeriodEnd: subscription.current_period_end,
        cancellationReason: subscription.cancellation_details?.reason,
        cancellationFeedback: subscription.cancellation_details?.feedback,
      },
    })
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  const clerkId = subscription.metadata?.clerkId

  if (!clerkId) {
    console.warn('No clerkId in subscription metadata:', subscription.id)
    return
  }

  console.log(`🗑️ Subscription deleted for user ${clerkId}`)

  // Check if this was a scheduled cancellation (cancel_at_period_end) or immediate cancellation
  const wasScheduledCancellation = subscription.cancel_at_period_end
  const wasImmediateCancellation = subscription.canceled_at && !subscription.cancel_at_period_end
  const periodEnded = subscription.current_period_end < Math.floor(Date.now() / 1000)

  // Downgrade to free if:
  // 1. It was a scheduled cancellation AND the billing period has ended, OR
  // 2. It was an immediate cancellation (canceled_at exists but cancel_at_period_end is false)
  const shouldDowngrade = (wasScheduledCancellation && periodEnded) || wasImmediateCancellation

  console.log(`📊 Subscription deletion analysis:`, {
    wasScheduledCancellation,
    wasImmediateCancellation,
    periodEnded,
    shouldDowngrade,
    canceledAt: subscription.canceled_at,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: subscription.current_period_end
  })

  if (shouldDowngrade) {
    // Update user to free plan
    await convex.mutation(api.usage.updateUserSubscription, {
      clerkId,
      subscriptionPlan: 'free',
      subscriptionId: subscription.id,
      subscriptionStatus: 'canceled',
    })

    // Reset all credits to 0 when subscription is deleted
    console.log(`🔄 Subscription deleted - resetting credits for ${clerkId}`)
    await convex.mutation(api.usage.updateUserCredits, {
      clerkId,
      messagesPerMonth: 0,
      totalPaidUSD: 0,
    })

    // Create transaction record
    const cancellationType = wasImmediateCancellation ? 'immediate' : 'scheduled'
    const description = wasImmediateCancellation 
      ? 'Subscription immediately canceled - downgraded to free plan, credits reset'
      : 'Subscription canceled - downgraded to free plan, credits reset'
    
    await convex.mutation(api.paymentTransactions.createTransaction, {
      userId: clerkId,
      transactionId: `${subscription.id}_deleted`,
      type: 'subscription_change',
      amount: 0,
      currency: 'usd',
      status: 'succeeded',
      description,
      subscriptionPlan: 'free',
      processedAt: Date.now(),
      metadata: {
        stripeSubscriptionId: subscription.id,
        previousPlan: 'pro', // Assume they had pro before
        newPlan: 'free',
        cancellationReason: subscription.cancellation_details?.reason || 'user_requested',
        wasScheduledCancellation: wasScheduledCancellation,
        wasImmediateCancellation: wasImmediateCancellation,
        cancellationType: cancellationType,
        periodEnded: periodEnded,
        creditsReset: true,
        canceledAt: subscription.canceled_at,
        endedAt: subscription.ended_at,
      },
    })
  } else {
    // Keep current plan but mark as canceled (access until period end)
    // DON'T reset credits - user still has access until period end
    console.log(`⏳ Keeping credits for ${clerkId} - access until period end: ${new Date(subscription.current_period_end * 1000).toISOString()}`)
    await convex.mutation(api.usage.updateUserSubscription, {
      clerkId,
      subscriptionPlan: 'pro', // Keep current plan
      subscriptionId: subscription.id,
      subscriptionStatus: 'canceled',
    })

    // Create transaction record for cancellation notice
    await convex.mutation(api.paymentTransactions.createTransaction, {
      userId: clerkId,
      transactionId: `${subscription.id}_cancellation_notice`,
      type: 'subscription_change',
      amount: 0,
      currency: 'usd',
      status: 'succeeded',
      description: 'Subscription canceled - access maintained until period end',
      subscriptionPlan: 'pro', // Keep current plan
      processedAt: Date.now(),
      metadata: {
        stripeSubscriptionId: subscription.id,
        cancellationReason: 'user_requested',
        wasScheduledCancellation: wasScheduledCancellation,
        periodEnded: periodEnded,
        currentPeriodEnd: subscription.current_period_end,
        accessMaintained: true,
      },
    })
  }
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  // Check if invoice has a subscription
  if (!invoice.subscription) {
    console.log('Invoice has no subscription, skipping')
    return
  }

  const subscription = await stripe.subscriptions.retrieve(invoice.subscription) as any
  const clerkId = subscription.metadata?.clerkId

  if (!clerkId) {
    console.warn('No clerkId in subscription metadata for invoice:', invoice.id)
    return
  }

  console.log(`💰 Invoice payment succeeded for user ${clerkId}: $${invoice.amount_paid / 100}`)

  // Get plan from subscription
  const priceId = subscription.items.data[0]?.price?.id
  const planId = getPlanIdFromPriceId(priceId) || 'free'
  const plan = getPlanConfig(planId)

  if (plan && plan.price > 0) {
    // Get user's agent type to determine billing mode
    const user = await convex.query(api.usage.getUserByClerkId, { clerkId })
    const agentType = user?.agentType || process.env.AGENT_TYPE || 'cursor'
    const billingMode = agentType === 'cursor' ? 'tokens' : 'credits'

    console.log(`💳 Billing mode for invoice: ${billingMode} (agent: ${agentType})`)

    if (billingMode === 'tokens') {
      // TOKEN MODE: Add monthly messages
      await convex.mutation(api.usage.updateUserCredits, {
        clerkId,
        messagesPerMonth: plan.messagesPerMonth,
        totalPaidUSD: plan.price,
      })
    } else {
      // CREDIT MODE: Add credits using billing-switch
      await convex.mutation(api.billingSwitch.allocateResourcesForPlan, {
        clerkId,
        planId,
        transactionId: invoice.id,
      })
    }

    // Create transaction record
    await convex.mutation(api.paymentTransactions.createTransaction, {
      userId: clerkId,
      transactionId: invoice.id,
      type: 'payment',
      amount: invoice.amount_paid / 100,
      currency: invoice.currency || 'usd',
      status: 'succeeded',
      description: `Monthly payment - ${plan.displayName}`,
      messagesAdded: billingMode === 'tokens' ? plan.messagesPerMonth : 0,
      subscriptionPlan: planId,
      processedAt: Date.now(),
      metadata: {
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: invoice.customer,
        billingPeriodStart: subscription.current_period_start,
        billingPeriodEnd: subscription.current_period_end,
        billingMode,
        agentType,
        creditsAllocated: billingMode === 'credits' ? plan.creditsUSD : 0,
      },
    })
  }
}

async function handleInvoicePaymentFailed(invoice: any) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription)
  const clerkId = subscription.metadata?.clerkId

  if (!clerkId) {
    console.warn('No clerkId in subscription metadata for failed invoice:', invoice.id)
    return
  }

  console.log(`❌ Invoice payment failed for user ${clerkId}: $${invoice.amount_due / 100}`)

  // Create failed payment transaction
  await convex.mutation(api.paymentTransactions.createTransaction, {
    userId: clerkId,
    transactionId: invoice.id,
    type: 'failed_payment',
    amount: invoice.amount_due / 100,
    currency: invoice.currency || 'usd',
    status: 'failed',
    description: `Payment failed - ${invoice.description || 'Subscription payment'}`,
    subscriptionPlan: 'pro', // Assume pro for failed payments
    processedAt: Date.now(),
    metadata: {
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: invoice.customer,
      failureReason: 'payment_failed',
      nextPaymentAttempt: invoice.next_payment_attempt,
    },
  })
}


async function handlePaymentIntentSucceeded(paymentIntent: any) {
  console.log(`💳 Payment intent succeeded: ${paymentIntent.id}`)
  
  // This is typically handled by invoice.payment_succeeded
  // But we can log it for monitoring
}

async function handlePaymentIntentFailed(paymentIntent: any) {
  console.log(`💳 Payment intent failed: ${paymentIntent.id}`)
  
  // This is typically handled by invoice.payment_failed
  // But we can log it for monitoring
}

async function handleInvoicePaymentPaid(invoicePayment: any) {
  console.log(`💰 Invoice payment paid: ${invoicePayment.id}`)
  
  // This is typically handled by invoice.payment_succeeded
  // But we can log it for monitoring
}

async function handleSubscriptionPaused(subscription: any) {
  const clerkId = subscription.metadata?.clerkId

  if (!clerkId) {
    console.warn('No clerkId in subscription metadata for paused subscription:', subscription.id)
    return
  }

  console.log(`⏸️ Subscription paused for user ${clerkId}`)

  // Update user subscription status but keep access until period end
  await convex.mutation(api.usage.updateUserSubscription, {
    clerkId,
    subscriptionPlan: 'free', // Downgrade to free
    subscriptionId: subscription.id,
    subscriptionStatus: 'paused',
  })

  // Create transaction record
  await convex.mutation(api.paymentTransactions.createTransaction, {
    userId: clerkId,
    transactionId: `${subscription.id}_paused`,
    type: 'subscription_change',
    amount: 0,
    currency: 'usd',
    status: 'succeeded',
    description: 'Subscription paused - access maintained until period end',
    subscriptionPlan: 'free',
    processedAt: Date.now(),
    metadata: {
      stripeSubscriptionId: subscription.id,
      previousPlan: 'pro', // Assume they had pro before
      newPlan: 'free',
      pauseReason: 'missing_payment_method',
    },
  })
}

async function handleSubscriptionResumed(subscription: any) {
  const clerkId = subscription.metadata?.clerkId

  if (!clerkId) {
    console.warn('No clerkId in subscription metadata for resumed subscription:', subscription.id)
    return
  }

  console.log(`▶️ Subscription resumed for user ${clerkId}`)

  // Get plan from subscription
  const priceId = subscription.items.data[0]?.price?.id
  const planId = getPlanIdFromPriceId(priceId) || 'pro'
  const plan = getPlanConfig(planId)

  if (plan && plan.price > 0) {
    // Update user subscription
    await convex.mutation(api.usage.updateUserSubscription, {
      clerkId,
      subscriptionPlan: planId,
      subscriptionId: subscription.id,
      subscriptionStatus: 'active',
    })

    // Add credits for resumed subscription
    await convex.mutation(api.usage.updateUserCredits, {
      clerkId,
      messagesPerMonth: plan.messagesPerMonth,
      totalPaidUSD: plan.price,
    })

    // Create transaction record
    await convex.mutation(api.paymentTransactions.createTransaction, {
      userId: clerkId,
      transactionId: `${subscription.id}_resumed`,
      type: 'subscription_change',
      amount: plan.price,
      currency: 'usd',
      status: 'succeeded',
      description: `Subscription resumed - ${plan.displayName} plan`,
      messagesAdded: plan.messagesPerMonth,
      subscriptionPlan: planId,
      processedAt: Date.now(),
      metadata: {
        stripeSubscriptionId: subscription.id,
        previousPlan: 'free',
        newPlan: planId,
        resumeReason: 'payment_method_added',
      },
    })
  }
}

async function handleTrialEnded(subscription: any) {
  const clerkId = subscription.metadata?.clerkId

  if (!clerkId) {
    console.warn('No clerkId in subscription metadata for trial ended:', subscription.id)
    return
  }

  console.log(`⏰ Trial ended for user ${clerkId}`)

  // Create notification transaction
  await convex.mutation(api.paymentTransactions.createTransaction, {
    userId: clerkId,
    transactionId: `${subscription.id}_trial_ended`,
    type: 'subscription_change',
    amount: 0,
    currency: 'usd',
    status: 'succeeded',
    description: 'Trial period ended - subscription converted to paid',
    subscriptionPlan: 'pro', // Assume pro trial
    processedAt: Date.now(),
    metadata: {
      stripeSubscriptionId: subscription.id,
      trialEnd: subscription.trial_end,
      eventType: 'trial_ended',
    },
  })
}

async function handleChargeDisputeCreated(dispute: any) {
  console.log(`⚖️ Charge dispute created: ${dispute.id} for amount $${dispute.amount / 100}`)

  // Find the customer and subscription associated with this dispute
  const charge = await stripe.charges.retrieve(dispute.charge)
  const customerId = charge.customer

  if (!customerId) {
    console.warn('No customer found for dispute:', dispute.id)
    return
  }

  // Get Stripe customer to find clerkId in metadata
  const stripeCustomer = await stripe.customers.retrieve(customerId as string) as any
  const clerkId = stripeCustomer.metadata?.clerkId

  if (!clerkId) {
    console.warn('No clerkId found in customer metadata for dispute:', dispute.id)
    return
  }

  // Get user by Clerk ID
  const user = await convex.query(api.usage.getUserByClerkId, { clerkId })
  if (!user) {
    console.warn('No user found for clerkId:', clerkId)
    return
  }

  // Immediately revoke access for disputes
  await convex.mutation(api.usage.updateUserSubscription, {
    clerkId: user.clerkId,
    subscriptionPlan: 'free',
    subscriptionId: user.subscriptionId || '',
    subscriptionStatus: 'disputed',
  })

  // Reset all credits to 0 for disputes
  await convex.mutation(api.usage.updateUserCredits, {
    clerkId: user.clerkId,
    messagesPerMonth: 0,
    totalPaidUSD: 0,
  })

  // Create dispute transaction
  await convex.mutation(api.paymentTransactions.createTransaction, {
    userId: user.clerkId,
    transactionId: dispute.id,
    type: 'chargeback',
    amount: -(dispute.amount / 100), // Negative for chargeback
    currency: dispute.currency,
    status: 'disputed',
    description: `Chargeback - ${dispute.reason || 'Dispute created'} - Access revoked, credits reset`,
    subscriptionPlan: 'free', // Downgraded to free
    processedAt: Date.now(),
    metadata: {
      stripeDisputeId: dispute.id,
      stripeChargeId: dispute.charge,
      disputeReason: dispute.reason,
      disputeAmount: dispute.amount,
      disputeStatus: dispute.status,
      accessRevoked: true,
      creditsReset: true,
      previousPlan: user.subscriptionPlan || 'pro',
      newPlan: 'free',
    },
  })

  console.log(`🚨 Dispute created - access immediately revoked for user ${user.clerkId}`)
}

async function handleChargeRefunded(refund: any) {
  console.log(`💸 Charge refunded: ${refund.id} for amount $${refund.amount / 100}`)

  // Get the charge to find customer
  const charge = await stripe.charges.retrieve(refund.charge)
  const customerId = charge.customer

  if (!customerId) {
    console.warn('No customer found for refund:', refund.id)
    return
  }

  // Get Stripe customer to find clerkId in metadata
  const stripeCustomer = await stripe.customers.retrieve(customerId as string) as any
  const clerkId = stripeCustomer.metadata?.clerkId

  if (!clerkId) {
    console.warn('No clerkId found in customer metadata for refund:', refund.id)
    return
  }

  // Get user by Clerk ID
  const user = await convex.query(api.usage.getUserByClerkId, { clerkId })
  if (!user) {
    console.warn('No user found for clerkId:', clerkId)
    return
  }

  // Immediately revoke access for refunds
  await convex.mutation(api.usage.updateUserSubscription, {
    clerkId: user.clerkId,
    subscriptionPlan: 'free',
    subscriptionId: user.subscriptionId || '',
    subscriptionStatus: 'refunded',
  })

  // Reset all credits to 0 for refunds
  await convex.mutation(api.usage.updateUserCredits, {
    clerkId: user.clerkId,
    messagesPerMonth: 0,
    totalPaidUSD: 0,
  })

  // Create refund transaction
  await convex.mutation(api.paymentTransactions.createTransaction, {
    userId: user.clerkId,
    transactionId: refund.id,
    type: 'refund',
    amount: -(refund.amount / 100), // Negative for refund
    currency: refund.currency,
    status: 'refunded',
    description: `Refund - ${refund.reason || 'Customer request'} - Access revoked, credits reset`,
    subscriptionPlan: 'free', // Downgraded to free
    processedAt: Date.now(),
    metadata: {
      stripeRefundId: refund.id,
      stripeChargeId: refund.charge,
      refundReason: refund.reason,
      refundAmount: refund.amount,
      refundStatus: refund.status,
      accessRevoked: true,
      creditsReset: true,
      previousPlan: user.subscriptionPlan || 'pro',
      newPlan: 'free',
    },
  })

  console.log(`💰 Refund processed - access immediately revoked for user ${user.clerkId}`)
}

async function handleRefundCreated(refund: any) {
  console.log(`💸 Refund created: ${refund.id} for amount $${refund.amount / 100}`)

  // Get the charge to find customer
  const charge = await stripe.charges.retrieve(refund.charge)
  const customerId = charge.customer

  if (!customerId) {
    console.warn('No customer found for refund:', refund.id)
    return
  }

  // Get Stripe customer to find clerkId in metadata
  const stripeCustomer = await stripe.customers.retrieve(customerId as string) as any
  const clerkId = stripeCustomer.metadata?.clerkId

  if (!clerkId) {
    console.warn('No clerkId found in customer metadata for refund:', refund.id)
    return
  }

  // Get user by Clerk ID
  const user = await convex.query(api.usage.getUserByClerkId, { clerkId })
  if (!user) {
    console.warn('No user found for clerkId:', clerkId)
    return
  }

  // Immediately revoke access for refunds
  await convex.mutation(api.usage.updateUserSubscription, {
    clerkId: user.clerkId,
    subscriptionPlan: 'free',
    subscriptionId: user.subscriptionId || '',
    subscriptionStatus: 'refunded',
  })

  // Reset all credits to 0 for refunds
  await convex.mutation(api.usage.updateUserCredits, {
    clerkId: user.clerkId,
    messagesPerMonth: 0,
    totalPaidUSD: 0,
  })

  // Create refund transaction
  await convex.mutation(api.paymentTransactions.createTransaction, {
    userId: user.clerkId,
    transactionId: refund.id,
    type: 'refund',
    amount: -(refund.amount / 100), // Negative for refund
    currency: refund.currency,
    status: 'refunded',
    description: `Refund created - ${refund.reason || 'Customer request'} - Access revoked, credits reset`,
    subscriptionPlan: 'free', // Downgraded to free
    processedAt: Date.now(),
    metadata: {
      stripeRefundId: refund.id,
      stripeChargeId: refund.charge,
      refundReason: refund.reason,
      refundAmount: refund.amount,
      refundStatus: refund.status,
      accessRevoked: true,
      creditsReset: true,
      previousPlan: user.subscriptionPlan || 'pro',
      newPlan: 'free',
    },
  })

  console.log(`💰 Refund created - access immediately revoked for user ${user.clerkId}`)
}

async function handleTrialWillEnd(subscription: any) {
  const clerkId = subscription.metadata?.clerkId

  if (!clerkId) {
    console.warn('No clerkId in subscription metadata for trial will end:', subscription.id)
    return
  }

  console.log(`⏰ Trial will end for user ${clerkId}`)

  // Create notification transaction
  await convex.mutation(api.paymentTransactions.createTransaction, {
    userId: clerkId,
    transactionId: `${subscription.id}_trial_will_end`,
    type: 'subscription_change',
    amount: 0,
    currency: 'usd',
    status: 'succeeded',
    description: 'Trial will end soon - add payment method to continue',
    subscriptionPlan: 'pro', // Assume pro trial
    processedAt: Date.now(),
    metadata: {
      stripeSubscriptionId: subscription.id,
      trialEnd: subscription.trial_end,
      eventType: 'trial_will_end',
    },
  })
}

// Helper function to get plan ID from Stripe price ID
function getPlanIdFromPriceId(priceId: string): string | null {
  const priceIdMap = {
    [process.env.STRIPE_PRICE_ID_WEEKLY_PLUS || '']: 'weekly_plus',
    [process.env.STRIPE_PRICE_ID_PRO || '']: 'pro',
    [process.env.STRIPE_PRICE_ID_BUSINESS || '']: 'business',
    [process.env.STRIPE_PRICE_ID_ENTERPRISE || '']: 'enterprise',
  }
  
  return priceIdMap[priceId] || null
}
