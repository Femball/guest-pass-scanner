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
      activity_logs: {
        Row: {
          action: string
          actor_label: string | null
          category: string
          created_at: string
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_label?: string | null
          category?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_label?: string | null
          category?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          name: string
          notes: string | null
          phone: string | null
          reservation_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          name: string
          notes?: string | null
          phone?: string | null
          reservation_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          name?: string
          notes?: string | null
          phone?: string | null
          reservation_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_dispatch_log: {
        Row: {
          dispatch_type: string
          id: string
          reservation_id: string
          sent_at: string
        }
        Insert: {
          dispatch_type: string
          id?: string
          reservation_id: string
          sent_at?: string
        }
        Update: {
          dispatch_type?: string
          id?: string
          reservation_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_dispatch_log_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_feedback: {
        Row: {
          client_email: string
          client_name: string
          comment: string | null
          created_at: string
          event_date: string
          id: string
          rating: number | null
          reservation_id: string
          submitted_at: string | null
          token: string
        }
        Insert: {
          client_email: string
          client_name: string
          comment?: string | null
          created_at?: string
          event_date: string
          id?: string
          rating?: number | null
          reservation_id: string
          submitted_at?: string | null
          token: string
        }
        Update: {
          client_email?: string
          client_name?: string
          comment?: string | null
          created_at?: string
          event_date?: string
          id?: string
          rating?: number | null
          reservation_id?: string
          submitted_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      flyer_invitations: {
        Row: {
          created_at: string
          event_date: string
          id: string
          label: string
          qr_code: string
          scan_count: number
        }
        Insert: {
          created_at?: string
          event_date?: string
          id?: string
          label: string
          qr_code: string
          scan_count?: number
        }
        Update: {
          created_at?: string
          event_date?: string
          id?: string
          label?: string
          qr_code?: string
          scan_count?: number
        }
        Relationships: []
      }
      flyer_scans: {
        Row: {
          flyer_invitation_id: string
          id: string
          scanned_at: string
        }
        Insert: {
          flyer_invitation_id: string
          id?: string
          scanned_at?: string
        }
        Update: {
          flyer_invitation_id?: string
          id?: string
          scanned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flyer_scans_flyer_invitation_id_fkey"
            columns: ["flyer_invitation_id"]
            isOneToOne: false
            referencedRelation: "flyer_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_cards: {
        Row: {
          card_uid: string
          company_id: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          member_type: string
          notes: string | null
          phone: string | null
          updated_at: string
          valid_until: string | null
          wallet_auth_token: string
        }
        Insert: {
          card_uid: string
          company_id?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          member_type?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          valid_until?: string | null
          wallet_auth_token?: string
        }
        Update: {
          card_uid?: string
          company_id?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          member_type?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          valid_until?: string | null
          wallet_auth_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_companies: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reservation_bottles: {
        Row: {
          bottle_type: string
          created_at: string
          id: string
          quantity: number
          reservation_id: string
        }
        Insert: {
          bottle_type: string
          created_at?: string
          id?: string
          quantity?: number
          reservation_id: string
        }
        Update: {
          bottle_type?: string
          created_at?: string
          id?: string
          quantity?: number
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_bottles_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          amount: number | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          event_date: string
          id: string
          is_validated: boolean
          number_of_persons: number
          payment_method: string | null
          payment_status: string | null
          qr_code: string
          sumup_checkout_id: string | null
          validated_at: string | null
        }
        Insert: {
          amount?: number | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          event_date?: string
          id?: string
          is_validated?: boolean
          number_of_persons?: number
          payment_method?: string | null
          payment_status?: string | null
          qr_code: string
          sumup_checkout_id?: string | null
          validated_at?: string | null
        }
        Update: {
          amount?: number | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          event_date?: string
          id?: string
          is_validated?: boolean
          number_of_persons?: number
          payment_method?: string | null
          payment_status?: string | null
          qr_code?: string
          sumup_checkout_id?: string | null
          validated_at?: string | null
        }
        Relationships: []
      }
      scan_anomalies: {
        Row: {
          client_name: string
          created_at: string
          delta_seconds: number
          duplicate_scan_at: string
          event_date: string
          first_scan_at: string
          id: string
          source_kind: string | null
          source_record_id: string | null
        }
        Insert: {
          client_name: string
          created_at?: string
          delta_seconds: number
          duplicate_scan_at?: string
          event_date: string
          first_scan_at: string
          id?: string
          source_kind?: string | null
          source_record_id?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string
          delta_seconds?: number
          duplicate_scan_at?: string
          event_date?: string
          first_scan_at?: string
          id?: string
          source_kind?: string | null
          source_record_id?: string | null
        }
        Relationships: []
      }
      scan_notifications: {
        Row: {
          client_name: string
          created_at: string
          event_date: string
          id: string
          scanned_by: string | null
          source_kind: string | null
          source_record_id: string | null
        }
        Insert: {
          client_name: string
          created_at?: string
          event_date?: string
          id?: string
          scanned_by?: string | null
          source_kind?: string | null
          source_record_id?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string
          event_date?: string
          id?: string
          scanned_by?: string | null
          source_kind?: string | null
          source_record_id?: string | null
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
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
      wallet_registrations: {
        Row: {
          created_at: string
          device_library_identifier: string
          id: string
          pass_type_identifier: string
          push_token: string
          serial_number: string
        }
        Insert: {
          created_at?: string
          device_library_identifier: string
          id?: string
          pass_type_identifier: string
          push_token: string
          serial_number: string
        }
        Update: {
          created_at?: string
          device_library_identifier?: string
          id?: string
          pass_type_identifier?: string
          push_token?: string
          serial_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_feedback_by_token: {
        Args: { p_token: string }
        Returns: {
          client_name: string
          comment: string
          event_date: string
          id: string
          rating: number
          submitted_at: string
        }[]
      }
      get_member_card_by_uid: {
        Args: { p_uid: string }
        Returns: {
          card_uid: string
          company_logo_url: string
          company_name: string
          first_name: string
          last_name: string
          member_type: string
          valid_until: string
        }[]
      }
      has_admin_privileges: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      purge_old_data: { Args: never; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      submit_feedback_by_token: {
        Args: { p_comment: string; p_rating: number; p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "agent" | "supervisor"
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
      app_role: ["admin", "agent", "supervisor"],
    },
  },
} as const
