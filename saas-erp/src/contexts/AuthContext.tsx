import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/auditLog';

export interface PermissionSet {
  modules: Record<string, boolean>;
  actions: Record<string, boolean>;
}

export interface UserRole {
  role: 'admin' | 'teacher' | 'staff' | 'accountant' | 'librarian' | 'parent' | 'principal' | 'director'
      | 'vice_principal' | 'campus_coordinator' | 'academic_coordinator' | 'section_coordinator';
  school_id: string;
  user_id: string;
  staff_id?: string;
  permissions?: PermissionSet;
  is_active?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  roleNotFound: boolean;
  signOut: () => Promise<void>;
  /** Returns true if the user has access to a module key */
  canAccess: (moduleKey: string) => boolean;
  /** Returns true if the user can perform a dangerous action key */
  canDo: (actionKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userRole: null,
  loading: true,
  roleNotFound: false,
  signOut: async () => {},
  canAccess: () => true,
  canDo: () => false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession]       = useState<Session | null>(null);
  const [user, setUser]             = useState<User | null>(null);
  const [userRole, setUserRole]     = useState<UserRole | null>(null);
  const [loading, setLoading]       = useState(true);
  const [roleNotFound, setRoleNotFound] = useState(false);

  useEffect(() => {
    // Track the last user ID we fetched a role for.
    // This guarantees we skip redundant calls on TOKEN_REFRESHED events.
    let lastFetchedUserId: string | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        lastFetchedUserId = session.user.id;
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // If this is a password recovery event, redirect to the reset page
      if (_event === 'PASSWORD_RECOVERY') {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        window.location.href = '/reset-password';
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Only re-fetch role if the user identity actually changed.
        // TOKEN_REFRESHED fires with the same user.id — skip it to avoid 429s.
        if (session.user.id !== lastFetchedUserId) {
          lastFetchedUserId = session.user.id;
          fetchUserRole(session.user.id);
        }
      } else {
        lastFetchedUserId = null;
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      // limit(1) handles both 0-rows and multiple-rows cases safely.
      // maybeSingle() alone errors when >1 row exists; limit(1) prevents that.
      const { data: rows, error } = await supabase
        .from('user_roles')
        .select('role, school_id, user_id, staff_id, permissions, is_active')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      const data = rows && rows.length > 0 ? rows[0] : null;

      if (error) {
        // A real DB error (network, RLS, etc.) — log it but do NOT redirect to login
        // to avoid an infinite auth loop
        console.error('Error fetching user role:', error.message);
        setUserRole(null);
        setRoleNotFound(false);
        setLoading(false);
        return;
      }

      if (!data) {
        // Authenticated but no user_roles row exists yet.
        // Show "contact admin" screen — do NOT redirect to /login or we get a loop.
        console.warn(`No user_role row found for user ${userId}. Account not configured.`);
        setUserRole(null);
        setRoleNotFound(true);
        setLoading(false);
        return;
      }

      // Suspended account — sign out immediately
      if (data.is_active === false) {
        await supabase.auth.signOut();
        setUserRole(null);
        setSession(null);
        setUser(null);
        setRoleNotFound(false);
        alert('Your account has been suspended. Please contact the administrator.');
        setLoading(false);
        return;
      }

      setRoleNotFound(false);
      setUserRole(data as UserRole);

      // Record last_login timestamp (fire-and-forget, don't block)
      supabase
        .from('user_roles')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', userId)
        .then(() => {/* ignore result */});

      // Audit log: login event
      logActivity({
        school_id:   data.school_id,
        user_id:     userId,
        user_role:   data.role,
        action:      'LOGIN',
        module:      'Auth',
        description: `${data.role} signed in`,
      });

    } catch (err: any) {
      // Unexpected error — log and leave loading=false to avoid hang
      console.error('Unexpected auth error:', err);
      setUserRole(null);
      setRoleNotFound(false);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  /**
   * Returns true if the user may access a given module.
   * Admins always pass. Others check their permissions.modules map;
   * if the key is absent (never been set), default to true.
   */
  const canAccess = useCallback((moduleKey: string): boolean => {
    if (!userRole) return false;
    if (userRole.role === 'admin') return true;
    const modules = userRole.permissions?.modules;
    if (!modules || modules[moduleKey] === undefined) return true;
    return modules[moduleKey] === true;
  }, [userRole]);

  /**
   * Returns true if the user may perform a dangerous action.
   * Admins always pass. Others must have the action explicitly enabled.
   */
  const canDo = useCallback((actionKey: string): boolean => {
    if (!userRole) return false;
    if (userRole.role === 'admin') return true;
    return userRole.permissions?.actions?.[actionKey] === true;
  }, [userRole]);

  // Memoize the full context value to prevent spurious re-renders in all consumers
  const contextValue = useMemo(() => ({
    session, user, userRole, loading, roleNotFound, signOut, canAccess, canDo
  }), [session, user, userRole, loading, roleNotFound, canAccess, canDo]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
