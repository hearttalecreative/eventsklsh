import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Check, GraduationCap, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

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

const formatFee = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

export default function TrainingPrograms() {
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredDates: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        {/* Minimal Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 max-w-screen-2xl items-center justify-center">
            <Link to="/">
              <img 
                src="https://kylelamsoundhealing.com/wp-content/uploads/2023/11/cropped-LOGO-NEW-170x77.png" 
                alt="Kyle Lam Sound Healing" 
                className="h-10"
              />
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container max-w-6xl mx-auto px-4 py-12">
          {/* Hero Section */}
          <div className="text-center mb-14">
            <h1 className="font-playfair text-3xl md:text-4xl font-normal tracking-wide mb-6 text-foreground">
              Private Sound Training Programs
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Three structured training levels designed for students who want a direct and practical learning format. 
              Each program builds technique, confidence, and a clear understanding of how to create effective sound bath experiences. 
              You can book a single level or choose a multi level package at a reduced rate.
            </p>
          </div>

          {/* Individual Programs */}
          <section className="mb-16">
            <h2 className="font-playfair text-xl font-normal tracking-wide mb-8 flex items-center gap-3 text-foreground">
              <GraduationCap className="h-5 w-5 text-primary" />
              Training Levels
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {individualPrograms.map((program) => {
                const isSelected = selectedProgram?.id === program.id;
                const totalCents = program.price_cents + calculateFee(program.price_cents, program.processing_fee_percent);
                return (
                  <Card 
                    key={program.id}
                    className={`relative overflow-hidden transition-all duration-300 cursor-pointer group ${
                      isSelected 
                        ? 'ring-2 ring-primary shadow-lg scale-[1.02]' 
                        : 'hover:shadow-lg hover:scale-[1.01] hover:border-primary/40'
                    }`}
                    onClick={() => setSelectedProgram(program)}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                    <CardHeader className="pb-4">
                      <CardTitle className="font-playfair text-2xl font-normal leading-tight text-foreground pr-8">
                        {program.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <CardDescription className="text-sm leading-relaxed min-h-[60px]">
                        {program.description}
                      </CardDescription>
                      <div className="pt-2 border-t border-border/50">
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-semibold text-foreground">{formatPrice(totalCents)}</span>
                          <span className="text-xs text-muted-foreground">incl. processing</span>
                        </div>
                      </div>
                      <Button 
                        variant={isSelected ? "default" : "secondary"}
                        className={`w-full transition-all ${isSelected ? '' : 'group-hover:bg-primary group-hover:text-primary-foreground'}`}
                        size="default"
                      >
                        {isSelected ? 'Selected' : 'Select Program'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Bundle Programs */}
          <section className="mb-16">
            <h2 className="font-playfair text-xl font-normal tracking-wide mb-8 flex items-center gap-3 text-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              Bundle Packages
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {bundles.map((program) => {
                const isSelected = selectedProgram?.id === program.id;
                const totalCents = program.price_cents + calculateFee(program.price_cents, program.processing_fee_percent);
                return (
                  <Card 
                    key={program.id}
                    className={`relative overflow-hidden transition-all duration-300 cursor-pointer group border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 ${
                      isSelected 
                        ? 'ring-2 ring-primary shadow-lg scale-[1.02]' 
                        : 'hover:shadow-lg hover:scale-[1.01] hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedProgram(program)}
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
                    {isSelected && (
                      <div className="absolute top-4 right-3">
                        <div className="bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                    <CardHeader className="pb-4 pt-5">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-primary uppercase tracking-wider">Bundle & Save</span>
                      </div>
                      <CardTitle className="font-playfair text-2xl font-normal leading-tight text-foreground pr-8">
                        {program.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <CardDescription className="text-sm leading-relaxed min-h-[60px]">
                        {program.description}
                      </CardDescription>
                      <div className="pt-2 border-t border-primary/20">
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-semibold text-foreground">{formatPrice(totalCents)}</span>
                          <span className="text-xs text-muted-foreground">incl. processing</span>
                        </div>
                      </div>
                      <Button 
                        variant={isSelected ? "default" : "secondary"}
                        className={`w-full transition-all ${isSelected ? '' : 'group-hover:bg-primary group-hover:text-primary-foreground'}`}
                        size="default"
                      >
                        {isSelected ? 'Selected' : 'Select Package'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Purchase Form */}
          <section className="max-w-xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="font-playfair text-lg font-normal">Complete Your Registration</CardTitle>
                <CardDescription>
                  {selectedProgram 
                    ? `Selected: ${selectedProgram.name} - ${formatPrice(selectedProgram.price_cents)}`
                    : 'Select a training program above to continue'
                  }
                </CardDescription>
                {selectedProgram && (
                  <p className="text-xs text-muted-foreground mt-1">
                    A 3.5% processing fee will be added at checkout
                  </p>
                )}
              </CardHeader>
              <CardContent>
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
                      placeholder="e.g., January 15-17, 2025 or flexible weekends"
                      value={formData.preferredDates}
                      onChange={(e) => setFormData({ ...formData, preferredDates: e.target.value })}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full mt-6" 
                    size="lg"
                    disabled={!selectedProgram || isSubmitting}
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

          </section>
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-border/40 py-6">
          <div className="container text-center text-sm text-muted-foreground">
          </div>
        </footer>
      </div>
    </>
  );
}
