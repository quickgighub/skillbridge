import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  membership_tier: 'none' | 'regular' | 'pro' | 'vip';
  membership_expires_at: string | null;
  daily_tasks_used: number;
  last_task_reset_date: string;
  total_earnings: number;
  pending_earnings: number;
  approved_earnings: number;
  tasks_completed: number;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache for user data
let cachedUserData: {
  profile: Profile | null;
  isAdmin: boolean;
} | null = null;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Single function to fetch user data with caching
  const fetchUserData = async (userId: string) => {
    // Return cached data if available and user is the same
    if (cachedUserData && user?.id === userId) {
      setProfile(cachedUserData.profile);
      setIsAdmin(cachedUserData.isAdmin);
      return;
    }

    try {
      // Fetch in parallel with timeout
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 5000)
      );

      const fetchPromise = Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle()
      ]);

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!result) {
        console.warn('User data fetch timed out');
        return;
      }

      const [profileResult, roleResult] = result;

      if (profileResult.data) {
        setProfile(profileResult.data as Profile);
        cachedUserData = {
          profile: profileResult.data as Profile,
          isAdmin: !!roleResult.data
        };
      }

      setIsAdmin(!!roleResult.data);
    } catch (error) {
      console.warn('Error fetching user data:', error);
      // Don't block auth if profile fetch fails
    }
  };

  const refreshProfile = async () => {
    if (user) {
      cachedUserData = null; // Clear cache
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;
    let authStateSubscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      if (!mounted) return;
      
      try {
        // Set loading immediately for better UX
        setIsLoading(true);
        
        // Check for session WITHOUT triggering re-authentication
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('Session check error:', error);
          if (mounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setIsAdmin(false);
          }
          return;
        }

        if (!mounted) return;

        if (session) {
          setSession(session);
          setUser(session.user);
          
          // Fetch user data in background - don't wait for it
          fetchUserData(session.user.id).finally(() => {
            if (mounted) {
              setIsLoading(false);
            }
          });
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setIsLoading(false);
        }
      } catch (error) {
        console.warn('Auth init error:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth listener with debounce
    let listenerTimeout: NodeJS.Timeout;
    const setupAuthListener = () => {
      authStateSubscription = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          if (!mounted) return;

          // Debounce rapid auth state changes
          clearTimeout(listenerTimeout);
          listenerTimeout = setTimeout(async () => {
            console.log('Auth state change:', event);
            
            if (newSession?.user?.id !== user?.id) {
              cachedUserData = null; // Clear cache on user change
            }
            
            setSession(newSession);
            setUser(newSession?.user ?? null);
            
            if (newSession?.user) {
              await fetchUserData(newSession.user.id);
            } else {
              setProfile(null);
              setIsAdmin(false);
            }
            
            setIsLoading(false);
          }, 100);
        }
      ).data.subscription;
    };

    // Wait a bit before setting up listener
    const listenerSetupTimeout = setTimeout(setupAuthListener, 300);

    return () => {
      mounted = false;
      clearTimeout(listenerSetupTimeout);
      clearTimeout(listenerTimeout);
      if (authStateSubscription) {
        authStateSubscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      cachedUserData = null; // Clear cache on new sign in
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) {
        setIsLoading(false);
        
        if (error.message.includes('Email not confirmed')) {
          return { error: new Error('Please verify your email first. Check your inbox.') };
        }
        
        return { error };
      }
      
      // Update state
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        await fetchUserData(data.session.user.id);
      }
      
      setIsLoading(false);
      return { error: null };
    } catch (error: any) {
      setIsLoading(false);
      console.error('Sign in exception:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setIsLoading(true);
      
      const siteUrl = window.location.origin;
      const redirectUrl = `${siteUrl}/auth/callback`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: fullName },
        },
      });
      
      if (error) {
        setIsLoading(false);
        return { error };
      }
      
      // Don't automatically sign in - wait for email confirmation
      setIsLoading(false);
      return { error: null };
    } catch (error: any) {
      setIsLoading(false);
      console.error('Sign up exception:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      cachedUserData = null; // Clear cache on sign out
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Sign out error:', error);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isAdmin,
      isLoading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};