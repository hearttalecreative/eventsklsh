import EventList from "@/components/EventList";
import { Helmet } from "react-helmet-async";

const Index = () => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Upcoming Events',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
  };

  return (
    <main className="min-h-screen overflow-x-hidden flex flex-col">
      <Helmet>
        <title>Events | Kyle Lam Sound Healing</title>
        <meta name="description" content="Buy tickets and discover Kyle Lam Sound Healing events." />
        <link rel="canonical" href={`${baseUrl}/`} />
        <meta property="og:site_name" content="Kyle Lam Sound Healing" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Events | Kyle Lam Sound Healing" />
        <meta property="og:description" content="Buy tickets and discover Kyle Lam Sound Healing events." />
        <meta property="og:image" content="https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-34-100.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Events | Kyle Lam Sound Healing" />
        <meta name="twitter:description" content="Buy tickets and discover Kyle Lam Sound Healing events." />
        <meta name="twitter:image" content="https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-34-100.jpg" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Hero Header */}
      <header className="container mx-auto max-w-4xl px-4 pt-14 pb-10 sm:pt-20 sm:pb-14 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70 mb-4">Sound Healing Experiences</p>
        <h1 className="font-playfair text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
          Upcoming Events
        </h1>
        {/* Decorative divider */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="h-px w-16 bg-border" />
          <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
          <div className="h-px w-16 bg-border" />
        </div>
      </header>

      {/* Events Grid */}
      <section className="container mx-auto max-w-7xl px-4 pb-16 sm:pb-20 flex-1">
        <EventList />
      </section>
    </main>
  );
};

export default Index;
