import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('Stripe not configured - payment features disabled')
}

export const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-09-30.clover',
      typescript: true,
    })
  : null

// Stripe configuration
export const STRIPE_CONFIG = {
  // Webhook events we care about
  WEBHOOK_EVENTS: [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated', 
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'customer.subscription.trial_will_end',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
  ],
  
  // Payment methods we support
  PAYMENT_METHOD_TYPES: ['card'],
  
  // Currency
  DEFAULT_CURRENCY: 'usd',
  
  // Billing behavior
  PAYMENT_BEHAVIOR: 'default_incomplete',
  SAVE_PAYMENT_METHOD: 'on_subscription',
} as const

// Stripe price IDs for each plan (you'll need to create these in Stripe Dashboard)
export const STRIPE_PRICE_IDS = {
  weekly_plus: process.env.STRIPE_PRICE_ID_WEEKLY_PLUS || 'price_weekly_plus',
  pro: process.env.STRIPE_PRICE_ID_PRO || 'price_pro', 
  business: process.env.STRIPE_PRICE_ID_BUSINESS || 'price_business',
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE || 'price_enterprise',
} as const

// Helper function to get price ID for a plan
export function getStripePriceId(planId: string): string | null {
  return STRIPE_PRICE_IDS[planId as keyof typeof STRIPE_PRICE_IDS] || null
}

// Helper function to validate Stripe webhook signature
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Stripe.Event {
  if (!stripe) {
    throw new Error('Stripe is not configured')
  }
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret)
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${error}`)
  }
}
