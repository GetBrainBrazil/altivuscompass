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
      agency_settings: {
        Row: {
          address: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      airlines: {
        Row: {
          country: string | null
          created_at: string
          iata_code: string | null
          id: string
          mileage_program_name: string | null
          name: string
          program_url: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          iata_code?: string | null
          id?: string
          mileage_program_name?: string | null
          name: string
          program_url?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          iata_code?: string | null
          id?: string
          mileage_program_name?: string | null
          name?: string
          program_url?: string | null
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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      bank_account_access: {
        Row: {
          bank_account_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          bank_account_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          bank_account_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_access_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_account_credential_viewers: {
        Row: {
          created_at: string
          credential_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_credential_viewers_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "bank_account_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_account_credentials: {
        Row: {
          access_password: string | null
          bank_account_id: string
          created_at: string
          has_facial: boolean
          id: string
          login_username: string | null
          notes: string | null
          transaction_password: string | null
          updated_at: string
        }
        Insert: {
          access_password?: string | null
          bank_account_id: string
          created_at?: string
          has_facial?: boolean
          id?: string
          login_username?: string | null
          notes?: string | null
          transaction_password?: string | null
          updated_at?: string
        }
        Update: {
          access_password?: string | null
          bank_account_id?: string
          created_at?: string
          has_facial?: boolean
          id?: string
          login_username?: string | null
          notes?: string | null
          transaction_password?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_credentials_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string | null
          agency: string | null
          bank_name: string
          created_at: string
          holder_document: string | null
          holder_name: string | null
          id: string
          is_active: boolean
          notes: string | null
          pix_key: string | null
          pix_key_type: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          bank_name: string
          created_at?: string
          holder_document?: string | null
          holder_name?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          bank_name?: string
          created_at?: string
          holder_document?: string | null
          holder_name?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
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
          image_urls: string[] | null
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
          image_urls?: string[] | null
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
          image_urls?: string[] | null
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
      client_relationships: {
        Row: {
          client_id_a: string
          client_id_b: string
          created_at: string
          id: string
          relationship_label: string | null
          relationship_type: Database["public"]["Enums"]["relationship_type"]
        }
        Insert: {
          client_id_a: string
          client_id_b: string
          created_at?: string
          id?: string
          relationship_label?: string | null
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
        }
        Update: {
          client_id_a?: string
          client_id_b?: string
          created_at?: string
          id?: string
          relationship_label?: string | null
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
        }
        Relationships: [
          {
            foreignKeyName: "client_relationships_client_id_a_fkey"
            columns: ["client_id_a"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_relationships_client_id_b_fkey"
            columns: ["client_id_b"]
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
          country_region: string | null
          created_at: string
          description: string | null
          entry_type: string | null
          id: string
          image_url: string | null
          issue_date: string | null
          passport_id: string | null
          validity_date: string | null
          visa_number: string | null
          visa_type: string
        }
        Insert: {
          client_id?: string | null
          country_region?: string | null
          created_at?: string
          description?: string | null
          entry_type?: string | null
          id?: string
          image_url?: string | null
          issue_date?: string | null
          passport_id?: string | null
          validity_date?: string | null
          visa_number?: string | null
          visa_type: string
        }
        Update: {
          client_id?: string | null
          country_region?: string | null
          created_at?: string
          description?: string | null
          entry_type?: string | null
          id?: string
          image_url?: string | null
          issue_date?: string | null
          passport_id?: string | null
          validity_date?: string | null
          visa_number?: string | null
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
          desired_destinations: string[] | null
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
          desired_destinations?: string[] | null
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
          desired_destinations?: string[] | null
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
      continent_countries: {
        Row: {
          continent_id: string
          country_id: string
          created_at: string
          id: string
        }
        Insert: {
          continent_id: string
          country_id: string
          created_at?: string
          id?: string
        }
        Update: {
          continent_id?: string
          country_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continent_countries_continent_id_fkey"
            columns: ["continent_id"]
            isOneToOne: false
            referencedRelation: "continents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continent_countries_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      continents: {
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
      custom_destination_items: {
        Row: {
          created_at: string
          custom_destination_id: string
          id: string
          item_id: string
          item_type: string
        }
        Insert: {
          created_at?: string
          custom_destination_id: string
          id?: string
          item_id: string
          item_type: string
        }
        Update: {
          created_at?: string
          custom_destination_id?: string
          id?: string
          item_id?: string
          item_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_destination_items_custom_destination_id_fkey"
            columns: ["custom_destination_id"]
            isOneToOne: false
            referencedRelation: "custom_destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_destinations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          account_nature: string
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_nature?: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          account_nature?: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
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
          is_reconciled: boolean
          observations: string | null
          party_name: string | null
          payment_account: string | null
          quote_id: string | null
          status: string | null
          type: string
          virtual_account_owner: string | null
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
          is_reconciled?: boolean
          observations?: string | null
          party_name?: string | null
          payment_account?: string | null
          quote_id?: string | null
          status?: string | null
          type: string
          virtual_account_owner?: string | null
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
          is_reconciled?: boolean
          observations?: string | null
          party_name?: string | null
          payment_account?: string | null
          quote_id?: string | null
          status?: string | null
          type?: string
          virtual_account_owner?: string | null
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
          login_username: string | null
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
          login_username?: string | null
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
          login_username?: string | null
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
          relationship_type: string | null
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
          relationship_type?: string | null
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
          relationship_type?: string | null
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
          address_complement: string | null
          address_number: string | null
          address_street: string | null
          avatar_url: string | null
          cep: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          health_plan: string | null
          id: string
          neighborhood: string | null
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_complement?: string | null
          address_number?: string | null
          address_street?: string | null
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          health_plan?: string | null
          id?: string
          neighborhood?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_complement?: string | null
          address_number?: string | null
          address_street?: string | null
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          health_plan?: string | null
          id?: string
          neighborhood?: string | null
          phone?: string | null
          state?: string | null
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
      quote_history: {
        Row: {
          action: string
          created_at: string
          description: string | null
          details: Json | null
          id: string
          quote_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          details?: Json | null
          id?: string
          quote_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          details?: Json | null
          id?: string
          quote_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          description: string | null
          details: Json | null
          id: string
          item_type: string
          quote_id: string
          sort_order: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          details?: Json | null
          id?: string
          item_type: string
          quote_id: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          details?: Json | null
          id?: string
          item_type?: string
          quote_id?: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
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
          conclusion_type: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          departure_airport: string | null
          departure_city: string | null
          destination: string | null
          destination_images: string[] | null
          details: string | null
          hotel_options: string | null
          id: string
          notes: string | null
          other_info: string | null
          payment_terms: string | null
          price_breakdown: Json | null
          quote_validity: string | null
          stage: Database["public"]["Enums"]["quote_stage"]
          terms_conditions: string | null
          title: string | null
          total_value: number | null
          travel_date_end: string | null
          travel_date_start: string | null
          updated_at: string
        }
        Insert: {
          airline_options?: string | null
          assigned_to?: string | null
          client_id?: string | null
          conclusion_type?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          departure_airport?: string | null
          departure_city?: string | null
          destination?: string | null
          destination_images?: string[] | null
          details?: string | null
          hotel_options?: string | null
          id?: string
          notes?: string | null
          other_info?: string | null
          payment_terms?: string | null
          price_breakdown?: Json | null
          quote_validity?: string | null
          stage?: Database["public"]["Enums"]["quote_stage"]
          terms_conditions?: string | null
          title?: string | null
          total_value?: number | null
          travel_date_end?: string | null
          travel_date_start?: string | null
          updated_at?: string
        }
        Update: {
          airline_options?: string | null
          assigned_to?: string | null
          client_id?: string | null
          conclusion_type?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          departure_airport?: string | null
          departure_city?: string | null
          destination?: string | null
          destination_images?: string[] | null
          details?: string | null
          hotel_options?: string | null
          id?: string
          notes?: string | null
          other_info?: string | null
          payment_terms?: string | null
          price_breakdown?: Json | null
          quote_validity?: string | null
          stage?: Database["public"]["Enums"]["quote_stage"]
          terms_conditions?: string | null
          title?: string | null
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
      sales: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          destination: string | null
          id: string
          notes: string | null
          quote_id: string | null
          stage: string
          ticket_issued_at: string | null
          ticket_number: string | null
          total_value: number | null
          travel_date_end: string | null
          travel_date_start: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          notes?: string | null
          quote_id?: string | null
          stage?: string
          ticket_issued_at?: string | null
          ticket_number?: string | null
          total_value?: number | null
          travel_date_end?: string | null
          travel_date_start?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          notes?: string | null
          quote_id?: string | null
          stage?: string
          ticket_issued_at?: string | null
          ticket_number?: string | null
          total_value?: number | null
          travel_date_end?: string | null
          travel_date_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
      supplier_emails: {
        Row: {
          created_at: string
          description: string | null
          email: string
          id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          email: string
          id?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          email?: string
          id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_emails_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_phones: {
        Row: {
          country_code: string
          created_at: string
          description: string | null
          id: string
          phone: string
          supplier_id: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          description?: string | null
          id?: string
          phone: string
          supplier_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          description?: string | null
          id?: string
          phone?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_phones_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_complement: string | null
          address_number: string | null
          address_street: string | null
          category: string[] | null
          cep: string | null
          city: string | null
          contact_person: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          document_number: string | null
          email: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          phone: string | null
          state: string | null
          supplier_type: string | null
          trade_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_complement?: string | null
          address_number?: string | null
          address_street?: string | null
          category?: string[] | null
          cep?: string | null
          city?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          document_number?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          state?: string | null
          supplier_type?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_complement?: string | null
          address_number?: string | null
          address_street?: string | null
          category?: string[] | null
          cep?: string | null
          city?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          document_number?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          state?: string | null
          supplier_type?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_contract_compensations: {
        Row: {
          amount: number | null
          contract_id: string
          created_at: string
          description: string
          end_date: string | null
          id: string
          start_date: string
        }
        Insert: {
          amount?: number | null
          contract_id: string
          created_at?: string
          description: string
          end_date?: string | null
          id?: string
          start_date: string
        }
        Update: {
          amount?: number | null
          contract_id?: string
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contract_compensations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "user_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contract_documents: {
        Row: {
          contract_id: string
          created_at: string
          file_name: string
          file_url: string
          id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          file_name: string
          file_url: string
          id?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "user_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contracts: {
        Row: {
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          signed_contract_url: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          signed_contract_url?: string | null
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          signed_contract_url?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      contract_type:
        | "clt"
        | "pj"
        | "estagio"
        | "temporario"
        | "freelancer"
        | "outro"
      financial_party_type: "individual" | "company"
      quote_stage:
        | "new"
        | "sent"
        | "negotiation"
        | "confirmed"
        | "issued"
        | "completed"
        | "post_sale"
      relationship_type:
        | "spouse"
        | "child"
        | "parent"
        | "employee"
        | "partner"
        | "sibling"
        | "other"
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
      contract_type: [
        "clt",
        "pj",
        "estagio",
        "temporario",
        "freelancer",
        "outro",
      ],
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
      relationship_type: [
        "spouse",
        "child",
        "parent",
        "employee",
        "partner",
        "sibling",
        "other",
      ],
      travel_profile: ["economic", "opportunity", "sophisticated"],
    },
  },
} as const
