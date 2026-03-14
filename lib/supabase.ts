import { createClient } from '@supabase/supabase-js';

// Ambil data ini dari Dashboard Supabase -> Settings -> API
const supabaseUrl = 'https://lnokazctxovtfilvbden.supabase.co'; 
const supabaseAnonKey = 'sb_publishable__3wmaFoNfsdfy8ix3TqIHQ_eR7IFY62';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);