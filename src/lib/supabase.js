import { createClient } from "@supabase/supabase-js";

const DEMO_URL_MARKERS = ["tu-proyecto", "your-project", "example.supabase.co"];
const DEMO_KEY_MARKERS = ["tu-anon-key", "your-anon-key"];

export function normalizeSupabaseUrl(value) {
  return (value ?? "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = (import.meta.env.VITE_SUPABASE_KEY ?? "").trim();

export const supabaseUrl = normalizeSupabaseUrl(rawUrl);
export const isDemoMode =
  !supabaseUrl ||
  !rawKey ||
  DEMO_URL_MARKERS.some((marker) => supabaseUrl.includes(marker)) ||
  DEMO_KEY_MARKERS.some((marker) => rawKey.includes(marker));

export const supabase = isDemoMode ? null : createClient(supabaseUrl, rawKey);
