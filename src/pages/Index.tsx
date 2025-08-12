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
        <title>Eventos | Kyle Lam Sound Healing</title>
        <meta name="description" content="Compra entradas y descubre eventos de Kyle Lam Sound Healing." />
        <link rel="canonical" href={`${baseUrl}/`} />
        <meta property="og:site_name" content="Kyle Lam Sound Healing" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Eventos | Kyle Lam Sound Healing" />
        <meta property="og:description" content="Compra entradas y descubre eventos de Kyle Lam Sound Healing." />
        <meta property="og:image" content="https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-34-100.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Eventos | Kyle Lam Sound Healing" />
        <meta name="twitter:description" content="Compra entradas y descubre eventos de Kyle Lam Sound Healing." />
        <meta name="twitter:image" content="https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-34-100.jpg" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-4xl font-bold">Upcoming events</h1>
      </header>

      <section className="py-6">
        <EventList />
      </section>
    </main>
  );
};

export default Index;
