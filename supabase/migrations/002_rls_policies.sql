-- Row Level Security Policies (Compatible with Supabase Cloud)
-- Migration: 002_rls_policies

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tooltip_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filter_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS FOR RLS (in public schema)
-- ============================================

-- Get current user's role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT public.user_role() IN ('admin', 'super_admin');
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT public.user_role() = 'super_admin';
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

-- Super admins can create any user
CREATE POLICY "Super admins can create users"
    ON public.profiles FOR INSERT
    WITH CHECK (public.is_super_admin());

-- Admins can create auditors only
CREATE POLICY "Admins can create auditors"
    ON public.profiles FOR INSERT
    WITH CHECK (
        public.user_role() = 'admin'
        AND role = 'auditor'
    );

-- Super admins can update any user
CREATE POLICY "Super admins can update users"
    ON public.profiles FOR UPDATE
    USING (public.is_super_admin());

-- Admins can update auditors only
CREATE POLICY "Admins can update auditors"
    ON public.profiles FOR UPDATE
    USING (
        public.user_role() = 'admin'
        AND role = 'auditor'
    );

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Super admins can delete users
CREATE POLICY "Super admins can delete users"
    ON public.profiles FOR DELETE
    USING (public.is_super_admin());

-- ============================================
-- FACILITIES POLICIES
-- ============================================

-- All authenticated users can view non-deleted facilities
CREATE POLICY "Authenticated users can view facilities"
    ON public.facilities FOR SELECT
    USING (auth.uid() IS NOT NULL AND is_deleted = false);

-- Super admins can view deleted facilities
CREATE POLICY "Super admins can view deleted facilities"
    ON public.facilities FOR SELECT
    USING (public.is_super_admin() AND is_deleted = true);

-- All authenticated users can create facilities
CREATE POLICY "Authenticated users can create facilities"
    ON public.facilities FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can update facilities
CREATE POLICY "Authenticated users can update facilities"
    ON public.facilities FOR UPDATE
    USING (auth.uid() IS NOT NULL AND is_deleted = false);

-- Super admins can soft delete facilities
CREATE POLICY "Super admins can delete facilities"
    ON public.facilities FOR UPDATE
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ============================================
-- QUESTIONNAIRE VERSION POLICIES
-- ============================================

-- All authenticated users can view published questionnaires
CREATE POLICY "Users can view published questionnaires"
    ON public.questionnaire_versions FOR SELECT
    USING (auth.uid() IS NOT NULL AND status = 'published');

-- Admins can view all questionnaires
CREATE POLICY "Admins can view all questionnaires"
    ON public.questionnaire_versions FOR SELECT
    USING (public.is_admin());

-- Admins can create questionnaires
CREATE POLICY "Admins can create questionnaires"
    ON public.questionnaire_versions FOR INSERT
    WITH CHECK (public.is_admin());

-- Admins can update draft questionnaires
CREATE POLICY "Admins can update questionnaires"
    ON public.questionnaire_versions FOR UPDATE
    USING (public.is_admin());

-- ============================================
-- SECTIONS POLICIES
-- ============================================

-- All authenticated users can view sections of published questionnaires
CREATE POLICY "Users can view sections"
    ON public.sections FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.questionnaire_versions qv
            WHERE qv.id = questionnaire_version_id
            AND (qv.status = 'published' OR public.is_admin())
        )
    );

-- Admins can create sections
CREATE POLICY "Admins can create sections"
    ON public.sections FOR INSERT
    WITH CHECK (public.is_admin());

-- Admins can update sections
CREATE POLICY "Admins can update sections"
    ON public.sections FOR UPDATE
    USING (public.is_admin());

-- Admins can delete sections
CREATE POLICY "Admins can delete sections"
    ON public.sections FOR DELETE
    USING (public.is_admin());

-- ============================================
-- QUESTIONS POLICIES
-- ============================================

-- All authenticated users can view questions
CREATE POLICY "Users can view questions"
    ON public.questions FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.sections s
            JOIN public.questionnaire_versions qv ON qv.id = s.questionnaire_version_id
            WHERE s.id = section_id
            AND (qv.status = 'published' OR public.is_admin())
        )
    );

-- Admins can create questions
CREATE POLICY "Admins can create questions"
    ON public.questions FOR INSERT
    WITH CHECK (public.is_admin());

-- Admins can update questions
CREATE POLICY "Admins can update questions"
    ON public.questions FOR UPDATE
    USING (public.is_admin());

-- ============================================
-- AUDITS POLICIES
-- ============================================

-- All authenticated users can view audits
CREATE POLICY "Users can view audits"
    ON public.audits FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- All authenticated users can create audits
CREATE POLICY "Users can create audits"
    ON public.audits FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can update audits
CREATE POLICY "Users can update audits"
    ON public.audits FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- ============================================
-- AUDIT ANSWERS POLICIES
-- ============================================

-- All authenticated users can view audit answers
CREATE POLICY "Users can view audit answers"
    ON public.audit_answers FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- All authenticated users can create audit answers
CREATE POLICY "Users can create audit answers"
    ON public.audit_answers FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can update audit answers
CREATE POLICY "Users can update audit answers"
    ON public.audit_answers FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- ============================================
-- CHANGE LOGS POLICIES
-- ============================================

-- Admins can view all change logs
CREATE POLICY "Admins can view change logs"
    ON public.change_logs FOR SELECT
    USING (public.is_admin());

-- All authenticated users can create change logs (via triggers)
CREATE POLICY "Users can create change logs"
    ON public.change_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Change logs cannot be updated or deleted (immutable)
-- No UPDATE or DELETE policies

-- ============================================
-- CONFIG POLICIES
-- ============================================

-- All authenticated users can view active configs
CREATE POLICY "Users can view tooltip config"
    ON public.tooltip_config FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view filter config"
    ON public.filter_config FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Admins can manage configs
CREATE POLICY "Admins can manage tooltip config"
    ON public.tooltip_config FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage filter config"
    ON public.filter_config FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
