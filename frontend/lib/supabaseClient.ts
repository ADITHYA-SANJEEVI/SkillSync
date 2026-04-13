import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "public-anon-key-placeholder";

export const supabase = createClient(url, anon, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});
