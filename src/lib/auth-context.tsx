'use client';

import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/types/database';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchProfile = useCallback(async (userId: string, userEmail?: string, retryCount = 0): Promise<Profile | null> => {
    // Use maybeSingle() instead of single() to handle missing profiles gracefully
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .abortSignal(AbortSignal.timeout(10_000))
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      if (retryCount < 2) {
        const delay = 1000 * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchProfile(userId, userEmail, retryCount + 1);
      }
      return null;
    }

    // If profile exists, return it
    if (data) {
      return data as Profile;
    }

    // Profile doesn't exist yet — may be a race with the trigger
    // Retry before attempting manual creation
    if (retryCount < 2) {
      const delay = 1000 * Math.pow(2, retryCount);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchProfile(userId, userEmail, retryCount + 1);
    }

    // Profile still doesn't exist after retries - try to create one
    console.log('Profile not found after retries, attempting to create one...');

    if (!userEmail) {
      console.error('Cannot create profile: no email provided');
      return null;
    }

    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: userEmail,
        full_name: '',
        role: 'auditor',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating profile:', createError);
      return null;
    }

    console.log('Profile created successfully');
    return newProfile as Profile;
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id, user.email);
      setProfile(profileData);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('Initializing auth...');
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          console.log('Session found for user:', session.user.email);
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id, session.user.email);
          console.log('Profile loaded:', profileData);
          setProfile(profileData);
        } else {
          console.log('No active session found');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id, session.user.email);
          setProfile(profileData);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    router.push('/facilities');
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || null,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
