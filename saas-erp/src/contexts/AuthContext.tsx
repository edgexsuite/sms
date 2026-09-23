import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/auditLog';
import { cleanupDemoSchoolModifications, DEMO_SCHOOL_ID } from '../lib/demoReset';

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
  allRoles: UserRole[];
  inchargeClassIds: string[];
  loading: boolean;
  roleNotFound: boolean;
  signOut: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  /** Returns true if the user has access to a module key */
  canAccess: (moduleKey: string) => boolean;
  /** Returns true if the user can perform an action key */
  canDo: (actionKey: string) => boolean;
  /** Returns true if the user is a class incharge (optionally for a specific class ID) */
  isClassIncharge: (classId?: string) => boolean;
  /** Returns true if the user can manage and print complete class diary for a class */
  canManageClassDiary: (classId?: string) => boolean;
  /** Returns true if the user can manage exams for a class */
  canManageExams: (classId?: string) => boolean;
}

const ROLE_PRIORITY: Record<string, number> = {
  admin: 100,
  director: 90,
  principal: 80,
  vice_principal: 70,
  campus_coordinator: 60,
  academic_coordinator: 50,
  section_coordinator: 40,
  accountant: 30,
  librarian: 25,
  teacher: 20,
  staff: 10,
  parent: 5
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userRole: null,
  allRoles: [],
  inchargeClassIds: [],
  loading: true,
  roleNotFound: false,
  signOut: async () => {},
  switchRole: () => {},
  canAccess: () => true,
  canDo: () => false,
  isClassIncharge: () => false,
  canManageClassDiary: () => false,
  canManageExams: () => false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession]             = useState<Session | null>(null);
  const [user, setUser]                   = useState<User | null>(null);
  const [userRole, setUserRole]           = useState<UserRole | null>(null);
  const [allRoles, setAllRoles]           = useState<UserRole[]>([]);
  const [inchargeClassIds, setInchargeClassIds] = useState<string[]>([]);
  const [loading, setLoading]             = useState(true);
  const [roleNotFound, setRoleNotFound]   = useState(false);

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
        setAllRoles([]);
        setInchargeClassIds([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      // Query all user_roles rows for this user
      const { data: rows, error } = await supabase
        .from('user_roles')
        .select('role, school_id, user_id, staff_id, permissions, is_active')
        .eq('user_id', userId);

      if (error) {
        // A real DB error (network, RLS, etc.) — log it but do NOT redirect to login
        // to avoid an infinite auth loop
        console.error('Error fetching user role:', error.message);
        setUserRole(null);
        setAllRoles([]);
        setInchargeClassIds([]);
        setRoleNotFound(false);
        setLoading(false);
        return;
      }

      if (!rows || rows.length === 0) {
        // Authenticated but no user_roles row exists yet.
        // Show "contact admin" screen — do NOT redirect to /login or we get a loop.
        console.warn(`No user_role row found for user ${userId}. Account not configured.`);
        setUserRole(null);
        setAllRoles([]);
        setInchargeClassIds([]);
        setRoleNotFound(true);
        setLoading(false);
        return;
      }

      // Check if all accounts are suspended
      const activeRows = rows.filter(r => r.is_active !== false);
      if (activeRows.length === 0) {
        await supabase.auth.signOut();
        setUserRole(null);
        setAllRoles([]);
        setInchargeClassIds([]);
        setSession(null);
        setUser(null);
        setRoleNotFound(false);
        alert('Your account has been suspended. Please contact the administrator.');
        setLoading(false);
        return;
      }

      // Sort by role hierarchy priority descending (Admin always highest)
      activeRows.sort((a, b) => (ROLE_PRIORITY[b.role] || 0) - (ROLE_PRIORITY[a.role] || 0));

      const primaryRole = activeRows[0] as UserRole;
      setAllRoles(activeRows as UserRole[]);
      setRoleNotFound(false);
      setUserRole(primaryRole);

      // Fetch incharge classes for this staff member
      resolveInchargeClasses(primaryRole.school_id, primaryRole.staff_id, userId);

      // Record last_login timestamp (fire-and-forget, don't block)
      supabase
        .from('user_roles')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', userId)
        .then(() => {/* ignore result */});

      // Audit log: login event
      logActivity({
        school_id:   primaryRole.school_id,
        user_id:     userId,
        user_role:   primaryRole.role,
        action:      'LOGIN',
        module:      'Auth',
        description: `${primaryRole.role} signed in`,
      });

    } catch (err: any) {
      // Unexpected error — log and leave loading=false to avoid hang
      console.error('Unexpected auth error:', err);
      setUserRole(null);
      setAllRoles([]);
      setInchargeClassIds([]);
      setRoleNotFound(false);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const switchRole = useCallback((role: UserRole) => {
    setUserRole(role);
    if (role.school_id) {
      resolveInchargeClasses(role.school_id, role.staff_id, role.user_id);
    }
  }, []);

  const resolveInchargeClasses = async (schoolId: string, staffId?: string, userId?: string) => {
    try {
      let resolvedStaffId = staffId || null;
      if (!resolvedStaffId && userId) {
        const { data: authUser } = await supabase.auth.getUser();
        const email = authUser?.user?.email;
        if (email) {
          const { data: staffRow } = await supabase
            .from('staff')
            .select('id')
            .eq('school_id', schoolId)
            .eq('email', email)
            .maybeSingle();
          resolvedStaffId = staffRow?.id || null;
        }
      }

      if (!resolvedStaffId) {
        setInchargeClassIds([]);
        return;
      }

      const { data: classesData } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', schoolId)
        .eq('class_teacher_id', resolvedStaffId);

      const classIds = (classesData || []).map((c: any) => c.id);
      setInchargeClassIds(classIds);
    } catch (err) {
      console.error('Error resolving incharge classes:', err);
      setInchargeClassIds([]);
    }
  };

  const signOut = async () => {
    if (userRole?.school_id === DEMO_SCHOOL_ID) {
      try {
        await cleanupDemoSchoolModifications(userRole.school_id);
      } catch (err) {
        console.error('Error cleaning demo school data on sign out:', err);
      }
    }
    await supabase.auth.signOut();
  };

  /**
   * Returns true if the user may access a given module.
   * Admins always pass. Others check their permissions.modules map;
   * if the key is absent (never been set), default to true.
   */
  const canAccess = useCallback((moduleKey: string): boolean => {
    if (!userRole) return false;
    if (['admin', 'director', 'principal'].includes(userRole.role)) return true;
    const modules = userRole.permissions?.modules;
    if (!modules || modules[moduleKey] === undefined) return true;
    return modules[moduleKey] === true;
  }, [userRole]);

  /**
   * Returns true if the user may perform an action.
   * Admins and Directors always pass. Others must have the action explicitly enabled.
   */
  const canDo = useCallback((actionKey: string): boolean => {
    if (!userRole) return false;
    if (['admin', 'director'].includes(userRole.role)) return true;
    const actions = userRole.permissions?.actions;
    if (actions && actions[actionKey] !== undefined) {
      return actions[actionKey] === true;
    }
    // Fallback to role presets if permissions dictionary has not set this action key explicitly
    return false;
  }, [userRole]);

  /**
   * Check if user is Class Incharge of a given classId (or any class if no classId passed)
   */
  const isClassIncharge = useCallback((classId?: string): boolean => {
    if (inchargeClassIds.length === 0) return false;
    if (!classId) return inchargeClassIds.length > 0;
    return inchargeClassIds.includes(classId);
  }, [inchargeClassIds]);

  /**
   * Check if user can manage/view complete class diary for a class.
   * Admins, Principals, Directors, Coordinators OR users with explicit action OR Class Incharge.
   */
  const canManageClassDiary = useCallback((classId?: string): boolean => {
    if (!userRole) return false;
    if (['admin', 'director', 'principal', 'vice_principal', 'academic_coordinator', 'campus_coordinator', 'section_coordinator'].includes(userRole.role)) return true;
    if (canDo('manage_class_diary')) return true;
    return isClassIncharge(classId);
  }, [userRole, canDo, isClassIncharge]);

  /**
   * Check if user can manage exams for a class.
   * Admins, Principals, Directors, Coordinators OR users with explicit action OR Class Incharge.
   */
  const canManageExams = useCallback((classId?: string): boolean => {
    if (!userRole) return false;
    if (['admin', 'director', 'principal', 'vice_principal', 'academic_coordinator', 'campus_coordinator', 'section_coordinator'].includes(userRole.role)) return true;
    if (canDo('manage_exams')) return true;
    return isClassIncharge(classId);
  }, [userRole, canDo, isClassIncharge]);

  // Memoize the full context value to prevent spurious re-renders in all consumers
  const contextValue = useMemo(() => ({
    session, user, userRole, allRoles, inchargeClassIds, loading, roleNotFound, signOut, switchRole,
    canAccess, canDo, isClassIncharge, canManageClassDiary, canManageExams
  }), [
    session, user, userRole, allRoles, inchargeClassIds, loading, roleNotFound, signOut, switchRole,
    canAccess, canDo, isClassIncharge, canManageClassDiary, canManageExams
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

