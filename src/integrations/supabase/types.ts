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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
          xp_rewarded: number | null
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
          xp_rewarded?: number | null
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
          xp_rewarded?: number | null
        }
        Relationships: []
      }
      club_members: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          member_cap: number | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          member_cap?: number | null
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          member_cap?: number | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          club_id: string | null
          created_at: string | null
          custom_name: string | null
          destination: string | null
          id: string
          likes: number | null
          message: string | null
          tags: string[] | null
          type: string
          user_id: string
          workout_data: Json | null
          workout_id: string | null
          workout_name: string | null
        }
        Insert: {
          club_id?: string | null
          created_at?: string | null
          custom_name?: string | null
          destination?: string | null
          id?: string
          likes?: number | null
          message?: string | null
          tags?: string[] | null
          type: string
          user_id: string
          workout_data?: Json | null
          workout_id?: string | null
          workout_name?: string | null
        }
        Update: {
          club_id?: string | null
          created_at?: string | null
          custom_name?: string | null
          destination?: string | null
          id?: string
          likes?: number | null
          message?: string | null
          tags?: string[] | null
          type?: string
          user_id?: string
          workout_data?: Json | null
          workout_id?: string | null
          workout_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_exercises: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          achieved_at: string | null
          id: string
          record_type: string
          user_id: string
          value: number
        }
        Insert: {
          achieved_at?: string | null
          id?: string
          record_type: string
          user_id: string
          value: number
        }
        Update: {
          achieved_at?: string | null
          id?: string
          record_type?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          advanced_sessions_to_l100: number
          avatar_url: string | null
          beginner_sessions_to_l100: number
          best_session_xp: number
          bio: string | null
          birthday_workout: boolean
          circles_count: number
          combos_landed: number | null
          comeback_count: number
          complex_combos: number
          counter_combos: number
          created_at: string
          current_level: number | null
          current_streak: number
          defense_combos: number
          double_days: number
          equipment: Json | null
          experience_level: string | null
          friday_workouts: number
          goals: string[] | null
          handle: string | null
          height_cm: number | null
          holiday_workouts: number
          id: string
          intermediate_sessions_to_l100: number
          last_active_at: string | null
          last_workout_date: string | null
          longest_streak: number
          monday_workouts: number
          morning_workouts: number
          name: string
          new_years_workout: boolean
          night_workouts: number
          overflow_xp: number
          perfect_months: number
          post_l100_sessions: number
          preferences: Json | null
          prestige: string | null
          pro_sessions_to_l100: number
          pullbacks_count: number
          punch_1_count: number
          punch_2_count: number
          punch_3_count: number
          punch_4_count: number
          punch_5_count: number
          punch_6_count: number
          punch_7_count: number
          punch_8_count: number
          role: string
          rolls_count: number
          rookie_sessions_to_l100: number
          sessions_completed_this_year: number | null
          slips_count: number
          streak_multiplier: number | null
          streak_recoveries: number
          sunday_workouts: number
          tiers_completed: number
          total_burpees: number
          total_curlups: number
          total_jog_run_minutes: number
          total_levels_earned: number
          total_pushups: number
          total_training_seconds: number | null
          total_xp: number
          updated_at: string
          user_id: string
          weekday_workouts: number
          weekend_workouts: number
          weight_kg: number | null
          workouts_completed: number
        }
        Insert: {
          advanced_sessions_to_l100?: number
          avatar_url?: string | null
          beginner_sessions_to_l100?: number
          best_session_xp?: number
          bio?: string | null
          birthday_workout?: boolean
          circles_count?: number
          combos_landed?: number | null
          comeback_count?: number
          complex_combos?: number
          counter_combos?: number
          created_at?: string
          current_level?: number | null
          current_streak?: number
          defense_combos?: number
          double_days?: number
          equipment?: Json | null
          experience_level?: string | null
          friday_workouts?: number
          goals?: string[] | null
          handle?: string | null
          height_cm?: number | null
          holiday_workouts?: number
          id?: string
          intermediate_sessions_to_l100?: number
          last_active_at?: string | null
          last_workout_date?: string | null
          longest_streak?: number
          monday_workouts?: number
          morning_workouts?: number
          name?: string
          new_years_workout?: boolean
          night_workouts?: number
          overflow_xp?: number
          perfect_months?: number
          post_l100_sessions?: number
          preferences?: Json | null
          prestige?: string | null
          pro_sessions_to_l100?: number
          pullbacks_count?: number
          punch_1_count?: number
          punch_2_count?: number
          punch_3_count?: number
          punch_4_count?: number
          punch_5_count?: number
          punch_6_count?: number
          punch_7_count?: number
          punch_8_count?: number
          role?: string
          rolls_count?: number
          rookie_sessions_to_l100?: number
          sessions_completed_this_year?: number | null
          slips_count?: number
          streak_multiplier?: number | null
          streak_recoveries?: number
          sunday_workouts?: number
          tiers_completed?: number
          total_burpees?: number
          total_curlups?: number
          total_jog_run_minutes?: number
          total_levels_earned?: number
          total_pushups?: number
          total_training_seconds?: number | null
          total_xp?: number
          updated_at?: string
          user_id: string
          weekday_workouts?: number
          weekend_workouts?: number
          weight_kg?: number | null
          workouts_completed?: number
        }
        Update: {
          advanced_sessions_to_l100?: number
          avatar_url?: string | null
          beginner_sessions_to_l100?: number
          best_session_xp?: number
          bio?: string | null
          birthday_workout?: boolean
          circles_count?: number
          combos_landed?: number | null
          comeback_count?: number
          complex_combos?: number
          counter_combos?: number
          created_at?: string
          current_level?: number | null
          current_streak?: number
          defense_combos?: number
          double_days?: number
          equipment?: Json | null
          experience_level?: string | null
          friday_workouts?: number
          goals?: string[] | null
          handle?: string | null
          height_cm?: number | null
          holiday_workouts?: number
          id?: string
          intermediate_sessions_to_l100?: number
          last_active_at?: string | null
          last_workout_date?: string | null
          longest_streak?: number
          monday_workouts?: number
          morning_workouts?: number
          name?: string
          new_years_workout?: boolean
          night_workouts?: number
          overflow_xp?: number
          perfect_months?: number
          post_l100_sessions?: number
          preferences?: Json | null
          prestige?: string | null
          pro_sessions_to_l100?: number
          pullbacks_count?: number
          punch_1_count?: number
          punch_2_count?: number
          punch_3_count?: number
          punch_4_count?: number
          punch_5_count?: number
          punch_6_count?: number
          punch_7_count?: number
          punch_8_count?: number
          role?: string
          rolls_count?: number
          rookie_sessions_to_l100?: number
          sessions_completed_this_year?: number | null
          slips_count?: number
          streak_multiplier?: number | null
          streak_recoveries?: number
          sunday_workouts?: number
          tiers_completed?: number
          total_burpees?: number
          total_curlups?: number
          total_jog_run_minutes?: number
          total_levels_earned?: number
          total_pushups?: number
          total_training_seconds?: number | null
          total_xp?: number
          updated_at?: string
          user_id?: string
          weekday_workouts?: number
          weekend_workouts?: number
          weight_kg?: number | null
          workouts_completed?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_history: {
        Row: {
          completed_at: string
          created_at: string
          difficulty: string | null
          duration: number
          id: string
          is_manual_entry: boolean | null
          notes: string | null
          round_feedback: Json | null
          user_id: string
          workout_id: string | null
          workout_name: string
          xp_earned: number
        }
        Insert: {
          completed_at?: string
          created_at?: string
          difficulty?: string | null
          duration?: number
          id?: string
          is_manual_entry?: boolean | null
          notes?: string | null
          round_feedback?: Json | null
          user_id: string
          workout_id?: string | null
          workout_name: string
          xp_earned?: number
        }
        Update: {
          completed_at?: string
          created_at?: string
          difficulty?: string | null
          duration?: number
          id?: string
          is_manual_entry?: boolean | null
          notes?: string | null
          round_feedback?: Json | null
          user_id?: string
          workout_id?: string | null
          workout_name?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_history_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          combos: Json | null
          created_at: string
          description: string | null
          difficulty: string | null
          duration: number
          id: string
          is_archived: boolean | null
          is_preset: boolean | null
          last_used_at: string | null
          name: string
          phases: Json
          sort_order: number | null
          tags: string[] | null
          times_completed: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          combos?: Json | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          duration?: number
          id?: string
          is_archived?: boolean | null
          is_preset?: boolean | null
          last_used_at?: string | null
          name: string
          phases?: Json
          sort_order?: number | null
          tags?: string[] | null
          times_completed?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          combos?: Json | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          duration?: number
          id?: string
          is_archived?: boolean | null
          is_preset?: boolean | null
          last_used_at?: string | null
          name?: string
          phases?: Json
          sort_order?: number | null
          tags?: string[] | null
          times_completed?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          current_level: number | null
          current_streak: number | null
          handle: string | null
          id: string | null
          name: string | null
          prestige: string | null
          role: string | null
          sessions_completed_this_year: number | null
          total_training_seconds: number | null
          total_xp: number | null
          user_id: string | null
          workouts_completed: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          current_level?: number | null
          current_streak?: number | null
          handle?: string | null
          id?: string | null
          name?: string | null
          prestige?: string | null
          role?: string | null
          sessions_completed_this_year?: number | null
          total_training_seconds?: number | null
          total_xp?: number | null
          user_id?: string | null
          workouts_completed?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          current_level?: number | null
          current_streak?: number | null
          handle?: string | null
          id?: string | null
          name?: string | null
          prestige?: string | null
          role?: string | null
          sessions_completed_this_year?: number | null
          total_training_seconds?: number | null
          total_xp?: number | null
          user_id?: string | null
          workouts_completed?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_public_profile: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          current_level: number
          current_streak: number
          handle: string
          id: string
          name: string
          prestige: string
          role: string
          sessions_completed_this_year: number
          total_training_seconds: number
          total_xp: number
          user_id: string
          workouts_completed: number
        }[]
      }
      get_total_training_seconds: {
        Args: { target_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
