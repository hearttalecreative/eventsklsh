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
    <main className="overflow-x-hidden">
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

      <header className="container mx-auto px-4 py-6 sm:py-8 text-center">
        <h1 className="text-2xl sm:text-4xl font-bold">Upcoming events</h1>
      </header>

      <section className="py-4 sm:py-6">
        <EventList />
      </section>

      <footer className="container mx-auto px-4 py-8 text-center border-t">
        <p className="text-sm text-muted-foreground">
          © Copyright {new Date().getFullYear()} Kyle Lam Sound Healing. All Rights Reserved. | Developed with ❤️ by{' '}
          <a 
            href="https://hearttalecreative.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Hearttale Creative
          </a>
          .
        </p>
      </footer>
    </main>
  );
};

export default Index;
