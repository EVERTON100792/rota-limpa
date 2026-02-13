
// This file contains the backend code requested by the user.
// It is displayed in the "Premium" or "Setup" section of the app.

export const SQL_SETUP_SCRIPT = `-- Supabase SQL to create the Profiles table with Premium support

-- 1. Create a table for public profiles
create table profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  email text,
  full_name text,
  is_premium boolean default false,
  subscription_id text,
  
  constraint email_validation check (char_length(email) >= 3)
);

-- 2. Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 3. Trigger to create profile on Signup
create function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, is_premium)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', false);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
`;

export const STRIPE_INTEGRATION_CODE = `// Server-side (Node.js/Edge Function) integration for Stripe

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = async (req, res) => {
  const { userId, userEmail } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_H5ggYJDqbu8', // Replace with your Stripe Price ID
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: 'YOUR_CLIENT_URL/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'YOUR_CLIENT_URL/cancel',
      customer_email: userEmail,
      metadata: {
        supabase_user_id: userId // Important for webhook reconciliation
      },
    });

    return res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Webhook to update Supabase after payment
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.supabase_user_id;

    // Update Supabase Database
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    await supabase
      .from('profiles')
      .update({ is_premium: true, subscription_id: session.subscription })
      .eq('id', userId);
  }

  res.json({ received: true });
};
`;
