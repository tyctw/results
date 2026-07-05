import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AdmissionRecord = {
  id?: number;
  year: string;
  region: string;
  school_name: string;
  department: string;
  ticket_number: string;
  student_name: string;
  gender: string;
  created_at?: string;
};
