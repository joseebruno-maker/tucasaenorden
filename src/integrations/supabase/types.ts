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
      activities: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          id: string
          location: string | null
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["activity_status"]
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          household_id: string
          id: string
          recurrence_end_date: string | null
          recurrence_group_id: string | null
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          household_id: string
          id?: string
          recurrence_end_date?: string | null
          recurrence_group_id?: string | null
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          household_id?: string
          id?: string
          recurrence_end_date?: string | null
          recurrence_group_id?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string
          created_at: string
          created_by: string
          household_id: string
          id: string
          monthly_budget: number | null
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          monthly_budget?: number | null
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          monthly_budget?: number | null
          name?: string
        }
        Relationships: []
      }
      expense_permissions: {
        Row: {
          created_at: string
          household_id: string
          id: string
          permission: Database["public"]["Enums"]["expense_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          permission?: Database["public"]["Enums"]["expense_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          permission?: Database["public"]["Enums"]["expense_permission"]
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          currency: string
          description: string | null
          household_id: string
          id: string
          recurring_id: string | null
          spent_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          household_id: string
          id?: string
          recurring_id?: string | null
          spent_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          household_id?: string
          id?: string
          recurring_id?: string | null
          spent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_roles: {
        Row: {
          created_at: string
          household_id: string
          id: string
          role: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_roles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      maintenance_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          frequency_days: number
          household_id: string
          id: string
          last_done_at: string | null
          name: string
          next_due_date: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          frequency_days: number
          household_id: string
          id?: string
          last_done_at?: string | null
          name: string
          next_due_date: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          frequency_days?: number
          household_id?: string
          id?: string
          last_done_at?: string | null
          name?: string
          next_due_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_entries: {
        Row: {
          created_at: string
          created_by: string
          date: string
          household_id: string
          id: string
          meal: Database["public"]["Enums"]["meal_slot"]
          notes: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date: string
          household_id: string
          id?: string
          meal: Database["public"]["Enums"]["meal_slot"]
          notes?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          household_id?: string
          id?: string
          meal?: Database["public"]["Enums"]["meal_slot"]
          notes?: string | null
          title?: string
        }
        Relationships: []
      }
      note_items: {
        Row: {
          created_at: string
          created_by: string
          done: boolean
          household_id: string
          id: string
          note_id: string
          position: number
          text: string
        }
        Insert: {
          created_at?: string
          created_by: string
          done?: boolean
          household_id: string
          id?: string
          note_id: string
          position?: number
          text: string
        }
        Update: {
          created_at?: string
          created_by?: string
          done?: boolean
          household_id?: string
          id?: string
          note_id?: string
          position?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_items_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          color: string
          content: string | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          kind: Database["public"]["Enums"]["note_kind"]
          title: string
          updated_at: string
        }
        Insert: {
          color?: string
          content?: string | null
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
          title: string
          updated_at?: string
        }
        Update: {
          color?: string
          content?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number | null
          currency: string
          household_id: string
          id: string
          notes: string | null
          paid_at: string
          paid_by: string
          payment_id: string
        }
        Insert: {
          amount?: number | null
          currency?: string
          household_id: string
          id?: string
          notes?: string | null
          paid_at?: string
          paid_by: string
          payment_id: string
        }
        Update: {
          amount?: number | null
          currency?: string
          household_id?: string
          id?: string
          notes?: string | null
          paid_at?: string
          paid_by?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          category: Database["public"]["Enums"]["payment_category"]
          created_at: string
          created_by: string
          currency: string
          household_id: string
          id: string
          name: string
          next_due_date: string
          notes: string | null
          recurrence: Database["public"]["Enums"]["payment_recurrence"]
        }
        Insert: {
          amount?: number | null
          category?: Database["public"]["Enums"]["payment_category"]
          created_at?: string
          created_by: string
          currency?: string
          household_id: string
          id?: string
          name: string
          next_due_date: string
          notes?: string | null
          recurrence?: Database["public"]["Enums"]["payment_recurrence"]
        }
        Update: {
          amount?: number | null
          category?: Database["public"]["Enums"]["payment_category"]
          created_at?: string
          created_by?: string
          currency?: string
          household_id?: string
          id?: string
          name?: string
          next_due_date?: string
          notes?: string | null
          recurrence?: Database["public"]["Enums"]["payment_recurrence"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          id: string
          ingredients: string[]
          name: string
          steps: string[]
        }
        Insert: {
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          ingredients?: string[]
          name: string
          steps?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          ingredients?: string[]
          name?: string
          steps?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          active: boolean
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          currency: string
          day_of_month: number
          description: string | null
          household_id: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          day_of_month?: number
          description?: string | null
          household_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          day_of_month?: number
          description?: string | null
          household_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          bought: boolean
          category: string | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          name: string
          qty: string | null
        }
        Insert: {
          bought?: boolean
          category?: string | null
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          name: string
          qty?: string | null
        }
        Update: {
          bought?: boolean
          category?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          name?: string
          qty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          household_id: string
          id: string
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          household_id: string
          id?: string
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          household_id?: string
          id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_expenses: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_expenses: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      ensure_recurring_expenses: {
        Args: { _household_id: string; _ym: string }
        Returns: number
      }
      get_expense_permission: {
        Args: { _household_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["expense_permission"]
      }
      get_household_role: {
        Args: { _household_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["household_role"]
      }
      has_household_role: {
        Args: {
          _household_id: string
          _role: Database["public"]["Enums"]["household_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_household_admin: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      is_household_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      is_household_member_or_admin: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_status: "pending" | "done"
      activity_type: "restaurante" | "actividad" | "salida" | "viaje" | "otro"
      expense_permission: "none" | "view" | "edit"
      household_role: "admin" | "member" | "guest"
      meal_slot: "breakfast" | "lunch" | "snack" | "dinner"
      note_kind: "list" | "note"
      payment_category: "rent" | "service" | "other"
      payment_recurrence:
        | "monthly"
        | "bimonthly"
        | "quarterly"
        | "yearly"
        | "one_time"
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
      activity_status: ["pending", "done"],
      activity_type: ["restaurante", "actividad", "salida", "viaje", "otro"],
      expense_permission: ["none", "view", "edit"],
      household_role: ["admin", "member", "guest"],
      meal_slot: ["breakfast", "lunch", "snack", "dinner"],
      note_kind: ["list", "note"],
      payment_category: ["rent", "service", "other"],
      payment_recurrence: [
        "monthly",
        "bimonthly",
        "quarterly",
        "yearly",
        "one_time",
      ],
    },
  },
} as const
