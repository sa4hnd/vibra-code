'use server'

import { currentUser } from '@clerk/nextjs/server'
import { createCheckoutSession } from '@/lib/stripe/subscriptions'
import { getPlanConfig } from '@/lib/plans'
import { redirect } from 'next/navigation'

export async function createStripeCheckoutSession(planId: string) {
  // Get current user
  const user = await currentUser()
  if (!user) {
    throw new Error('Unauthorized: Please sign in to continue')
  }

  // Validate plan
  const plan = getPlanConfig(planId)
  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`)
  }

  if (plan.price === 0) {
    throw new Error('Cannot create checkout session for free plan')
  }

  // Create checkout session
  const result = await createCheckoutSession(
    user.id,
    planId,
    `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    `${process.env.NEXT_PUBLIC_APP_URL}/billing/cancel`
  )

  if (!result.url) {
    throw new Error('Failed to create checkout session')
  }

  // Redirect to Stripe Checkout
  redirect(result.url)
}

export async function createStripeCheckoutSessionAction(formData: FormData) {
  const planId = formData.get('planId') as string
  
  if (!planId) {
    throw new Error('Plan ID is required')
  }

  return createStripeCheckoutSession(planId)
}
