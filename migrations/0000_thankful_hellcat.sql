CREATE TABLE "approved_vendors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"contact_email" text,
	"rate" text,
	"nda_signed" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_search_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_titles" text[] DEFAULT '{}'::text[],
	"location_city" text,
	"location_province" text,
	"latitude" text,
	"longitude" text,
	"radius_km" integer DEFAULT 50,
	"enforce_radius" integer DEFAULT 0,
	"employment_types" text[] DEFAULT '{}'::text[],
	"work_arrangements" text[] DEFAULT '{}'::text[],
	"seniority_target" text,
	"salary_min" integer,
	"salary_max" integer,
	"enforce_salary" integer DEFAULT 0,
	"top_k" integer DEFAULT 20,
	"notify_on_new_matches" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auto_search_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "auto_search_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"heuristic_score" integer NOT NULL,
	"llm_score" integer,
	"final_score" integer NOT NULL,
	"vec_similarity" text,
	"skills_jaccard" text,
	"title_similarity" text,
	"distance_km" text,
	"salary_alignment" text,
	"seniority_alignment" text,
	"explanation" text,
	"risks" text,
	"highlighted_skills" text[] DEFAULT '{}'::text[],
	"viewed" integer DEFAULT 0,
	"applied" integer DEFAULT 0,
	"feedback" text,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "awards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"name" text,
	"by_whom" text,
	"year" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "candidate_embeddings" (
	"candidate_id" varchar PRIMARY KEY NOT NULL,
	"embedding" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"full_name" text NOT NULL,
	"province" text NOT NULL,
	"postal_code" text,
	"city" text NOT NULL,
	"country" text DEFAULT 'South Africa' NOT NULL,
	"physical_address" text,
	"email" text,
	"telephone" text,
	"job_title" text NOT NULL,
	"experience_level" text NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"cv_url" text,
	"is_public" integer DEFAULT 1 NOT NULL,
	"popia_consent_given" integer NOT NULL,
	"popia_consent_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_skills" (
	"candidate_id" varchar NOT NULL,
	"skill_id" varchar NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"full_name" text,
	"headline" text,
	"email" text,
	"phone" text,
	"city" text,
	"country" text,
	"links" jsonb DEFAULT '{}'::jsonb,
	"summary" text,
	"work_authorization" text,
	"availability" text,
	"salary_expectation" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"name" text,
	"issuer" text,
	"year" text
);
--> statement-breakpoint
CREATE TABLE "competency_tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"job_title" text NOT NULL,
	"job_family" text,
	"industry" text,
	"seniority" text,
	"duration_minutes" integer DEFAULT 45 NOT NULL,
	"languages" text[] DEFAULT '{"en-ZA"}'::text[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"weights" jsonb NOT NULL,
	"cut_scores" jsonb NOT NULL,
	"anti_cheat_config" jsonb NOT NULL,
	"candidate_notice" jsonb,
	"data_retention_days" integer DEFAULT 365 NOT NULL,
	"creation_method" text NOT NULL,
	"source_job_id" varchar,
	"source_template_id" varchar,
	"ai_generation_prompt" text,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"average_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "competency_tests_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "compliance_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"ee_data_capture" text DEFAULT 'optional' NOT NULL,
	"consent_text" text DEFAULT 'By applying you consent to processing your personal data for recruitment purposes in compliance with POPIA.' NOT NULL,
	"data_retention_days" integer DEFAULT 365 NOT NULL,
	"popia_officer" text,
	"data_deletion_contact" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"email" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[],
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"is_primary" integer DEFAULT 0,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_client_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"is_primary" integer DEFAULT 0 NOT NULL,
	"full_name" text NOT NULL,
	"role" text,
	"email" text,
	"phone" text,
	"whatsapp_number" text,
	"whatsapp_consent" integer DEFAULT 0 NOT NULL,
	"whatsapp_consent_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_client_engagements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"agreement_type" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"fee_percent" integer,
	"retainer_amount" integer,
	"terms_document" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"registration_number" text,
	"industry" text,
	"province" text,
	"city" text,
	"status" text DEFAULT 'active' NOT NULL,
	"tier" text,
	"rating" integer,
	"default_fee_percent" integer,
	"guarantee_period_days" integer,
	"payment_terms" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cvs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"reference_number" varchar,
	"personal_info" jsonb NOT NULL,
	"work_experience" jsonb NOT NULL,
	"skills" jsonb NOT NULL,
	"education" jsonb NOT NULL,
	"references" jsonb,
	"about_me" text,
	"photo_url" text,
	"include_photo" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cvs_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "education" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"institution" text,
	"qualification" text,
	"location" text,
	"grad_date" text
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"title" text,
	"company" text,
	"industry" text,
	"location" text,
	"start_date" text,
	"end_date" text,
	"is_current" integer DEFAULT 0 NOT NULL,
	"bullets" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_entitlements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"feature_key" varchar NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"monthly_cap" integer,
	"overage_unit_cents" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"key" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"kind" text NOT NULL,
	"unit" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_detections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"content_id" varchar NOT NULL,
	"user_id" varchar,
	"risk_level" text NOT NULL,
	"risk_score" integer NOT NULL,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"ai_reasoning" text NOT NULL,
	"content_snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"action_taken" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"reason" text,
	"is_recurring" integer DEFAULT 0,
	"recurrence_rule" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "individual_notification_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email_job_alerts" integer DEFAULT 1 NOT NULL,
	"email_application_updates" integer DEFAULT 1 NOT NULL,
	"email_weekly_digest" integer DEFAULT 0 NOT NULL,
	"whatsapp_job_alerts" integer DEFAULT 0 NOT NULL,
	"whatsapp_application_updates" integer DEFAULT 0 NOT NULL,
	"sms_job_alerts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "individual_notification_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "individual_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"preferred_industries" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_locations" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_employment_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"desired_salary_min" integer,
	"desired_salary_max" integer,
	"salary_currency" text DEFAULT 'ZAR' NOT NULL,
	"availability" text,
	"willing_to_relocate" integer DEFAULT 0 NOT NULL,
	"remote_preference" text DEFAULT 'any' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "individual_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "interview_pools" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"routing" text DEFAULT 'roundRobin' NOT NULL,
	"buffer_mins_before" integer DEFAULT 15,
	"buffer_mins_after" integer DEFAULT 15,
	"working_hours" jsonb DEFAULT '{"start":9,"end":17,"days":[1,2,3,4,5],"timezone":"Africa/Johannesburg"}'::jsonb NOT NULL,
	"meeting_duration" integer DEFAULT 60,
	"slot_interval" integer DEFAULT 30,
	"min_notice_hours" integer DEFAULT 24,
	"provider" text DEFAULT 'google',
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"calendar_provider" text,
	"video_provider" text,
	"panel_templates" text[] DEFAULT '{}'::text[] NOT NULL,
	"feedback_form_template" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "interview_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"pool_id" varchar,
	"job_id" varchar,
	"candidate_user_id" varchar,
	"candidate_name" text NOT NULL,
	"candidate_email" text NOT NULL,
	"candidate_phone" text,
	"interviewer_user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"timezone" text DEFAULT 'Africa/Johannesburg',
	"provider" text NOT NULL,
	"provider_event_id" text,
	"meeting_join_url" text,
	"location" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"reminder_sent" integer DEFAULT 0,
	"feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'Applied' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_embeddings" (
	"job_id" varchar PRIMARY KEY NOT NULL,
	"embedding" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"job_title" text,
	"job_description" text,
	"requirements" text[] DEFAULT '{}'::text[] NOT NULL,
	"interview_structure" text[] DEFAULT '{}'::text[] NOT NULL,
	"approval_chain" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"posted_by_user_id" varchar,
	"client_id" varchar,
	"reference_number" varchar,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text,
	"salary_min" integer,
	"salary_max" integer,
	"description" text,
	"requirements" text,
	"whatsapp_contact" text,
	"employment_type" text,
	"industry" text,
	"core" jsonb,
	"compensation" jsonb,
	"role_details" jsonb,
	"application" jsonb,
	"company_details" jsonb,
	"contract" jsonb,
	"benefits" jsonb,
	"vetting" jsonb,
	"compliance" jsonb,
	"attachments" jsonb,
	"accessibility" jsonb,
	"branding" jsonb,
	"admin" jsonb,
	"seo" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar NOT NULL,
	"user_id" varchar,
	"email" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"request_ip" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "magic_link_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_state_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_state_tokens_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "organization_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"slack_webhook" text,
	"ms_teams_webhook" text,
	"ats_provider" text,
	"ats_api_key" text,
	"sourcing_channels" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_integrations_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"website" text,
	"province" text,
	"city" text,
	"industry" text,
	"size" text,
	"logo_url" text,
	"is_verified" integer DEFAULT 0 NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"job_post_limit" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gateway" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp,
	"error" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product" text NOT NULL,
	"tier" text NOT NULL,
	"interval" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"is_public" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"weight" integer DEFAULT 1,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"name" text,
	"what" text,
	"impact" text,
	"link" text
);
--> statement-breakpoint
CREATE TABLE "recruiter_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"agency_name" text NOT NULL,
	"website" text,
	"email" text,
	"telephone" text,
	"sectors" text[] DEFAULT '{}'::text[],
	"proof_url" text,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recruiter_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"filename" text,
	"filesize_bytes" integer,
	"parsed_ok" integer DEFAULT 1 NOT NULL,
	"parse_notes" text,
	"raw_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"job_title" text NOT NULL,
	"job_description" text NOT NULL,
	"seniority" text,
	"employment_type" text,
	"location_city" text,
	"location_country" text DEFAULT 'South Africa',
	"work_type" text,
	"must_have_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"nice_to_have_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" text DEFAULT 'ZAR',
	"knockouts" text[] DEFAULT '{}'::text[] NOT NULL,
	"weights" jsonb DEFAULT '{"skills":35,"experience":25,"achievements":15,"education":10,"location_auth":10,"salary_availability":5}'::jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_bands" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"title" text NOT NULL,
	"min_salary" integer NOT NULL,
	"max_salary" integer NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_candidates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screening_job_id" varchar NOT NULL,
	"full_name" text NOT NULL,
	"contact" jsonb,
	"headline" text,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"experience" jsonb,
	"education" jsonb,
	"certifications" jsonb,
	"achievements" jsonb,
	"links" jsonb,
	"work_authorization" text,
	"salary_expectation" text,
	"availability" text,
	"raw_cv_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_evaluations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screening_job_id" varchar NOT NULL,
	"candidate_id" varchar NOT NULL,
	"score_total" integer NOT NULL,
	"score_breakdown" jsonb NOT NULL,
	"must_haves_satisfied" text[] DEFAULT '{}'::text[] NOT NULL,
	"missing_must_haves" text[] DEFAULT '{}'::text[] NOT NULL,
	"knockout" jsonb,
	"reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"flags" jsonb,
	"rank" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"job_title" text NOT NULL,
	"job_description" text NOT NULL,
	"seniority" text,
	"employment_type" text,
	"location" jsonb,
	"must_have_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"nice_to_have_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"salary_range" jsonb,
	"knockouts" text[] DEFAULT '{}'::text[] NOT NULL,
	"weights" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"candidate_id" varchar NOT NULL,
	"score_total" integer,
	"score_breakdown" jsonb,
	"must_haves_satisfied" text[] DEFAULT '{}'::text[] NOT NULL,
	"missing_must_haves" text[] DEFAULT '{}'::text[] NOT NULL,
	"knockout" jsonb,
	"reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"flags" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"holder_type" text NOT NULL,
	"holder_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_ends_at" timestamp,
	"cancel_at_period_end" integer DEFAULT 0 NOT NULL,
	"netcash_ref" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "test_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" varchar NOT NULL,
	"candidate_id" varchar NOT NULL,
	"application_id" varchar,
	"job_id" varchar,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"time_spent_seconds" integer,
	"device_meta" jsonb,
	"ip_address" varchar,
	"popia_consent_given" integer DEFAULT 0 NOT NULL,
	"popia_consent_timestamp" timestamp,
	"proctoring_events" jsonb DEFAULT '[]' NOT NULL,
	"fullscreen_exits" integer DEFAULT 0 NOT NULL,
	"tab_switches" integer DEFAULT 0 NOT NULL,
	"copy_paste_attempts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"overall_score" integer,
	"passed" integer,
	"section_scores" jsonb,
	"fraud_score" integer,
	"review_required" integer DEFAULT 0 NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" varchar NOT NULL,
	"format" text NOT NULL,
	"stem" text NOT NULL,
	"options" jsonb,
	"correct_answer" jsonb,
	"rubric" jsonb,
	"max_points" integer DEFAULT 1 NOT NULL,
	"competencies" text[] DEFAULT '{}'::text[] NOT NULL,
	"difficulty" text DEFAULT 'M' NOT NULL,
	"time_seconds" integer,
	"times_answered" integer DEFAULT 0 NOT NULL,
	"percent_correct" integer,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"response" jsonb NOT NULL,
	"is_correct" integer,
	"points_awarded" integer,
	"time_spent_seconds" integer,
	"answered_at" timestamp DEFAULT now() NOT NULL,
	"graded_by" varchar,
	"graded_at" timestamp,
	"grader_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"time_minutes" integer NOT NULL,
	"weight" integer NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holder_type" text NOT NULL,
	"holder_id" varchar NOT NULL,
	"feature_key" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"extra_allowance" integer DEFAULT 0 NOT NULL,
	"last_reset_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" text DEFAULT 'individual' NOT NULL,
	"onboarding_complete" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auto_search_user" ON "auto_search_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auto_search_job" ON "auto_search_results" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_auto_search_score" ON "auto_search_results" USING btree ("final_score");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auto_search_unique" ON "auto_search_results" USING btree ("user_id","job_id","generated_at");--> statement-breakpoint
CREATE INDEX "idx_competency_test_org" ON "competency_tests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_competency_test_status" ON "competency_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_connected_user" ON "connected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_connected_unique" ON "connected_accounts" USING btree ("user_id","provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_entitlement_unique" ON "feature_entitlements" USING btree ("plan_id","feature_key");--> statement-breakpoint
CREATE INDEX "idx_entitlement_plan" ON "feature_entitlements" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_entitlement_feature" ON "feature_entitlements" USING btree ("feature_key");--> statement-breakpoint
CREATE UNIQUE INDEX "fraud_detections_content_unique" ON "fraud_detections" USING btree ("content_id","content_type");--> statement-breakpoint
CREATE INDEX "idx_hold_user" ON "holds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_hold_time" ON "holds" USING btree ("start_time","end_time");--> statement-breakpoint
CREATE INDEX "idx_pool_org" ON "interview_pools" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_interview_org" ON "interviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_interview_candidate" ON "interviews" USING btree ("candidate_email");--> statement-breakpoint
CREATE INDEX "idx_interview_interviewer" ON "interviews" USING btree ("interviewer_user_id");--> statement-breakpoint
CREATE INDEX "idx_interview_time" ON "interviews" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_interview_status" ON "interviews" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_job_favorites_unique" ON "job_favorites" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_job_favorites_user" ON "job_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_magic_token" ON "magic_link_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_magic_email" ON "magic_link_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_oauth_state" ON "oauth_state_tokens" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_oauth_expires" ON "oauth_state_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_payment_event_type" ON "payment_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_payment_event_processed" ON "payment_events" USING btree ("processed");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_plan_unique" ON "plans" USING btree ("product","tier","interval","version");--> statement-breakpoint
CREATE INDEX "idx_plan_product" ON "plans" USING btree ("product");--> statement-breakpoint
CREATE INDEX "idx_pool_member_pool" ON "pool_members" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_pool_member_user" ON "pool_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pool_member_unique" ON "pool_members" USING btree ("pool_id","user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_subscription_holder" ON "subscriptions" USING btree ("holder_type","holder_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_status" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_subscription_period" ON "subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "idx_test_attempt_test" ON "test_attempts" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "idx_test_attempt_candidate" ON "test_attempts" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "idx_test_attempt_application" ON "test_attempts" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_test_item_section" ON "test_items" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_test_response_attempt" ON "test_responses" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_test_response_unique" ON "test_responses" USING btree ("attempt_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_test_section_test" ON "test_sections" USING btree ("test_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_usage_unique" ON "usage" USING btree ("holder_type","holder_id","feature_key","period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_usage_holder" ON "usage" USING btree ("holder_type","holder_id");--> statement-breakpoint
CREATE INDEX "idx_usage_period" ON "usage" USING btree ("period_end");