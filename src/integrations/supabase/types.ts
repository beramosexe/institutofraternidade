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
          created_by: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          invited_user_id: string | null
          method: string | null
          occurrence_date: string
          user_id: string | null
          work_id: string
        }
        Insert: {
          checked_in_at?: string
          created_by?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          invited_user_id?: string | null
          method?: string | null
          occurrence_date?: string
          user_id?: string | null
          work_id: string
        }
        Update: {
          checked_in_at?: string
          created_by?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          invited_user_id?: string | null
          method?: string | null
          occurrence_date?: string
          user_id?: string | null
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
      audio_upload_tokens: {
        Row: {
          created_at: string
          default_access_level: Database["public"]["Enums"]["audio_access_level"]
          default_work_id: string | null
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          default_access_level?: Database["public"]["Enums"]["audio_access_level"]
          default_work_id?: string | null
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          default_access_level?: Database["public"]["Enums"]["audio_access_level"]
          default_work_id?: string | null
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_upload_tokens_default_work_id_fkey"
            columns: ["default_work_id"]
            isOneToOne: false
            referencedRelation: "works"
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
          is_featured: boolean
          keywords: string[]
          message_entity_id: string | null
          message_source: string | null
          mime_type: string | null
          play_count: number
          published_at: string | null
          recorded_at: string | null
          status: Database["public"]["Enums"]["audio_status"]
          storage_path: string
          stream_path: string | null
          summary: string | null
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
          is_featured?: boolean
          keywords?: string[]
          message_entity_id?: string | null
          message_source?: string | null
          mime_type?: string | null
          play_count?: number
          published_at?: string | null
          recorded_at?: string | null
          status?: Database["public"]["Enums"]["audio_status"]
          storage_path: string
          stream_path?: string | null
          summary?: string | null
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
          is_featured?: boolean
          keywords?: string[]
          message_entity_id?: string | null
          message_source?: string | null
          mime_type?: string | null
          play_count?: number
          published_at?: string | null
          recorded_at?: string | null
          status?: Database["public"]["Enums"]["audio_status"]
          storage_path?: string
          stream_path?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audios_message_entity_id_fkey"
            columns: ["message_entity_id"]
            isOneToOne: false
            referencedRelation: "channeling_entities"
            referencedColumns: ["id"]
          },
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
      channeling_entities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_members: {
        Row: {
          changed_by: string | null
          class_id: string
          created_at: string
          id: string
          is_primary: boolean
          joined_at: string
          left_at: string | null
          notes: string | null
          purpose: string | null
          status: Database["public"]["Enums"]["class_member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          class_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          joined_at?: string
          left_at?: string | null
          notes?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["class_member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          changed_by?: string | null
          class_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          joined_at?: string
          left_at?: string | null
          notes?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["class_member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          level_id: string | null
          name: string
          notes: string | null
          opened_at: string | null
          period: string | null
          status: Database["public"]["Enums"]["class_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          level_id?: string | null
          name: string
          notes?: string | null
          opened_at?: string | null
          period?: string | null
          status?: Database["public"]["Enums"]["class_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          level_id?: string | null
          name?: string
          notes?: string | null
          opened_at?: string | null
          period?: string | null
          status?: Database["public"]["Enums"]["class_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "formation_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          platforms: string[]
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          platforms?: string[]
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          platforms?: string[]
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      critical_permissions: {
        Row: {
          created_at: string
          note: string | null
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Insert: {
          created_at?: string
          note?: string | null
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Update: {
          created_at?: string
          note?: string | null
          permission?: Database["public"]["Enums"]["app_permission"]
        }
        Relationships: []
      }
      formation_levels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_quotes: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deadline: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          description: string | null
          document_path: string | null
          id: string
          notes: string | null
          status: string
          supplier: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          document_path?: string | null
          id?: string
          notes?: string | null
          status?: string
          supplier: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          document_path?: string | null
          id?: string
          notes?: string | null
          status?: string
          supplier?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_quotes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_ticket_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          ticket_id: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          ticket_id: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          ticket_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          location: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_events: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          kind: string
          occurred_at: string
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          kind: string
          occurred_at?: string
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          kind?: string
          occurred_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      member_status_periods: {
        Row: {
          changed_by: string | null
          created_at: string
          ended_on: string | null
          id: string
          reason: string | null
          started_on: string
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          ended_on?: string | null
          id?: string
          reason?: string | null
          started_on?: string
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          ended_on?: string | null
          id?: string
          reason?: string | null
          started_on?: string
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          email: boolean
          internal: boolean
          push: boolean
          updated_at: string
          user_id: string
          whatsapp: boolean
        }
        Insert: {
          email?: boolean
          internal?: boolean
          push?: boolean
          updated_at?: string
          user_id: string
          whatsapp?: boolean
        }
        Update: {
          email?: boolean
          internal?: boolean
          push?: boolean
          updated_at?: string
          user_id?: string
          whatsapp?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      options: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          list: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          list: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          list?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      pending_invites: {
        Row: {
          consumed_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          work_id: string | null
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          work_id?: string | null
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_invites_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
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
          membership_status: Database["public"]["Enums"]["membership_status"]
          phone: string | null
          shortcuts: string[]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          membership_status?: Database["public"]["Enums"]["membership_status"]
          phone?: string | null
          shortcuts?: string[]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          membership_status?: Database["public"]["Enums"]["membership_status"]
          phone?: string | null
          shortcuts?: string[]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: []
      }
      purchase_documents: {
        Row: {
          ai_suggestion: Json | null
          created_at: string
          id: string
          kind: string
          mime_type: string | null
          purchase_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          ai_suggestion?: Json | null
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          purchase_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          ai_suggestion?: Json | null
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          purchase_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_documents_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          name: string
          purchase_id: string
          quantity: number
          total_price: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          name: string
          purchase_id: string
          quantity?: number
          total_price?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          name?: string
          purchase_id?: string
          quantity?: number
          total_price?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_items: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          name: string
          notes: string | null
          quantity: number
          request_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          name: string
          notes?: string | null
          quantity?: number
          request_id: string
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          name?: string
          notes?: string | null
          quantity?: number
          request_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          justification: string | null
          needs_finance: boolean
          notes: string | null
          priority: string
          requested_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          justification?: string | null
          needs_finance?: boolean
          notes?: string | null
          priority?: string
          requested_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          justification?: string | null
          needs_finance?: boolean
          notes?: string | null
          priority?: string
          requested_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          applied_to_stock: boolean
          created_at: string
          id: string
          notes: string | null
          purchased_by: string | null
          purchased_on: string
          request_id: string | null
          supplier: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          applied_to_stock?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          purchased_by?: string | null
          purchased_on?: string
          request_id?: string | null
          supplier?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          applied_to_stock?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          purchased_by?: string | null
          purchased_on?: string
          request_id?: string | null
          supplier?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
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
      site_posts: {
        Row: {
          author_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          id: string
          published_at: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_media_posts: {
        Row: {
          approval_mode: string
          approved_at: string | null
          approved_by: string | null
          attempt_count: number
          channels: string[]
          content_text: string
          created_at: string
          created_by: string | null
          id: string
          last_error: string | null
          media_url: string | null
          occurrence_at: string | null
          published_at: string | null
          reminder_minutes: number | null
          scheduled_for: string | null
          source: string
          status: string
          title: string | null
          updated_at: string
          work_id: string | null
        }
        Insert: {
          approval_mode?: string
          approved_at?: string | null
          approved_by?: string | null
          attempt_count?: number
          channels?: string[]
          content_text: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          media_url?: string | null
          occurrence_at?: string | null
          published_at?: string | null
          reminder_minutes?: number | null
          scheduled_for?: string | null
          source?: string
          status?: string
          title?: string | null
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          approval_mode?: string
          approved_at?: string | null
          approved_by?: string | null
          attempt_count?: number
          channels?: string[]
          content_text?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          media_url?: string | null
          occurrence_at?: string | null
          published_at?: string | null
          reminder_minutes?: number | null
          scheduled_for?: string | null
          source?: string
          status?: string
          title?: string | null
          updated_at?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_media_posts_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_deliveries: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string
          error_message: string | null
          id: string
          last_attempt_at: string | null
          post_id: string
          provider_post_id: string | null
          provider_url: string | null
          published_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          post_id: string
          provider_post_id?: string | null
          provider_url?: string | null
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          post_id?: string
          provider_post_id?: string | null
          provider_url?: string | null
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_deliveries_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          location: string | null
          min_quantity: number
          name: string
          notes: string | null
          package_content: string | null
          package_size: number | null
          quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          min_quantity?: number
          name: string
          notes?: string | null
          package_content?: string | null
          package_size?: number | null
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          min_quantity?: number
          name?: string
          notes?: string | null
          package_content?: string | null
          package_size?: number | null
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          quantity: number
          reason: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          work_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          quantity: number
          reason?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          work_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          quantity?: number
          reason?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
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
      work_entity_favorites: {
        Row: {
          created_at: string
          entity_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_entity_favorites_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "channeling_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_entity_favorites_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
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
      work_responsibles: {
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
            foreignKeyName: "work_responsibles_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_social_settings: {
        Row: {
          approval_mode: string
          channels: string[]
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          media_url: string | null
          reminder_minutes: number[]
          template_text: string
          updated_at: string
          work_id: string
        }
        Insert: {
          approval_mode?: string
          channels?: string[]
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          media_url?: string | null
          reminder_minutes?: number[]
          template_text?: string
          updated_at?: string
          work_id: string
        }
        Update: {
          approval_mode?: string
          channels?: string[]
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          media_url?: string | null
          reminder_minutes?: number[]
          template_text?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_social_settings_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_template: boolean
          location: string | null
          modality: string | null
          name: string
          recurrence: string
          recurrence_time: string | null
          recurrence_weekday: number | null
          starts_at: string
          status: Database["public"]["Enums"]["work_status"]
          template_id: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["work_visibility"]
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_template?: boolean
          location?: string | null
          modality?: string | null
          name: string
          recurrence?: string
          recurrence_time?: string | null
          recurrence_weekday?: number | null
          starts_at: string
          status?: Database["public"]["Enums"]["work_status"]
          template_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["work_visibility"]
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_template?: boolean
          location?: string | null
          modality?: string | null
          name?: string
          recurrence?: string
          recurrence_time?: string | null
          recurrence_weekday?: number | null
          starts_at?: string
          status?: Database["public"]["Enums"]["work_status"]
          template_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["work_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "works_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
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
      can_manage_classes: { Args: { _user_id: string }; Returns: boolean }
      can_manage_members: { Args: { _user_id: string }; Returns: boolean }
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
      is_critical_permission: {
        Args: { _permission: Database["public"]["Enums"]["app_permission"] }
        Returns: boolean
      }
      is_work_responsible: {
        Args: { _user_id: string; _work_id: string }
        Returns: boolean
      }
      notify_permission: {
        Args: {
          _body: string
          _kind: string
          _link: string
          _permission: Database["public"]["Enums"]["app_permission"]
          _title: string
        }
        Returns: undefined
      }
      register_audio_play: { Args: { _audio_id: string }; Returns: undefined }
      role_has_critical_permission: {
        Args: { _role_id: string }
        Returns: boolean
      }
      was_active_at: {
        Args: { _at: string; _user_id: string }
        Returns: boolean
      }
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
        | "attendance.manage"
        | "member.validate"
        | "member.manage"
        | "class.manage"
        | "member.role_assign"
        | "stock.manage"
        | "maintenance.request"
        | "maintenance.manage"
        | "purchase.manage"
        | "finance.view"
        | "finance.approve"
        | "media.manage"
        | "options.manage"
        | "record.delete"
        | "notification.manage"
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
      class_member_status: "active" | "ended" | "removed"
      class_status: "planned" | "open" | "ongoing" | "closed" | "cancelled"
      job_status: "pending" | "running" | "done" | "error"
      job_type: "convert" | "transcribe"
      membership_status: "pending" | "active" | "inactive"
      review_status: "unreviewed" | "in_review" | "reviewed"
      stock_movement_type: "in" | "out" | "adjustment"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "attendance.manage",
        "member.validate",
        "member.manage",
        "class.manage",
        "member.role_assign",
        "stock.manage",
        "maintenance.request",
        "maintenance.manage",
        "purchase.manage",
        "finance.view",
        "finance.approve",
        "media.manage",
        "options.manage",
        "record.delete",
        "notification.manage",
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
      class_member_status: ["active", "ended", "removed"],
      class_status: ["planned", "open", "ongoing", "closed", "cancelled"],
      job_status: ["pending", "running", "done", "error"],
      job_type: ["convert", "transcribe"],
      membership_status: ["pending", "active", "inactive"],
      review_status: ["unreviewed", "in_review", "reviewed"],
      stock_movement_type: ["in", "out", "adjustment"],
      work_status: ["draft", "published", "completed", "archived"],
      work_visibility: ["public", "internal"],
    },
  },
} as const
