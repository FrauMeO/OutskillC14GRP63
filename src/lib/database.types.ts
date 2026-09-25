// Generated from the live database (project gzsawayrorlcjmpssalc) after migration 0004,
// with the Supabase connector's generate_typescript_types. Regenerate after every schema change:
//   npx supabase gen types typescript --project-id gzsawayrorlcjmpssalc > src/lib/database.types.ts
// then re-add the aliases at the bottom.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      daily_conditions: {
        Row: {
          apparent_temp_max_c: number | null
          date: string
          daylight_hours: number | null
          fetched_at: string
          humidity_mean_pct: number | null
          id: string
          is_final: boolean
          latitude: number
          location_name: string | null
          longitude: number
          moon_illumination: number | null
          moon_phase: string | null
          pm2_5_mean: number | null
          pollen_max: number | null
          precipitation_mm: number | null
          pressure_mean_hpa: number | null
          rain_mm: number | null
          snowfall_cm: number | null
          sunshine_hours: number | null
          temp_max_c: number | null
          temp_min_c: number | null
          us_aqi_max: number | null
          user_id: string
          uv_index_max: number | null
        }
        Insert: {
          apparent_temp_max_c?: number | null
          date: string
          daylight_hours?: number | null
          fetched_at?: string
          humidity_mean_pct?: number | null
          id?: string
          is_final?: boolean
          latitude: number
          location_name?: string | null
          longitude: number
          moon_illumination?: number | null
          moon_phase?: string | null
          pm2_5_mean?: number | null
          pollen_max?: number | null
          precipitation_mm?: number | null
          pressure_mean_hpa?: number | null
          rain_mm?: number | null
          snowfall_cm?: number | null
          sunshine_hours?: number | null
          temp_max_c?: number | null
          temp_min_c?: number | null
          us_aqi_max?: number | null
          user_id?: string
          uv_index_max?: number | null
        }
        Update: {
          apparent_temp_max_c?: number | null
          date?: string
          daylight_hours?: number | null
          fetched_at?: string
          humidity_mean_pct?: number | null
          id?: string
          is_final?: boolean
          latitude?: number
          location_name?: string | null
          longitude?: number
          moon_illumination?: number | null
          moon_phase?: string | null
          pm2_5_mean?: number | null
          pollen_max?: number | null
          precipitation_mm?: number | null
          pressure_mean_hpa?: number | null
          rain_mm?: number | null
          snowfall_cm?: number | null
          sunshine_hours?: number | null
          temp_max_c?: number | null
          temp_min_c?: number | null
          us_aqi_max?: number | null
          user_id?: string
          uv_index_max?: number | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          target_value: number
          unit: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_type: string
          id?: string
          target_value: number
          unit: string
          user_id?: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          target_value?: number
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          created_at: string
          energy: number | null
          exercise_minutes: number | null
          feelings: string[] | null
          id: string
          latitude: number | null
          location_name: string | null
          location_source: string | null
          log_date: string
          longitude: number | null
          mood: number | null
          notes: string | null
          sleep_hours: number | null
          stress: number | null
          user_id: string
          water_liters: number | null
        }
        Insert: {
          created_at?: string
          energy?: number | null
          exercise_minutes?: number | null
          feelings?: string[] | null
          id?: string
          latitude?: number | null
          location_name?: string | null
          location_source?: string | null
          log_date?: string
          longitude?: number | null
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          stress?: number | null
          user_id?: string
          water_liters?: number | null
        }
        Update: {
          created_at?: string
          energy?: number | null
          exercise_minutes?: number | null
          feelings?: string[] | null
          id?: string
          latitude?: number | null
          location_name?: string | null
          location_source?: string | null
          log_date?: string
          longitude?: number | null
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          stress?: number | null
          user_id?: string
          water_liters?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          home_city: string | null
          home_country_code: string | null
          home_latitude: number | null
          home_longitude: number | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          home_city?: string | null
          home_country_code?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          home_city?: string | null
          home_country_code?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      array_has_no_duplicates: { Args: { arr: string[] }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Goal = Database['public']['Tables']['goals']['Row'];
export type HabitLog = Database['public']['Tables']['habit_logs']['Row'];
export type DailyConditions = Database['public']['Tables']['daily_conditions']['Row'];
