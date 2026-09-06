export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      applications: {
        Row: {
          applied_date: string | null
          company_name: string
          created_at: string
          id: string
          interview_scheduled_at: string | null
          is_archived: boolean
          job_link: string | null
          job_title: string
          location: string | null
          location_latitude: number | null
          location_longitude: number | null
          notes: string | null
          platform_source: Database["public"]["Enums"]["platform_source"]
          road_distance_from_lat: number | null
          road_distance_from_lng: number | null
          road_distance_meters: number | null
          road_duration_seconds: number | null
          salary_range: string | null
          status: Database["public"]["Enums"]["application_status"]
          status_changed_at: string
          target_experience_level: Database["public"]["Enums"]["experience_level"] | null
          updated_at: string
          user_id: string
          work_setup: Database["public"]["Enums"]["work_setup"] | null
        }
        Insert: {
          applied_date?: string | null
          company_name: string
          created_at?: string
          id?: string
          interview_scheduled_at?: string | null
          is_archived?: boolean
          job_link?: string | null
          job_title: string
          location?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          notes?: string | null
          platform_source: Database["public"]["Enums"]["platform_source"]
          road_distance_from_lat?: number | null
          road_distance_from_lng?: number | null
          road_distance_meters?: number | null
          road_duration_seconds?: number | null
          salary_range?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          status_changed_at?: string
          target_experience_level?: Database["public"]["Enums"]["experience_level"] | null
          updated_at?: string
          user_id?: string
          work_setup?: Database["public"]["Enums"]["work_setup"] | null
        }
        Update: {
          applied_date?: string | null
          company_name?: string
          created_at?: string
          id?: string
          interview_scheduled_at?: string | null
          is_archived?: boolean
          job_link?: string | null
          job_title?: string
          location?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          notes?: string | null
          platform_source?: Database["public"]["Enums"]["platform_source"]
          road_distance_from_lat?: number | null
          road_distance_from_lng?: number | null
          road_distance_meters?: number | null
          road_duration_seconds?: number | null
          salary_range?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          status_changed_at?: string
          target_experience_level?: Database["public"]["Enums"]["experience_level"] | null
          updated_at?: string
          user_id?: string
          work_setup?: Database["public"]["Enums"]["work_setup"] | null
        }
        Relationships: []
      }
      saved_locations: {
        Row: {
          address: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      status_history: {
        Row: {
          application_id: string
          changed_at: string
          from_status: Database["public"]["Enums"]["application_status"] | null
          id: string
          to_status: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Insert: {
          application_id: string
          changed_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          to_status: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Update: {
          application_id?: string
          changed_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          to_status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          graduation_date: string | null
          monthly_application_goal: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          graduation_date?: string | null
          monthly_application_goal?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          graduation_date?: string | null
          monthly_application_goal?: number | null
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
      application_status:
        | "pending_application"
        | "scheduled_for_interview"
        | "interviewed"
        | "rejected"
        | "accepted"
      experience_level: "fresh_grad" | "experienced"
      platform_source:
        | "jobstreet"
        | "linkedin"
        | "indeed"
        | "company_website"
        | "referral"
        | "other"
      work_setup: "remote" | "hybrid" | "onsite"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      application_status: [
        "pending_application",
        "scheduled_for_interview",
        "interviewed",
        "rejected",
        "accepted",
      ],
      platform_source: [
        "jobstreet",
        "linkedin",
        "indeed",
        "company_website",
        "referral",
        "other",
      ],
      work_setup: ["remote", "hybrid", "onsite"],
    },
  },
} as const

