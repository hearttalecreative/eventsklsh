import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Check, GraduationCap, Sparkles, ChevronDown, ArrowRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

interface TrainingProgram {
  id: string;
  name: string;
  description: string | null;
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

// Helper to format savings message with amount placeholder
const formatSavingsMessage = (template: string, amount: string) => {
  return template.replace('{amount}', amount);
};

const calculateFee = (priceCents: number, feePercent: number) => {
  return Math.round(priceCents * (feePercent / 100));
};

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

// Component for displaying related training links - attractive secondary action
function RelatedTrainingsLinks({ relatedIds, allPrograms }: { relatedIds: string[] | null; allPrograms: TrainingProgram[] }) {
  if (!relatedIds || relatedIds.length === 0) return null;

  const relatedPrograms = allPrograms.filter(p => relatedIds.includes(p.id) && !p.is_bundle);
  if (relatedPrograms.length === 0) return null;

  return (
    <div className="mt-10 pt-8 border-t border-border/40">
      <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium mb-5 text-center">Also Available</p>
      <div className="flex flex-col items-center gap-3">
        {relatedPrograms.map(program => (
          <Link 
            key={program.id}
            to={`/trainings?program=${program.id}`} 
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 hover:bg-primary/10 border border-border/50 hover:border-primary/30 transition-all"
          >
            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{program.name}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// Component for displaying bundle packages in direct link mode
function BundlesSection({ currentProgramId, savingsMessage }: { currentProgramId: string; savingsMessage: string }) {
  const { data: bundles, isLoading } = useQuery({
    queryKey: ['training-bundles-for-direct-link'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_programs')
        .select('*')
        .eq('active', true)
        .eq('is_bundle', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as TrainingProgram[];
    },
  });

  if (isLoading || !bundles || bundles.length === 0) return null;

  return (
    <section className="py-16 bg-gradient-to-b from-muted/30 to-background">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-widest text-primary/70 mb-2">Bundle & Save</p>
          <h3 className="font-playfair text-xl md:text-2xl font-normal tracking-wide text-foreground">
            Save more with a training package
          </h3>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {bundles.map((bundle) => {
            const hasSale = bundle.original_price_cents && bundle.original_price_cents > bundle.price_cents;
            const savings = hasSale ? bundle.original_price_cents! - bundle.price_cents : 0;
            
            return (
              <Link
                key={bundle.id}
                to={`/trainings?program=${bundle.id}`}
                className="block group"
              >
                <Card className="h-full transition-all duration-300 hover:shadow-xl hover:border-primary/50 border-primary/20 bg-gradient-to-br from-background to-primary/5 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">Bundle</span>
                    </div>
                    
                    <h4 className="font-playfair text-lg font-normal text-foreground mb-4 group-hover:text-primary transition-colors">
                      {bundle.name}
                    </h4>
                    
                    {/* Price block with clear hierarchy */}
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground">{formatPrice(bundle.price_cents)}</span>
                        {hasSale && (
                          <span className="text-sm text-muted-foreground/70 line-through">
                            {formatPrice(bundle.original_price_cents!)}
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
                    </div>
                    
                    <div className="mt-5 pt-4 border-t border-border/30">
                      <span className="text-sm text-primary font-medium group-hover:underline flex items-center gap-1">
                        View Details
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

      </div>
    </section>
  );
}

export default function TrainingPrograms() {
  const [searchParams] = useSearchParams();
  const programIdFromUrl = searchParams.get('program');
  const isDirectLink = !!programIdFromUrl;

  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredDates: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: programs, isLoading } = useQuery({
    queryKey: ['training-programs', programIdFromUrl],
    queryFn: async () => {
      // If direct link, fetch only that program
      if (programIdFromUrl) {
        const { data, error } = await supabase
          .from('training_programs')
          .select('*')
          .eq('id', programIdFromUrl)
          .eq('active', true)
          .single();
        
        if (error) throw error;
        return data ? [data as TrainingProgram] : [];
      }
      
      // Otherwise fetch all active programs
      const { data, error } = await supabase
        .from('training_programs')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as TrainingProgram[];
    },
  });

  // Fetch all programs for related training links (used in direct link mode)
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
    enabled: isDirectLink, // Only fetch when in direct link mode
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

  // Auto-select program when accessed via direct link
  useEffect(() => {
    if (isDirectLink && programs?.length === 1) {
      setSelectedProgram(programs[0]);
    }
  }, [isDirectLink, programs]);

  const individualPrograms = programs?.filter(p => !p.is_bundle) || [];
  const bundles = programs?.filter(p => p.is_bundle) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) {
      toast.error('Please select a training program');
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
          programId: selectedProgram.id,
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

  // Direct link mode: show only the selected program and form
  if (isDirectLink && selectedProgram) {
    const hasSale = selectedProgram.original_price_cents && selectedProgram.original_price_cents > selectedProgram.price_cents;
    const savings = hasSale ? selectedProgram.original_price_cents! - selectedProgram.price_cents : 0;
    
    return (
      <>
        <Helmet>
          <title>{selectedProgram.name} | Kyle Lam Sound Healing</title>
          <meta name="description" content={selectedProgram.description || 'Book your private sound healing training.'} />
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
            {/* Hero Section - Enhanced pricing hierarchy */}
            <section className="bg-gradient-to-b from-primary/5 via-primary/3 to-background py-14 md:py-20">
              <div className="container max-w-3xl mx-auto px-4 text-center">
                {/* Program title */}
                <h1 className="font-playfair text-3xl md:text-4xl lg:text-[2.75rem] font-normal tracking-wide mb-5 text-foreground">
                  {selectedProgram.name}
                </h1>
                
                {/* Description */}
                {selectedProgram.description && (
                  <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
                    {selectedProgram.description}
                  </p>
                )}
                
                {/* PRICING BLOCK - Clear visual hierarchy */}
                <div className="bg-background rounded-2xl shadow-lg border border-border/50 p-6 md:p-8 max-w-md mx-auto">
                  {hasSale && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">Limited Sale</span>
                    </div>
                  )}
                  
                  {/* Primary price - largest and most prominent */}
                  <div className="mb-3">
                    <span className="text-4xl md:text-5xl font-bold text-foreground">
                      {formatPrice(selectedProgram.price_cents)}
                    </span>
                    {hasSale && (
                      <span className="text-xl text-muted-foreground/60 line-through ml-3">
                        {formatPrice(selectedProgram.original_price_cents!)}
                      </span>
                    )}
                  </div>
                  
                  {/* Processing fee - subtle */}
                  <p className="text-xs text-muted-foreground mb-4">+ 3.5% processing fee</p>
                  
                  {/* Savings badge - highlighted but secondary to price */}
                  {hasSale && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-success/10 border border-success/20">
                      <Check className="h-4 w-4 text-success" />
                      <span 
                        className="text-xs font-normal text-success"
                        dangerouslySetInnerHTML={{ __html: formatSavingsMessage(savingsMessage, formatPrice(savings)) }}
                      />
                    </div>
                  )}
                  
                  {/* CTA Button */}
                  <Button 
                    onClick={scrollToForm}
                    size="lg"
                    className="w-full mt-6 text-base"
                  >
                    Register Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                
                {/* Note about date confirmation */}
                <p className="mt-6 text-sm text-muted-foreground italic max-w-md mx-auto">
                  Upon completion of registration, our team will reach out regarding date confirmation.
                </p>
                
                {/* Related trainings links - clearly secondary */}
                <RelatedTrainingsLinks 
                  relatedIds={selectedProgram.related_training_ids} 
                  allPrograms={allPrograms || []}
                />
              </div>
            </section>

            {/* Registration Form */}
            <section id="registration-form" className="py-14 md:py-20 bg-muted/30">
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
                          placeholder="e.g., January 15-17, 2025 or flexible weekends"
                          value={formData.preferredDates}
                          onChange={(e) => setFormData({ ...formData, preferredDates: e.target.value })}
                          required
                        />
                        {selectedProgram.availability_info && (
                          <p 
                            className="text-xs text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: selectedProgram.availability_info }}
                          />
                        )}
                      </div>
                      <div className="flex items-start space-x-3 pt-2">
                        <Checkbox
                          id="terms-direct"
                          checked={acceptedTerms}
                          onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                          required
                        />
                        <label
                          htmlFor="terms-direct"
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
                          `Proceed to Payment - ${formatPrice(selectedProgram.price_cents)}`
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Bundle Packages Section */}
            <BundlesSection currentProgramId={selectedProgram.id} savingsMessage={savingsMessage} />
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
          <section className="bg-gradient-to-b from-primary/5 to-background py-12 md:py-16">
            <div className="container max-w-4xl mx-auto px-4 text-center">
              <h1 className="font-playfair text-3xl md:text-4xl font-normal tracking-wide mb-4 text-foreground">
                Private Sound Training Programs
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Three structured training levels for a direct and practical learning format. 
                Book a single level or choose a bundle package at a reduced rate.
              </p>
            </div>
          </section>

          {/* Step 1: Training Levels */}
          <section className="py-12 md:py-16 bg-background">
            <div className="container max-w-6xl mx-auto px-4">
              <div className="flex items-center justify-center gap-3 mb-10">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">1</div>
                <h2 className="font-playfair text-xl md:text-2xl font-normal tracking-wide flex items-center gap-2 text-muted-foreground">
                  <GraduationCap className="h-5 w-5 text-primary/70" />
                  Choose Your Training Level
                </h2>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {individualPrograms.map((program) => {
                  const isSelected = selectedProgram?.id === program.id;
                  const hasSale = program.original_price_cents && program.original_price_cents > program.price_cents;
                  const savings = hasSale ? program.original_price_cents! - program.price_cents : 0;
                  
                  return (
                    <Card 
                      key={program.id}
                      className={`relative flex flex-col h-full transition-all duration-300 cursor-pointer group overflow-hidden ${
                        isSelected 
                          ? 'ring-2 ring-primary shadow-xl' 
                          : 'hover:shadow-xl hover:border-primary/40'
                      }`}
                      onClick={() => {
                        setSelectedProgram(program);
                        scrollToForm();
                      }}
                    >
                      {/* Sale indicator bar - muted to not compete with CTA */}
                      {hasSale && (
                        <div className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest text-center py-1.5 border-b border-border/50">
                          Limited Sale
                        </div>
                      )}
                      
                      {isSelected && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className="bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                      
                      <CardContent className="flex flex-col flex-1 p-6">
                        <h3 className="font-playfair text-lg md:text-xl font-medium leading-tight text-foreground mb-3 pr-8">
                          {program.name}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                          {program.description}
                        </p>
                        
                        {/* Pricing section - improved hierarchy */}
                        <div className="mt-6 pt-5 border-t border-border/50 space-y-3">
                          {/* Price display */}
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-foreground">{formatPrice(program.price_cents)}</span>
                            {hasSale && (
                              <span className="text-base text-muted-foreground/60 line-through">
                                {formatPrice(program.original_price_cents!)}
                              </span>
                            )}
                          </div>
                          
                          {/* Savings badge */}
                          {hasSale && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
                              <Check className="h-3 w-3 text-success" />
                              <span className="text-xs font-semibold text-success">
                                Save {formatPrice(savings)}
                              </span>
                            </div>
                          )}
                          
                          <Button 
                            variant="default"
                            className={`w-full mt-2 transition-all ${isSelected ? 'bg-primary' : 'bg-primary/90 hover:bg-primary'}`}
                            size="default"
                          >
                            {isSelected ? 'Selected' : 'Select Program'}
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

          {/* Step 2: Bundle Packages */}
          <section className="py-12 md:py-16 bg-gradient-to-b from-primary/5 to-background">
            <div className="container max-w-6xl mx-auto px-4">
              <div className="flex items-center justify-center gap-3 mb-10">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">2</div>
                <h2 className="font-playfair text-xl md:text-2xl font-normal tracking-wide flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="h-5 w-5 text-primary/70" />
                  Bundle Packages
                </h2>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {bundles.map((program) => {
                  const isSelected = selectedProgram?.id === program.id;
                  const hasSale = program.original_price_cents && program.original_price_cents > program.price_cents;
                  const savings = hasSale ? program.original_price_cents! - program.price_cents : 0;
                  
                  return (
                    <Card 
                      key={program.id}
                      className={`relative flex flex-col h-full transition-all duration-300 cursor-pointer group border-primary/30 bg-gradient-to-br from-background to-primary/5 overflow-hidden ${
                        isSelected 
                          ? 'ring-2 ring-primary shadow-xl' 
                          : 'hover:shadow-xl hover:border-primary/50'
                      }`}
                      onClick={() => {
                        setSelectedProgram(program);
                        scrollToForm();
                      }}
                    >
                      {/* Sale indicator bar - muted to not compete with CTA */}
                      {hasSale && (
                        <div className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest text-center py-1.5 border-b border-border/50">
                          Limited Sale
                        </div>
                      )}
                      
                      {isSelected && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className="bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                      
                      <CardContent className="flex flex-col flex-1 p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Bundle & Save</span>
                        </div>
                        
                        <h3 className="font-playfair text-lg md:text-xl font-medium leading-tight text-foreground mb-3 pr-8">
                          {program.name}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                          {program.description}
                        </p>
                        
                        {/* Pricing section - improved hierarchy */}
                        <div className="mt-6 pt-5 border-t border-primary/20 space-y-3">
                          {/* Price display */}
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-foreground">{formatPrice(program.price_cents)}</span>
                            {hasSale && (
                              <span className="text-base text-muted-foreground/60 line-through">
                                {formatPrice(program.original_price_cents!)}
                              </span>
                            )}
                          </div>
                          
                          {/* Savings badge */}
                          {hasSale && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
                              <Check className="h-3 w-3 text-success" />
                              <span className="text-xs font-semibold text-success">
                                Save {formatPrice(savings)}
                              </span>
                            </div>
                          )}
                          
                          <Button 
                            variant="default"
                            className={`w-full mt-2 transition-all ${isSelected ? 'bg-primary' : 'bg-primary/90 hover:bg-primary'}`}
                            size="default"
                          >
                            {isSelected ? 'Selected' : 'Select Package'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Step 3: Registration Form */}
          <section id="registration-form" className="py-12 md:py-16 bg-muted/30 scroll-mt-20">
            <div className="container max-w-xl mx-auto px-4">
              <div className="flex items-center gap-3 mb-8 justify-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">3</div>
                <h2 className="font-playfair text-xl font-normal tracking-wide text-foreground">
                  Complete Your Registration
                </h2>
              </div>
              
              <Card className="shadow-xl border-border/50">
                <CardContent className="p-6 md:p-8">
                  {/* Selected Program Display */}
                  <div className={`mb-6 p-4 rounded-lg transition-all ${
                    selectedProgram 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted border border-border'
                  }`}>
                    {selectedProgram ? (
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Selected Program</p>
                          <p className="font-medium text-foreground">{selectedProgram.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-baseline justify-end gap-2">
                            <p className="text-xl font-bold text-foreground">{formatPrice(selectedProgram.price_cents)}</p>
                            {selectedProgram.original_price_cents && selectedProgram.original_price_cents > selectedProgram.price_cents && (
                              <p className="text-sm text-muted-foreground/60 line-through">
                                {formatPrice(selectedProgram.original_price_cents)}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">+ 3.5% fee</p>
                          {selectedProgram.original_price_cents && selectedProgram.original_price_cents > selectedProgram.price_cents && (
                            <p className="text-xs text-success font-semibold mt-1">
                              Save {formatPrice(selectedProgram.original_price_cents - selectedProgram.price_cents)}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ChevronDown className="h-4 w-4" />
                        <span className="text-sm">Select a training program above to continue</span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        placeholder="Enter your full name"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                        disabled={!selectedProgram}
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
                        disabled={!selectedProgram}
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
                        disabled={!selectedProgram}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preferredDates">Preferred Date or Dates *</Label>
                      <Input
                        id="preferredDates"
                        placeholder="e.g., January 15-17, 2025 or flexible weekends"
                        value={formData.preferredDates}
                        onChange={(e) => setFormData({ ...formData, preferredDates: e.target.value })}
                        required
                        disabled={!selectedProgram}
                      />
                      {selectedProgram?.availability_info && (
                        <p 
                          className="text-xs text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: selectedProgram.availability_info }}
                        />
                      )}
                    </div>
                    <div className="flex items-start space-x-3 pt-2">
                      <Checkbox
                        id="terms"
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                        disabled={!selectedProgram}
                        required
                      />
                      <label
                        htmlFor="terms"
                        className={`text-sm leading-relaxed cursor-pointer ${!selectedProgram ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
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
                      disabled={!selectedProgram || isSubmitting || !acceptedTerms}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : selectedProgram ? (
                        `Proceed to Payment - ${formatPrice(selectedProgram.price_cents)}`
                      ) : (
                        'Select a Program to Continue'
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </section>
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
