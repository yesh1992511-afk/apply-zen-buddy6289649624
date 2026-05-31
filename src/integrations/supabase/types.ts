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
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          purge_after: string
          reason: string | null
          requested_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          purge_after?: string
          reason?: string | null
          requested_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          purge_after?: string
          reason?: string | null
          requested_at?: string
          user_id?: string
        }
        Relationships: []
      }
      application_events: {
        Row: {
          application_id: string
          id: number
          message: string | null
          payload: Json
          phase: Database["public"]["Enums"]["application_phase"]
          screenshot_path: string | null
          status: string | null
          ts: string
          user_id: string
        }
        Insert: {
          application_id: string
          id?: number
          message?: string | null
          payload?: Json
          phase: Database["public"]["Enums"]["application_phase"]
          screenshot_path?: string | null
          status?: string | null
          ts?: string
          user_id: string
        }
        Update: {
          application_id?: string
          id?: number
          message?: string | null
          payload?: Json
          phase?: Database["public"]["Enums"]["application_phase"]
          screenshot_path?: string | null
          status?: string | null
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          applied_at: string | null
          attempts: number | null
          cover_letter_id: string | null
          created_at: string
          dlq_reason: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          job_id: string
          last_error: string | null
          next_retry_at: string | null
          notes: string | null
          phase: Database["public"]["Enums"]["application_phase"]
          queued_at: string
          resume_id: string | null
          retry_count: number
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
          dlq_reason?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_id: string
          last_error?: string | null
          next_retry_at?: string | null
          notes?: string | null
          phase?: Database["public"]["Enums"]["application_phase"]
          queued_at?: string
          resume_id?: string | null
          retry_count?: number
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
          dlq_reason?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_id?: string
          last_error?: string | null
          next_retry_at?: string | null
          notes?: string | null
          phase?: Database["public"]["Enums"]["application_phase"]
          queued_at?: string
          resume_id?: string | null
          retry_count?: number
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
      audit_log: {
        Row: {
          action: string
          actor_role: string | null
          after: Json | null
          before: Json | null
          entity_id: string | null
          entity_type: string
          id: number
          ip: string | null
          metadata: Json
          request_id: string | null
          ts: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: number
          ip?: string | null
          metadata?: Json
          request_id?: string | null
          ts?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: number
          ip?: string | null
          metadata?: Json
          request_id?: string | null
          ts?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          target_country: string
          target_exclude_keywords: string[]
          target_locations: string[]
          target_posted_within_hours: number
          target_titles: string[]
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
          target_country?: string
          target_exclude_keywords?: string[]
          target_locations?: string[]
          target_posted_within_hours?: number
          target_titles?: string[]
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
          target_country?: string
          target_exclude_keywords?: string[]
          target_locations?: string[]
          target_posted_within_hours?: number
          target_titles?: string[]
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      certifications: {
        Row: {
          created_at: string
          credential_id: string | null
          expiry_date: string | null
          id: string
          issued_date: string | null
          issuer: string | null
          name: string
          sort_order: number | null
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id?: string | null
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          issuer?: string | null
          name: string
          sort_order?: number | null
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string | null
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          issuer?: string | null
          name?: string
          sort_order?: number | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cover_letters: {
        Row: {
          body: string
          created_at: string
          id: string
          is_default: boolean
          job_id: string | null
          kind: string
          name: string
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_default?: boolean
          job_id?: string | null
          kind?: string
          name: string
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_default?: boolean
          job_id?: string | null
          kind?: string
          name?: string
          tone?: string | null
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
      error_events: {
        Row: {
          count: number
          fingerprint: string
          first_seen: string
          id: string
          last_seen: string
          message: string
          metadata: Json
          resolved: boolean
          route: string | null
          source: string
          stack: string | null
          user_id: string
        }
        Insert: {
          count?: number
          fingerprint: string
          first_seen?: string
          id?: string
          last_seen?: string
          message: string
          metadata?: Json
          resolved?: boolean
          route?: string | null
          source: string
          stack?: string | null
          user_id: string
        }
        Update: {
          count?: number
          fingerprint?: string
          first_seen?: string
          id?: string
          last_seen?: string
          message?: string
          metadata?: Json
          resolved?: boolean
          route?: string | null
          source?: string
          stack?: string | null
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
      extension_tokens: {
        Row: {
          captures_today: number
          captures_total: number
          created_at: string
          id: string
          label: string
          last_reset_date: string
          last_seen_at: string | null
          revoked_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          captures_today?: number
          captures_total?: number
          created_at?: string
          id?: string
          label?: string
          last_reset_date?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          token: string
          user_id: string
        }
        Update: {
          captures_today?: number
          captures_total?: number
          created_at?: string
          id?: string
          label?: string
          last_reset_date?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          payload: Json
          rollout_pct: number
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          payload?: Json
          rollout_pct?: number
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          payload?: Json
          rollout_pct?: number
          updated_at?: string
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
      jd_analysis_cache: {
        Row: {
          analysis: Json
          cost_usd: number
          created_at: string
          dedupe_hash: string
          hit_count: number
          id: string
          last_used_at: string
          model: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          analysis: Json
          cost_usd?: number
          created_at?: string
          dedupe_hash: string
          hit_count?: number
          id?: string
          last_used_at?: string
          model: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          analysis?: Json
          cost_usd?: number
          created_at?: string
          dedupe_hash?: string
          hit_count?: number
          id?: string
          last_used_at?: string
          model?: string
          tokens_in?: number | null
          tokens_out?: number | null
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
          score_breakdown: Json | null
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
          score_breakdown?: Json | null
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
          score_breakdown?: Json | null
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
      languages: {
        Row: {
          created_at: string
          id: string
          name: string
          proficiency: string | null
          sort_order: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          proficiency?: string | null
          sort_order?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          proficiency?: string | null
          sort_order?: number | null
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
          idempotency_key: string | null
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
          idempotency_key?: string | null
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
          idempotency_key?: string | null
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
      plans: {
        Row: {
          active: boolean
          admin_console: boolean
          cookie_sync: boolean
          currency: string
          key: string
          max_applies_per_day: number
          max_sources: number
          name: string
          price_cents: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          admin_console?: boolean
          cookie_sync?: boolean
          currency?: string
          key: string
          max_applies_per_day?: number
          max_sources?: number
          name: string
          price_cents?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          admin_console?: boolean
          cookie_sync?: boolean
          currency?: string
          key?: string
          max_applies_per_day?: number
          max_sources?: number
          name?: string
          price_cents?: number
          sort_order?: number
        }
        Relationships: []
      }
      profile: {
        Row: {
          address_line_2: string | null
          apply_email: string | null
          apply_password_set: boolean | null
          authorized_countries: string[] | null
          available_hours_per_week: number | null
          behance_url: string | null
          city: string | null
          consent_background_check: boolean | null
          consent_drug_test: boolean | null
          country: string | null
          cover_letter_tone: string | null
          created_at: string
          criminal_record_disclosure: string | null
          current_salary: number | null
          date_of_birth: string | null
          desired_industries: string[] | null
          desired_salary: number | null
          desired_titles: string[] | null
          disability_status: string | null
          dribbble_url: string | null
          drivers_license: boolean | null
          earliest_start_date: string | null
          email: string | null
          ethnicity: string | null
          excluded_industries: string[] | null
          first_name: string | null
          full_name: string | null
          gender: string | null
          github_url: string | null
          has_own_transport: boolean | null
          has_passport: boolean | null
          headline: string | null
          last_name: string | null
          lgbtq_status: string | null
          linkedin_url: string | null
          linkedin_username: string | null
          location: string | null
          medium_url: string | null
          nationality: string | null
          needs_visa_future: boolean | null
          needs_visa_now: boolean | null
          notice_period_category: string | null
          notice_period_weeks: number | null
          onboarded_at: string | null
          onboarding_state: Json
          open_to_contract: boolean | null
          open_to_fulltime: boolean | null
          open_to_internship: boolean | null
          open_to_parttime: boolean | null
          passport_country: string | null
          personal_website: string | null
          phone: string | null
          portfolio_url: string | null
          postal_code: string | null
          preferred_locations: string[] | null
          preferred_name: string | null
          pronouns: string | null
          references_available_on_request: boolean | null
          relocation_assistance_needed: boolean | null
          remote_preference: string | null
          requires_sponsorship: boolean | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_period: string | null
          screening_answers: Json | null
          security_clearance: string | null
          share_demographics: boolean | null
          shift_preference: string | null
          stackoverflow_url: string | null
          state_region: string | null
          street_address: string | null
          summary: string | null
          timezone: string | null
          travel_willingness: string | null
          travel_willingness_pct: number | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          veteran_status: string | null
          visa_expiry: string | null
          visa_status: string | null
          willing_to_relocate: boolean | null
          work_auth_country: string | null
          work_authorization: string | null
          years_experience: number | null
        }
        Insert: {
          address_line_2?: string | null
          apply_email?: string | null
          apply_password_set?: boolean | null
          authorized_countries?: string[] | null
          available_hours_per_week?: number | null
          behance_url?: string | null
          city?: string | null
          consent_background_check?: boolean | null
          consent_drug_test?: boolean | null
          country?: string | null
          cover_letter_tone?: string | null
          created_at?: string
          criminal_record_disclosure?: string | null
          current_salary?: number | null
          date_of_birth?: string | null
          desired_industries?: string[] | null
          desired_salary?: number | null
          desired_titles?: string[] | null
          disability_status?: string | null
          dribbble_url?: string | null
          drivers_license?: boolean | null
          earliest_start_date?: string | null
          email?: string | null
          ethnicity?: string | null
          excluded_industries?: string[] | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          github_url?: string | null
          has_own_transport?: boolean | null
          has_passport?: boolean | null
          headline?: string | null
          last_name?: string | null
          lgbtq_status?: string | null
          linkedin_url?: string | null
          linkedin_username?: string | null
          location?: string | null
          medium_url?: string | null
          nationality?: string | null
          needs_visa_future?: boolean | null
          needs_visa_now?: boolean | null
          notice_period_category?: string | null
          notice_period_weeks?: number | null
          onboarded_at?: string | null
          onboarding_state?: Json
          open_to_contract?: boolean | null
          open_to_fulltime?: boolean | null
          open_to_internship?: boolean | null
          open_to_parttime?: boolean | null
          passport_country?: string | null
          personal_website?: string | null
          phone?: string | null
          portfolio_url?: string | null
          postal_code?: string | null
          preferred_locations?: string[] | null
          preferred_name?: string | null
          pronouns?: string | null
          references_available_on_request?: boolean | null
          relocation_assistance_needed?: boolean | null
          remote_preference?: string | null
          requires_sponsorship?: boolean | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          screening_answers?: Json | null
          security_clearance?: string | null
          share_demographics?: boolean | null
          shift_preference?: string | null
          stackoverflow_url?: string | null
          state_region?: string | null
          street_address?: string | null
          summary?: string | null
          timezone?: string | null
          travel_willingness?: string | null
          travel_willingness_pct?: number | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          veteran_status?: string | null
          visa_expiry?: string | null
          visa_status?: string | null
          willing_to_relocate?: boolean | null
          work_auth_country?: string | null
          work_authorization?: string | null
          years_experience?: number | null
        }
        Update: {
          address_line_2?: string | null
          apply_email?: string | null
          apply_password_set?: boolean | null
          authorized_countries?: string[] | null
          available_hours_per_week?: number | null
          behance_url?: string | null
          city?: string | null
          consent_background_check?: boolean | null
          consent_drug_test?: boolean | null
          country?: string | null
          cover_letter_tone?: string | null
          created_at?: string
          criminal_record_disclosure?: string | null
          current_salary?: number | null
          date_of_birth?: string | null
          desired_industries?: string[] | null
          desired_salary?: number | null
          desired_titles?: string[] | null
          disability_status?: string | null
          dribbble_url?: string | null
          drivers_license?: boolean | null
          earliest_start_date?: string | null
          email?: string | null
          ethnicity?: string | null
          excluded_industries?: string[] | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          github_url?: string | null
          has_own_transport?: boolean | null
          has_passport?: boolean | null
          headline?: string | null
          last_name?: string | null
          lgbtq_status?: string | null
          linkedin_url?: string | null
          linkedin_username?: string | null
          location?: string | null
          medium_url?: string | null
          nationality?: string | null
          needs_visa_future?: boolean | null
          needs_visa_now?: boolean | null
          notice_period_category?: string | null
          notice_period_weeks?: number | null
          onboarded_at?: string | null
          onboarding_state?: Json
          open_to_contract?: boolean | null
          open_to_fulltime?: boolean | null
          open_to_internship?: boolean | null
          open_to_parttime?: boolean | null
          passport_country?: string | null
          personal_website?: string | null
          phone?: string | null
          portfolio_url?: string | null
          postal_code?: string | null
          preferred_locations?: string[] | null
          preferred_name?: string | null
          pronouns?: string | null
          references_available_on_request?: boolean | null
          relocation_assistance_needed?: boolean | null
          remote_preference?: string | null
          requires_sponsorship?: boolean | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          screening_answers?: Json | null
          security_clearance?: string | null
          share_demographics?: boolean | null
          shift_preference?: string | null
          stackoverflow_url?: string | null
          state_region?: string | null
          street_address?: string | null
          summary?: string | null
          timezone?: string | null
          travel_willingness?: string | null
          travel_willingness_pct?: number | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          veteran_status?: string | null
          visa_expiry?: string | null
          visa_status?: string | null
          willing_to_relocate?: boolean | null
          work_auth_country?: string | null
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
      publications: {
        Row: {
          authors: string | null
          created_at: string
          description: string | null
          doi: string | null
          id: string
          publication_date: string | null
          sort_order: number | null
          title: string
          url: string | null
          user_id: string
          venue: string | null
        }
        Insert: {
          authors?: string | null
          created_at?: string
          description?: string | null
          doi?: string | null
          id?: string
          publication_date?: string | null
          sort_order?: number | null
          title?: string
          url?: string | null
          user_id: string
          venue?: string | null
        }
        Update: {
          authors?: string | null
          created_at?: string
          description?: string | null
          doi?: string | null
          id?: string
          publication_date?: string | null
          sort_order?: number | null
          title?: string
          url?: string | null
          user_id?: string
          venue?: string | null
        }
        Relationships: []
      }
      references_list: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          relationship: string | null
          sort_order: number | null
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          relationship?: string | null
          sort_order?: number | null
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          relationship?: string | null
          sort_order?: number | null
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
      session_cookies: {
        Row: {
          ciphertext: string
          created_at: string
          decrypt_failures: number
          expires_at: string | null
          host: string
          id: string
          iv: string
          last_used_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          decrypt_failures?: number
          expires_at?: string | null
          host: string
          id?: string
          iv: string
          last_used_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          decrypt_failures?: number
          expires_at?: string | null
          host?: string
          id?: string
          iv?: string
          last_used_at?: string | null
          updated_at?: string
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
      subscriptions: {
        Row: {
          cancel_at: string | null
          created_at: string
          current_period_end: string | null
          plan_key: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          plan_key: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          plan_key?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
        ]
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
      usage_quotas: {
        Row: {
          ai_tokens: number
          applies_count: number
          captures_count: number
          day: string
          user_id: string
        }
        Insert: {
          ai_tokens?: number
          applies_count?: number
          captures_count?: number
          day: string
          user_id: string
        }
        Update: {
          ai_tokens?: number
          applies_count?: number
          captures_count?: number
          day?: string
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
      worker_invocations: {
        Row: {
          created_at: string
          idempotency_key: string
          kind: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          kind: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_plan_for: {
        Args: { _user_id: string }
        Returns: {
          active: boolean
          admin_console: boolean
          cookie_sync: boolean
          currency: string
          key: string
          max_applies_per_day: number
          max_sources: number
          name: string
          price_cents: number
          sort_order: number
        }
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_job_to_filters: { Args: { _job_id: string }; Returns: undefined }
      prune_worker_invocations: { Args: never; Returns: undefined }
      rescore_all_jobs_for_user: { Args: { _user_id: string }; Returns: number }
      usage_mtd_by_provider: {
        Args: { _user_id: string }
        Returns: {
          event_count: number
          provider: string
          total_cost: number
          total_units: number
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "viewer" | "super_admin"
      application_phase:
        | "discovered"
        | "scored"
        | "tailored"
        | "queued"
        | "applying"
        | "submitted"
        | "needs_review"
        | "failed"
        | "follow_up_sent"
        | "replied"
        | "interview"
        | "offer"
        | "rejected"
        | "dead_letter"
      application_status:
        | "queued"
        | "applying"
        | "applied"
        | "failed"
        | "needs_review"
        | "skipped"
      log_level: "debug" | "info" | "warn" | "error"
      run_status: "running" | "succeeded" | "failed" | "success"
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
      app_role: ["owner", "admin", "viewer", "super_admin"],
      application_phase: [
        "discovered",
        "scored",
        "tailored",
        "queued",
        "applying",
        "submitted",
        "needs_review",
        "failed",
        "follow_up_sent",
        "replied",
        "interview",
        "offer",
        "rejected",
        "dead_letter",
      ],
      application_status: [
        "queued",
        "applying",
        "applied",
        "failed",
        "needs_review",
        "skipped",
      ],
      log_level: ["debug", "info", "warn", "error"],
      run_status: ["running", "succeeded", "failed", "success"],
      source_kind: ["apify", "rest", "board"],
    },
  },
} as const
