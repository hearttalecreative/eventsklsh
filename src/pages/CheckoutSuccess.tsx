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
    const run = async () => {
      try {
        const cartRaw = localStorage.getItem("lastCart");
        if (isFree) {
          setDone(true);
          toast.success("Free order confirmed.");
          localStorage.removeItem("lastCart");
          return;
        }
        if (!sessionId) { setError("Missing session id"); return; }
        if (!cartRaw) throw new Error("Missing cart data");
        const cart = JSON.parse(cartRaw);
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { sessionId, cart },
        });
        if (error) throw error as any;
        if (data?.ok) {
          setDone(true);
          toast.success("Payment confirmed. Confirmation emails sent.");
          localStorage.removeItem("lastCart");
        } else {
          throw new Error("Unexpected response");
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to verify payment");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [sessionId, isFree]);

  return (
    <main className="container mx-auto py-16">
      <Helmet>
        <title>Payment successful | Kyle Lam Sound Healing</title>
        <meta name="description" content="Purchase confirmation" />
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