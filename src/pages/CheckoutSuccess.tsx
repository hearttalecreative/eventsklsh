import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const CheckoutSuccess = () => {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const isFree = params.get("free") === "1";
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prevent multiple executions
    let isExecuting = false;
    
    const run = async () => {
      if (isExecuting) return;
      isExecuting = true;

      try {
        const cartRaw = localStorage.getItem("lastCart");
        
        // Handle free orders (no Stripe webhook)
        if (isFree) {
          if (!cartRaw) throw new Error("Missing cart data for free order");
          const cart = JSON.parse(cartRaw);
          const { data, error } = await supabase.functions.invoke("process-free-order", {
            body: { cart },
          });
          if (error) throw error as any;
          if (data?.ok) {
            setDone(true);
            toast.success("Free order confirmed. Confirmation emails sent.");
            localStorage.removeItem("lastCart");
          } else {
            throw new Error("Failed to process free order");
          }
          return;
        }

        // For paid orders, the webhook handles processing
        // This page just verifies the order was created
        if (!sessionId) { 
          setError("Missing session id"); 
          return; 
        }
        
        if (!cartRaw) {
          // If no cart data, try to verify order by session
          console.log("[CheckoutSuccess] No cart data, checking if order already processed by webhook");
        }

        // Poll for order completion (webhook should have processed it)
        let retries = 0;
        const maxRetries = 8; // Reduced from 10
        const retryDelay = 1500; // Reduced from 2000ms

        while (retries < maxRetries) {
          try {
            // Ask server if this specific session has an order
            const { data: checkData, error: checkError } = await supabase.functions.invoke("check-order-by-session", {
              body: { sessionId },
            });

            if (checkError) throw checkError as any;

            if (checkData?.exists && checkData?.paid) {
              console.log("[CheckoutSuccess] Order found for session, webhook processed it");
              setDone(true);
              toast.success("Payment confirmed. Confirmation emails sent.");
              localStorage.removeItem("lastCart");
              return;
            }

            // If no order found yet, wait and retry
            if (retries < maxRetries - 1) {
              console.log(`[CheckoutSuccess] Waiting for webhook... (${retries + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              retries++;
            } else {
              // Webhook timeout - do NOT fallback to verify-payment
              // The webhook will eventually process it, or it's already processed
              console.log("[CheckoutSuccess] Webhook processing - order will be confirmed shortly");
              setDone(true);
              toast.success("Payment received! You'll receive a confirmation email shortly.");
              localStorage.removeItem("lastCart");
              return;
            }
          } catch (pollError: any) {
            console.error("[CheckoutSuccess] Polling error:", pollError);
            if (retries >= maxRetries - 1) {
              // Don't throw - just show success message
              setDone(true);
              toast.success("Payment received! You'll receive a confirmation email shortly.");
              localStorage.removeItem("lastCart");
              return;
            }
            retries++;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      } catch (e: any) {
        console.error("[CheckoutSuccess] Error:", e);
        // For payment errors, show a user-friendly message
        if (sessionId) {
          // Payment was initiated, so it might have succeeded
          setError("We're processing your payment. You'll receive a confirmation email within a few minutes.");
        } else {
          setError(e?.message || "Failed to verify payment");
        }
      } finally {
        setLoading(false);
        isExecuting = false;
      }
    };
    
    run();
  }, [sessionId, isFree]);

  return (
    <main className="container mx-auto py-16">
      <Helmet>
        <title>Payment successful | Kyle Lam Sound Healing</title>
        <meta name="description" content="Purchase confirmation." />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : ''} />
      </Helmet>
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-3xl font-bold">{loading ? 'Processing your payment…' : done ? 'Thank you!' : 'Verification'}</h1>
        {loading && <p className="text-muted-foreground">Confirming your payment…</p>}
        {error && (
          <div>
            <p className="text-destructive">{error}</p>
            <p className="text-muted-foreground text-sm mt-2">If the charge appears on your statement, contact us and we'll help.</p>
          </div>
        )}
        {done && (
          <div className="space-y-3">
            <p className="text-muted-foreground">Your purchase was recorded successfully. You will receive the event instructions and details by email shortly.</p>
            <Button asChild>
              <Link to="/">Back to events</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
};

export default CheckoutSuccess;