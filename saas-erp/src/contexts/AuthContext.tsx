import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface PermissionSet {
  modules: Record<string, boolean>;
  actions: Record<string, boolean>;
}

export interface UserRole {
  role: 'admin' | 'teacher' | 'staff' | 'accountant' | 'librarian' | 'parent' | 'principal' | 'director';
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
  signOut: async () => {},
  canAccess: () => true,
  canDo: () => false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession]   = useState<Session | null>(null);
  const [user, setUser]         = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, school_id, user_id, staff_id, permissions, is_active')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      // Suspended account — sign out immediately
      if (data.is_active === false) {
        await supabase.auth.signOut();
        setUserRole(null);
        setSession(null);
        setUser(null);
        alert('Your account has been suspended. Please contact the administrator.');
        return;
      }

      setUserRole(data as UserRole);

      // Record last_login timestamp
      await supabase
        .from('user_roles')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', userId);

    } catch (error) {
      console.error('Error fetching user role:', error);
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
  const canAccess = (moduleKey: string): boolean => {
    if (!userRole) return false;
    if (userRole.role === 'admin') return true;
    const modules = userRole.permissions?.modules;
    if (!modules || modules[moduleKey] === undefined) return true;
    return modules[moduleKey] === true;
  };

  /**
   * Returns true if the user may perform a dangerous action.
   * Admins always pass. Others must have the action explicitly enabled.
   */
  const canDo = (actionKey: string): boolean => {
    if (!userRole) return false;
    if (userRole.role === 'admin') return true;
    return userRole.permissions?.actions?.[actionKey] === true;
  };

  return (
    <AuthContext.Provider value={{ session, user, userRole, loading, signOut, canAccess, canDo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
