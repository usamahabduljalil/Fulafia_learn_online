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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assignment_submissions: {
        Row: {
          assignment_id: string
          feedback: string | null
          file_url: string | null
          grade: number | null
          graded_at: string | null
          id: string
          student_id: string
          storage_path: string | null
          submission_text: string | null
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          feedback?: string | null
          file_url?: string | null
          grade?: number | null
          graded_at?: string | null
          id?: string
          student_id: string
          storage_path?: string | null
          submission_text?: string | null
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          feedback?: string | null
          file_url?: string | null
          grade?: number | null
          graded_at?: string | null
          id?: string
          student_id?: string
          storage_path?: string | null
          submission_text?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late_submissions: boolean
          allow_resubmission: boolean
          class_id: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          points: number | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_late_submissions?: boolean
          allow_resubmission?: boolean
          class_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          points?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_late_submissions?: boolean
          allow_resubmission?: boolean
          class_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          points?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: string
          enrolled_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Insert: {
          class_id: string
          enrolled_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Update: {
          class_id?: string
          enrolled_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_resources: {
        Row: {
          class_id: string
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          resource_type: string
          storage_path: string | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          resource_type?: string
          storage_path?: string | null
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          resource_type?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_resources_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_resources_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          class_id: string
          created_at: string
          duration_minutes: number
          ended_at: string | null
          engagement_mode: Database["public"]["Enums"]["engagement_mode"]
          id: string
          meeting_url: string | null
          livekit_room_name: string
          scheduled_at: string
          status: Database["public"]["Enums"]["session_status"]
          started_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          engagement_mode?: Database["public"]["Enums"]["engagement_mode"]
          id?: string
          meeting_url?: string | null
          livekit_room_name?: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["session_status"]
          started_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          engagement_mode?: Database["public"]["Enums"]["engagement_mode"]
          id?: string
          meeting_url?: string | null
          livekit_room_name?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          started_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          access_mode: Database["public"]["Enums"]["class_access_mode"]
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          access_mode?: Database["public"]["Enums"]["class_access_mode"]
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          access_mode?: Database["public"]["Enums"]["class_access_mode"]
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_metrics: {
        Row: {
          attention_score: number | null
          camera_enabled: boolean | null
          face_present: boolean | null
          id: string
          interval_seconds: number
          nudge_triggered: boolean
          overall_engagement_score: number | null
          recorded_at: string
          screen_focus_score: number | null
          signal_confidence: number | null
          session_id: string
          student_id: string
          speaking_seconds: number
          speaking_turns: number
          voice_activity_score: number | null
          word_count: number
        }
        Insert: {
          attention_score?: number | null
          camera_enabled?: boolean | null
          face_present?: boolean | null
          id?: string
          interval_seconds?: number
          nudge_triggered?: boolean
          overall_engagement_score?: number | null
          recorded_at?: string
          screen_focus_score?: number | null
          signal_confidence?: number | null
          session_id: string
          student_id: string
          speaking_seconds?: number
          speaking_turns?: number
          voice_activity_score?: number | null
          word_count?: number
        }
        Update: {
          attention_score?: number | null
          camera_enabled?: boolean | null
          face_present?: boolean | null
          id?: string
          interval_seconds?: number
          nudge_triggered?: boolean
          overall_engagement_score?: number | null
          recorded_at?: string
          screen_focus_score?: number | null
          signal_confidence?: number | null
          session_id?: string
          student_id?: string
          speaking_seconds?: number
          speaking_turns?: number
          voice_activity_score?: number | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "engagement_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_metrics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_attendance: {
        Row: {
          connection_id: string | null
          duration_minutes: number | null
          duration_seconds: number | null
          id: string
          joined_at: string
          left_at: string | null
          session_id: string
          student_id: string
          verification_method: string
        }
        Insert: {
          connection_id?: string | null
          duration_minutes?: number | null
          duration_seconds?: number | null
          id?: string
          joined_at?: string
          left_at?: string | null
          session_id: string
          student_id: string
          verification_method?: string
        }
        Update: {
          connection_id?: string | null
          duration_minutes?: number | null
          duration_seconds?: number | null
          id?: string
          joined_at?: string
          left_at?: string | null
          session_id?: string
          student_id?: string
          verification_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_invites: {
        Row: { class_id: string; code_hash: string; created_at: string; created_by: string; expires_at: string | null; id: string; max_uses: number | null; use_count: number }
        Insert: { class_id: string; code_hash: string; created_at?: string; created_by: string; expires_at?: string | null; id?: string; max_uses?: number | null; use_count?: number }
        Update: { class_id?: string; code_hash?: string; created_at?: string; created_by?: string; expires_at?: string | null; id?: string; max_uses?: number | null; use_count?: number }
        Relationships: []
      }
      intervention_events: {
        Row: { acknowledged_at: string | null; acknowledged_by: string | null; created_at: string; event_type: string; id: string; reason: string; score: number | null; session_id: string; student_id: string }
        Insert: { acknowledged_at?: string | null; acknowledged_by?: string | null; created_at?: string; event_type: string; id?: string; reason: string; score?: number | null; session_id: string; student_id: string }
        Update: { acknowledged_at?: string | null; acknowledged_by?: string | null; created_at?: string; event_type?: string; id?: string; reason?: string; score?: number | null; session_id?: string; student_id?: string }
        Relationships: []
      }
      session_access_overrides: {
        Row: { created_at: string; expires_at: string; granted_by: string; id: string; reason: string; session_id: string; student_id: string }
        Insert: { created_at?: string; expires_at: string; granted_by: string; id?: string; reason: string; session_id: string; student_id: string }
        Update: { created_at?: string; expires_at?: string; granted_by?: string; id?: string; reason?: string; session_id?: string; student_id?: string }
        Relationships: []
      }
      session_biometric_verifications: {
        Row: { expires_at: string; session_id: string; student_id: string; verified_at: string }
        Insert: { expires_at: string; session_id: string; student_id: string; verified_at?: string }
        Update: { expires_at?: string; session_id?: string; student_id?: string; verified_at?: string }
        Relationships: []
      }
      student_biometrics: {
        Row: { consented_at: string; encrypted_descriptor: string; encryption_iv: string; enrolled_at: string; model_version: string; updated_at: string; user_id: string }
        Insert: { consented_at: string; encrypted_descriptor: string; encryption_iv: string; enrolled_at?: string; model_version: string; updated_at?: string; user_id: string }
        Update: { consented_at?: string; encrypted_descriptor?: string; encryption_iv?: string; enrolled_at?: string; model_version?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
      student_session_reports: {
        Row: { alerts_count: number; attendance_seconds: number; average_attention: number | null; average_overall: number | null; average_screen_focus: number | null; average_voice_activity: number | null; generated_at: string; id: string; nudges_count: number; overrides_count: number; session_id: string; speaking_seconds: number; speaking_turns: number; student_id: string; timeline: Json; word_count: number }
        Insert: { alerts_count?: number; attendance_seconds?: number; average_attention?: number | null; average_overall?: number | null; average_screen_focus?: number | null; average_voice_activity?: number | null; generated_at?: string; id?: string; nudges_count?: number; overrides_count?: number; session_id: string; speaking_seconds?: number; speaking_turns?: number; student_id: string; timeline?: Json; word_count?: number }
        Update: { alerts_count?: number; attendance_seconds?: number; average_attention?: number | null; average_overall?: number | null; average_screen_focus?: number | null; average_voice_activity?: number | null; generated_at?: string; id?: string; nudges_count?: number; overrides_count?: number; session_id?: string; speaking_seconds?: number; speaking_turns?: number; student_id?: string; timeline?: Json; word_count?: number }
        Relationships: []
      }
      teacher_invites: {
        Row: { code_hash: string; created_at: string; expires_at: string; id: string; used_at: string | null; used_by: string | null }
        Insert: { code_hash: string; created_at?: string; expires_at: string; id?: string; used_at?: string | null; used_by?: string | null }
        Update: { code_hash?: string; created_at?: string; expires_at?: string; id?: string; used_at?: string | null; used_by?: string | null }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
      create_class_invite: {
        Args: { _class_id: string; _code: string; _expires_at?: string | null; _max_uses?: number | null }
        Returns: string
      }
      finalize_session_reports: { Args: { _session_id: string }; Returns: number }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      redeem_teacher_invite: { Args: { _code: string }; Returns: Database["public"]["Enums"]["app_role"] }
      request_class_enrollment: { Args: { _class_id: string; _invite_code?: string | null }; Returns: Database["public"]["Enums"]["enrollment_status"] }
    }
    Enums: {
      app_role: "teacher" | "student"
      class_access_mode: "public" | "invite" | "approval"
      engagement_mode: "lecture" | "interactive"
      enrollment_status: "pending" | "active" | "rejected"
      session_status: "scheduled" | "active" | "completed" | "cancelled"
      user_role: "teacher" | "student"
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
      app_role: ["teacher", "student"],
      class_access_mode: ["public", "invite", "approval"],
      engagement_mode: ["lecture", "interactive"],
      enrollment_status: ["pending", "active", "rejected"],
      session_status: ["scheduled", "active", "completed", "cancelled"],
      user_role: ["teacher", "student"],
    },
  },
} as const
