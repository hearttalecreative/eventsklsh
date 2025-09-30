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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      addons: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          max_quantity_per_person: number | null
          name: string
          unit_amount_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          max_quantity_per_person?: number | null
          name: string
          unit_amount_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          max_quantity_per_person?: number | null
          name?: string
          unit_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_sales_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "addons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      attendees: {
        Row: {
          checked_in_at: string | null
          confirmation_code: string
          created_at: string
          email: string | null
          event_id: string
          id: string
          is_comped: boolean
          name: string | null
          order_item_id: string | null
          phone: string | null
          qr_code: string | null
          seat: string | null
          ticket_label: string | null
          zone: string | null
        }
        Insert: {
          checked_in_at?: string | null
          confirmation_code: string
          created_at?: string
          email?: string | null
          event_id: string
          id?: string
          is_comped?: boolean
          name?: string | null
          order_item_id?: string | null
          phone?: string | null
          qr_code?: string | null
          seat?: string | null
          ticket_label?: string | null
          zone?: string | null
        }
        Update: {
          checked_in_at?: string | null
          confirmation_code?: string
          created_at?: string
          email?: string | null
          event_id?: string
          id?: string
          is_comped?: boolean
          name?: string | null
          order_item_id?: string | null
          phone?: string | null
          qr_code?: string | null
          seat?: string | null
          ticket_label?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_sales_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendees_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          amount_discount_cents: number
          coupon_id: string
          created_at: string
          email: string | null
          event_id: string
          id: string
          order_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_discount_cents?: number
          coupon_id: string
          created_at?: string
          email?: string | null
          event_id: string
          id?: string
          order_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_discount_cents?: number
          coupon_id?: string
          created_at?: string
          email?: string | null
          event_id?: string
          id?: string
          order_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_sales_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "coupon_redemptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          apply_to: Database["public"]["Enums"]["discount_apply_to"]
          code: string
          created_at: string
          description: string | null
          discount_amount_cents: number | null
          discount_percent: number | null
          ends_at: string | null
          event_id: string | null
          id: string
          max_redemptions: number | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          apply_to?: Database["public"]["Enums"]["discount_apply_to"]
          code: string
          created_at?: string
          description?: string | null
          discount_amount_cents?: number | null
          discount_percent?: number | null
          ends_at?: string | null
          event_id?: string | null
          id?: string
          max_redemptions?: number | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          apply_to?: Database["public"]["Enums"]["discount_apply_to"]
          code?: string
          created_at?: string
          description?: string | null
          discount_amount_cents?: number | null
          discount_percent?: number | null
          ends_at?: string | null
          event_id?: string | null
          id?: string
          max_redemptions?: number | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_sales_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "coupons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity_total: number | null
          category: string | null
          coupon_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          instructions: string | null
          recurrence_rule: string | null
          recurrence_text: string | null
          short_description: string | null
          sku: string
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          timezone: string | null
          title: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          capacity_total?: number | null
          category?: string | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          recurrence_rule?: string | null
          recurrence_text?: string | null
          short_description?: string | null
          sku?: string
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string | null
          title: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          capacity_total?: number | null
          category?: string | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          recurrence_rule?: string | null
          recurrence_text?: string | null
          short_description?: string | null
          sku?: string
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string | null
          title?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_sales_summary"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          addon_id: string | null
          id: string
          order_id: string
          quantity: number
          ticket_id: string | null
          total_amount_cents: number
          unit_amount_cents: number
        }
        Insert: {
          addon_id?: string | null
          id?: string
          order_id: string
          quantity?: number
          ticket_id?: string | null
          total_amount_cents?: number
          unit_amount_cents?: number
        }
        Update: {
          addon_id?: string | null
          id?: string
          order_id?: string
          quantity?: number
          ticket_id?: string | null
          total_amount_cents?: number
          unit_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          email: string | null
          event_id: string
          id: string
          status: Database["public"]["Enums"]["order_status"]
          total_amount_cents: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          email?: string | null
          event_id: string
          id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          email?: string | null
          event_id?: string
          id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_sales_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          capacity_total: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string | null
          display_order: number | null
          early_bird_amount_cents: number | null
          early_bird_end: string | null
          early_bird_start: string | null
          event_id: string
          id: string
          internal_notes: string | null
          name: string
          participants_per_ticket: number
          unit_amount_cents: number
          updated_at: string
          zone: string | null
        }
        Insert: {
          capacity_total: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          display_order?: number | null
          early_bird_amount_cents?: number | null
          early_bird_end?: string | null
          early_bird_start?: string | null
          event_id: string
          id?: string
          internal_notes?: string | null
          name: string
          participants_per_ticket?: number
          unit_amount_cents: number
          updated_at?: string
          zone?: string | null
        }
        Update: {
          capacity_total?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          display_order?: number | null
          early_bird_amount_cents?: number | null
          early_bird_end?: string | null
          early_bird_start?: string | null
          event_id?: string
          id?: string
          internal_notes?: string | null
          name?: string
          participants_per_ticket?: number
          unit_amount_cents?: number
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_sales_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      venues: {
        Row: {
          address: string | null
          capacity_total: number | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          capacity_total?: number | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          capacity_total?: number | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      event_sales_summary: {
        Row: {
          event_id: string | null
          orders_paid: number | null
          orders_total: number | null
          title: string | null
          total_amount_cents: number | null
          venue_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_sales_summary"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_sales_summary: {
        Row: {
          name: string | null
          orders_paid: number | null
          total_amount_cents: number | null
          venue_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      compute_event_slug: {
        Args: { _id: string; _title: string }
        Returns: string
      }
      generate_confirmation_code: {
        Args: { _len?: number }
        Returns: string
      }
      generate_qr_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_event_sales_summary_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          event_id: string | null
          orders_paid: number | null
          orders_total: number | null
          title: string | null
          total_amount_cents: number | null
          venue_id: string | null
        }[]
      }
      get_venue_sales_summary_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string | null
          orders_paid: number | null
          total_amount_cents: number | null
          venue_id: string | null
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      promote_to_admin_if_allowlisted: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      currency_code: "usd" | "eur" | "ars" | "mxn"
      discount_apply_to: "tickets" | "addons" | "both"
      event_status: "draft" | "published" | "archived" | "sold_out" | "paused"
      order_status: "pending" | "paid" | "refunded" | "canceled"
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
      currency_code: ["usd", "eur", "ars", "mxn"],
      discount_apply_to: ["tickets", "addons", "both"],
      event_status: ["draft", "published", "archived", "sold_out", "paused"],
      order_status: ["pending", "paid", "refunded", "canceled"],
    },
  },
} as const
