import { Helmet } from "react-helmet-async";

const Terms = () => {
  const title = "Términos y Condiciones | Events";
  const description = "Lee los Términos y Condiciones de nuestros eventos.";
  const canonical = typeof window !== 'undefined' ? `${window.location.origin}/terms` : '/terms';

  return (
    <main className="container mx-auto py-12">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
      </Helmet>
      <article className="prose max-w-3xl">
        <h1>Términos y Condiciones</h1>
        <p className="text-muted-foreground">Última actualización: {new Date().toLocaleDateString()}</p>
        <p>
          Esta página describe los términos que aplican a la compra de entradas y la asistencia a nuestros
          eventos. Este contenido es un placeholder de ejemplo. Personaliza esta sección con tus condiciones
          reales, incluyendo políticas de cancelación, reembolsos, conducta y privacidad.
        </p>
        <h2>Uso aceptable</h2>
        <p>
          El acceso al evento implica el respeto de las normas del recinto y del organizador. El incumplimiento
          podrá resultar en la expulsión sin reembolso.
        </p>
        <h2>Reembolsos</h2>
        <p>
          Salvo que la ley indique lo contrario, los reembolsos están sujetos a la política del organizador.
        </p>
        <h2>Contacto</h2>
        <p>
          Para consultas, contáctanos a través de la página principal.
        </p>
      </article>
    </main>
  );
};

export default Terms;
