import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CheckoutCancel = () => {
  return (
    <main className="container mx-auto py-16">
      <Helmet>
        <title>Pago cancelado | Kyle Lam Sound Healing</title>
        <meta name="description" content="Cancelaste el proceso de pago" />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : ''} />
      </Helmet>
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-3xl font-bold">Has cancelado el pago</h1>
        <p className="text-muted-foreground">Puedes volver a intentarlo cuando quieras.</p>
        <Button asChild>
          <Link to="/">Volver a eventos</Link>
        </Button>
      </div>
    </main>
  );
};

export default CheckoutCancel;
