import { stripe } from './client'
import { currentUser } from '@clerk/nextjs/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import Stripe from 'stripe'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * Create a Stripe customer from a Clerk user
 */
export async function createStripeCustomer(clerkUser: any): Promise<Stripe.Customer> {
  const customer = await stripe.customers.create({
    email: clerkUser.emailAddresses[0]?.emailAddress,
    name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined,
    metadata: {
      clerkId: clerkUser.id,
      source: 'clerk_migration',
      createdAt: new Date().toISOString(),
    },
  })

  return customer
}

/**
 * Get or create a Stripe customer for a Clerk user
 */
export async function getOrCreateStripeCustomer(clerkId: string): Promise<Stripe.Customer> {
  // First, check if we already have a Stripe customer for this Clerk user
  const existingCustomer = await getStripeCustomerByClerkId(clerkId)
  if (existingCustomer) {
    return existingCustomer
  }

  // If not, get the Clerk user and create a new Stripe customer
  const clerkUser = await currentUser()
  if (!clerkUser || clerkUser.id !== clerkId) {
    throw new Error('Unauthorized: Clerk user not found or mismatch')
  }

  const customer = await createStripeCustomer(clerkUser)
  
  // Save the mapping in our database
  await convex.mutation(api.usage.updateUserStripeCustomer, {
    clerkId,
    stripeCustomerId: customer.id,
  })

  return customer
}

/**
 * Get Stripe customer by Clerk ID
 */
export async function getStripeCustomerByClerkId(clerkId: string): Promise<Stripe.Customer | null> {
  try {
    // Get user from our database to find Stripe customer ID
    const user = await convex.query(api.usage.getUserByClerkId, { clerkId })
    if (!user?.stripeCustomerId) {
      return null
    }

    // Retrieve customer from Stripe
    const customer = await stripe.customers.retrieve(user.stripeCustomerId)
    
    if (customer.deleted) {
      return null
    }

    return customer as Stripe.Customer
  } catch (error) {
    console.error('Error retrieving Stripe customer:', error)
    return null
  }
}

/**
 * Update Stripe customer information
 */
export async function updateStripeCustomer(
  customerId: string, 
  updates: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> {
  return await stripe.customers.update(customerId, updates)
}

/**
 * Delete Stripe customer (soft delete)
 */
export async function deleteStripeCustomer(customerId: string): Promise<Stripe.Customer> {
  return await stripe.customers.del(customerId)
}

/**
 * List all Stripe customers with pagination
 */
export async function listStripeCustomers(
  limit: number = 100,
  startingAfter?: string
): Promise<Stripe.ApiList<Stripe.Customer>> {
  return await stripe.customers.list({
    limit,
    starting_after: startingAfter,
  })
}

/**
 * Search for customers by email
 */
export async function searchStripeCustomers(email: string): Promise<Stripe.ApiList<Stripe.Customer>> {
  return await stripe.customers.search({
    query: `email:'${email}'`,
  })
}
