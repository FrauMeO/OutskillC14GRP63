// Hand-written to match supabase/migrations/0001_init.sql.
// Regenerate later with: npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; created_at: string };
        Insert: { id: string; full_name?: string | null; created_at?: string };
        Update: { id?: string; full_name?: string | null; created_at?: string };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          goal_type: string;
          target_value: number;
          unit: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          goal_type: string;
          target_value: number;
          unit: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_type?: string;
          target_value?: number;
          unit?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      habit_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          exercise_minutes: number | null;
          sleep_hours: number | null;
          water_liters: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          log_date?: string;
          exercise_minutes?: number | null;
          sleep_hours?: number | null;
          water_liters?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          log_date?: string;
          exercise_minutes?: number | null;
          sleep_hours?: number | null;
          water_liters?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Goal = Database['public']['Tables']['goals']['Row'];
export type HabitLog = Database['public']['Tables']['habit_logs']['Row'];
