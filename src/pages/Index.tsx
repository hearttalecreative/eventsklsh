import EventList from "@/components/EventList";
import { Button } from "@/components/ui/button";
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
    <main>
      <Helmet>
        <title>Upcoming Events | Modern Tickets</title>
        <meta name="description" content="Discover and book upcoming events with a clean, fast experience." />
        <link rel="canonical" href={`${baseUrl}/`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="container mx-auto py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-5 animate-enter">
            <h1 className="text-5xl font-bold tracking-tight">Explore upcoming events</h1>
            <p className="text-lg text-muted-foreground">Modern, intuitive and mobile-friendly experience. Choose tickets, add-ons and register participants in minutes.</p>
            <div className="flex gap-3">
              <Button size="lg">Browse events</Button>
              <Button size="lg" variant="secondary">How it works</Button>
            </div>
          </div>
          <div className="rounded-xl border bg-card h-64 lg:h-80 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-secondary to-muted" />
          </div>
        </div>
      </header>

      <section className="py-12">
        <EventList />
      </section>
    </main>
  );
};

export default Index;
