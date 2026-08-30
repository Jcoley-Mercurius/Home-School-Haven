/**
 * Generated database types — DO NOT EDIT BY HAND.
 *
 * Regenerate after every migration:
 *
 *     npm run db:types          # writes this file from the linked project
 *     npm run db:types:check    # fails if this file has drifted
 *
 * `db:types:check` runs against the linked Supabase project and is the guard
 * that keeps this file honest. Treat any drift it reports as this file being
 * stale, not the database.
 *
 * Hand-maintained helpers over these types live in `./types.ts`, so this file
 * can be overwritten wholesale without losing anything.
 */

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
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          is_sample: boolean
          program_id: string
          published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_sample?: boolean
          program_id: string
          published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          program_id?: string
          published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          changed_fields: Json
          entity_id: string | null
          entity_type: string
          id: number
          occurred_at: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          changed_fields?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          changed_fields?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
          occurred_at?: string
        }
        Relationships: []
      }
      educator_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          educator_user_id: string
          program_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          educator_user_id: string
          program_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          educator_user_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "educator_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          family_id: string
          id: string
          is_sample: boolean
          program_id: string
          state: Database["public"]["Enums"]["enrollment_state"]
          state_changed_at: string
          state_note: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          is_sample?: boolean
          program_id: string
          state?: Database["public"]["Enums"]["enrollment_state"]
          state_changed_at?: string
          state_note?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          is_sample?: boolean
          program_id?: string
          state?: Database["public"]["Enums"]["enrollment_state"]
          state_changed_at?: string
          state_note?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          added_at: string
          family_id: string
          member_role: Database["public"]["Enums"]["family_member_role"]
          user_id: string
        }
        Insert: {
          added_at?: string
          family_id: string
          member_role?: Database["public"]["Enums"]["family_member_role"]
          user_id: string
        }
        Update: {
          added_at?: string
          family_id?: string
          member_role?: Database["public"]["Enums"]["family_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_resources: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_sample: boolean
          program_id: string
          published: boolean
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_sample?: boolean
          program_id: string
          published?: boolean
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_sample?: boolean
          program_id?: string
          published?: boolean
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_resources_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          audience: string | null
          availability: Database["public"]["Enums"]["availability_state"]
          checkout_url: string | null
          created_at: string
          educator: string | null
          enrollment_window: string | null
          format: string | null
          id: string
          image_alt: string | null
          image_height: number | null
          image_is_placeholder: boolean
          image_src: string | null
          image_width: number | null
          import_status: string
          location: string | null
          name: string
          publication_state: Database["public"]["Enums"]["program_publication_state"]
          published_dates: string | null
          published_duration: string | null
          published_price: string | null
          published_registration_options: string | null
          published_schedule: string | null
          published_session_length: string | null
          slug: string
          sort_order: number
          source: string
          summary: string | null
          unverified_details: Json
          updated_at: string
        }
        Insert: {
          audience?: string | null
          availability?: Database["public"]["Enums"]["availability_state"]
          checkout_url?: string | null
          created_at?: string
          educator?: string | null
          enrollment_window?: string | null
          format?: string | null
          id?: string
          image_alt?: string | null
          image_height?: number | null
          image_is_placeholder?: boolean
          image_src?: string | null
          image_width?: number | null
          import_status?: string
          location?: string | null
          name: string
          publication_state?: Database["public"]["Enums"]["program_publication_state"]
          published_dates?: string | null
          published_duration?: string | null
          published_price?: string | null
          published_registration_options?: string | null
          published_schedule?: string | null
          published_session_length?: string | null
          slug: string
          sort_order?: number
          source: string
          summary?: string | null
          unverified_details?: Json
          updated_at?: string
        }
        Update: {
          audience?: string | null
          availability?: Database["public"]["Enums"]["availability_state"]
          checkout_url?: string | null
          created_at?: string
          educator?: string | null
          enrollment_window?: string | null
          format?: string | null
          id?: string
          image_alt?: string | null
          image_height?: number | null
          image_is_placeholder?: boolean
          image_src?: string | null
          image_width?: number | null
          import_status?: string
          location?: string | null
          name?: string
          publication_state?: Database["public"]["Enums"]["program_publication_state"]
          published_dates?: string | null
          published_duration?: string | null
          published_price?: string | null
          published_registration_options?: string | null
          published_schedule?: string | null
          published_session_length?: string | null
          slug?: string
          sort_order?: number
          source?: string
          summary?: string | null
          unverified_details?: Json
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          affirmation_version: string
          affirmed_at: string
          created_at: string
          family_id: string
          grade_level: string | null
          guardian_relationship: string | null
          id: string
          is_sample: boolean
          preferred_name: string
          updated_at: string
        }
        Insert: {
          affirmation_version?: string
          affirmed_at?: string
          created_at?: string
          family_id: string
          grade_level?: string | null
          guardian_relationship?: string | null
          id?: string
          is_sample?: boolean
          preferred_name: string
          updated_at?: string
        }
        Update: {
          affirmation_version?: string
          affirmed_at?: string
          created_at?: string
          family_id?: string
          grade_level?: string | null
          guardian_relationship?: string | null
          id?: string
          is_sample?: boolean
          preferred_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_student_to_own_family: {
        Args: {
          grade_level?: string
          guardian_relationship?: string
          preferred_name: string
        }
        Returns: string
      }
      create_family_for_current_user: {
        Args: { family_name: string }
        Returns: string
      }
      remove_student_from_own_family: {
        Args: { student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "parent" | "educator" | "admin" | "owner"
      availability_state: "open" | "limited" | "waitlist" | "closed" | "unknown"
      enrollment_state:
        | "started"
        | "approval_pending"
        | "payment_pending"
        | "waitlisted"
        | "confirmed"
        | "payment_failed"
        | "canceled"
        | "blocked"
      family_member_role: "primary_guardian" | "invited_guardian"
      program_publication_state: "draft" | "published" | "archived"
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
      app_role: ["parent", "educator", "admin", "owner"],
      availability_state: ["open", "limited", "waitlist", "closed", "unknown"],
      enrollment_state: [
        "started",
        "approval_pending",
        "payment_pending",
        "waitlisted",
        "confirmed",
        "payment_failed",
        "canceled",
        "blocked",
      ],
      family_member_role: ["primary_guardian", "invited_guardian"],
      program_publication_state: ["draft", "published", "archived"],
    },
  },
} as const
