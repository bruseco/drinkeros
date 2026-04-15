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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      certificates: {
        Row: {
          certificate_type: string
          completed_at: string
          created_at: string
          id: string
          reference_id: string
          reference_name: string
          student_cpf: string | null
          student_name: string | null
          user_id: string
          verification_code: string
          workload_seconds: number
        }
        Insert: {
          certificate_type: string
          completed_at?: string
          created_at?: string
          id?: string
          reference_id: string
          reference_name: string
          student_cpf?: string | null
          student_name?: string | null
          user_id: string
          verification_code: string
          workload_seconds?: number
        }
        Update: {
          certificate_type?: string
          completed_at?: string
          created_at?: string
          id?: string
          reference_id?: string
          reference_name?: string
          student_cpf?: string | null
          student_name?: string | null
          user_id?: string
          verification_code?: string
          workload_seconds?: number
        }
        Relationships: []
      }
      collection_recipes: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          recipe_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          recipe_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_recipes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      combo_courses: {
        Row: {
          combo_id: string
          course_id: string
          created_at: string
          display_order: number | null
          id: string
        }
        Insert: {
          combo_id: string
          course_id: string
          created_at?: string
          display_order?: number | null
          id?: string
        }
        Update: {
          combo_id?: string
          course_id?: string
          created_at?: string
          display_order?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_courses_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_ebooks: {
        Row: {
          combo_id: string
          created_at: string
          display_order: number | null
          ebook_id: string
          id: string
        }
        Insert: {
          combo_id: string
          created_at?: string
          display_order?: number | null
          ebook_id: string
          id?: string
        }
        Update: {
          combo_id?: string
          created_at?: string
          display_order?: number | null
          ebook_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_ebooks_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_ebooks_ebook_id_fkey"
            columns: ["ebook_id"]
            isOneToOne: false
            referencedRelation: "ebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number | null
          hotmart_product_code: string | null
          id: string
          includes_exclusive_access: boolean
          is_active: boolean
          is_available_for_sale: boolean
          is_free: boolean
          is_lifetime: boolean
          name: string
          price: number | null
          slug: string
          updated_at: string
          woocommerce_product_id: string | null
          workload_hours: number | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          hotmart_product_code?: string | null
          id?: string
          includes_exclusive_access?: boolean
          is_active?: boolean
          is_available_for_sale?: boolean
          is_free?: boolean
          is_lifetime?: boolean
          name: string
          price?: number | null
          slug: string
          updated_at?: string
          woocommerce_product_id?: string | null
          workload_hours?: number | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          hotmart_product_code?: string | null
          id?: string
          includes_exclusive_access?: boolean
          is_active?: boolean
          is_available_for_sale?: boolean
          is_free?: boolean
          is_lifetime?: boolean
          name?: string
          price?: number | null
          slug?: string
          updated_at?: string
          woocommerce_product_id?: string | null
          workload_hours?: number | null
        }
        Relationships: []
      }
      course_packages: {
        Row: {
          course_id: string
          created_at: string
          display_order: number | null
          id: string
          package_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          display_order?: number | null
          id?: string
          package_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          display_order?: number | null
          id?: string
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_packages_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          certificate_bg_url: string | null
          certificate_enabled: boolean
          certificate_text_color: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number | null
          hotmart_product_code: string | null
          id: string
          is_active: boolean
          is_available_for_sale: boolean
          is_free: boolean
          name: string
          slug: string
          updated_at: string
          woocommerce_product_id: string | null
          workload_hours: number | null
        }
        Insert: {
          certificate_bg_url?: string | null
          certificate_enabled?: boolean
          certificate_text_color?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          hotmart_product_code?: string | null
          id?: string
          is_active?: boolean
          is_available_for_sale?: boolean
          is_free?: boolean
          name: string
          slug: string
          updated_at?: string
          woocommerce_product_id?: string | null
          workload_hours?: number | null
        }
        Update: {
          certificate_bg_url?: string | null
          certificate_enabled?: boolean
          certificate_text_color?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          hotmart_product_code?: string | null
          id?: string
          is_active?: boolean
          is_available_for_sale?: boolean
          is_free?: boolean
          name?: string
          slug?: string
          updated_at?: string
          woocommerce_product_id?: string | null
          workload_hours?: number | null
        }
        Relationships: []
      }
      crm_automation_settings: {
        Row: {
          id: string
          nurturing_days: number
          nurturing_enabled: boolean
          nurturing_stage: string
          updated_at: string
        }
        Insert: {
          id?: string
          nurturing_days?: number
          nurturing_enabled?: boolean
          nurturing_stage?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nurturing_days?: number
          nurturing_enabled?: boolean
          nurturing_stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          lead_id: string
          metadata: Json | null
        }
        Insert: {
          activity_type?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          lead_id: string
          metadata?: Json | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          lead_id: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          lead_id: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          lead_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_to: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          funnel: string
          id: string
          lost_reason: string | null
          metadata: Json | null
          name: string
          phone: string | null
          product_id: string | null
          product_name: string | null
          product_type: string | null
          profile_id: string | null
          recovery_url: string | null
          sale_value: number | null
          source: string
          stage: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          funnel?: string
          id?: string
          lost_reason?: string | null
          metadata?: Json | null
          name: string
          phone?: string | null
          product_id?: string | null
          product_name?: string | null
          product_type?: string | null
          profile_id?: string | null
          recovery_url?: string | null
          sale_value?: number | null
          source?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          funnel?: string
          id?: string
          lost_reason?: string | null
          metadata?: Json | null
          name?: string
          phone?: string | null
          product_id?: string | null
          product_name?: string | null
          product_type?: string | null
          profile_id?: string | null
          recovery_url?: string | null
          sale_value?: number | null
          source?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      cs_reports: {
        Row: {
          alerts: Json
          created_at: string
          id: string
          metrics: Json
          report_date: string
          report_text: string
          status: string
        }
        Insert: {
          alerts?: Json
          created_at?: string
          id?: string
          metrics?: Json
          report_date?: string
          report_text: string
          status?: string
        }
        Update: {
          alerts?: Json
          created_at?: string
          id?: string
          metrics?: Json
          report_date?: string
          report_text?: string
          status?: string
        }
        Relationships: []
      }
      cs_timeline_events: {
        Row: {
          channel: string
          created_at: string
          event_subtype: string
          event_type: string
          id: string
          metadata: Json | null
          phone: string | null
          summary: string
          user_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          event_subtype?: string
          event_type: string
          id?: string
          metadata?: Json | null
          phone?: string | null
          summary: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          event_subtype?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          phone?: string | null
          summary?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ebooks: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number | null
          file_url: string | null
          id: string
          is_active: boolean
          name: string
          price: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      email_settings: {
        Row: {
          id: string
          reply_to_email: string | null
          sender_email: string
          sender_name: string
          updated_at: string
        }
        Insert: {
          id?: string
          reply_to_email?: string | null
          sender_email?: string
          sender_name?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reply_to_email?: string | null
          sender_email?: string
          sender_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          available_variables: string[]
          created_at: string
          description: string | null
          html_body: string
          id: string
          name: string
          slug: string
          subject: string
          updated_at: string
        }
        Insert: {
          available_variables?: string[]
          created_at?: string
          description?: string | null
          html_body: string
          id?: string
          name: string
          slug: string
          subject: string
          updated_at?: string
        }
        Update: {
          available_variables?: string[]
          created_at?: string
          description?: string | null
          html_body?: string
          id?: string
          name?: string
          slug?: string
          subject?: string
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
      exclusive_categories: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number | null
          feature_key: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          feature_key?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          feature_key?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      exclusive_posts: {
        Row: {
          category_id: string | null
          characteristics: string[] | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          ingredients: string[] | null
          instructions: string | null
          is_published: boolean
          title: string
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          category_id?: string | null
          characteristics?: string[] | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          ingredients?: string[] | null
          instructions?: string | null
          is_published?: boolean
          title: string
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          category_id?: string | null
          characteristics?: string[] | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          ingredients?: string[] | null
          instructions?: string | null
          is_published?: boolean
          title?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exclusive_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "exclusive_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          sent_by: string
          sent_count: number | null
          target_package_id: string | null
          target_type: string
          target_user_ids: string[] | null
          title: string
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sent_by: string
          sent_count?: number | null
          target_package_id?: string | null
          target_type?: string
          target_user_ids?: string[] | null
          title: string
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sent_by?: string
          sent_count?: number | null
          target_package_id?: string | null
          target_type?: string
          target_user_ids?: string[] | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_target_package_id_fkey"
            columns: ["target_package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_followup_logs: {
        Row: {
          created_at: string
          email: string | null
          email_sent: boolean
          id: string
          phone: string | null
          user_id: string
          whatsapp_sent: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_sent?: boolean
          id?: string
          phone?: string | null
          user_id: string
          whatsapp_sent?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          email_sent?: boolean
          id?: string
          phone?: string | null
          user_id?: string
          whatsapp_sent?: boolean
        }
        Relationships: []
      }
      onboarding_reminder_settings: {
        Row: {
          id: string
          inactive_days: number
          is_enabled: boolean
          second_reminder_days: number
          second_reminder_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          inactive_days?: number
          is_enabled?: boolean
          second_reminder_days?: number
          second_reminder_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          inactive_days?: number
          is_enabled?: boolean
          second_reminder_days?: number
          second_reminder_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number | null
          hotmart_product_code: string | null
          id: string
          is_active: boolean | null
          is_available_for_sale: boolean
          is_free: boolean
          lesson_order: string
          name: string
          price: number | null
          slug: string
          updated_at: string
          woocommerce_product_id: string | null
          workload_hours: number | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          hotmart_product_code?: string | null
          id?: string
          is_active?: boolean | null
          is_available_for_sale?: boolean
          is_free?: boolean
          lesson_order?: string
          name: string
          price?: number | null
          slug: string
          updated_at?: string
          woocommerce_product_id?: string | null
          workload_hours?: number | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          hotmart_product_code?: string | null
          id?: string
          is_active?: boolean | null
          is_available_for_sale?: boolean
          is_free?: boolean
          lesson_order?: string
          name?: string
          price?: number | null
          slug?: string
          updated_at?: string
          woocommerce_product_id?: string | null
          workload_hours?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpf: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_admin: boolean | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id?: string
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
      recipe_materials: {
        Row: {
          created_at: string
          display_order: number
          file_url: string
          id: string
          name: string
          recipe_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          file_url: string
          id?: string
          name: string
          recipe_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          file_url?: string
          id?: string
          name?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_materials_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_packages: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          package_id: string
          recipe_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          package_id: string
          recipe_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          package_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_packages_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_views: {
        Row: {
          completed: boolean
          id: string
          recipe_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          completed?: boolean
          id?: string
          recipe_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          completed?: boolean
          id?: string
          recipe_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_views_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          id: string
          image_url: string | null
          ingredients: string | null
          instructions: string | null
          material_url: string | null
          name: string
          notes_status: string | null
          servings: string | null
          status: string | null
          transcript: string | null
          transcript_status: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          material_url?: string | null
          name: string
          notes_status?: string | null
          servings?: string | null
          status?: string | null
          transcript?: string | null
          transcript_status?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          material_url?: string | null
          name?: string
          notes_status?: string | null
          servings?: string | null
          status?: string | null
          transcript?: string | null
          transcript_status?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      redirect_links: {
        Row: {
          click_count: number
          code: string
          created_at: string
          destination_url: string
          id: string
          last_clicked_at: string | null
          product_name: string | null
          source: string
        }
        Insert: {
          click_count?: number
          code: string
          created_at?: string
          destination_url: string
          id?: string
          last_clicked_at?: string | null
          product_name?: string | null
          source?: string
        }
        Update: {
          click_count?: number
          code?: string
          created_at?: string
          destination_url?: string
          id?: string
          last_clicked_at?: string | null
          product_name?: string | null
          source?: string
        }
        Relationships: []
      }
      shopping_list_items: {
        Row: {
          created_at: string
          id: string
          is_checked: boolean | null
          item_text: string
          recipe_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_checked?: boolean | null
          item_text: string
          recipe_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_checked?: boolean | null
          item_text?: string
          recipe_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      study_reminder_settings: {
        Row: {
          id: string
          inactive_days: number
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          inactive_days?: number
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          inactive_days?: number
          is_enabled?: boolean
          updated_at?: string
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
      upsell_email_logs: {
        Row: {
          body_html: string | null
          channel: string
          id: string
          sent_at: string | null
          sequence_id: string
          status: string
          step: number
          subject: string | null
        }
        Insert: {
          body_html?: string | null
          channel?: string
          id?: string
          sent_at?: string | null
          sequence_id: string
          status?: string
          step: number
          subject?: string | null
        }
        Update: {
          body_html?: string | null
          channel?: string
          id?: string
          sent_at?: string | null
          sequence_id?: string
          status?: string
          step?: number
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upsell_email_logs_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "upsell_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      upsell_product_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          offer_product_id: string
          offer_product_type: string
          priority: number
          trigger_product_id: string
          trigger_product_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          offer_product_id: string
          offer_product_type: string
          priority?: number
          trigger_product_id: string
          trigger_product_type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          offer_product_id?: string
          offer_product_type?: string
          priority?: number
          trigger_product_id?: string
          trigger_product_type?: string
        }
        Relationships: []
      }
      upsell_sales_page_cache: {
        Row: {
          checkout_url: string | null
          created_at: string | null
          id: string
          product_id: string
          product_type: string
          scraped_at: string | null
          scraped_content: string | null
          updated_at: string | null
        }
        Insert: {
          checkout_url?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          product_type: string
          scraped_at?: string | null
          scraped_content?: string | null
          updated_at?: string | null
        }
        Update: {
          checkout_url?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          product_type?: string
          scraped_at?: string | null
          scraped_content?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      upsell_sequences: {
        Row: {
          ai_generated_body: string | null
          ai_generated_subject: string | null
          created_at: string
          emails_sent: number
          id: string
          last_email_at: string | null
          last_whatsapp_at: string | null
          product_id: string
          product_type: string
          status: string
          trigger_module_id: string | null
          updated_at: string
          user_id: string
          whatsapp_sent: number
        }
        Insert: {
          ai_generated_body?: string | null
          ai_generated_subject?: string | null
          created_at?: string
          emails_sent?: number
          id?: string
          last_email_at?: string | null
          last_whatsapp_at?: string | null
          product_id: string
          product_type: string
          status?: string
          trigger_module_id?: string | null
          updated_at?: string
          user_id: string
          whatsapp_sent?: number
        }
        Update: {
          ai_generated_body?: string | null
          ai_generated_subject?: string | null
          created_at?: string
          emails_sent?: number
          id?: string
          last_email_at?: string | null
          last_whatsapp_at?: string | null
          product_id?: string
          product_type?: string
          status?: string
          trigger_module_id?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_sent?: number
        }
        Relationships: []
      }
      upsell_settings: {
        Row: {
          cooldown_days: number
          enrollment_days_trigger: number
          id: string
          is_enabled: boolean
          progress_threshold: number
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_template_name: string
        }
        Insert: {
          cooldown_days?: number
          enrollment_days_trigger?: number
          id?: string
          is_enabled?: boolean
          progress_threshold?: number
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_template_name?: string
        }
        Update: {
          cooldown_days?: number
          enrollment_days_trigger?: number
          id?: string
          is_enabled?: boolean
          progress_threshold?: number
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_template_name?: string
        }
        Relationships: []
      }
      upsell_unsubscribes: {
        Row: {
          id: string
          unsubscribed_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          unsubscribed_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          unsubscribed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_combos: {
        Row: {
          combo_id: string
          expires_at: string | null
          id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          combo_id: string
          expires_at?: string | null
          id?: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          combo_id?: string
          expires_at?: string | null
          id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_combos_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_courses: {
        Row: {
          course_id: string
          expires_at: string | null
          id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          expires_at?: string | null
          id?: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          expires_at?: string | null
          id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ebooks: {
        Row: {
          ebook_id: string
          expires_at: string | null
          id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          ebook_id: string
          expires_at?: string | null
          id?: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          ebook_id?: string
          expires_at?: string | null
          id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ebooks_ebook_id_fkey"
            columns: ["ebook_id"]
            isOneToOne: false
            referencedRelation: "ebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_exclusive_access: {
        Row: {
          created_at: string
          feature: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_lifetime_access: {
        Row: {
          granted_at: string
          id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_packages: {
        Row: {
          expires_at: string | null
          hotmart_transaction_id: string | null
          id: string
          package_id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          hotmart_transaction_id?: string | null
          id?: string
          package_id: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          hotmart_transaction_id?: string | null
          id?: string
          package_id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
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
      ux_interactions: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          already_had_access: boolean | null
          created_at: string
          email: string | null
          error_message: string | null
          id: string
          is_new_user: boolean | null
          phone: string | null
          processing_time_ms: number | null
          product_id: string | null
          product_name: string | null
          raw_payload: Json | null
          source: string
          status: string
          status_detail: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          already_had_access?: boolean | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          id?: string
          is_new_user?: boolean | null
          phone?: string | null
          processing_time_ms?: number | null
          product_id?: string | null
          product_name?: string | null
          raw_payload?: Json | null
          source?: string
          status?: string
          status_detail?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          already_had_access?: boolean | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          id?: string
          is_new_user?: boolean | null
          phone?: string | null
          processing_time_ms?: number | null
          product_id?: string | null
          product_name?: string | null
          raw_payload?: Json | null
          source?: string
          status?: string
          status_detail?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      whatsapp_agent_settings: {
        Row: {
          agent_templates: Json | null
          auto_reply_delay_seconds: number
          business_context: string
          escalation_keywords: string[]
          id: string
          is_enabled: boolean
          max_messages_per_conversation: number
          system_prompt: string
          updated_at: string
          whatsapp_welcome_enabled: boolean
        }
        Insert: {
          agent_templates?: Json | null
          auto_reply_delay_seconds?: number
          business_context?: string
          escalation_keywords?: string[]
          id?: string
          is_enabled?: boolean
          max_messages_per_conversation?: number
          system_prompt?: string
          updated_at?: string
          whatsapp_welcome_enabled?: boolean
        }
        Update: {
          agent_templates?: Json | null
          auto_reply_delay_seconds?: number
          business_context?: string
          escalation_keywords?: string[]
          id?: string
          is_enabled?: boolean
          max_messages_per_conversation?: number
          system_prompt?: string
          updated_at?: string
          whatsapp_welcome_enabled?: boolean
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          agent_mode: string
          agent_type: string | null
          contact_name: string | null
          created_at: string
          escalated_at: string | null
          escalation_reason: string | null
          id: string
          last_message_at: string | null
          last_message_direction: string | null
          last_message_preview: string | null
          phone: string
          profile_id: string | null
          status: string
          unread_count: number
          updated_at: string
          zapi_connection_id: string | null
        }
        Insert: {
          agent_mode?: string
          agent_type?: string | null
          contact_name?: string | null
          created_at?: string
          escalated_at?: string | null
          escalation_reason?: string | null
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          phone: string
          profile_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          zapi_connection_id?: string | null
        }
        Update: {
          agent_mode?: string
          agent_type?: string | null
          contact_name?: string | null
          created_at?: string
          escalated_at?: string | null
          escalation_reason?: string | null
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          phone?: string
          profile_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          zapi_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_zapi_connection_id_fkey"
            columns: ["zapi_connection_id"]
            isOneToOne: false
            referencedRelation: "zapi_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          message_type: string
          metadata: Json | null
          status: string
          zapi_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          status?: string
          zapi_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          status?: string
          zapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_send_queue: {
        Row: {
          attempts: number
          context_data: Json | null
          context_type: string
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          message: string
          phone: string
          priority: number
          scheduled_at: string
          sent_at: string | null
          status: string
          zapi_connection_id: string | null
        }
        Insert: {
          attempts?: number
          context_data?: Json | null
          context_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          message: string
          phone: string
          priority?: number
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          zapi_connection_id?: string | null
        }
        Update: {
          attempts?: number
          context_data?: Json | null
          context_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          message?: string
          phone?: string
          priority?: number
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          zapi_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_send_queue_zapi_connection_id_fkey"
            columns: ["zapi_connection_id"]
            isOneToOne: false
            referencedRelation: "zapi_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          business_hours_end: string | null
          business_hours_start: string | null
          id: string
          is_enabled: boolean
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          business_hours_end?: string | null
          business_hours_start?: string | null
          id?: string
          is_enabled?: boolean
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          business_hours_end?: string | null
          business_hours_start?: string | null
          id?: string
          is_enabled?: boolean
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      whatsapp_template_bindings: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          is_active: boolean
          process: string
          template_name: string
          updated_at: string
          variable_map: Json
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          process: string
          template_name: string
          updated_at?: string
          variable_map?: Json
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          process?: string
          template_name?: string
          updated_at?: string
          variable_map?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_template_bindings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "zapi_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          category: string
          components: Json | null
          connection_id: string
          created_at: string | null
          id: string
          language: string
          name: string
          status: string
        }
        Insert: {
          category: string
          components?: Json | null
          connection_id: string
          created_at?: string | null
          id?: string
          language?: string
          name: string
          status?: string
        }
        Update: {
          category?: string
          components?: Json | null
          connection_id?: string
          created_at?: string | null
          id?: string
          language?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "zapi_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_welcome_queue: {
        Row: {
          created_at: string
          credentials_sent: boolean
          email: string
          full_name: string | null
          id: string
          is_new_user: boolean
          phone: string
          processed: boolean
          product_name: string | null
          scheduled_at: string
          temporary_password: string | null
        }
        Insert: {
          created_at?: string
          credentials_sent?: boolean
          email: string
          full_name?: string | null
          id?: string
          is_new_user?: boolean
          phone: string
          processed?: boolean
          product_name?: string | null
          scheduled_at?: string
          temporary_password?: string | null
        }
        Update: {
          created_at?: string
          credentials_sent?: boolean
          email?: string
          full_name?: string | null
          id?: string
          is_new_user?: boolean
          phone?: string
          processed?: boolean
          product_name?: string | null
          scheduled_at?: string
          temporary_password?: string | null
        }
        Relationships: []
      }
      zapi_connections: {
        Row: {
          api_url: string | null
          connection_status: string
          created_at: string
          daily_new_contact_limit: number
          id: string
          instance_id: string | null
          instance_name: string | null
          is_active: boolean
          last_disconnect_reason: string | null
          last_reset_at: string
          last_status_at: string | null
          name: string
          new_contacts_today: number
          phone_number: string
          provider: string
          security_token: string | null
          token: string | null
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          api_url?: string | null
          connection_status?: string
          created_at?: string
          daily_new_contact_limit?: number
          id?: string
          instance_id?: string | null
          instance_name?: string | null
          is_active?: boolean
          last_disconnect_reason?: string | null
          last_reset_at?: string
          last_status_at?: string | null
          name: string
          new_contacts_today?: number
          phone_number: string
          provider?: string
          security_token?: string | null
          token?: string | null
          updated_at?: string
          waba_id?: string | null
        }
        Update: {
          api_url?: string | null
          connection_status?: string
          created_at?: string
          daily_new_contact_limit?: number
          id?: string
          instance_id?: string | null
          instance_name?: string | null
          is_active?: boolean
          last_disconnect_reason?: string | null
          last_reset_at?: string
          last_status_at?: string | null
          name?: string
          new_contacts_today?: number
          phone_number?: string
          provider?: string
          security_token?: string | null
          token?: string | null
          updated_at?: string
          waba_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit: { Args: { _user_id: string }; Returns: boolean }
      claim_whatsapp_queue_items: {
        Args: { batch_size?: number }
        Returns: {
          attempts: number
          context_data: Json | null
          context_type: string
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          message: string
          phone: string
          priority: number
          scheduled_at: string
          sent_at: string | null
          status: string
          zapi_connection_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_send_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_whatsapp_welcome_items: {
        Args: never
        Returns: {
          created_at: string
          credentials_sent: boolean
          email: string
          full_name: string | null
          id: string
          is_new_user: boolean
          phone: string
          processed: boolean
          product_name: string | null
          scheduled_at: string
          temporary_password: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_welcome_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_package_recipe_metadata: {
        Args: { p_package_id: string }
        Returns: {
          display_order: number
          id: string
          image_url: string
          name: string
        }[]
      }
      get_retention_metrics: {
        Args: { p_seven_days_ago: string; p_thirty_days_ago: string }
        Returns: Json
      }
      get_study_reminder_stats: { Args: never; Returns: Json }
      get_ux_metrics: { Args: never; Returns: Json }
      get_zapi_credentials: {
        Args: { p_connection_id: string }
        Returns: {
          api_url: string
          instance_id: string
          instance_name: string
          phone_number: string
          provider: string
          security_token: string
          token: string
        }[]
      }
      has_exclusive_access: {
        Args: { _feature?: string; _user_id: string }
        Returns: boolean
      }
      has_package_access: {
        Args: { _package_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_redirect_click: {
        Args: { link_code: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      search_exclusive_posts: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_published_only?: boolean
          p_term: string
        }
        Returns: {
          characteristics: string[]
          cover_image_url: string
          created_at: string
          description: string
          display_order: number
          id: string
          ingredients: string[]
          instructions: string
          is_published: boolean
          title: string
          total_count: number
          updated_at: string
          youtube_url: string
        }[]
      }
      select_zapi_connection: {
        Args: { p_conversation_id?: string; p_is_new_contact?: boolean }
        Returns: string
      }
    }
    Enums: {
      app_role: "super_admin" | "editor" | "viewer"
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
      app_role: ["super_admin", "editor", "viewer"],
    },
  },
} as const
