import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { getPlanByPrice, calculateCreditsForPlan } from '@/lib/plans'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Handle GET requests (Clerk verification/health checks)
export async function GET() {
  return new Response('Clerk billing webhook endpoint is active', { status: 200 })
}

// Handle OPTIONS requests (CORS preflight)
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, svix-id, svix-timestamp, svix-signature',
    },
  })
}

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Clerk webhook not configured' }, { status: 503 })
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.text()
  const body = JSON.parse(payload)

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: any

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    })
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type
  console.log(`🔔 Received webhook event: ${eventType}`)
  console.log(`📊 Event data:`, JSON.stringify(evt.data, null, 2))

  try {
    switch (eventType) {
      case 'user.created': {
        const { data } = evt
        const clerkId = data.id

        if (clerkId) {
          console.log(`Creating new user ${clerkId}`)

          // Create user with profile data from Clerk
          await convex.mutation(api.usage.createUser, {
            clerkId,
            firstName: data.first_name || undefined,
            lastName: data.last_name || undefined,
            fullName: data.first_name && data.last_name
              ? `${data.first_name} ${data.last_name}`
              : data.first_name || data.last_name || undefined,
            email: data.email_addresses?.[0]?.email_address || undefined,
            imageUrl: data.image_url || undefined,
          })
        }
        break
      }

      case 'user.updated': {
        const { data } = evt
        const clerkId = data.id

        if (clerkId) {
          console.log(`Updating user profile for ${clerkId}`)

          // Sync profile data from Clerk to Convex
          await convex.mutation(api.usage.updateUserProfile, {
            clerkId,
            firstName: data.first_name || undefined,
            lastName: data.last_name || undefined,
            fullName: data.first_name && data.last_name
              ? `${data.first_name} ${data.last_name}`
              : data.first_name || data.last_name || undefined,
            email: data.email_addresses?.[0]?.email_address || undefined,
            imageUrl: data.image_url || undefined,
          })
        }
        break
      }
      
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.active': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          // Determine plan based on subscription items
          const subscriptionItems = data.subscription_items || []
          let plan = 'free'
          let amount = 0
          
          // Check if user has any paid plans
          for (const item of subscriptionItems) {
            if (item.plan?.name && item.plan.name !== 'free') {
              plan = item.plan.name.toLowerCase()
              amount = item.plan.price || 0
              break
            }
          }
          
          console.log(`Updating subscription for user ${clerkId} to plan ${plan}`)
          
          // Update user subscription
          await convex.mutation(api.usage.updateUserSubscription, {
            clerkId,
            subscriptionPlan: plan,
            subscriptionId: data.id,
            subscriptionStatus: data.status,
          })

          // Create payment transaction record if it's a paid plan
          if (plan !== 'free' && amount > 0) {
            // Reset credits to full amount for the plan (prevents infinite money exploit)
            const fullCredits = plan === 'pro' ? 40 : 5;
            
            // Update user with reset credits
            await convex.mutation(api.usage.updateUserCredits, {
              clerkId,
              creditsUSD: fullCredits,
              totalPaidUSD: amount,
            })
            
            await convex.mutation(api.paymentTransactions.createTransaction, {
              userId: clerkId,
              transactionId: data.id,
              type: 'payment',
              amount: amount,
              currency: 'usd',
              status: 'succeeded',
              description: `Subscription payment for ${plan} plan - Credits reset to ${fullCredits}`,
              creditsAdded: fullCredits,
              subscriptionPlan: plan,
              processedAt: Date.now(),
              metadata: {
                subscriptionId: data.id,
                subscriptionStatus: data.status,
                eventType: eventType,
                creditsAdded: fullCredits,
                newBalance: fullCredits,
                creditReset: true,
              },
            })
          }
        }
        break
      }
      
      case 'subscriptionItem.active': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          const planName = data.plan?.name?.toLowerCase() || 'free'
          const planAmount = data.plan?.amount || 0
          
          console.log(`Subscription item active for user ${clerkId} with plan ${planName} (${planAmount} cents)`)
          
          await convex.mutation(api.usage.updateUserSubscription, {
            clerkId,
            subscriptionPlan: planName,
            subscriptionId: data.subscription_id,
            subscriptionStatus: 'active',
          })
          
          // Create payment transaction for paid plans
          if (planName !== 'free' && planAmount > 0) {
            // Reset credits to full amount for the plan
            const planConfig = getPlanByPrice(planAmount);
            const fullCredits = planConfig?.creditsUSD || (planName === 'pro' ? 40 : planName === 'weekly_plus' ? 20 : planName === 'business' ? 125 : planName === 'enterprise' ? 600 : 5);
            
            await convex.mutation(api.usage.updateUserCredits, {
              clerkId,
              creditsUSD: fullCredits,
              totalPaidUSD: planAmount / 100,
            })
            
            await convex.mutation(api.paymentTransactions.createTransaction, {
              userId: clerkId,
              transactionId: `${data.subscription_id}_active_${Date.now()}`,
              type: 'payment',
              amount: planAmount / 100,
              currency: data.plan?.currency || 'usd',
              status: 'succeeded',
              description: `Subscription activated - ${planName} plan - Credits reset to ${fullCredits}`,
              creditsAdded: fullCredits,
              subscriptionPlan: planName,
              processedAt: Date.now(),
              metadata: {
                subscriptionId: data.subscription_id,
                planName: planName,
                planAmount: planAmount,
                eventType: eventType,
                creditsAdded: fullCredits,
                newBalance: fullCredits,
                creditReset: true,
              },
            })
          }
        }
        break
      }
      
      case 'subscriptionItem.ended': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          const planName = data.plan?.name?.toLowerCase() || 'free'
          
          console.log(`Subscription item ended for user ${clerkId} with plan ${planName}`)
          
          // Update user subscription to free plan
          await convex.mutation(api.usage.updateUserSubscription, {
            clerkId,
            subscriptionPlan: 'free',
            subscriptionId: data.subscription_id,
            subscriptionStatus: 'ended',
          })
          
          // Create transaction record for plan end
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: `${data.subscription_id}_ended_${Date.now()}`,
            type: 'subscription_change',
            amount: 0,
            currency: 'usd',
            status: 'succeeded',
            description: `Subscription ended - downgraded from ${planName} to free plan`,
            subscriptionPlan: 'free',
            processedAt: Date.now(),
            metadata: {
              subscriptionId: data.subscription_id,
              previousPlan: planName,
              newPlan: 'free',
              eventType: eventType,
            },
          })
        }
        break
      }
      
      case 'subscriptionItem.created': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          const planName = data.plan?.name?.toLowerCase() || 'free'
          const planAmount = data.plan?.amount || 0
          
          console.log(`Subscription item created for user ${clerkId} with plan ${planName}`)
          
          // Create transaction record for new subscription item
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: `${data.subscription_id}_created_${Date.now()}`,
            type: 'subscription_change',
            amount: planAmount / 100,
            currency: data.plan?.currency || 'usd',
            status: 'pending',
            description: `Subscription item created - ${planName} plan`,
            subscriptionPlan: planName,
            processedAt: Date.now(),
            metadata: {
              subscriptionId: data.subscription_id,
              planName: planName,
              planAmount: planAmount,
              eventType: eventType,
            },
          })
        }
        break
      }
      
      case 'subscriptionItem.pastDue': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Subscription past due for user ${clerkId}`)
          
          // Create transaction record for past due
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: `${data.subscription_id}_past_due_${Date.now()}`,
            type: 'failed_payment',
            amount: data.plan?.amount ? data.plan.amount / 100 : 0,
            currency: data.plan?.currency || 'usd',
            status: 'failed',
            description: `Subscription past due - payment failed`,
            subscriptionPlan: data.plan?.name?.toLowerCase() || 'free',
            processedAt: Date.now(),
            metadata: {
              subscriptionId: data.subscription_id,
              eventType: eventType,
              planName: data.plan?.name,
            },
          })
        }
        break
      }
      
      case 'subscriptionItem.freeTrialEnding': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Free trial ending for user ${clerkId}`)
          
          // Create transaction record for trial ending
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: `${data.subscription_id}_trial_ending_${Date.now()}`,
            type: 'subscription_change',
            amount: 0,
            currency: 'usd',
            status: 'succeeded',
            description: `Free trial ending - subscription will convert to paid`,
            subscriptionPlan: data.plan?.name?.toLowerCase() || 'free',
            processedAt: Date.now(),
            metadata: {
              subscriptionId: data.subscription_id,
              eventType: eventType,
              planName: data.plan?.name,
            },
          })
        }
        break
      }
      
      case 'subscriptionItem.upcoming': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Subscription renewal upcoming for user ${clerkId}`)
          
          // Create transaction record for upcoming renewal
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: `${data.subscription_id}_upcoming_${Date.now()}`,
            type: 'subscription_change',
            amount: data.plan?.amount ? data.plan.amount / 100 : 0,
            currency: data.plan?.currency || 'usd',
            status: 'pending',
            description: `Subscription renewal upcoming - ${data.plan?.name || 'plan'}`,
            subscriptionPlan: data.plan?.name?.toLowerCase() || 'free',
            processedAt: Date.now(),
            metadata: {
              subscriptionId: data.subscription_id,
              eventType: eventType,
              planName: data.plan?.name,
              renewalDate: data.period_end,
            },
          })
        }
        break
      }
      
      case 'subscriptionItem.updated': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          const planName = data.plan?.name?.toLowerCase() || 'free'
          const planAmount = data.plan?.amount || 0
          
          console.log(`Subscription item updated for user ${clerkId} to plan ${planName} (${planAmount} cents)`)
          console.log(`📊 Update data:`, {
            status: data.status,
            planName: planName,
            planAmount: planAmount,
            subscriptionId: data.subscription_id
          })
          
          // Get current user to determine previous plan
          const user = await convex.query(api.usage.getUserByClerkId, { clerkId })
          const previousPlan = user?.subscriptionPlan || 'free'
          
          // Check if this is a resubscription (user was canceled, now getting new paid plan)
          const isResubscription = user?.isCanceled && planName !== 'free' && planAmount > 0;
          
          // Determine correct subscription status
          let subscriptionStatus = 'active';
          if (data.status === 'ended') {
            subscriptionStatus = 'canceled';
          } else if (data.status === 'active') {
            subscriptionStatus = 'active';
          } else if (data.status === 'past_due') {
            subscriptionStatus = 'past_due';
          }
          
          // Update user subscription
          await convex.mutation(api.usage.updateUserSubscription, {
            clerkId,
            subscriptionPlan: planName,
            subscriptionId: data.subscription_id,
            subscriptionStatus: subscriptionStatus,
          })
          
          // If this is a resubscription, clear cancellation flags
          if (isResubscription) {
            await convex.mutation(api.billing.handleSubscriptionRenewal, {
              clerkId,
              subscriptionId: data.subscription_id,
              plan: planName,
              amountPaid: planAmount / 100,
              billingPeriodEnd: data.period_end,
            })
          }
          
          // Create transaction record for plan change
          if (previousPlan !== planName) {
            let creditResult = null;
            
            // Only add credits if it's a paid plan and not ending, OR if it's a resubscription
            if ((planName !== 'free' && planAmount > 0 && data.status !== 'ended') || isResubscription) {
              // Reset credits to full amount for resubscription (prevents infinite money)
              const planConfig = getPlanByPrice(planAmount);
              const fullCredits = planConfig?.creditsUSD || (planName === 'pro' ? 40 : planName === 'weekly_plus' ? 20 : planName === 'business' ? 125 : planName === 'enterprise' ? 600 : 5);
              
              await convex.mutation(api.usage.updateUserCredits, {
                clerkId,
                creditsUSD: fullCredits,
                totalPaidUSD: planAmount / 100,
              })
              
              creditResult = {
                creditsAdded: fullCredits,
                newBalance: fullCredits,
              }
            }
            
            await convex.mutation(api.paymentTransactions.createTransaction, {
              userId: clerkId,
              transactionId: `${data.subscription_id}_updated_${Date.now()}`,
              type: 'subscription_change',
              amount: planAmount / 100, // Convert from cents
              currency: data.plan?.currency || 'usd',
              status: data.status === 'ended' ? 'succeeded' : 'succeeded',
              description: isResubscription 
                ? `Resubscription - upgraded from ${previousPlan} to ${planName} - Credits reset to ${creditResult?.creditsAdded || 0}`
                : `Plan changed from ${previousPlan} to ${planName} - ${data.status}`,
              creditsAdded: creditResult?.creditsAdded || 0,
              subscriptionPlan: planName,
              processedAt: Date.now(),
              metadata: {
                subscriptionId: data.subscription_id,
                previousPlan: previousPlan,
                newPlan: planName,
                planAmount: planAmount,
                status: data.status,
                eventType: eventType,
                creditsAdded: creditResult?.creditsAdded || 0,
                newBalance: creditResult?.newBalance,
              },
            })
          }
        }
        break
      }
      
      case 'subscriptionItem.canceled': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Subscription canceled for user ${clerkId}`)
          
          // Handle cancellation - user keeps access until end of billing period
          const cancellationResult = await convex.mutation(api.billing.handleSubscriptionCancellation, {
            clerkId,
            subscriptionId: data.subscription_id,
            billingPeriodEnd: data.period_end, // Already in milliseconds
          })

          // Create subscription change transaction record
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: `${data.subscription_id}_canceled`,
            type: 'subscription_change',
            amount: 0, // No money movement for cancellation
            currency: 'usd',
            status: 'succeeded',
            description: `Subscription canceled - ${cancellationResult.daysRemaining} days remaining in billing period`,
            subscriptionPlan: 'free',
            processedAt: Date.now(),
            metadata: {
              subscriptionId: data.subscription_id,
              previousPlan: 'pro', // Assuming they had pro before
              newPlan: 'free',
              daysRemaining: cancellationResult.daysRemaining,
              billingPeriodEnd: cancellationResult.billingPeriodEnd,
              eventType: eventType,
            },
          })
        }
        break
      }
      
      case 'payment.succeeded': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Payment succeeded for user ${clerkId}: $${data.amount / 100}`)
          
          // Reset credits to full amount (prevents infinite money exploit)
          const fullCredits = 40; // Assume pro for successful payments
          
          await convex.mutation(api.usage.updateUserCredits, {
            clerkId,
            creditsUSD: fullCredits,
            totalPaidUSD: data.amount / 100,
          })
          
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: data.id,
            type: 'payment',
            amount: data.amount / 100, // Convert from cents
            currency: data.currency || 'usd',
            status: 'succeeded',
            description: `Payment succeeded - ${data.description || 'Subscription payment'} - Credits reset to ${fullCredits}`,
            creditsAdded: fullCredits,
            subscriptionPlan: 'pro', // Assume pro for successful payments
            processedAt: Date.now(),
            metadata: {
              paymentId: data.id,
              paymentMethod: data.payment_method,
              eventType: eventType,
              creditsAdded: fullCredits,
              newBalance: fullCredits,
              creditReset: true,
            },
          })
        }
        break
      }
      
      case 'payment.failed': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Payment failed for user ${clerkId}: $${data.amount / 100}`)
          
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: data.id,
            type: 'failed_payment',
            amount: data.amount / 100,
            currency: data.currency || 'usd',
            status: 'failed',
            description: `Payment failed - ${data.failure_reason || 'Unknown reason'}`,
            processedAt: Date.now(),
            metadata: {
              paymentId: data.id,
              failureReason: data.failure_reason,
              eventType: eventType,
            },
          })
        }
        break
      }
      
      case 'payment.refunded': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Payment refunded for user ${clerkId}: $${data.amount / 100}`)
          
          // Handle refund with immediate access revocation
          const refundResult = await convex.mutation(api.billing.handleRefund, {
            clerkId,
            refundAmount: data.amount / 100,
            transactionId: data.id,
          })
          
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: data.id,
            type: 'refund',
            amount: -(data.amount / 100), // Negative for refund
            currency: data.currency || 'usd',
            status: 'refunded',
            description: `Payment refunded - ${data.reason || 'Customer request'} - Access revoked`,
            processedAt: Date.now(),
            metadata: {
              paymentId: data.id,
              refundReason: data.reason,
              creditsRemoved: refundResult.creditsRemoved,
              eventType: eventType,
            },
          })
        }
        break
      }
      
      case 'payment.dispute.created': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Payment dispute created for user ${clerkId}: $${data.amount / 100}`)
          
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: data.id,
            type: 'chargeback',
            amount: -(data.amount / 100), // Negative for chargeback
            currency: data.currency || 'usd',
            status: 'disputed',
            description: `Payment disputed - ${data.reason || 'Chargeback'}`,
            processedAt: Date.now(),
            metadata: {
              paymentId: data.id,
              disputeReason: data.reason,
              eventType: eventType,
            },
          })
        }
        break
      }
      
      case 'subscription.paused':
      case 'subscription.canceled': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Subscription ${eventType} for user ${clerkId}`)
          
          // Update user subscription
          await convex.mutation(api.usage.updateUserSubscription, {
            clerkId,
            subscriptionPlan: 'free',
            subscriptionId: data.id,
            subscriptionStatus: eventType.includes('canceled') ? 'canceled' : 'paused',
          })

          // Create subscription change transaction
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: `${data.id}_${eventType}`,
            type: 'subscription_change',
            amount: 0,
            currency: 'usd',
            status: 'succeeded',
            description: `Subscription ${eventType} - downgraded to free plan`,
            subscriptionPlan: 'free',
            processedAt: Date.now(),
            metadata: {
              subscriptionId: data.id,
              previousPlan: 'pro',
              newPlan: 'free',
              eventType: eventType,
            },
          })
        }
        break
      }
      
      case 'subscription.resumed': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Subscription resumed for user ${clerkId}`)
          
          // Determine plan from subscription data
          const plan = data.items?.[0]?.price?.nickname || 'pro'
          const amount = plan === 'pro' ? 20 : 10
          
          // Update user subscription
          await convex.mutation(api.usage.updateUserSubscription, {
            clerkId,
            subscriptionPlan: plan,
            subscriptionId: data.id,
            subscriptionStatus: 'active',
          })

          // Reset credits to full amount for resumed subscription
          const fullCredits = plan === 'pro' ? 40 : 5;
          
          await convex.mutation(api.usage.updateUserCredits, {
            clerkId,
            creditsUSD: fullCredits,
            totalPaidUSD: amount,
          })
          
          // Create subscription resumed transaction
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: `${data.id}_resumed`,
            type: 'subscription_change',
            amount: amount,
            currency: 'usd',
            status: 'succeeded',
            description: `Subscription resumed - upgraded to ${plan} plan - Credits reset to ${fullCredits}`,
            creditsAdded: fullCredits,
            subscriptionPlan: plan,
            processedAt: Date.now(),
            metadata: {
              subscriptionId: data.id,
              previousPlan: 'free',
              newPlan: plan,
              eventType: eventType,
              creditsAdded: fullCredits,
              newBalance: fullCredits,
              creditReset: true,
            },
          })
        }
        break
      }
      
      case 'subscription.updated': {
        const { data } = evt
        const clerkId = data.payer?.user_id
        
        if (clerkId) {
          console.log(`Subscription updated for user ${clerkId}`)
          
          // Get current user to determine previous plan
          const user = await convex.query(api.usage.getByClerkId, { clerkId })
          const previousPlan = user?.subscriptionPlan || 'free'
          
          // Determine new plan from subscription data
          const newPlan = data.items?.[0]?.price?.nickname || 'pro'
          const amount = newPlan === 'pro' ? 20 : 10
          
          // Update user subscription
          await convex.mutation(api.usage.updateUserSubscription, {
            clerkId,
            subscriptionPlan: newPlan,
            subscriptionId: data.id,
            subscriptionStatus: data.status || 'active',
          })

          // Reset credits to full amount for subscription change
          const fullCredits = newPlan === 'pro' ? 40 : 5;
          
          await convex.mutation(api.usage.updateUserCredits, {
            clerkId,
            creditsUSD: fullCredits,
            totalPaidUSD: amount,
          })
          
          // Create subscription change transaction
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: `${data.id}_updated`,
            type: 'subscription_change',
            amount: amount,
            currency: 'usd',
            status: 'succeeded',
            description: `Subscription updated - changed from ${previousPlan} to ${newPlan} plan - Credits reset to ${fullCredits}`,
            creditsAdded: fullCredits,
            subscriptionPlan: newPlan,
            processedAt: Date.now(),
            metadata: {
              subscriptionId: data.id,
              previousPlan: previousPlan,
              newPlan: newPlan,
              eventType: eventType,
              creditsAdded: fullCredits,
              newBalance: fullCredits,
              creditReset: true,
            },
          })
        }
        break
      }
      
      case 'invoice.payment_succeeded': {
        const { data } = evt
        const clerkId = data.customer?.user_id || data.subscription?.user_id
        
        if (clerkId) {
          console.log(`Invoice payment succeeded for user ${clerkId}: $${data.amount_paid / 100}`)
          
          // Reset credits to full amount (prevents infinite money exploit)
          const fullCredits = 40; // Assume pro for successful payments
          
          await convex.mutation(api.usage.updateUserCredits, {
            clerkId,
            creditsUSD: fullCredits,
            totalPaidUSD: data.amount_paid / 100,
          })
          
          // Create successful payment transaction
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: data.id,
            type: 'payment',
            amount: data.amount_paid / 100,
            currency: data.currency || 'usd',
            status: 'succeeded',
            description: `Invoice payment succeeded - ${data.description || 'Subscription payment'} - Credits reset to ${fullCredits}`,
            creditsAdded: fullCredits,
            subscriptionPlan: 'pro', // Assume pro for successful payments
            processedAt: Date.now(),
            metadata: {
              invoiceId: data.id,
              subscriptionId: data.subscription,
              eventType: eventType,
              creditsAdded: fullCredits,
              newBalance: fullCredits,
              creditReset: true,
            },
          })
        }
        break
      }
      
      case 'invoice.payment_failed': {
        const { data } = evt
        const clerkId = data.customer?.user_id || data.subscription?.user_id
        
        if (clerkId) {
          console.log(`Invoice payment failed for user ${clerkId}: $${data.amount_due / 100}`)
          
          // Create failed payment transaction
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: data.id,
            type: 'failed_payment',
            amount: data.amount_due / 100,
            currency: data.currency || 'usd',
            status: 'failed',
            description: `Invoice payment failed - ${data.description || 'Payment attempt failed'}`,
            processedAt: Date.now(),
            metadata: {
              invoiceId: data.id,
              subscriptionId: data.subscription,
              failureReason: 'payment_failed',
              eventType: eventType,
            },
          })
        }
        break
      }
      
      case 'customer.subscription.deleted': {
        const { data } = evt
        const clerkId = data.customer?.user_id
        
        if (clerkId) {
          console.log(`Customer subscription deleted for user ${clerkId}`)
          
          // Update user subscription
          await convex.mutation(api.usage.updateUserSubscription, {
            clerkId,
            subscriptionPlan: 'free',
            subscriptionId: data.id,
            subscriptionStatus: 'canceled',
          })

          // Create subscription deletion transaction
          await convex.mutation(api.paymentTransactions.createTransaction, {
            userId: clerkId,
            transactionId: `${data.id}_deleted`,
            type: 'subscription_change',
            amount: 0,
            currency: 'usd',
            status: 'succeeded',
            description: 'Subscription deleted - downgraded to free plan',
            subscriptionPlan: 'free',
            processedAt: Date.now(),
            metadata: {
              subscriptionId: data.id,
              previousPlan: 'pro',
              newPlan: 'free',
              eventType: eventType,
            },
          })
        }
        break
      }
      
      default:
        console.log(`Unhandled event type: ${eventType}`)
        console.log(`Event data:`, JSON.stringify(evt.data, null, 2))
    }
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response('Error processing webhook', {
      status: 500,
    })
  }

  return new Response('', { status: 200 })
}
