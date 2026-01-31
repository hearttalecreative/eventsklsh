import { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

// Helper to format savings message with amount placeholder
const formatSavingsMessage = (template: string, amount: string) => {
  return template.replace('{amount}', amount);
};

// All other programs section (excluding current)
function OtherProgramsSection({ 
  currentProgram,
  allPrograms 
}: { 
  currentProgram: TrainingProgram;
  allPrograms: TrainingProgram[];
}) {
  const otherPrograms = allPrograms.filter(p => p.id !== currentProgram.id);

  if (otherPrograms.length === 0) return null;

  const bundles = otherPrograms.filter(p => p.is_bundle);
  const trainings = otherPrograms.filter(p => !p.is_bundle);

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-muted/30 to-background">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground/70 mb-2">Explore More</p>
          <h3 className="font-playfair text-xl md:text-2xl font-normal tracking-wide text-foreground">
            Other Training Programs
          </h3>
        </div>

        {/* Individual trainings */}
        {trainings.length > 0 && (
          <div className="mb-8">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 text-center">Training Levels</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trainings.map((training) => {
                const hasSale = training.original_price_cents && training.original_price_cents > training.price_cents;
                const savings = hasSale ? training.original_price_cents! - training.price_cents : 0;
                
                return (
                  <Link
                    key={training.id}
                    to={`/trainings/${training.id}`}
                    className="block group"
                  >
                    <Card className="h-full transition-all duration-300 hover:shadow-lg hover:border-primary/50 border-border/50 bg-background overflow-hidden">
                      <CardContent className="p-5">
                        <h4 className="font-playfair text-base font-normal text-foreground mb-2 group-hover:text-primary transition-colors">
                          {training.name}
                        </h4>
                        
                        {training.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {training.excerpt}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-foreground">{formatPrice(training.price_cents)}</span>
                            {hasSale && (
                              <span className="text-xs text-muted-foreground/70 line-through">
                                {formatPrice(training.original_price_cents!)}
                              </span>
                            )}
                          </div>
                          
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
                          >
                            View Details
                            <ArrowRight className="ml-1 h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Bundles */}
        {bundles.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 text-center">
              {currentProgram.is_bundle ? 'Other Bundles' : 'Bundle & Save'}
            </h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bundles.map((bundle) => {
                const hasSale = bundle.original_price_cents && bundle.original_price_cents > bundle.price_cents;
                const savings = hasSale ? bundle.original_price_cents! - bundle.price_cents : 0;
                
                return (
                  <Link
                    key={bundle.id}
                    to={`/trainings/${bundle.id}`}
                    className="block group"
                  >
                    <Card className="h-full transition-all duration-300 hover:shadow-lg hover:border-primary/50 border-primary/20 bg-gradient-to-br from-background to-primary/5 overflow-hidden">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Bundle</span>
                        </div>
                        
                        <h4 className="font-playfair text-base font-normal text-foreground mb-2 group-hover:text-primary transition-colors">
                          {bundle.name}
                        </h4>
                        
                        {bundle.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {bundle.excerpt}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold text-foreground">{formatPrice(bundle.price_cents)}</span>
                              {hasSale && (
                                <span className="text-xs text-muted-foreground/70 line-through">
                                  {formatPrice(bundle.original_price_cents!)}
                                </span>
                              )}
                            </div>
                            {hasSale && (
                              <span className="text-xs font-medium text-success">
                                Save {formatPrice(savings)}
                              </span>
                            )}
                          </div>
                          
                          <Button 
                            size="sm" 
                            className="group-hover:scale-105 transition-transform"
                          >
                            View Details
                            <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function TrainingDetail() {
  const { programId } = useParams<{ programId: string }>();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredDates: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch the specific program
  const { data: program, isLoading, error } = useQuery({
    queryKey: ['training-program', programId],
    queryFn: async () => {
      if (!programId) throw new Error('No program ID');
      
      const { data, error } = await supabase
        .from('training_programs')
        .select('*')
        .eq('id', programId)
        .eq('active', true)
        .single();
      
      if (error) throw error;
      return data as TrainingProgram;
    },
    enabled: !!programId,
  });

  // Fetch all programs for related section
  const { data: allPrograms } = useQuery({
    queryKey: ['all-training-programs'],
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

  // Fetch global savings message setting
  const { data: savingsMessageSetting } = useQuery({
    queryKey: ['app-settings', 'training_savings_message'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'training_savings_message')
        .single();
      
      if (error) return 'Save {amount} with our special sale now.';
      return data?.value || 'Save {amount} with our special sale now.';
    },
  });

  const savingsMessage = savingsMessageSetting || 'Save {amount} with our special sale now.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!program) {
      toast.error('Program not found');
      return;
    }

    if (!formData.fullName || !formData.email || !formData.phone || !formData.preferredDates) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!acceptedTerms) {
      toast.error('Please accept the terms and conditions');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-training-payment', {
        body: {
          programId: program.id,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          preferredDates: formData.preferredDates,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      toast.error(err.message || 'Failed to initiate payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById('registration-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !program) {
    return <Navigate to="/trainings" replace />;
  }

  const hasSale = program.original_price_cents && program.original_price_cents > program.price_cents;
  const savings = hasSale ? program.original_price_cents! - program.price_cents : 0;

  return (
    <>
      <Helmet>
        <title>{program.name} | Kyle Lam Sound Healing</title>
        <meta name="description" content={program.excerpt || program.description || 'Book your private sound healing training.'} />
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

        <main className="flex-1">
          {/* Hero Section - Title Only */}
          <section className="bg-gradient-to-b from-primary/5 via-primary/3 to-background pt-6 pb-4 md:pt-8 md:pb-6">
            <div className="container max-w-3xl mx-auto px-4 text-center">
              {/* Bundle badge */}
              {program.is_bundle && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Bundle Package</span>
                </div>
              )}
              
              {/* Program title */}
              <h1 className="font-playfair text-2xl md:text-3xl lg:text-4xl font-normal tracking-wide text-foreground">
                {program.name}
              </h1>
            </div>
          </section>

          {/* Full Description Section */}
          {program.description && (
            <section className="py-6 md:py-8 bg-background">
              <div className="container max-w-3xl mx-auto px-4">
                <div className="prose prose-neutral dark:prose-invert max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({children}) => <p className="mb-4 leading-relaxed text-muted-foreground">{children}</p>,
                      ul: ({children}) => <ul className="mb-4 list-disc pl-6 space-y-2 text-muted-foreground">{children}</ul>,
                      ol: ({children}) => <ol className="mb-4 list-decimal pl-6 space-y-2 text-muted-foreground">{children}</ol>,
                      li: ({children}) => <li className="leading-relaxed">{children}</li>,
                      a: ({href, children}) => (
                        <a 
                          href={href} 
                          className="text-primary hover:underline" 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                      strong: ({children}) => <strong className="font-semibold text-foreground">{children}</strong>,
                      em: ({children}) => <em className="italic">{children}</em>,
                      h1: ({children}) => <h1 className="text-2xl font-bold mb-4 text-foreground">{children}</h1>,
                      h2: ({children}) => <h2 className="text-xl font-semibold mb-3 text-foreground">{children}</h2>,
                      h3: ({children}) => <h3 className="text-lg font-medium mb-2 text-foreground">{children}</h3>,
                      blockquote: ({children}) => (
                        <blockquote className="mb-4 pl-4 border-l-4 border-primary/30 italic text-muted-foreground">
                          {children}
                        </blockquote>
                      ),
                      code: ({children}) => (
                        <code className="px-1 py-0.5 bg-muted rounded text-sm font-mono">{children}</code>
                      ),
                    }}
                  >
                    {program.description}
                  </ReactMarkdown>
                </div>
              </div>
            </section>
          )}

          {/* Unified Pricing + Registration Form Section */}
          <section id="registration-form" className="py-8 md:py-12 bg-muted/30 scroll-mt-20">
            <div className="container max-w-xl mx-auto px-4">
              <Card className="shadow-xl border-border/50 overflow-hidden">
                <CardContent className="p-0">
                  {/* Pricing header */}
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center border-b border-border/30">
                    {hasSale && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Limited Sale</span>
                      </div>
                    )}
                    
                    {/* Primary price */}
                    <div className="mb-2">
                      <span className="text-3xl md:text-4xl font-bold text-foreground">
                        {formatPrice(program.price_cents)}
                      </span>
                      {hasSale && (
                        <span className="text-lg text-muted-foreground/60 line-through ml-2">
                          {formatPrice(program.original_price_cents!)}
                        </span>
                      )}
                    </div>
                    
                    {/* Processing fee */}
                    <p className="text-xs text-muted-foreground mb-3">+ {program.processing_fee_percent}% processing fee</p>
                    
                    {/* Savings badge */}
                    {hasSale && (
                      <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
                        <span 
                          className="text-xs font-normal text-success"
                          dangerouslySetInnerHTML={{ __html: formatSavingsMessage(savingsMessage, formatPrice(savings)) }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Registration form */}
                  <div className="p-6 md:p-8">
                    <h2 className="font-playfair text-lg md:text-xl font-normal tracking-wide text-foreground text-center mb-6">
                      Complete Your Registration
                    </h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name *</Label>
                        <Input
                          id="fullName"
                          placeholder="Enter your full name"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="preferredDates">Preferred Date or Dates *</Label>
                        <Input
                          id="preferredDates"
                          value={formData.preferredDates}
                          onChange={(e) => setFormData({ ...formData, preferredDates: e.target.value })}
                          required
                        />
                        {program.availability_info && (
                          <p 
                            className="text-xs text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: program.availability_info }}
                          />
                        )}
                      </div>
                      <div className="flex items-start space-x-3 pt-2">
                        <Checkbox
                          id="terms"
                          checked={acceptedTerms}
                          onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                          required
                        />
                        <label
                          htmlFor="terms"
                          className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                        >
                          I have read and agree to the{' '}
                          <a
                            href="https://kylelamsoundhealing.com/private-training-terms-conditions/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Terms and Conditions
                          </a>
                          {' '}*
                        </label>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full mt-4" 
                        size="lg"
                        disabled={isSubmitting || !acceptedTerms}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          `Proceed to Payment - ${formatPrice(program.price_cents)}`
                        )}
                      </Button>
                    </form>
                    
                    {/* Note about date confirmation */}
                    <p className="mt-4 text-xs text-muted-foreground italic text-center">
                      Upon completion of registration, our team will reach out regarding date confirmation.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Registration Form */}
          <section id="registration-form" className="py-10 md:py-14 bg-background scroll-mt-20">
            <div className="container max-w-xl mx-auto px-4">
              <h2 className="font-playfair text-xl md:text-2xl font-normal tracking-wide text-foreground text-center mb-8">
                Complete Your Registration
              </h2>
              
              <Card className="shadow-xl border-border/50">
                <CardContent className="p-6 md:p-8">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        placeholder="Enter your full name"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preferredDates">Preferred Date or Dates *</Label>
                      <Input
                        id="preferredDates"
                        value={formData.preferredDates}
                        onChange={(e) => setFormData({ ...formData, preferredDates: e.target.value })}
                        required
                      />
                      {program.availability_info && (
                        <p 
                          className="text-xs text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: program.availability_info }}
                        />
                      )}
                    </div>
                    <div className="flex items-start space-x-3 pt-2">
                      <Checkbox
                        id="terms"
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                        required
                      />
                      <label
                        htmlFor="terms"
                        className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                      >
                        I have read and agree to the{' '}
                        <a
                          href="https://kylelamsoundhealing.com/private-training-terms-conditions/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Terms and Conditions
                        </a>
                        {' '}*
                      </label>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full mt-6" 
                      size="lg"
                      disabled={isSubmitting || !acceptedTerms}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        `Proceed to Payment - ${formatPrice(program.price_cents)}`
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Other Programs Section */}
          {allPrograms && allPrograms.length > 1 && (
            <OtherProgramsSection 
              currentProgram={program}
              allPrograms={allPrograms}
            />
          )}

          {/* Back to All Programs link at the bottom */}
          <div className="py-8 bg-background">
            <div className="container max-w-4xl mx-auto px-4 text-center">
              <Link 
                to="/trainings" 
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to All Programs
              </Link>
            </div>
          </div>
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
