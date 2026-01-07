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
import { Loader2, Check, GraduationCap, Sparkles, ChevronDown } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

interface TrainingProgram {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  processing_fee_percent: number;
  is_bundle: boolean;
  display_order: number;
}

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

// Component for displaying bundle packages in direct link mode
function BundlesSection({ currentProgramId }: { currentProgramId: string }) {
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
    <section className="py-12 bg-gradient-to-b from-primary/5 to-background">
      <div className="container max-w-4xl mx-auto px-4 text-center">
        <h3 className="font-playfair text-lg md:text-xl font-normal tracking-wide text-foreground mb-2">
          Looking to save even more and bundle additional levels?
        </h3>
        <p className="text-muted-foreground mb-8">
          View all our training packages below:
        </p>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.map((bundle) => (
            <Link
              key={bundle.id}
              to={`/trainings?program=${bundle.id}`}
              className="block"
            >
              <Card className="h-full transition-all duration-300 hover:shadow-lg hover:border-primary/50 border-primary/30 bg-gradient-to-br from-background to-primary/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary uppercase tracking-wider">Bundle & Save</span>
                  </div>
                  <h4 className="font-playfair text-base font-normal text-foreground mb-2 text-left">
                    {bundle.name}
                  </h4>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-semibold text-foreground">{formatPrice(bundle.price_cents)}</span>
                    <span className="text-xs text-primary font-medium">View Details →</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
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
            {/* Hero Section */}
            <section className="bg-gradient-to-b from-primary/5 to-background py-12 md:py-16">
              <div className="container max-w-4xl mx-auto px-4 text-center">
                <h1 className="font-playfair text-3xl md:text-4xl font-normal tracking-wide mb-4 text-foreground">
                  {selectedProgram.name}
                </h1>
                {selectedProgram.description && (
                  <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    {selectedProgram.description}
                  </p>
                )}
                <div className="mt-6">
                  <span className="text-3xl font-semibold text-foreground">{formatPrice(selectedProgram.price_cents)}</span>
                  <span className="text-sm text-muted-foreground ml-2">+ 3.5% processing fee</span>
                </div>
                <p className="mt-4 text-sm text-muted-foreground italic">
                  Upon completion of registration, our team will reach out regarding date confirmation.
                </p>
              </div>
            </section>

            {/* Registration Form */}
            <section id="registration-form" className="py-12 md:py-16 bg-muted/30">
              <div className="container max-w-xl mx-auto px-4">
                <h2 className="font-playfair text-xl font-normal tracking-wide text-foreground text-center mb-8">
                  Complete Your Registration
                </h2>
                
                <Card className="shadow-lg border-border/50">
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
                          `Proceed to Payment - ${formatPrice(selectedProgram.price_cents + calculateFee(selectedProgram.price_cents, selectedProgram.processing_fee_percent))}`
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  <Link to="/trainings" className="text-primary hover:underline">
                    View all training programs
                  </Link>
                </p>
              </div>
            </section>

            {/* Bundle Packages Section */}
            <BundlesSection currentProgramId={selectedProgram.id} />
          </main>
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
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">1</div>
                <h2 className="font-playfair text-2xl font-normal tracking-wide flex items-center gap-2 text-foreground">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  Choose Your Training Level
                </h2>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {individualPrograms.map((program) => {
                  const isSelected = selectedProgram?.id === program.id;
                  return (
                    <Card 
                      key={program.id}
                      className={`relative flex flex-col h-full transition-all duration-300 cursor-pointer group ${
                        isSelected 
                          ? 'ring-2 ring-primary shadow-lg' 
                          : 'hover:shadow-lg hover:border-primary/40'
                      }`}
                      onClick={() => {
                        setSelectedProgram(program);
                        scrollToForm();
                      }}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className="bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                      <CardContent className="flex flex-col flex-1 p-6">
                        <h3 className="font-playfair text-[1.35rem] font-normal leading-tight text-foreground mb-3 pr-8">
                          {program.name}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {program.description}
                        </p>
                        <div className="mt-auto pt-6 space-y-4">
                          <div className="border-t border-border/50 pt-4">
                            <span className="text-2xl font-semibold text-foreground">{formatPrice(program.price_cents)}</span>
                          </div>
                          <Button 
                            variant="default"
                            className={`w-full transition-all ${isSelected ? 'bg-primary' : 'bg-primary/80 hover:bg-primary'}`}
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
            <div className="relative py-4">
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
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">2</div>
                <h2 className="font-playfair text-2xl font-normal tracking-wide flex items-center gap-2 text-foreground">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Bundle Packages
                </h2>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {bundles.map((program) => {
                  const isSelected = selectedProgram?.id === program.id;
                  return (
                    <Card 
                      key={program.id}
                      className={`relative flex flex-col h-full transition-all duration-300 cursor-pointer group border-primary/30 bg-gradient-to-br from-background to-primary/5 ${
                        isSelected 
                          ? 'ring-2 ring-primary shadow-lg' 
                          : 'hover:shadow-lg hover:border-primary/50'
                      }`}
                      onClick={() => {
                        setSelectedProgram(program);
                        scrollToForm();
                      }}
                    >
                      
                      {isSelected && (
                        <div className="absolute top-4 right-3 z-10">
                          <div className="bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                      <CardContent className="flex flex-col flex-1 p-6 pt-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium text-primary uppercase tracking-wider">Bundle & Save</span>
                        </div>
                        <h3 className="font-playfair text-[1.35rem] font-normal leading-tight text-foreground mb-3 pr-8">
                          {program.name}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {program.description}
                        </p>
                        <div className="mt-auto pt-6 space-y-4">
                          <div className="border-t border-primary/20 pt-4">
                            <span className="text-2xl font-semibold text-foreground">{formatPrice(program.price_cents)}</span>
                          </div>
                          <Button 
                            variant="default"
                            className={`w-full transition-all ${isSelected ? 'bg-primary' : 'bg-primary/80 hover:bg-primary'}`}
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
              
              <Card className="shadow-lg border-border/50">
                <CardContent className="p-6 md:p-8">
                  {/* Selected Program Display */}
                  <div className={`mb-6 p-4 rounded-lg transition-all ${
                    selectedProgram 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted border border-border'
                  }`}>
                    {selectedProgram ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Selected Program</p>
                          <p className="font-medium text-foreground">{selectedProgram.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-foreground">{formatPrice(selectedProgram.price_cents)}</p>
                          <p className="text-xs text-muted-foreground">+ 3.5% fee</p>
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
                        `Proceed to Payment - ${formatPrice(selectedProgram.price_cents + calculateFee(selectedProgram.price_cents, selectedProgram.processing_fee_percent))}`
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

      </div>
    </>
  );
}
