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
        <title>Próximos eventos | Modern Tickets</title>
        <meta name="description" content="Explora y reserva próximos eventos con una experiencia rápida y móvil." />
        <link rel="canonical" href={`${baseUrl}/`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="container mx-auto py-8">
        <h1 className="text-4xl font-bold">Próximos eventos</h1>
      </header>

      <section className="py-6">
        <EventList />
      </section>
    </main>
  );
};

export default Index;
