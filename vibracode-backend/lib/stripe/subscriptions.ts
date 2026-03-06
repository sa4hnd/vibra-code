import { stripe, getStripePriceId } from './client'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { getPlanConfig } from '@/lib/plans'
import { getOrCreateStripeCustomer, getStripeCustomerByClerkId } from './customers'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession(
  clerkId: string,
  planId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string | null }> {
  try {
    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(clerkId)
    
    // Get plan configuration
    const plan = getPlanConfig(planId)
    if (!plan) {
      throw new Error(`Plan ${planId} not found`)
    }

    // Get Stripe price ID
    const priceId = getStripePriceId(planId)
    if (!priceId) {
      throw new Error(`Stripe price ID not configured for plan ${planId}`)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      subscription_data: {
        metadata: {
          clerkId,
          planId,
          migrationSource: 'clerk',
        },
      },
      metadata: {
        clerkId,
        planId,
        migrationSource: 'clerk',
      },
    })

    return { url: session.url }
  } catch (error) {
    console.error('Error creating checkout session:', error)
    throw new Error(`Failed to create checkout session: ${error}`)
  }
}

/**
 * Create a customer portal session for subscription management
 */
export async function createCustomerPortalSession(
  clerkId: string,
  returnUrl: string
): Promise<{ url: string }> {
  try {
    // Get Stripe customer
    const customer = await getStripeCustomerByClerkId(clerkId)
    if (!customer) {
      throw new Error('No Stripe customer found for user')
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl,
    })

    return { url: session.url }
  } catch (error) {
    console.error('Error creating customer portal session:', error)
    throw new Error(`Failed to create customer portal session: ${error}`)
  }
}

/**
 * Cancel a Stripe subscription
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    })

    return subscription
  } catch (error) {
    console.error('Error canceling subscription:', error)
    throw new Error(`Failed to cancel subscription: ${error}`)
  }
}

/**
 * Update a Stripe subscription (change plan)
 */
export async function updateStripeSubscription(
  subscriptionId: string,
  newPlanId: string
): Promise<Stripe.Subscription> {
  try {
    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    
    // Get new price ID
    const newPriceId = getStripePriceId(newPlanId)
    if (!newPriceId) {
      throw new Error(`Stripe price ID not configured for plan ${newPlanId}`)
    }

    // Update subscription
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        ...subscription.metadata,
        planId: newPlanId,
        updatedAt: new Date().toISOString(),
      },
    })

    return updatedSubscription
  } catch (error) {
    console.error('Error updating subscription:', error)
    throw new Error(`Failed to update subscription: ${error}`)
  }
}

/**
 * Get Stripe subscription by ID
 */
export async function getStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return subscription
  } catch (error) {
    console.error('Error retrieving subscription:', error)
    return null
  }
}

/**
 * List all subscriptions for a customer
 */
export async function listCustomerSubscriptions(
  customerId: string,
  status?: Stripe.Subscription.Status
): Promise<Stripe.ApiList<Stripe.Subscription>> {
  const params: Stripe.SubscriptionListParams = {
    customer: customerId,
  }
  
  if (status) {
    params.status = status
  }

  return await stripe.subscriptions.list(params)
}

/**
 * Handle subscription creation/update from webhook
 */
export async function handleSubscriptionWebhook(subscription: Stripe.Subscription): Promise<void> {
  try {
    const clerkId = subscription.metadata.clerkId
    if (!clerkId) {
      console.warn('No clerkId in subscription metadata:', subscription.id)
      return
    }

    // Determine plan from subscription
    const priceId = subscription.items.data[0]?.price?.id
    const planId = getPlanIdFromPriceId(priceId) || 'free'
    
    // Get plan configuration
    const plan = getPlanConfig(planId)
    const creditsToAdd = plan?.creditsUSD || 0

    // Update user subscription in database
    await convex.mutation(api.usage.updateUserSubscription, {
      clerkId,
      subscriptionPlan: planId,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    })

    // Add credits if this is a paid plan
    if (plan && plan.price > 0 && subscription.status === 'active') {
      await convex.mutation(api.usage.updateUserCredits, {
        clerkId,
        creditsUSD: creditsToAdd,
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
        creditsAdded: creditsToAdd,
        subscriptionPlan: planId,
        processedAt: Date.now(),
        metadata: {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          stripePriceId: priceId,
          subscriptionStatus: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
        },
      })
    }
  } catch (error) {
    console.error('Error handling subscription webhook:', error)
    throw error
  }
}

/**
 * Helper function to get plan ID from Stripe price ID
 */
function getPlanIdFromPriceId(priceId: string): string | null {
  const priceIdMap = {
    [process.env.STRIPE_PRICE_ID_WEEKLY_PLUS || '']: 'weekly_plus',
    [process.env.STRIPE_PRICE_ID_PRO || '']: 'pro',
    [process.env.STRIPE_PRICE_ID_BUSINESS || '']: 'business',
    [process.env.STRIPE_PRICE_ID_ENTERPRISE || '']: 'enterprise',
  }
  
  return priceIdMap[priceId] || null
}

