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
      community_posts: {
        Row: {
          created_at: string | null
          id: string
          likes: number | null
          message: string | null
          type: string
          user_id: string
          workout_data: Json | null
          workout_id: string | null
          workout_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          likes?: number | null
          message?: string | null
          type: string
          user_id: string
          workout_data?: Json | null
          workout_id?: string | null
          workout_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          likes?: number | null
          message?: string | null
          type?: string
          user_id?: string
          workout_data?: Json | null
          workout_id?: string | null
          workout_name?: string | null
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
          avatar_url: string | null
          bio: string | null
          combos_landed: number | null
          created_at: string
          current_level: number | null
          current_streak: number
          equipment: Json | null
          experience_level: string | null
          goals: string[] | null
          handle: string | null
          id: string
          last_active_at: string | null
          last_workout_date: string | null
          longest_streak: number
          name: string
          preferences: Json | null
          prestige: string | null
          role: string
          sessions_completed_this_year: number | null
          streak_multiplier: number | null
          total_training_seconds: number | null
          total_xp: number
          updated_at: string
          user_id: string
          workouts_completed: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          combos_landed?: number | null
          created_at?: string
          current_level?: number | null
          current_streak?: number
          equipment?: Json | null
          experience_level?: string | null
          goals?: string[] | null
          handle?: string | null
          id?: string
          last_active_at?: string | null
          last_workout_date?: string | null
          longest_streak?: number
          name?: string
          preferences?: Json | null
          prestige?: string | null
          role?: string
          sessions_completed_this_year?: number | null
          streak_multiplier?: number | null
          total_training_seconds?: number | null
          total_xp?: number
          updated_at?: string
          user_id: string
          workouts_completed?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          combos_landed?: number | null
          created_at?: string
          current_level?: number | null
          current_streak?: number
          equipment?: Json | null
          experience_level?: string | null
          goals?: string[] | null
          handle?: string | null
          id?: string
          last_active_at?: string | null
          last_workout_date?: string | null
          longest_streak?: number
          name?: string
          preferences?: Json | null
          prestige?: string | null
          role?: string
          sessions_completed_this_year?: number | null
          streak_multiplier?: number | null
          total_training_seconds?: number | null
          total_xp?: number
          updated_at?: string
          user_id?: string
          workouts_completed?: number
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
