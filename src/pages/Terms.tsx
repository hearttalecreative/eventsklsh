import { Helmet } from "react-helmet-async";

const Terms = () => {
  const title = "Terms and Conditions | Events";
  const description = "Read the Terms and Conditions for our events.";
  const canonical = typeof window !== 'undefined' ? `${window.location.origin}/terms` : '/terms';

  return (
    <main className="container mx-auto py-12">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
      </Helmet>
      <article className="prose max-w-3xl">
        <h1>Terms and Conditions</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US')}</p>
        <p>
          This page describes the terms that apply to ticket purchases and attendance at our events. This is a sample placeholder. Replace with your real policies, including cancellation, refunds, conduct, and privacy.
        </p>
        <h2>Acceptable Use</h2>
        <p>
          Access to the event implies respecting the venue and organizer rules. Failure to comply may result in expulsion without refund.
        </p>
        <h2>Refunds</h2>
        <p>
          Unless required by law, refunds are subject to the organizer's policy.
        </p>
        <h2>Contact</h2>
        <p>
          For inquiries, contact us via the main site.
        </p>
      </article>
    </main>
  );
};

export default Terms;
