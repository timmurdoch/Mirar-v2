-- Fix RLS helper functions to handle missing profiles
-- Migration: 006_fix_rls_helper_functions
-- When a profile doesn't exist, these functions now return safe defaults

-- Get current user's role (returns 'auditor' if no profile exists to allow basic access)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role AS $$
    SELECT COALESCE(
        (SELECT role FROM public.profiles WHERE id = auth.uid()),
        'auditor'::user_role
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is admin or super_admin (returns false if no profile exists)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(public.user_role() IN ('admin', 'super_admin'), false);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is super_admin (returns false if no profile exists)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(public.user_role() = 'super_admin', false);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
