import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Check, GraduationCap, Sparkles, ArrowRight } from 'lucide-react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';

interface TrainingProgram {
  id: string;
  name: string;
  description: string | null;
  excerpt: string | null;
  price_cents: number;
  original_price_cents: number | null;
  processing_fee_percent: number;
  is_bundle: boolean;
  display_order: number;
  available_from: string | null;
  available_to: string | null;
  related_training_ids: string[] | null;
  availability_info: string | null;
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

export default function TrainingPrograms() {
  const [searchParams] = useSearchParams();
  const programIdFromUrl = searchParams.get('program');

  // Redirect old direct links to new detail page
  if (programIdFromUrl) {
    return <Navigate to={`/trainings/${programIdFromUrl}`} replace />;
  }

  const { data: programs, isLoading } = useQuery({
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

  const individualPrograms = programs?.filter(p => !p.is_bundle) || [];
  const bundles = programs?.filter(p => p.is_bundle) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Private Sound Training Programs | Kyle Lam Sound Healing</title>
        <meta name="description" content="Three structured training levels designed for students who want a direct and practical learning format. Book your private sound healing training." />
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
                Private Sound Training Programs
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Three structured training levels for a direct and practical learning format. 
                Book a single level or choose a bundle package at a reduced rate.
              </p>
            </div>
          </section>

          {/* Training Levels */}
          <section className="py-6 md:py-10 bg-background">
            <div className="container max-w-6xl mx-auto px-4">
              <div className="flex items-center justify-center gap-3 mb-6">
                <h2 className="font-playfair text-xl md:text-2xl font-normal tracking-wide flex items-center gap-2 text-muted-foreground">
                  <GraduationCap className="h-5 w-5 text-primary/70" />
                  Training Levels
                </h2>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {individualPrograms.map((program) => {
                  const hasSale = program.original_price_cents && program.original_price_cents > program.price_cents;
                  const savings = hasSale ? program.original_price_cents! - program.price_cents : 0;
                  
                  return (
                    <Card 
                      key={program.id}
                      className="relative flex flex-col h-full transition-all duration-300 group overflow-hidden hover:shadow-xl hover:border-primary/40"
                    >
                      {/* Sale indicator bar */}
                      {hasSale && (
                        <div className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest text-center py-1.5 border-b border-border/50">
                          Limited Sale
                        </div>
                      )}
                      
                      <CardContent className="flex flex-col flex-1 p-6">
                        <h3 className="font-playfair text-xl md:text-2xl font-semibold leading-tight text-foreground mb-4">
                          {program.name}
                        </h3>
                        
                        {/* Excerpt - max 50 words */}
                        <p className="text-sm text-muted-foreground/80 leading-relaxed flex-1">
                          {truncateWords(program.excerpt, 50)}
                        </p>
                        
                        {/* Pricing section */}
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
                              <span className="text-xs font-semibold text-success">
                                Save {formatPrice(savings)}
                              </span>
                            </div>
                          )}
                          
                          <Button 
                            variant="default"
                            className="w-full mt-2 transition-all shadow-md hover:shadow-lg"
                            size="default"
                            asChild
                          >
                            <Link to={`/trainings/${program.id}`}>
                              View Details
                              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Divider */}
          {bundles.length > 0 && (
            <div className="container max-w-6xl mx-auto px-4">
              <div className="relative py-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-4 text-sm text-muted-foreground">or save with a bundle</span>
                </div>
              </div>
            </div>
          )}

          {/* Bundle Packages */}
          {bundles.length > 0 && (
            <section className="py-12 md:py-16 bg-gradient-to-b from-primary/5 to-background">
              <div className="container max-w-6xl mx-auto px-4">
                <div className="flex items-center justify-center gap-3 mb-10">
                  <h2 className="font-playfair text-xl md:text-2xl font-normal tracking-wide flex items-center gap-2 text-muted-foreground">
                    <Sparkles className="h-5 w-5 text-primary/70" />
                    Bundle Packages
                  </h2>
                </div>
                
                <div className="grid md:grid-cols-3 gap-6">
                  {bundles.map((program) => {
                    const hasSale = program.original_price_cents && program.original_price_cents > program.price_cents;
                    const savings = hasSale ? program.original_price_cents! - program.price_cents : 0;
                    
                    return (
                      <Card 
                        key={program.id}
                        className="relative flex flex-col h-full transition-all duration-300 group border-primary/30 bg-gradient-to-br from-background to-primary/5 overflow-hidden hover:shadow-xl hover:border-primary/50"
                      >
                        {/* Sale indicator bar */}
                        {hasSale && (
                          <div className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest text-center py-1.5 border-b border-border/50">
                            Limited Sale
                          </div>
                        )}
                        
                        <CardContent className="flex flex-col flex-1 p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Bundle & Save</span>
                          </div>
                          
                          <h3 className="font-playfair text-xl md:text-2xl font-semibold leading-tight text-foreground mb-4">
                            {program.name}
                          </h3>
                          
                          {/* Excerpt - max 50 words */}
                          <p className="text-sm text-muted-foreground/80 leading-relaxed flex-1">
                            {truncateWords(program.excerpt, 50)}
                          </p>
                          
                          {/* Pricing section */}
                          <div className="mt-6 pt-5 border-t border-primary/20 space-y-3">
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
                                <span className="text-xs font-semibold text-success">
                                  Save {formatPrice(savings)}
                                </span>
                              </div>
                            )}
                            
                            <Button 
                              variant="default"
                              className="w-full mt-2 transition-all shadow-md hover:shadow-lg"
                              size="default"
                              asChild
                            >
                              <Link to={`/trainings/${program.id}`}>
                                View Details
                                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </section>
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
