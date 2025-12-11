-- Create training_programs table
CREATE TABLE public.training_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  stripe_fee_cents INTEGER NOT NULL DEFAULT 0,
  is_bundle BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

-- Public can view active programs
CREATE POLICY "Training programs: public can view active" 
ON public.training_programs 
FOR SELECT 
USING (active = true);

-- Admin full access
CREATE POLICY "Training programs: admin full" 
ON public.training_programs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_training_programs_updated_at
BEFORE UPDATE ON public.training_programs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create training_purchases table to track purchases
CREATE TABLE public.training_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  preferred_dates TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_purchases ENABLE ROW LEVEL SECURITY;

-- Admin full access to purchases
CREATE POLICY "Training purchases: admin full" 
ON public.training_purchases 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_training_purchases_updated_at
BEFORE UPDATE ON public.training_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial training programs
INSERT INTO public.training_programs (name, description, price_cents, stripe_fee_cents, is_bundle, display_order) VALUES
('Level 1 Sound Bath Training', 'Our beginner''s course is meticulously crafted for those who possess little or no prior experience with sound baths. It is tailored for individuals curious about how sound baths influence the body, mind, and heart or those seeking to cultivate a personal mindfulness and meditation practice in the comfort of their own homes.', 99500, 3485, false, 1),
('Level 2 Sound Healer Training', 'In our intermediate course, you''ll learn how to combine various notes, octaves, and tones to create unique melodies that align with your personal style, as well as how to blend multiple instruments together effectively. The course also guides you through the technical aspects of building a cohesive sound bath sequence, including rhythm, speed, volume adjustment, and smooth transitions.', 119500, 4183, false, 2),
('Level 3 Sound Practitioner Training', 'In this advanced course, you''ll learn how to sequence an entire sound bath from start to finish, explore advanced playing techniques, incorporate large crystal singing bowls, and structure your opening lecture, guided meditation, and closing reflections. Designed for those already offering sound baths or preparing to do so professionally, this program provides a mentorship-based experience that deepens your mastery. It serves as the culmination of your foundational training, giving you the tools and insight to lead with confidence, clarity, and heart.', 149500, 5235, false, 3),
('Level 1 & 2 Bundle', 'Bundle Level 1 & 2 together and save over $200', 195000, 6825, true, 4),
('Level 2 & 3 Bundle', 'Bundle Level 2 & 3 together and save $400', 229000, 8015, true, 5),
('Level 1, 2 & 3 Bundle', 'Bundle all three levels and save $500', 317500, 11113, true, 6);