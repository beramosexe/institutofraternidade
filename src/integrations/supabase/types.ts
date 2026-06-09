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
      attendance: {
        Row: {
          checked_in_at: string
          id: string
          method: string | null
          user_id: string
          work_id: string
        }
        Insert: {
          checked_in_at?: string
          id?: string
          method?: string | null
          user_id: string
          work_id: string
        }
        Update: {
          checked_in_at?: string
          id?: string
          method?: string | null
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_transcriptions: {
        Row: {
          audio_id: string
          created_at: string
          id: string
          language: string | null
          provider: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          search_vector: unknown
          segments: Json
          text: string
          updated_at: string
          version: number
        }
        Insert: {
          audio_id: string
          created_at?: string
          id?: string
          language?: string | null
          provider?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_vector?: unknown
          segments?: Json
          text?: string
          updated_at?: string
          version?: number
        }
        Update: {
          audio_id?: string
          created_at?: string
          id?: string
          language?: string | null
          provider?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_vector?: unknown
          segments?: Json
          text?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "audio_transcriptions_audio_id_fkey"
            columns: ["audio_id"]
            isOneToOne: true
            referencedRelation: "audios"
            referencedColumns: ["id"]
          },
        ]
      }
      audios: {
        Row: {
          access_level: Database["public"]["Enums"]["audio_access_level"]
          audio_type: Database["public"]["Enums"]["audio_type"]
          created_at: string
          description: string | null
          duration_seconds: number | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          message_source: string | null
          mime_type: string | null
          published_at: string | null
          recorded_at: string | null
          status: Database["public"]["Enums"]["audio_status"]
          storage_path: string
          stream_path: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          work_id: string | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["audio_access_level"]
          audio_type?: Database["public"]["Enums"]["audio_type"]
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          message_source?: string | null
          mime_type?: string | null
          published_at?: string | null
          recorded_at?: string | null
          status?: Database["public"]["Enums"]["audio_status"]
          storage_path: string
          stream_path?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          work_id?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["audio_access_level"]
          audio_type?: Database["public"]["Enums"]["audio_type"]
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          message_source?: string | null
          mime_type?: string | null
          published_at?: string | null
          recorded_at?: string | null
          status?: Database["public"]["Enums"]["audio_status"]
          storage_path?: string
          stream_path?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audios_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          attempts: number
          audio_id: string
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          payload: Json | null
          result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          attempts?: number
          audio_id: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type: Database["public"]["Enums"]["job_type"]
          payload?: Json | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          attempts?: number
          audio_id?: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          payload?: Json | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_audio_id_fkey"
            columns: ["audio_id"]
            isOneToOne: false
            referencedRelation: "audios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission: Database["public"]["Enums"]["app_permission"]
          role_id: string
        }
        Insert: {
          permission: Database["public"]["Enums"]["app_permission"]
          role_id: string
        }
        Update: {
          permission?: Database["public"]["Enums"]["app_permission"]
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      transcription_revisions: {
        Row: {
          created_at: string
          editor_id: string | null
          id: string
          note: string | null
          segments_after: Json | null
          segments_before: Json | null
          transcription_id: string
        }
        Insert: {
          created_at?: string
          editor_id?: string | null
          id?: string
          note?: string | null
          segments_after?: Json | null
          segments_before?: Json | null
          transcription_id: string
        }
        Update: {
          created_at?: string
          editor_id?: string | null
          id?: string
          note?: string | null
          segments_after?: Json | null
          segments_before?: Json | null
          transcription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcription_revisions_transcription_id_fkey"
            columns: ["transcription_id"]
            isOneToOne: false
            referencedRelation: "audio_transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_participants: {
        Row: {
          created_at: string
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_participants_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          name: string
          starts_at: string
          status: Database["public"]["Enums"]["work_status"]
          updated_at: string
          visibility: Database["public"]["Enums"]["work_visibility"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          name: string
          starts_at: string
          status?: Database["public"]["Enums"]["work_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["work_visibility"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          name?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["work_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["work_visibility"]
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_audio: {
        Args: { _audio_id: string; _user_id: string }
        Returns: boolean
      }
      get_profile_display: {
        Args: { _user_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_slug: {
        Args: { _slug: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_associate: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_permission:
        | "audio.upload"
        | "audio.edit_any"
        | "audio.delete"
        | "audio.publish"
        | "audio.reprocess"
        | "transcription.review"
        | "transcription.approve"
        | "work.manage"
        | "user.manage"
        | "role.manage"
        | "logs.view"
      audio_access_level:
        | "public"
        | "associates"
        | "work_participants"
        | "attendees_only"
      audio_status:
        | "uploaded"
        | "converting"
        | "transcribing"
        | "ready"
        | "error"
        | "archived"
      audio_type: "canalizacao" | "outro"
      job_status: "pending" | "running" | "done" | "error"
      job_type: "convert" | "transcribe"
      review_status: "unreviewed" | "in_review" | "reviewed"
      work_status: "draft" | "published" | "completed" | "archived"
      work_visibility: "public" | "internal"
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
      app_permission: [
        "audio.upload",
        "audio.edit_any",
        "audio.delete",
        "audio.publish",
        "audio.reprocess",
        "transcription.review",
        "transcription.approve",
        "work.manage",
        "user.manage",
        "role.manage",
        "logs.view",
      ],
      audio_access_level: [
        "public",
        "associates",
        "work_participants",
        "attendees_only",
      ],
      audio_status: [
        "uploaded",
        "converting",
        "transcribing",
        "ready",
        "error",
        "archived",
      ],
      audio_type: ["canalizacao", "outro"],
      job_status: ["pending", "running", "done", "error"],
      job_type: ["convert", "transcribe"],
      review_status: ["unreviewed", "in_review", "reviewed"],
      work_status: ["draft", "published", "completed", "archived"],
      work_visibility: ["public", "internal"],
    },
  },
} as const
