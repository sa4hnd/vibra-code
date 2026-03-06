import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function CancelPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <XCircle className="h-8 w-8 text-orange-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-orange-600">
              Payment Canceled
            </CardTitle>
            <CardDescription className="text-lg">
              No worries! Your payment was canceled and no charges were made.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="font-semibold mb-2">What happened?</h3>
              <ul className="text-sm text-muted-foreground space-y-2 text-left">
                <li>• You canceled the payment process</li>
                <li>• No charges were made to your card</li>
                <li>• You can try again anytime</li>
                <li>• Your account remains unchanged</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="flex-1">
                <Link href="/billing">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="flex-1">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              Need help? <Link href="/support" className="text-primary hover:underline">Contact Support</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

