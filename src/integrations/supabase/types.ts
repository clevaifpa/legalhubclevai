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
      clauses: {
        Row: {
          content: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          updated_at: string
        }
        Insert: {
          content: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          updated_at?: string
        }
        Update: {
          content?: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          updated_at?: string
        }
        Relationships: []
      }
      contract_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      contract_payment_schedules: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          payment_amount: number
          payment_due_date: string | null
          payment_status: string
          phase_name: string
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          payment_amount?: number
          payment_due_date?: string | null
          payment_status?: string
          phase_name: string
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          payment_amount?: number
          payment_due_date?: string | null
          payment_status?: string
          phase_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_payment_schedules_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          approved_pe_number: string | null
          category_id: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          created_by: string | null
          department: string
          effective_date: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          liquidation_file_url: string | null
          partner_name: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          signed_file_url: string | null
          status: Database["public"]["Enums"]["contract_status"]
          tax_code: string | null
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          approved_pe_number?: string | null
          category_id?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          department?: string
          effective_date?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          liquidation_file_url?: string | null
          partner_name?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          signed_file_url?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tax_code?: string | null
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          approved_pe_number?: string | null
          category_id?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          department?: string
          effective_date?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          liquidation_file_url?: string | null
          partner_name?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          signed_file_url?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tax_code?: string | null
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "contract_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_logs: {
        Row: {
          changes: Json
          created_at: string
          editor_id: string
          editor_name: string
          id: string
          record_id: string
          table_name: string
        }
        Insert: {
          changes?: Json
          created_at?: string
          editor_id: string
          editor_name: string
          id?: string
          record_id: string
          table_name: string
        }
        Update: {
          changes?: Json
          created_at?: string
          editor_id?: string
          editor_name?: string
          id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          content: string
          created_at: string
          id: string
          notification_type: string
          recipient_email: string | null
          recipient_user_id: string
          review_request_id: string | null
          status: string
          title: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          notification_type?: string
          recipient_email?: string | null
          recipient_user_id: string
          review_request_id?: string | null
          status?: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          notification_type?: string
          recipient_email?: string | null
          recipient_user_id?: string
          review_request_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_review_request_id_fkey"
            columns: ["review_request_id"]
            isOneToOne: false
            referencedRelation: "review_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          review_request_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          review_request_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          review_request_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_review_request_id_fkey"
            columns: ["review_request_id"]
            isOneToOne: false
            referencedRelation: "review_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          created_at: string
          id: string
          payment_amount: number
          payment_due_date: string | null
          payment_status: string
          phase_name: string
          review_request_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_amount?: number
          payment_due_date?: string | null
          payment_status?: string
          phase_name: string
          review_request_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_amount?: number
          payment_due_date?: string | null
          payment_status?: string
          phase_name?: string
          review_request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_review_request_id_fkey"
            columns: ["review_request_id"]
            isOneToOne: false
            referencedRelation: "review_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_notes: {
        Row: {
          author_id: string
          author_name: string
          content: string
          created_at: string
          id: string
          review_request_id: string
        }
        Insert: {
          author_id: string
          author_name: string
          content: string
          created_at?: string
          id?: string
          review_request_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          review_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_notes_review_request_id_fkey"
            columns: ["review_request_id"]
            isOneToOne: false
            referencedRelation: "review_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          admin_notes: string | null
          approved_pe_number: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          contract_title: string
          contract_type_category: string | null
          contract_value: number | null
          created_at: string
          department: string
          description: string | null
          file_url: string | null
          id: string
          legal_review_doc_link: string | null
          manager_id: string | null
          partner_name: string
          priority: Database["public"]["Enums"]["priority_level"]
          request_deadline: string
          requester_id: string
          requester_name: string
          review_deadline: string | null
          status: Database["public"]["Enums"]["review_request_status"]
          tax_code: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          approved_pe_number?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_title: string
          contract_type_category?: string | null
          contract_value?: number | null
          created_at?: string
          department: string
          description?: string | null
          file_url?: string | null
          id?: string
          legal_review_doc_link?: string | null
          manager_id?: string | null
          partner_name?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          request_deadline: string
          requester_id: string
          requester_name: string
          review_deadline?: string | null
          status?: Database["public"]["Enums"]["review_request_status"]
          tax_code?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          approved_pe_number?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_title?: string
          contract_type_category?: string | null
          contract_value?: number | null
          created_at?: string
          department?: string
          description?: string | null
          file_url?: string | null
          id?: string
          legal_review_doc_link?: string | null
          manager_id?: string | null
          partner_name?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          request_deadline?: string
          requester_id?: string
          requester_name?: string
          review_deadline?: string | null
          status?: Database["public"]["Enums"]["review_request_status"]
          tax_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          department: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          department?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          department?: string | null
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
      auto_expire_contracts: { Args: never; Returns: undefined }
      get_managers_by_department: {
        Args: { _department: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
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
      app_role: "admin" | "user" | "accountant" | "finance" | "manager"
      contract_status:
        | "nhap"
        | "dang_review"
        | "da_ky"
        | "het_hieu_luc"
        | "da_thanh_ly"
      contract_type:
        | "mua_ban"
        | "dich_vu"
        | "nda"
        | "hop_tac"
        | "lao_dong"
        | "thue"
        | "khac"
      priority_level: "cao" | "trung_binh" | "thap"
      review_request_status:
        | "cho_xu_ly"
        | "dang_review"
        | "da_hoan_thanh"
        | "yeu_cau_chinh_sua"
        | "tu_choi"
        | "cho_quan_ly"
        | "cho_phap_che"
        | "cho_ke_toan"
        | "cho_tai_chinh"
        | "hoan_tat"
      risk_level: "thap" | "trung_binh" | "cao"
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
      app_role: ["admin", "user", "accountant", "finance", "manager"],
      contract_status: [
        "nhap",
        "dang_review",
        "da_ky",
        "het_hieu_luc",
        "da_thanh_ly",
      ],
      contract_type: [
        "mua_ban",
        "dich_vu",
        "nda",
        "hop_tac",
        "lao_dong",
        "thue",
        "khac",
      ],
      priority_level: ["cao", "trung_binh", "thap"],
      review_request_status: [
        "cho_xu_ly",
        "dang_review",
        "da_hoan_thanh",
        "yeu_cau_chinh_sua",
        "tu_choi",
        "cho_quan_ly",
        "cho_phap_che",
        "cho_ke_toan",
        "cho_tai_chinh",
        "hoan_tat",
      ],
      risk_level: ["thap", "trung_binh", "cao"],
    },
  },
} as const
