-- Allow users to create their own profile
-- Migration: 005_allow_self_profile_creation
-- This fixes the case where the trigger fails and the user needs to create their own profile

-- Allow authenticated users to insert their own profile (id must match their auth.uid)
CREATE POLICY "Users can create own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);
