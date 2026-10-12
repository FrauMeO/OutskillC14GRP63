// Generated from the live database (project gzsawayrorlcjmpssalc) after migration 0007,
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
      care_shares: {
        Row: {
          accepted_at: string | null
          created_at: string
          ended_at: string | null
          id: string
          // Care sharing v2 (migration 0015, docs/care-sharing-v2-contract.md)
          last_confirmed_at: string
          level: string
          owner_id: string
          paused_at: string | null
          share_balance: boolean
          share_eat: boolean
          share_move: boolean
          share_sleep: boolean
          status: string
          viewer_email: string
          viewer_id: string | null
        }
        // Read only from the browser: every write goes through the care sharing functions (0010).
        Insert: never
        Update: never
        Relationships: []
      }
      care_share_views: {
        Row: {
          share_id: string
          viewed_on: string
          views: number
        }
        // Read only (owner of the share); written only by the definer functions.
        Insert: never
        Update: never
        Relationships: []
      }
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
          active_calories: number | null
          awake_minutes: number | null
          calories_consumed: number | null
          source: string
          stand_hours: number | null
          steps: number | null
          time_in_bed_hours: number | null
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
          active_calories?: number | null
          awake_minutes?: number | null
          calories_consumed?: number | null
          source?: string
          stand_hours?: number | null
          steps?: number | null
          time_in_bed_hours?: number | null
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
          active_calories?: number | null
          awake_minutes?: number | null
          calories_consumed?: number | null
          source?: string
          stand_hours?: number | null
          steps?: number | null
          time_in_bed_hours?: number | null
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
          auto_reflection: boolean
          gentle_checkin_enabled: boolean
          marketing_opt_in: boolean
          marketing_opt_in_at: string | null
          health_consent_at: string | null
          birth_month: number | null
          birth_year: number | null
          created_at: string
          full_name: string | null
          home_city: string | null
          home_country_code: string | null
          home_latitude: number | null
          home_longitude: number | null
          id: string
        }
        Insert: {
          auto_reflection?: boolean
          gentle_checkin_enabled?: boolean
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          health_consent_at?: string | null
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          full_name?: string | null
          home_city?: string | null
          home_country_code?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id: string
        }
        Update: {
          auto_reflection?: boolean
          gentle_checkin_enabled?: boolean
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          health_consent_at?: string | null
          birth_month?: number | null
          birth_year?: number | null
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
      reflections: {
        Row: {
          created_at: string
          id: string
          offered_on: string
          phq2_score: number | null
          phq9_item9: number | null
          phq9_score: number | null
          taken_on: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          offered_on?: string
          phq2_score?: number | null
          phq9_item9?: number | null
          phq9_score?: number | null
          taken_on?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          offered_on?: string
          phq2_score?: number | null
          phq9_item9?: number | null
          phq9_score?: number | null
          taken_on?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      array_has_no_duplicates: { Args: { arr: string[] }; Returns: boolean }
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined }
      join_waitlist: { Args: { p_email: string; p_ios: boolean; p_android: boolean; p_consent: boolean }; Returns: undefined }
      create_care_share: {
        Args: { p_email: string; p_eat: boolean; p_sleep: boolean; p_move: boolean; p_balance: boolean }
        Returns: string
      }
      update_care_share: {
        Args: { p_id: string; p_eat: boolean; p_sleep: boolean; p_move: boolean; p_balance: boolean }
        Returns: undefined
      }
      set_care_share_options: { Args: { p_id: string; p_level: string; p_paused: boolean }; Returns: undefined }
      confirm_care_share: { Args: { p_id: string }; Returns: undefined }
      shared_week_summary: {
        Args: { p_owner: string }
        Returns: { pillar: string; days_logged: number; trend: string }[]
      }
      accept_care_share: { Args: { p_id: string }; Returns: undefined }
      end_care_share: { Args: { p_id: string }; Returns: undefined }
      followed_people: {
        Args: Record<PropertyKey, never>
        Returns: {
          share_id: string
          owner_id: string
          owner_name: string
          status: string
          share_eat: boolean
          share_sleep: boolean
          share_move: boolean
          share_balance: boolean
          created_at: string
          accepted_at: string | null
          level: string
          paused: boolean
        }[]
      }
      shared_days: {
        Args: { p_owner: string; p_from: string; p_to: string }
        Returns: {
          log_date: string
          water_liters: number | null
          calories_consumed: number | null
          sleep_hours: number | null
          time_in_bed_hours: number | null
          awake_minutes: number | null
          exercise_minutes: number | null
          steps: number | null
          stand_hours: number | null
          active_calories: number | null
          mood: number | null
          energy: number | null
          stress: number | null
        }[]
      }
      shared_goals: {
        Args: { p_owner: string }
        Returns: { goal_type: string; target_value: number; unit: string }[]
      }
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
export type CareShare = Database['public']['Tables']['care_shares']['Row'];
export type Reflection = Database['public']['Tables']['reflections']['Row'];
