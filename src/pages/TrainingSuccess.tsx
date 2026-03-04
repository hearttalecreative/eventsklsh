import { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TrainingSuccess() {
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get('purchase_id');

  useEffect(() => {
    // Could verify purchase here if needed
    console.log('Training purchase completed:', purchaseId);
  }, [purchaseId]);

  return (
    <>
      <Helmet>
        <title>Registration Complete | Kyle Lam Sound Healing</title>
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Minimal Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 max-w-screen-2xl items-center justify-center">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-xl font-semibold tracking-tight">Kyle Lam Sound Healing</span>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container max-w-2xl mx-auto px-4 py-16 flex items-center justify-center">
          <Card className="w-full text-center">
            <CardHeader className="pb-4">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Registration Complete!</CardTitle>
              <CardDescription className="text-base mt-2">
                Thank you for registering for your Private Sound Training Program.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-6 text-left">
                <h3 className="font-semibold mb-3">What happens next?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• You will receive a confirmation email shortly</li>
                  <li>• Our team will review your preferred dates</li>
                  <li>• You will be contacted within 24-48 hours to finalize your training schedule</li>
                  <li>• Additional details and preparation materials will be sent before your training begins</li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground">
                If you have any questions, please contact us at{' '}
                <a href="mailto:info@kylelamsoundhealing.com" className="text-primary hover:underline">
                  info@kylelamsoundhealing.com
                </a>
              </p>

              <div className="pt-4">
                <Button asChild>
                  <Link to="/">Return to Homepage</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-border/40 py-6">
          <div className="container text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Kyle Lam Sound Healing. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
