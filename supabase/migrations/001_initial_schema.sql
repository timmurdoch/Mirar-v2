-- Sports Facility Audit Database Schema
-- Migration: 001_initial_schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE user_role AS ENUM ('auditor', 'admin', 'super_admin');
CREATE TYPE question_type AS ENUM ('string', 'number', 'list', 'radio', 'checkbox');
CREATE TYPE questionnaire_status AS ENUM ('draft', 'published', 'archived');

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'auditor',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for role-based queries
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- ============================================
-- FACILITIES TABLE (Baseline Data)
-- ============================================

CREATE TABLE public.facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_name TEXT NOT NULL,
    venue_address TEXT,
    town_suburb TEXT,
    postcode TEXT,
    state TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_deleted BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_facilities_deleted ON public.facilities(is_deleted);
CREATE INDEX idx_facilities_state ON public.facilities(state);
CREATE INDEX idx_facilities_location ON public.facilities(latitude, longitude);

-- ============================================
-- QUESTIONNAIRE VERSIONS
-- ============================================

CREATE TABLE public.questionnaire_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status questionnaire_status DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(version_number)
);

CREATE INDEX idx_questionnaire_versions_status ON public.questionnaire_versions(status);

-- ============================================
-- SECTIONS (grouped questions)
-- ============================================

CREATE TABLE public.sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_version_id UUID NOT NULL REFERENCES public.questionnaire_versions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sections_version ON public.sections(questionnaire_version_id);
CREATE INDEX idx_sections_order ON public.sections(questionnaire_version_id, sort_order);

-- ============================================
-- QUESTIONS
-- ============================================

CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    question_key TEXT NOT NULL, -- Stable key for CSV export/import
    label TEXT NOT NULL,
    description TEXT,
    question_type question_type NOT NULL,
    options JSONB, -- For list/radio/checkbox: ["Option 1", "Option 2"]
    is_required BOOLEAN DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_retired BOOLEAN DEFAULT false, -- Retired questions don't appear for new edits
    retired_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_section ON public.questions(section_id);
CREATE INDEX idx_questions_order ON public.questions(section_id, sort_order);
CREATE INDEX idx_questions_key ON public.questions(question_key);
CREATE INDEX idx_questions_retired ON public.questions(is_retired);

-- ============================================
-- AUDITS (snapshots tied to questionnaire version)
-- ============================================

CREATE TABLE public.audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    questionnaire_version_id UUID NOT NULL REFERENCES public.questionnaire_versions(id),
    audit_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audits_facility ON public.audits(facility_id);
CREATE INDEX idx_audits_version ON public.audits(questionnaire_version_id);
CREATE INDEX idx_audits_date ON public.audits(audit_date DESC);
CREATE INDEX idx_audits_facility_date ON public.audits(facility_id, created_at DESC);

-- ============================================
-- AUDIT ANSWERS
-- ============================================

CREATE TABLE public.audit_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id),
    value TEXT, -- Stored as text, parsed based on question type
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(audit_id, question_id)
);

CREATE INDEX idx_audit_answers_audit ON public.audit_answers(audit_id);
CREATE INDEX idx_audit_answers_question ON public.audit_answers(question_id);

-- ============================================
-- CHANGE LOGS (Immutable Audit Trail)
-- ============================================

CREATE TABLE public.change_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID REFERENCES public.facilities(id),
    audit_id UUID REFERENCES public.audits(id),
    entity_type TEXT NOT NULL, -- 'facility' or 'audit_answer'
    field_name TEXT NOT NULL, -- Field name or question key
    old_value TEXT,
    new_value TEXT,
    changed_by UUID NOT NULL REFERENCES public.profiles(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make change logs append-only by default
CREATE INDEX idx_change_logs_facility ON public.change_logs(facility_id);
CREATE INDEX idx_change_logs_audit ON public.change_logs(audit_id);
CREATE INDEX idx_change_logs_date ON public.change_logs(changed_at DESC);

-- ============================================
-- CONFIGURATION TABLES
-- ============================================

-- Configurable tooltip fields for map popups
CREATE TABLE public.tooltip_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_source TEXT NOT NULL, -- 'facility' or 'question'
    field_key TEXT NOT NULL, -- Field name or question_id
    display_label TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tooltip_config_active ON public.tooltip_config(is_active, sort_order);

-- Configurable filter fields for map
CREATE TABLE public.filter_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_source TEXT NOT NULL, -- 'facility' or 'question'
    field_key TEXT NOT NULL, -- Field name or question_id
    display_label TEXT NOT NULL,
    filter_type TEXT NOT NULL, -- 'select', 'multi-select', 'range', 'text'
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_filter_config_active ON public.filter_config(is_active, sort_order);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON public.facilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questionnaire_versions_updated_at BEFORE UPDATE ON public.questionnaire_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON public.sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audits_updated_at BEFORE UPDATE ON public.audits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_answers_updated_at BEFORE UPDATE ON public.audit_answers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get the latest published questionnaire version
CREATE OR REPLACE FUNCTION get_latest_published_questionnaire()
RETURNS UUID AS $$
    SELECT id FROM public.questionnaire_versions
    WHERE status = 'published'
    ORDER BY published_at DESC
    LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Get the latest audit for a facility
CREATE OR REPLACE FUNCTION get_latest_audit(p_facility_id UUID)
RETURNS UUID AS $$
    SELECT id FROM public.audits
    WHERE facility_id = p_facility_id
    ORDER BY created_at DESC
    LIMIT 1;
$$ LANGUAGE SQL STABLE;
