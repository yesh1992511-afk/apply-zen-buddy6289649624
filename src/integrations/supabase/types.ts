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
      applications: {
        Row: {
          applied_at: string | null
          attempts: number | null
          cover_letter_id: string | null
          created_at: string
          finished_at: string | null
          id: string
          job_id: string
          last_error: string | null
          notes: string | null
          queued_at: string
          resume_id: string | null
          screenshots: string[] | null
          started_at: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          attempts?: number | null
          cover_letter_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          job_id: string
          last_error?: string | null
          notes?: string | null
          queued_at?: string
          resume_id?: string | null
          screenshots?: string[] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          attempts?: number | null
          cover_letter_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          job_id?: string
          last_error?: string | null
          notes?: string | null
          queued_at?: string
          resume_id?: string | null
          screenshots?: string[] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          errors: number | null
          finished_at: string | null
          id: string
          items_in: number | null
          items_out: number | null
          kind: string
          metadata: Json | null
          source_key: string | null
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          user_id: string
        }
        Insert: {
          errors?: number | null
          finished_at?: string | null
          id?: string
          items_in?: number | null
          items_out?: number | null
          kind: string
          metadata?: Json | null
          source_key?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          user_id: string
        }
        Update: {
          errors?: number | null
          finished_at?: string | null
          id?: string
          items_in?: number | null
          items_out?: number | null
          kind?: string
          metadata?: Json | null
          source_key?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          user_id?: string
        }
        Relationships: []
      }
      automation_settings: {
        Row: {
          active_filter_id: string | null
          aggressiveness: number
          ai_reasoning_model: string | null
          ai_resume_model: string | null
          captcha_provider: string | null
          created_at: string
          daily_end: string | null
          daily_start: string | null
          enabled: boolean
          exclude_companies: string[] | null
          max_applies_per_day: number
          parallelism: number
          proxy_provider: string | null
          run_24_7: boolean
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_filter_id?: string | null
          aggressiveness?: number
          ai_reasoning_model?: string | null
          ai_resume_model?: string | null
          captcha_provider?: string | null
          created_at?: string
          daily_end?: string | null
          daily_start?: string | null
          enabled?: boolean
          exclude_companies?: string[] | null
          max_applies_per_day?: number
          parallelism?: number
          proxy_provider?: string | null
          run_24_7?: boolean
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_filter_id?: string | null
          aggressiveness?: number
          ai_reasoning_model?: string | null
          ai_resume_model?: string | null
          captcha_provider?: string | null
          created_at?: string
          daily_end?: string | null
          daily_start?: string | null
          enabled?: boolean
          exclude_companies?: string[] | null
          max_applies_per_day?: number
          parallelism?: number
          proxy_provider?: string | null
          run_24_7?: boolean
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      educations: {
        Row: {
          created_at: string
          degree: string | null
          end_date: string | null
          field: string | null
          gpa: string | null
          id: string
          notes: string | null
          school: string
          sort_order: number | null
          start_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          degree?: string | null
          end_date?: string | null
          field?: string | null
          gpa?: string | null
          id?: string
          notes?: string | null
          school: string
          sort_order?: number | null
          start_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          degree?: string | null
          end_date?: string | null
          field?: string | null
          gpa?: string | null
          id?: string
          notes?: string | null
          school?: string
          sort_order?: number | null
          start_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      experiences: {
        Row: {
          bullets: string[] | null
          company: string
          created_at: string
          end_date: string | null
          id: string
          is_current: boolean | null
          location: string | null
          sort_order: number | null
          start_date: string | null
          tech: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bullets?: string[] | null
          company: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          location?: string | null
          sort_order?: number | null
          start_date?: string | null
          tech?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bullets?: string[] | null
          company?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          location?: string | null
          sort_order?: number | null
          start_date?: string | null
          tech?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      filters: {
        Row: {
          created_at: string
          employment_type: string[] | null
          exclude_companies: string[] | null
          exclude_keywords: string[] | null
          hybrid_ok: boolean | null
          id: string
          is_default: boolean | null
          keywords: string[] | null
          locations: string[] | null
          min_score: number | null
          name: string
          onsite_ok: boolean | null
          posted_within_hours: number | null
          remote_only: boolean | null
          salary_min: number | null
          seniority: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employment_type?: string[] | null
          exclude_companies?: string[] | null
          exclude_keywords?: string[] | null
          hybrid_ok?: boolean | null
          id?: string
          is_default?: boolean | null
          keywords?: string[] | null
          locations?: string[] | null
          min_score?: number | null
          name: string
          onsite_ok?: boolean | null
          posted_within_hours?: number | null
          remote_only?: boolean | null
          salary_min?: number | null
          seniority?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employment_type?: string[] | null
          exclude_companies?: string[] | null
          exclude_keywords?: string[] | null
          hybrid_ok?: boolean | null
          id?: string
          is_default?: boolean | null
          keywords?: string[] | null
          locations?: string[] | null
          min_score?: number | null
          name?: string
          onsite_ok?: boolean | null
          posted_within_hours?: number | null
          remote_only?: boolean | null
          salary_min?: number | null
          seniority?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_credentials: {
        Row: {
          app_password: string
          created_at: string
          email: string
          id: string
          imap_host: string
          imap_port: number
          last_error: string | null
          smtp_host: string
          smtp_port: number
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          app_password: string
          created_at?: string
          email: string
          id?: string
          imap_host?: string
          imap_port?: number
          last_error?: string | null
          smtp_host?: string
          smtp_port?: number
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          app_password?: string
          created_at?: string
          email?: string
          id?: string
          imap_host?: string
          imap_port?: number
          last_error?: string | null
          smtp_host?: string
          smtp_port?: number
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          company: string
          created_at: string
          dedupe_hash: string
          description: string | null
          description_html: string | null
          employment_type: string | null
          id: string
          location: string | null
          matched: boolean | null
          matched_filter_ids: string[] | null
          posted_at: string | null
          raw: Json | null
          remote: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          score: number | null
          scraped_at: string
          seniority: string | null
          source_job_id: string | null
          source_key: string
          status: string | null
          title: string
          url: string
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          dedupe_hash: string
          description?: string | null
          description_html?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          matched?: boolean | null
          matched_filter_ids?: string[] | null
          posted_at?: string | null
          raw?: Json | null
          remote?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          score?: number | null
          scraped_at?: string
          seniority?: string | null
          source_job_id?: string | null
          source_key: string
          status?: string | null
          title: string
          url: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          dedupe_hash?: string
          description?: string | null
          description_html?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          matched?: boolean | null
          matched_filter_ids?: string[] | null
          posted_at?: string | null
          raw?: Json | null
          remote?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          score?: number | null
          scraped_at?: string
          seniority?: string | null
          source_job_id?: string | null
          source_key?: string
          status?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      logs: {
        Row: {
          application_id: string | null
          id: number
          job_id: string | null
          level: Database["public"]["Enums"]["log_level"]
          message: string
          metadata: Json | null
          run_id: string | null
          scope: string | null
          ts: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          id?: number
          job_id?: string | null
          level?: Database["public"]["Enums"]["log_level"]
          message: string
          metadata?: Json | null
          run_id?: string | null
          scope?: string | null
          ts?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          id?: number
          job_id?: string | null
          level?: Database["public"]["Enums"]["log_level"]
          message?: string
          metadata?: Json | null
          run_id?: string | null
          scope?: string | null
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          application_id: string | null
          body: string | null
          created_at: string
          id: string
          job_id: string | null
          kind: string
          last_error: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind: string
          last_error?: string | null
          metadata?: Json | null
          recipient_email: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          last_error?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          daily_summary_enabled: boolean
          daily_summary_time: string
          high_score_threshold: number
          last_daily_summary_date: string | null
          last_worker_offline_alert: string | null
          notify_apply_failed: boolean
          notify_high_score: boolean
          notify_manual_review: boolean
          notify_worker_offline: boolean
          recipient_email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_summary_enabled?: boolean
          daily_summary_time?: string
          high_score_threshold?: number
          last_daily_summary_date?: string | null
          last_worker_offline_alert?: string | null
          notify_apply_failed?: boolean
          notify_high_score?: boolean
          notify_manual_review?: boolean
          notify_worker_offline?: boolean
          recipient_email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_summary_enabled?: boolean
          daily_summary_time?: string
          high_score_threshold?: number
          last_daily_summary_date?: string | null
          last_worker_offline_alert?: string | null
          notify_apply_failed?: boolean
          notify_high_score?: boolean
          notify_manual_review?: boolean
          notify_worker_offline?: boolean
          recipient_email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile: {
        Row: {
          apply_email: string | null
          apply_password_set: boolean | null
          cover_letter_tone: string | null
          created_at: string
          email: string | null
          full_name: string | null
          github_url: string | null
          headline: string | null
          linkedin_url: string | null
          location: string | null
          phone: string | null
          portfolio_url: string | null
          preferred_locations: string[] | null
          remote_preference: string | null
          requires_sponsorship: boolean | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          summary: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          willing_to_relocate: boolean | null
          work_authorization: string | null
          years_experience: number | null
        }
        Insert: {
          apply_email?: string | null
          apply_password_set?: boolean | null
          cover_letter_tone?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          github_url?: string | null
          headline?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          portfolio_url?: string | null
          preferred_locations?: string[] | null
          remote_preference?: string | null
          requires_sponsorship?: boolean | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          summary?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          willing_to_relocate?: boolean | null
          work_authorization?: string | null
          years_experience?: number | null
        }
        Update: {
          apply_email?: string | null
          apply_password_set?: boolean | null
          cover_letter_tone?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          github_url?: string | null
          headline?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          portfolio_url?: string | null
          preferred_locations?: string[] | null
          remote_preference?: string | null
          requires_sponsorship?: boolean | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          summary?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          willing_to_relocate?: boolean | null
          work_authorization?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          bullets: string[] | null
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number | null
          tech: string[] | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          bullets?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
          tech?: string[] | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          bullets?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          tech?: string[] | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          application_id: string | null
          created_at: string
          id: string
          is_default: boolean | null
          kind: string
          markers: Json | null
          name: string
          pdf_storage_path: string | null
          storage_path: string | null
          tex_content: string | null
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          kind?: string
          markers?: Json | null
          name: string
          pdf_storage_path?: string | null
          storage_path?: string | null
          tex_content?: string | null
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          kind?: string
          markers?: Json | null
          name?: string
          pdf_storage_path?: string | null
          storage_path?: string | null
          tex_content?: string | null
          user_id?: string
        }
        Relationships: []
      }
      secrets_meta: {
        Row: {
          category: string | null
          id: string
          last_checked: string | null
          name: string
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          category?: string | null
          id?: string
          last_checked?: string | null
          name: string
          notes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          category?: string | null
          id?: string
          last_checked?: string | null
          name?: string
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          proficiency: string | null
          sort_order: number | null
          user_id: string
          years: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          proficiency?: string | null
          sort_order?: number | null
          user_id: string
          years?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          proficiency?: string | null
          sort_order?: number | null
          user_id?: string
          years?: number | null
        }
        Relationships: []
      }
      sources: {
        Row: {
          cadence_minutes: number
          config: Json
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          key: string
          kind: Database["public"]["Enums"]["source_kind"]
          last_error: string | null
          last_run_at: string | null
          last_run_count: number | null
          last_run_status: Database["public"]["Enums"]["run_status"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cadence_minutes?: number
          config?: Json
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          key: string
          kind: Database["public"]["Enums"]["source_kind"]
          last_error?: string | null
          last_run_at?: string | null
          last_run_count?: number | null
          last_run_status?: Database["public"]["Enums"]["run_status"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cadence_minutes?: number
          config?: Json
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["source_kind"]
          last_error?: string | null
          last_run_at?: string | null
          last_run_count?: number | null
          last_run_status?: Database["public"]["Enums"]["run_status"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          kind: string
          metadata: Json | null
          provider: string
          units: number
          user_id: string
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: string
          kind: string
          metadata?: Json | null
          provider: string
          units?: number
          user_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json | null
          provider?: string
          units?: number
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      worker_commands: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          kind: string
          last_error: string | null
          payload: Json
          result: Json | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          kind: string
          last_error?: string | null
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      worker_heartbeat: {
        Row: {
          last_seen: string | null
          metadata: Json | null
          user_id: string
          version: string | null
        }
        Insert: {
          last_seen?: string | null
          metadata?: Json | null
          user_id: string
          version?: string | null
        }
        Update: {
          last_seen?: string | null
          metadata?: Json | null
          user_id?: string
          version?: string | null
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
      app_role: "owner"
      application_status:
        | "queued"
        | "applying"
        | "applied"
        | "failed"
        | "needs_review"
        | "skipped"
      log_level: "debug" | "info" | "warn" | "error"
      run_status: "running" | "succeeded" | "failed"
      source_kind: "apify" | "rest" | "board"
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
      app_role: ["owner"],
      application_status: [
        "queued",
        "applying",
        "applied",
        "failed",
        "needs_review",
        "skipped",
      ],
      log_level: ["debug", "info", "warn", "error"],
      run_status: ["running", "succeeded", "failed"],
      source_kind: ["apify", "rest", "board"],
    },
  },
} as const
