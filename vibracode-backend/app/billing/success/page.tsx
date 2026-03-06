import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface SuccessPageProps {
  searchParams: Promise<{
    session_id?: string
  }>
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams
  const sessionId = params.session_id

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600">
              Payment Successful!
            </CardTitle>
            <CardDescription className="text-lg">
              Thank you for subscribing! Your payment has been processed successfully.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="font-semibold mb-2">What's Next?</h3>
              <ul className="text-sm text-muted-foreground space-y-2 text-left">
                <li>• Your subscription is now active</li>
                <li>• Credits have been added to your account</li>
                <li>• You can start using all premium features</li>
                <li>• Check your email for payment confirmation</li>
              </ul>
            </div>

            {sessionId && (
              <div className="text-xs text-muted-foreground">
                Session ID: {sessionId}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="flex-1">
                <Link href="/">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Start Building
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="flex-1">
                <Link href="/billing">
                  Manage Subscription
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
