-- Fix RLS performance warnings
-- Migration: 007_fix_rls_performance
--
-- Addresses two classes of Supabase performance advisor warnings:
--
-- 1. auth_rls_initplan: auth.uid() was being re-evaluated for every row.
--    Fix: wrap in (select auth.uid()) so Postgres evaluates it once as an
--    init-plan rather than per-row.
--
-- 2. multiple_permissive_policies: multiple PERMISSIVE policies for the same
--    table/role/action forces Postgres to execute every matching policy per
--    query. Fix: consolidate into single policies using OR conditions.

-- ============================================
-- PROFILES
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can create users" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create auditors" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update users" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update auditors" ON public.profiles;

-- Consolidated SELECT: own profile OR admin
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING ((select auth.uid()) = id OR public.is_admin());

-- Consolidated INSERT: own profile OR admin creates auditor OR super_admin creates anyone
CREATE POLICY "Users can create own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (
        (select auth.uid()) = id
        OR public.is_super_admin()
        OR (public.user_role() = 'admin' AND role = 'auditor')
    );

-- Consolidated UPDATE: own profile OR admin updates auditor OR super_admin updates anyone
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (
        (select auth.uid()) = id
        OR public.is_super_admin()
        OR (public.user_role() = 'admin' AND role = 'auditor')
    )
    WITH CHECK (
        (select auth.uid()) = id
        OR public.is_super_admin()
        OR (public.user_role() = 'admin' AND role = 'auditor')
    );

-- ============================================
-- FACILITIES
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view facilities" ON public.facilities;
DROP POLICY IF EXISTS "Super admins can view deleted facilities" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated users can create facilities" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated users can update facilities" ON public.facilities;
DROP POLICY IF EXISTS "Super admins can delete facilities" ON public.facilities;

-- Consolidated SELECT: authenticated see non-deleted, super_admins also see deleted
CREATE POLICY "Authenticated users can view facilities"
    ON public.facilities FOR SELECT
    USING ((select auth.uid()) IS NOT NULL AND (is_deleted = false OR public.is_super_admin()));

CREATE POLICY "Authenticated users can create facilities"
    ON public.facilities FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Consolidated UPDATE: authenticated can update non-deleted rows, super_admins can also update deleted rows (soft-delete)
CREATE POLICY "Authenticated users can update facilities"
    ON public.facilities FOR UPDATE
    USING ((select auth.uid()) IS NOT NULL AND (is_deleted = false OR public.is_super_admin()))
    WITH CHECK ((select auth.uid()) IS NOT NULL AND (is_deleted = false OR public.is_super_admin()));

-- ============================================
-- QUESTIONNAIRE VERSIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view published questionnaires" ON public.questionnaire_versions;
DROP POLICY IF EXISTS "Admins can view all questionnaires" ON public.questionnaire_versions;

-- Consolidated SELECT: authenticated see published, admins see all
CREATE POLICY "Users can view published questionnaires"
    ON public.questionnaire_versions FOR SELECT
    USING (
        ((select auth.uid()) IS NOT NULL AND status = 'published')
        OR public.is_admin()
    );

-- ============================================
-- SECTIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view sections" ON public.sections;

CREATE POLICY "Users can view sections"
    ON public.sections FOR SELECT
    USING (
        (select auth.uid()) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.questionnaire_versions qv
            WHERE qv.id = questionnaire_version_id
            AND (qv.status = 'published' OR public.is_admin())
        )
    );

-- ============================================
-- QUESTIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view questions" ON public.questions;

CREATE POLICY "Users can view questions"
    ON public.questions FOR SELECT
    USING (
        (select auth.uid()) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.sections s
            JOIN public.questionnaire_versions qv ON qv.id = s.questionnaire_version_id
            WHERE s.id = section_id
            AND (qv.status = 'published' OR public.is_admin())
        )
    );

-- ============================================
-- AUDITS
-- ============================================

DROP POLICY IF EXISTS "Users can view audits" ON public.audits;
DROP POLICY IF EXISTS "Users can create audits" ON public.audits;
DROP POLICY IF EXISTS "Users can update audits" ON public.audits;

CREATE POLICY "Users can view audits"
    ON public.audits FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can create audits"
    ON public.audits FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can update audits"
    ON public.audits FOR UPDATE
    USING ((select auth.uid()) IS NOT NULL);

-- ============================================
-- AUDIT ANSWERS
-- ============================================

DROP POLICY IF EXISTS "Users can view audit answers" ON public.audit_answers;
DROP POLICY IF EXISTS "Users can create audit answers" ON public.audit_answers;
DROP POLICY IF EXISTS "Users can update audit answers" ON public.audit_answers;

CREATE POLICY "Users can view audit answers"
    ON public.audit_answers FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can create audit answers"
    ON public.audit_answers FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can update audit answers"
    ON public.audit_answers FOR UPDATE
    USING ((select auth.uid()) IS NOT NULL);

-- ============================================
-- CHANGE LOGS
-- ============================================

DROP POLICY IF EXISTS "Users can create change logs" ON public.change_logs;

CREATE POLICY "Users can create change logs"
    ON public.change_logs FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ============================================
-- TOOLTIP CONFIG
-- ============================================

DROP POLICY IF EXISTS "Users can view tooltip config" ON public.tooltip_config;
DROP POLICY IF EXISTS "Admins can manage tooltip config" ON public.tooltip_config;

-- Consolidated SELECT: all authenticated users (admins are authenticated too)
CREATE POLICY "Users can view tooltip config"
    ON public.tooltip_config FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

-- Recreate admin write access as explicit per-action policies (avoids FOR ALL
-- contributing a redundant permissive SELECT policy on top of the one above)
CREATE POLICY "Admins can manage tooltip config"
    ON public.tooltip_config FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update tooltip config"
    ON public.tooltip_config FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete tooltip config"
    ON public.tooltip_config FOR DELETE
    USING (public.is_admin());

-- ============================================
-- FILTER CONFIG
-- ============================================

DROP POLICY IF EXISTS "Users can view filter config" ON public.filter_config;
DROP POLICY IF EXISTS "Admins can manage filter config" ON public.filter_config;

-- Consolidated SELECT: all authenticated users
CREATE POLICY "Users can view filter config"
    ON public.filter_config FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

-- Recreate admin write access as explicit per-action policies
CREATE POLICY "Admins can manage filter config"
    ON public.filter_config FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update filter config"
    ON public.filter_config FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete filter config"
    ON public.filter_config FOR DELETE
    USING (public.is_admin());
