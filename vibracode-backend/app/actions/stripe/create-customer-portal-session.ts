'use server'

import { currentUser } from '@clerk/nextjs/server'
import { createCustomerPortalSession } from '@/lib/stripe/subscriptions'
import { redirect } from 'next/navigation'

export async function createStripeCustomerPortalSession() {
  try {
    // Get current user
    const user = await currentUser()
    if (!user) {
      throw new Error('Unauthorized: Please sign in to continue')
    }

    // Create customer portal session
    const result = await createCustomerPortalSession(
      user.id,
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.vibracodeapp.com'}/billing`
    )

    // Redirect to Stripe Customer Portal
    redirect(result.url)
  } catch (error) {
    // Re-throw NEXT_REDIRECT errors as they are expected for redirects
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    
    console.error('Error creating customer portal session:', error)
    
    // Check if it's a configuration error
    if (error instanceof Error && error.message.includes('No configuration provided')) {
      throw new Error('Customer Portal not configured. Please set up the Stripe Customer Portal in your dashboard first.')
    }
    
    throw new Error(`Failed to create customer portal session: ${error}`)
  }
}

export async function createStripeCustomerPortalSessionAction() {
  return createStripeCustomerPortalSession()
}
