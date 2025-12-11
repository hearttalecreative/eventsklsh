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
  stripe_fee_cents: number;
  is_bundle: boolean;
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
          <div className="container flex h-14 max-w-screen-2xl items-center justify-center">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-xl font-semibold tracking-tight">Kyle Lam Sound Healing</span>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container max-w-6xl mx-auto px-4 py-12">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Private Sound Training Programs
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Three structured training levels designed for students who want a direct and practical learning format. 
              Each program builds technique, confidence, and a clear understanding of how to create effective sound bath experiences. 
              You can book a single level or choose a multi level package at a reduced rate.
            </p>
          </div>

          {/* Individual Programs */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              Training Levels
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {individualPrograms.map((program) => (
                <Card 
                  key={program.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    selectedProgram?.id === program.id 
                      ? 'ring-2 ring-primary shadow-lg' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedProgram(program)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg leading-tight">{program.name}</CardTitle>
                      {selectedProgram?.id === program.id && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <div className="pt-2">
                      <span className="text-2xl font-bold">{formatPrice(program.price_cents)}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        + {formatFee(program.stripe_fee_cents)} processing fee
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {program.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Bundle Programs */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Bundle Packages
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {bundles.map((program) => (
                <Card 
                  key={program.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-primary/20 bg-primary/5 ${
                    selectedProgram?.id === program.id 
                      ? 'ring-2 ring-primary shadow-lg' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedProgram(program)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg leading-tight">{program.name}</CardTitle>
                      {selectedProgram?.id === program.id && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <div className="pt-2">
                      <span className="text-2xl font-bold">{formatPrice(program.price_cents)}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        + {formatFee(program.stripe_fee_cents)} processing fee
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {program.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Purchase Form */}
          <section className="max-w-xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Complete Your Registration</CardTitle>
                <CardDescription>
                  {selectedProgram 
                    ? `Selected: ${selectedProgram.name} - ${formatPrice(selectedProgram.price_cents + selectedProgram.stripe_fee_cents)} total`
                    : 'Select a training program above to continue'
                  }
                </CardDescription>
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
                      `Proceed to Payment - ${formatPrice(selectedProgram.price_cents + selectedProgram.stripe_fee_cents)}`
                    ) : (
                      'Select a Program to Continue'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Footer Note */}
            <p className="text-sm text-muted-foreground text-center mt-8 px-4">
              All Private Trainings are offered in person. Once you complete your purchase, 
              you will be redirected to a form to provide your contact details and preferred dates. 
              You will receive a confirmation email with next steps and scheduling coordination.
            </p>
          </section>
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-border/40 py-6">
          <div className="container text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Kyle Lam Sound Healing. All rights reserved.</p>
            <p className="mt-1">Developed by Lovable</p>
          </div>
        </footer>
      </div>
    </>
  );
}
