import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import LandingPage from '@/components/LandingPage';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Moun ki deja konekte ale dirèk nan app la
  if (user) {
    redirect('/dashboard');
  }

  // Vizitè yo wè paj vitrin lan
  return <LandingPage />;
}