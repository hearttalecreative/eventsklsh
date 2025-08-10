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
    <main>
      <Helmet>
        <title>Upcoming Events | Modern Tickets</title>
        <meta name="description" content="Discover and book upcoming events with a clean, fast experience." />
        <link rel="canonical" href={`${baseUrl}/`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="container mx-auto py-8">
        <h1 className="text-4xl font-bold">Upcoming events</h1>
      </header>

      <section className="py-6">
        <EventList />
      </section>
    </main>
  );
};

export default Index;
