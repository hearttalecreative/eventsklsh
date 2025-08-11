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
          toast.success("Orden gratuita confirmada.");
          localStorage.removeItem("lastCart");
          return;
        }
        if (!sessionId) { setError("Falta session id"); return; }
        if (!cartRaw) throw new Error("Faltan datos del carrito");
        const cart = JSON.parse(cartRaw);
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { sessionId, cart },
        });
        if (error) throw error as any;
        if (data?.ok) {
          setDone(true);
          toast.success("Pago confirmado y emails enviados.");
          localStorage.removeItem("lastCart");
        } else {
          throw new Error("Respuesta inesperada");
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Fallo al verificar el pago");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [sessionId, isFree]);

  return (
    <main className="container mx-auto py-16">
      <Helmet>
        <title>Pago exitoso | Kyle Lam Sound Healing</title>
        <meta name="description" content="Confirmación de compra" />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : ''} />
      </Helmet>
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-3xl font-bold">{loading ? 'Procesando tu pago…' : done ? '¡Gracias!' : 'Verificación'}</h1>
        {loading && <p className="text-muted-foreground">Confirmando tu pago…</p>}
        {error && (
          <div>
            <p className="text-destructive">{error}</p>
            <p className="text-muted-foreground text-sm mt-2">Si el cargo aparece en tu estado de cuenta, contáctanos y te ayudaremos.</p>
          </div>
        )}
        {done && (
          <div className="space-y-3">
            <p className="text-muted-foreground">Tu compra se registró correctamente.</p>
            <Button asChild>
              <Link to="/">Volver a eventos</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
};

export default CheckoutSuccess;