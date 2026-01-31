import { useState } from 'react';
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
import { Loader2, Check, ArrowRight, ArrowLeft, Sparkles, Shield, Mail, Clock, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
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
          {/* Hero Section - Compact Title */}
          <section className="bg-gradient-to-b from-primary/5 to-background pt-5 pb-3 md:pt-6 md:pb-4">
            <div className="container max-w-3xl mx-auto px-4 text-center">
              {/* Bundle badge */}
              {program.is_bundle && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Bundle Package</span>
                </div>
              )}
              
              {/* Program title - Larger on mobile */}
              <h1 className="font-playfair text-2xl md:text-3xl lg:text-4xl font-normal tracking-wide text-foreground">
                {program.name}
              </h1>
            </div>
          </section>

          {/* Collapsible Description Section */}
          {program.description && (
            <section className="py-4 md:py-5 bg-background">
              <div className="container max-w-2xl mx-auto px-4">
                <div className="relative">
                  <div 
                    className={`prose prose-sm prose-neutral dark:prose-invert max-w-none overflow-hidden transition-all duration-300 ${
                      descriptionExpanded ? 'max-h-none' : 'max-h-[9rem]'
                    }`}
                  >
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({children}) => <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{children}</p>,
                        ul: ({children}) => <ul className="mb-3 list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">{children}</ul>,
                        ol: ({children}) => <ol className="mb-3 list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">{children}</ol>,
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
                        h1: ({children}) => <h1 className="text-xl font-bold mb-3 text-foreground">{children}</h1>,
                        h2: ({children}) => <h2 className="text-lg font-semibold mb-2 text-foreground">{children}</h2>,
                        h3: ({children}) => <h3 className="text-base font-medium mb-2 text-foreground">{children}</h3>,
                        blockquote: ({children}) => (
                          <blockquote className="mb-3 pl-3 border-l-3 border-primary/30 italic text-muted-foreground text-sm">
                            {children}
                          </blockquote>
                        ),
                        code: ({children}) => (
                          <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{children}</code>
                        ),
                      }}
                    >
                      {program.description}
                    </ReactMarkdown>
                  </div>
                  
                  {/* Gradient fade overlay when collapsed */}
                  {!descriptionExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                  )}
                </div>
                
                {/* Read more/less toggle */}
                <button
                  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors mx-auto"
                >
                  {descriptionExpanded ? (
                    <>
                      <span>Show less</span>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Read more</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </section>
          )}

          {/* Unified Pricing + Registration Form Section */}
          <section id="registration-form" className="py-6 md:py-8 bg-muted/40 scroll-mt-16">
            <div className="container max-w-md mx-auto px-4">
              <Card className="shadow-2xl border-border/40 overflow-hidden">
                <CardContent className="p-0">
                  {/* Pricing header - More prominent */}
                  <div className="bg-gradient-to-br from-primary/8 to-primary/15 p-5 text-center">
                    {/* Urgency badge - compact */}
                    {hasSale && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/10 border border-destructive/20 mb-3">
                        <span className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Limited Time Offer</span>
                      </div>
                    )}
                    
                    {/* Primary price */}
                    <div className="mb-1">
                      <span className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
                        {formatPrice(program.price_cents)}
                      </span>
                      {hasSale && (
                        <span className="text-sm text-muted-foreground/50 line-through ml-2 font-normal">
                          {formatPrice(program.original_price_cents!)}
                        </span>
                      )}
                    </div>
                    
                    {/* Processing fee - Subtle */}
                    <p className="text-[11px] text-muted-foreground/70 mb-3">+ {program.processing_fee_percent}% processing fee at checkout</p>
                    
                    {/* Savings - Clean single message without checkmark */}
                    {hasSale && (
                      <div className="bg-success/15 border border-success/30 rounded-lg p-2.5">
                        <p 
                          className="text-sm text-success leading-relaxed text-center"
                          dangerouslySetInnerHTML={{ __html: savingsMessage.replace('{amount}', `<strong>${formatPrice(savings)}</strong>`) }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Registration form - Tighter spacing */}
                  <div className="p-5 md:p-6">
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="fullName" className="text-xs font-medium">Full Name</Label>
                        <Input
                          id="fullName"
                          placeholder="Your full name"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          required
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="text-xs font-medium">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          required
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="preferredDates" className="text-xs font-medium">Preferred Date(s)</Label>
                        <Input
                          id="preferredDates"
                          placeholder="e.g., March 15-16, 2026 or flexible"
                          value={formData.preferredDates}
                          onChange={(e) => setFormData({ ...formData, preferredDates: e.target.value })}
                          required
                          className="h-10"
                        />
                        {program.availability_info && (
                          <p 
                            className="text-[10px] text-muted-foreground/60 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: program.availability_info }}
                          />
                        )}
                      </div>
                      
                      {/* Terms checkbox - More spacing from button */}
                      <div className="flex items-start space-x-2.5 pt-3 pb-1">
                        <Checkbox
                          id="terms"
                          checked={acceptedTerms}
                          onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                          required
                          className="mt-0.5"
                        />
                        <label
                          htmlFor="terms"
                          className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                        >
                          I agree to the{' '}
                          <a
                            href="https://kylelamsoundhealing.com/private-training-terms-conditions/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Terms & Conditions
                          </a>
                        </label>
                      </div>

                      {/* CTA Button - Stronger, action-focused */}
                      <Button 
                        type="submit" 
                        className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all" 
                        size="lg"
                        disabled={isSubmitting || !acceptedTerms}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Reserve Your Spot
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>

                      {/* Trust signals */}
                      <div className="flex items-center justify-center gap-4 pt-3 border-t border-border/30 mt-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground/70">
                          <Shield className="h-3.5 w-3.5" />
                          <span className="text-[10px]">Secure payment</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground/70">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="text-[10px]">Confirmation by email</span>
                        </div>
                      </div>
                    </form>
                  </div>
                </CardContent>
              </Card>
              
              {/* Post-card note */}
              <p className="mt-4 text-[11px] text-muted-foreground/60 text-center leading-relaxed">
                Our team will contact you within 24 hours to confirm your preferred dates.
              </p>
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
