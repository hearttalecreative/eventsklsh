import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowRight } from 'lucide-react';
import { Link, useSearchParams, Navigate, useParams } from 'react-router-dom';

interface TrainingProgram {
  id: string;
  name: string;
  excerpt: string | null;
  price_cents: number;
  original_price_cents: number | null;
  is_bundle: boolean;
  display_order: number;
  category_id: string | null;
}

interface TrainingCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
}

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

const truncateWords = (text: string | null, maxWords: number): string => {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
};

function ProgramCard({ program }: { program: TrainingProgram }) {
  const hasSale = program.original_price_cents && program.original_price_cents > program.price_cents;
  const savings = hasSale ? program.original_price_cents! - program.price_cents : 0;

  return (
    <Card className="relative flex flex-col h-full transition-all duration-300 group overflow-hidden hover:shadow-xl hover:border-primary/40">
      {hasSale && (
        <div className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest text-center py-1.5 border-b border-border/50">
          Limited Sale
        </div>
      )}
      <CardContent className="flex flex-col flex-1 p-6">
        <h3 className="font-playfair text-xl md:text-2xl font-semibold leading-tight text-foreground mb-4">
          {program.name}
        </h3>
        <p className="text-sm text-muted-foreground/80 leading-relaxed flex-1">
          {truncateWords(program.excerpt, 50)}
        </p>
        <div className="mt-6 pt-5 border-t border-border/50 space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{formatPrice(program.price_cents)}</span>
            {hasSale && (
              <span className="text-base text-muted-foreground/60 line-through">
                {formatPrice(program.original_price_cents!)}
              </span>
            )}
          </div>
          {hasSale && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
              <span className="text-xs font-semibold text-success">Save {formatPrice(savings)}</span>
            </div>
          )}
          <Button variant="default" className="w-full mt-2 transition-all shadow-md hover:shadow-lg" size="default" asChild>
            <Link to={`/trainings/${program.id}`}>
              View Details
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CategorySection({ category, programs }: { category: TrainingCategory; programs: TrainingProgram[] }) {
  const categoryPrograms = programs.filter(p => p.category_id === category.id);
  if (categoryPrograms.length === 0) return null;

  return (
    <section id={`category-${category.slug}`} className="py-6 md:py-10">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="font-playfair text-xl md:text-2xl font-normal tracking-wide text-foreground mb-2">
            {category.name}
          </h2>
          {category.description && (
            <p className="text-sm text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {category.description}
            </p>
          )}
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {categoryPrograms.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function TrainingPrograms() {
  const [searchParams] = useSearchParams();
  const { slug } = useParams<{ slug?: string }>();
  const programIdFromUrl = searchParams.get('program');

  // Redirect old direct links to new detail page
  if (programIdFromUrl) {
    return <Navigate to={`/trainings/${programIdFromUrl}`} replace />;
  }

  const { data: categories, isLoading: loadingCats } = useQuery({
    queryKey: ['training-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_categories')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as TrainingCategory[];
    },
  });

  const { data: programs, isLoading: loadingPrograms } = useQuery({
    queryKey: ['training-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_programs')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as TrainingProgram[];
    },
  });

  const isLoading = loadingCats || loadingPrograms;

  // If viewing a specific category by slug
  const filteredCategory = slug ? categories?.find(c => c.slug === slug) : null;
  const displayCategories = slug && filteredCategory ? [filteredCategory] : (categories || []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If slug provided but not found, redirect to main page
  if (slug && !filteredCategory) {
    return <Navigate to="/trainings" replace />;
  }

  const pageTitle = filteredCategory
    ? `${filteredCategory.name} | Kyle Lam Sound Healing`
    : 'Private Sound Training Programs | Kyle Lam Sound Healing';

  const pageDesc = filteredCategory?.description
    || 'Three structured training levels designed for students who want a direct and practical learning format. Book your private sound healing training.';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 max-w-screen-2xl items-center justify-center">
            <Link to="/">
              <img 
                src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-2logo-horizontal-color.svg" 
                alt="Kyle Lam Sound Healing" 
                className="h-8 w-auto"
              />
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {/* Hero Section */}
          <section className="bg-gradient-to-b from-primary/5 to-background py-6 md:py-8">
            <div className="container max-w-4xl mx-auto px-4 text-center">
              <h1 className="font-playfair text-3xl md:text-4xl font-normal tracking-wide mb-2 text-foreground">
                {filteredCategory ? filteredCategory.name : 'Private Sound Training Programs'}
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {filteredCategory
                  ? filteredCategory.description
                  : 'Three structured training levels for a direct and practical learning format. Book a single level or choose a bundle package at a reduced rate.'}
              </p>
            </div>
          </section>

          {/* Categories */}
          {displayCategories.map((category, index) => (
            <div key={category.id}>
              {index > 0 && (
                <div className="container max-w-6xl mx-auto px-4">
                  <div className="relative py-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/60"></div>
                    </div>
                  </div>
                </div>
              )}
              <CategorySection category={category} programs={programs || []} />
            </div>
          ))}

          {/* Back link when viewing single category */}
          {slug && (
            <div className="container max-w-6xl mx-auto px-4 py-8 text-center">
              <Link to="/trainings" className="text-sm text-primary hover:underline">
                ← Back to All Training Programs
              </Link>
            </div>
          )}

          {/* No categories message */}
          {!slug && displayCategories.length === 0 && (
            <div className="container max-w-6xl mx-auto px-4 py-16 text-center">
              <p className="text-muted-foreground">No training programs available at this time.</p>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/40 py-6 bg-background">
          <div className="container max-w-6xl mx-auto px-4 text-center">
            <p className="text-sm text-muted-foreground">
              © Copyright {new Date().getFullYear()} Kyle Lam Sound Healing. All Rights Reserved. | Developed with ❤️ by{' '}
              <a href="https://hearttalecreative.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Hearttale Creative
              </a>.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
