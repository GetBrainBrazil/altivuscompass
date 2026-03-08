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
      airlines: {
        Row: {
          country: string | null
          created_at: string
          iata_code: string | null
          id: string
          mileage_program_name: string | null
          name: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          iata_code?: string | null
          id?: string
          mileage_program_name?: string | null
          name: string
        }
        Update: {
          country?: string | null
          created_at?: string
          iata_code?: string | null
          id?: string
          mileage_program_name?: string | null
          name?: string
        }
        Relationships: []
      }
      airports: {
        Row: {
          city: string
          country: string
          created_at: string
          iata_code: string
          id: string
          name: string
          state: string | null
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          iata_code: string
          id?: string
          name: string
          state?: string | null
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          iata_code?: string
          id?: string
          name?: string
          state?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          channel: string | null
          created_at: string
          created_by: string | null
          filters: Json | null
          id: string
          name: string
          recipients_count: number | null
          status: string | null
          template: string | null
          updated_at: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          id?: string
          name: string
          recipients_count?: number | null
          status?: string | null
          template?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          id?: string
          name?: string
          recipients_count?: number | null
          status?: string | null
          template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          country_id: string
          created_at: string
          id: string
          name: string
          state_id: string | null
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          name: string
          state_id?: string | null
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          name?: string
          state_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      client_emails: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          email: string
          id: string
          is_primary: boolean
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          email: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          email?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_emails_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_passports: {
        Row: {
          client_id: string
          created_at: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          nationality: string | null
          passport_number: string | null
          status: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          nationality?: string | null
          passport_number?: string | null
          status?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          nationality?: string | null
          passport_number?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_passports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_phones: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          is_primary: boolean
          phone: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          phone: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_phones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_social_media: {
        Row: {
          client_id: string
          created_at: string
          handle: string
          id: string
          network: string
        }
        Insert: {
          client_id: string
          created_at?: string
          handle: string
          id?: string
          network: string
        }
        Update: {
          client_id?: string
          created_at?: string
          handle?: string
          id?: string
          network?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_social_media_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_visas: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          passport_id: string | null
          validity_date: string | null
          visa_type: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          passport_id?: string | null
          validity_date?: string | null
          visa_type: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          passport_id?: string | null
          validity_date?: string | null
          visa_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_visas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_visas_passport_id_fkey"
            columns: ["passport_id"]
            isOneToOne: false
            referencedRelation: "client_passports"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          accepts_email_comm: boolean
          accepts_whatsapp_comm: boolean
          address_complement: string | null
          address_number: string | null
          address_street: string | null
          birth_date: string | null
          cep: string | null
          city: string | null
          country: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          foreign_id: string | null
          full_name: string
          gender: string | null
          id: string
          is_active: boolean
          marital_status: string | null
          nationality: string | null
          neighborhood: string | null
          notes: string | null
          passport_expiry_date: string | null
          passport_issue_date: string | null
          passport_nationality: string | null
          passport_number: string | null
          passport_status: string | null
          phone: string | null
          preferred_airports: string[] | null
          rating: number
          region: string | null
          rg: string | null
          rg_issuer: string | null
          seat_preference: string | null
          state: string | null
          tags: string[] | null
          travel_preferences: string | null
          travel_profile: Database["public"]["Enums"]["travel_profile"] | null
          updated_at: string
          website: string | null
        }
        Insert: {
          accepts_email_comm?: boolean
          accepts_whatsapp_comm?: boolean
          address_complement?: string | null
          address_number?: string | null
          address_street?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          country?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          foreign_id?: string | null
          full_name: string
          gender?: string | null
          id?: string
          is_active?: boolean
          marital_status?: string | null
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_nationality?: string | null
          passport_number?: string | null
          passport_status?: string | null
          phone?: string | null
          preferred_airports?: string[] | null
          rating?: number
          region?: string | null
          rg?: string | null
          rg_issuer?: string | null
          seat_preference?: string | null
          state?: string | null
          tags?: string[] | null
          travel_preferences?: string | null
          travel_profile?: Database["public"]["Enums"]["travel_profile"] | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          accepts_email_comm?: boolean
          accepts_whatsapp_comm?: boolean
          address_complement?: string | null
          address_number?: string | null
          address_street?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          country?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          foreign_id?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          is_active?: boolean
          marital_status?: string | null
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_nationality?: string | null
          passport_number?: string | null
          passport_status?: string | null
          phone?: string | null
          preferred_airports?: string[] | null
          rating?: number
          region?: string | null
          rg?: string | null
          rg_issuer?: string | null
          seat_preference?: string | null
          state?: string | null
          tags?: string[] | null
          travel_preferences?: string | null
          travel_profile?: Database["public"]["Enums"]["travel_profile"] | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      countries: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      financial_parties: {
        Row: {
          billing_address: string | null
          billing_email: string | null
          created_at: string
          document_number: string | null
          id: string
          name: string
          notes: string | null
          type: Database["public"]["Enums"]["financial_party_type"]
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_email?: string | null
          created_at?: string
          document_number?: string | null
          id?: string
          name: string
          notes?: string | null
          type?: Database["public"]["Enums"]["financial_party_type"]
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_email?: string | null
          created_at?: string
          document_number?: string | null
          id?: string
          name?: string
          notes?: string | null
          type?: Database["public"]["Enums"]["financial_party_type"]
          updated_at?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          due_date: string | null
          id: string
          party_name: string | null
          quote_id: string | null
          status: string | null
          type: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description: string
          due_date?: string | null
          id?: string
          party_name?: string | null
          quote_id?: string | null
          status?: string | null
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          due_date?: string | null
          id?: string
          party_name?: string | null
          quote_id?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      miles_programs: {
        Row: {
          airline: string
          authorized_to_manage: boolean | null
          client_id: string
          created_at: string
          expiration_date: string | null
          id: string
          login_email: string | null
          login_password_encrypted: string | null
          membership_number: string | null
          miles_balance: number | null
          program_name: string
          updated_at: string
        }
        Insert: {
          airline: string
          authorized_to_manage?: boolean | null
          client_id: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          login_email?: string | null
          login_password_encrypted?: string | null
          membership_number?: string | null
          miles_balance?: number | null
          program_name: string
          updated_at?: string
        }
        Update: {
          airline?: string
          authorized_to_manage?: boolean | null
          client_id?: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          login_email?: string | null
          login_password_encrypted?: string | null
          membership_number?: string | null
          miles_balance?: number | null
          program_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "miles_programs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      passengers: {
        Row: {
          birth_date: string | null
          client_id: string | null
          created_at: string
          full_name: string
          id: string
          nationality: string | null
          notes: string | null
          passport_expiry: string | null
          passport_number: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          client_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          client_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passengers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_financial_parties: {
        Row: {
          financial_party_id: string
          id: string
          quote_id: string
          share_percentage: number | null
        }
        Insert: {
          financial_party_id: string
          id?: string
          quote_id: string
          share_percentage?: number | null
        }
        Update: {
          financial_party_id?: string
          id?: string
          quote_id?: string
          share_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_financial_parties_financial_party_id_fkey"
            columns: ["financial_party_id"]
            isOneToOne: false
            referencedRelation: "financial_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_financial_parties_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_passengers: {
        Row: {
          id: string
          passenger_id: string
          quote_id: string
        }
        Insert: {
          id?: string
          passenger_id: string
          quote_id: string
        }
        Update: {
          id?: string
          passenger_id?: string
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_passengers_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "passengers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_passengers_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          airline_options: string | null
          assigned_to: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          departure_airport: string | null
          departure_city: string | null
          destination: string | null
          destination_images: string[] | null
          hotel_options: string | null
          id: string
          notes: string | null
          price_breakdown: Json | null
          quote_validity: string | null
          stage: Database["public"]["Enums"]["quote_stage"]
          total_value: number | null
          travel_date_end: string | null
          travel_date_start: string | null
          updated_at: string
        }
        Insert: {
          airline_options?: string | null
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          departure_airport?: string | null
          departure_city?: string | null
          destination?: string | null
          destination_images?: string[] | null
          hotel_options?: string | null
          id?: string
          notes?: string | null
          price_breakdown?: Json | null
          quote_validity?: string | null
          stage?: Database["public"]["Enums"]["quote_stage"]
          total_value?: number | null
          travel_date_end?: string | null
          travel_date_start?: string | null
          updated_at?: string
        }
        Update: {
          airline_options?: string | null
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          departure_airport?: string | null
          departure_city?: string | null
          destination?: string | null
          destination_images?: string[] | null
          hotel_options?: string | null
          id?: string
          notes?: string | null
          price_breakdown?: Json | null
          quote_validity?: string | null
          stage?: Database["public"]["Enums"]["quote_stage"]
          total_value?: number | null
          travel_date_end?: string | null
          travel_date_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          country_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "states_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "sales_agent" | "operations"
      financial_party_type: "individual" | "company"
      quote_stage:
        | "new"
        | "sent"
        | "negotiation"
        | "confirmed"
        | "issued"
        | "completed"
        | "post_sale"
      travel_profile: "economic" | "opportunity" | "sophisticated"
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
      app_role: ["admin", "manager", "sales_agent", "operations"],
      financial_party_type: ["individual", "company"],
      quote_stage: [
        "new",
        "sent",
        "negotiation",
        "confirmed",
        "issued",
        "completed",
        "post_sale",
      ],
      travel_profile: ["economic", "opportunity", "sophisticated"],
    },
  },
} as const
