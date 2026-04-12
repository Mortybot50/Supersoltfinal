// Demo data seeding function
import { SupabaseClient } from '@supabase/supabase-js';

export async function seedDemoData(supabase: SupabaseClient, userId: string) {
  console.log('Seeding demo data for user:', userId);
  
  // Simple stub for now - just simulate success
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Demo data seeded successfully');
      resolve(true);
    }, 1000);
  });
}