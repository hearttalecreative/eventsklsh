import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CheckoutCancel = () => {
  return (
    <main className="container mx-auto py-16">
      <Helmet>
        <title>Payment canceled | Kyle Lam Sound Healing</title>
        <meta name="description" content="You canceled the payment process." />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : ''} />
      </Helmet>
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-3xl font-bold">You canceled the payment</h1>
        <p className="text-muted-foreground">You can try again anytime.</p>
        <Button asChild>
          <Link to="/">Back to events</Link>
        </Button>
      </div>
    </main>
  );
};

export default CheckoutCancel;
