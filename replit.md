# Sebenza Hub - South African Recruiting Platform

## Overview
Sebenza Hub is a South African recruiting platform designed to streamline hiring with a focus on transparency, compliance, and a WhatsApp-first approach. It features a comprehensive, feature-based billing system and connects recruiters, businesses, and job seekers through dedicated portals. The platform is a full-stack TypeScript application using React and Express, aiming to enhance the candidate experience and monetize through tiered subscriptions with Netcash integration. Key capabilities include AI-powered job description generation, CV screening, competency testing, and interview scheduling.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform utilizes a Charcoal/Amber color palette with Montserrat typography and a mobile-first responsive design built with shadcn/ui (Radix UI) and Tailwind CSS. It prioritizes accessibility with ARIA labels, semantic HTML, and keyboard navigation. Mobile navigation includes sticky headers and a hamburger menu for sidebar toggling, which acts as a modal overlay on mobile and expands on desktop. Performance optimizations include Brotli/Gzip compression, aggressive static asset caching, lazy loading for images, and optimized Google Fonts.

### Technical Implementations

#### Frontend
Developed with React and TypeScript (Vite), using Wouter for routing and TanStack React Query for state management.
- **Marketing Pages**: Includes a Contact Us page with a form and office details, and a Pricing page detailing Individual, Recruiter, and Corporate product families with tiered subscriptions, feature comparisons, and FAQs. A dedicated Recruiters marketing page highlights organizational types, plans, and features.
- **Recruiters Portal**: Features job posting forms with WhatsApp integration, AI-powered job description and company description generators, and a status-based workflow with conditional validation. Includes advanced skills management, job import functionality (document upload/text paste with AI extraction), PDF export/preview, automatic "Days Left" calculator, and multi-provider **Interview Scheduling** (Google Calendar/Meet, Microsoft Teams/Outlook, Zoom). An **AI SEO Assistant** uses OpenAI GPT-4o for metadata generation, live SERP preview, and keyword management. **Corporate Clients** management allows recruiting agencies to manage client companies, contacts (with POPIA consent), fee agreements, and client-specific job postings.
- **Individuals Portal**: Supports multiple CV management (with AI-powered circular photo cropping), profile management, competency test access, **Interview Booking**, and an AI Interview Coach. The **Job Searches** section is a collapsible sidebar tree with "All Jobs" (comprehensive search), "Auto Job Search" (AI-powered matching), "Manual Job Search" (simplified live jobs view), and "Saved Job Searches". Job detail views offer multiple application methods, favorites functionality, sharing, and PDF download.
- **ATS**: Manages candidates with AI-powered resume ingestion and semantic search.
- **Integrated Roles & Screening**: Facilitates hiring role management with configurable scoring and AI-evaluated candidate screening.
- **Competency Test Agent**: An AI-powered assessment platform for test generation, manual authoring, and a pre-built template library. Includes a candidate test-taking portal with server-authoritative timers, real-time anti-cheat tracking, automated scoring, and proctoring data collection.
- **Organization Settings**: Provides multi-tenant configuration for teams, pipelines, and compliance.
- **Location & Job Data**: Incorporates South African city/town and job title systems with auto-fill.

#### Backend
Built with Express.js and TypeScript, managing subscriptions, job postings, CVs, roles/screening, ATS, organization settings, competency testing, interview scheduling (OAuth flows, availability, booking), corporate clients, contact form inquiries, interview coach interactions, and billing.
- **Billing System**: Role-specific dashboards display current plan, usage, and upgrade paths. An automated cron job handles monthly billing resets. **Admin Feature & Plan Management** provides CRUD interfaces for 16 platform features (TOGGLE/QUOTA/METERED types) and 18 subscription plans across 3 products, 3 tiers, and 2 intervals, including feature entitlement configuration.
- **AI Integration**: Powers CV screening, resume ingestion, interview coaching, fraud detection, and competency test generation, utilizing hybrid document parsing (PDF, DOCX, DOC, TXT) and OpenAI Vision API (GPT-4o).
- **Background Job Processing**: Uses BullMQ with Redis for asynchronous tasks like candidate screening.
- **Authentication & Authorization**: Implements passwordless magic link authentication via Resend, Express-session with a PostgreSQL store, and a single-role system with role-based access control. A top-level `useRouteGuard` hook redirects unauthenticated users or those who haven't completed onboarding, with exceptions for public routes.
- **User Management**: Users identified by auto-incrementing `id` and unique `email`, with onboarding status and last login tracking.
- **Admin Setup**: Secure admin creation via an endpoint protected by an `ADMIN_SETUP_SECRET`.

#### Data Storage
Utilizes PostgreSQL (Neon) with Drizzle ORM and the pgvector extension, employing UUID primary keys.
- **Competency Testing Database**: Five-table schema for tests, sections, items, attempts, and responses, using JSONB for configuration and anti-cheat tracking.
- **Interview Scheduling Database**: Five-table schema for connected accounts, interview pools, members, interviews, and holds, supporting multi-provider OAuth and calendar synchronization.
- **Job Favorites Database**: `job_favorites` table tracks saved jobs with unique constraints and proper API support.
- **Job SEO Metadata**: `jobs` table includes a `seo` JSONB field for AI-generated and manually edited metadata, rendered on job detail pages.
- **Corporate Clients Database**: Three-table schema for clients, contacts (with POPIA consent), and engagements, with client-specific job postings and organization-scoped sharing.
- **Billing System Database**: Six-table architecture manages plans, features, feature entitlements, subscriptions, usage tracking, and payment events, enabling feature-gating and entitlement checks.

### System Design Choices
- **Monorepo Structure**: Organized into `client/`, `server/`, and `shared/` directories.
- **South African Context**: Designed with POPIA compliance and a WhatsApp-first workflow.

## External Dependencies
- **UI & Styling**: Radix UI, shadcn/ui, Lucide React, Tailwind CSS, Google Fonts.
- **Form Handling**: React Hook Form, Zod.
- **Database**: Drizzle ORM, @neondatabase/serverless.
- **File Upload**: Multer, pdf-parse, pdf-to-img, mammoth, word-extractor.
- **Background Jobs**: BullMQ, ioredis.
- **AI**: OpenAI GPT-4o, OpenAI GPT-4o-mini, OpenAI text-embedding-3-small.
- **Email**: Resend.
- **Maps & Geolocation**: Google Maps JavaScript API.
- **Calendar & Video Conferencing**: Google Calendar API, Microsoft Graph API (Teams/Outlook), Zoom API.