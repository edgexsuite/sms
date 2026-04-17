import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth, PermissionSet } from '../../contexts/AuthContext';
import {
  UserPlus, Shield, ShieldOff, Key, Trash2, Search, RefreshCw,
  CheckCircle, XCircle, Clock, Eye, EyeOff, Copy, AlertTriangle,
  ChevronRight, Users, Lock, Unlock, Settings, X, Save
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface StaffWithAccount {
  id: string;
  full_name: string;
  role: string;
  department: string | null;
  email: string | null;
  whatsapp_number: string | null;
  photograph_url: string | null;
  is_active: boolean;
  has_login: boolean;
  user_id: string | null;
  // joined from user_roles
  system_role: string | null;
  account_active: boolean | null;
  last_login: string | null;
  permissions: PermissionSet | null;
  user_roles_id: string | null;
}

const SYSTEM_ROLES = ['director', 'principal', 'admin', 'teacher', 'staff', 'accountant', 'librarian'] as const;
type SystemRole = typeof SYSTEM_ROLES[number];

const ROLE_COLORS: Record<string, string> = {
  director:   'bg-slate-900 text-white border-slate-700 shadow-md ring-1 ring-slate-800',
  principal:  'bg-blue-700 text-white border-blue-600 shadow-sm',
  admin:      'bg-red-600 text-white border-red-500 shadow-sm',
  teacher:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  staff:      'bg-violet-500/15 text-violet-400 border-violet-500/30',
  accountant: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  librarian:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const MODULES = [
  { key: 'students', label: 'Students Module' },
  { key: 'academic', label: 'Academic Suite' },
  { key: 'finance',  label: 'Financial Module' },
  { key: 'services', label: 'School Services' },
  { key: 'reports',  label: 'Reporting Suite' },
  { key: 'settings', label: 'System Settings' },
];

const ACTIONS = [
  { key: 'delete_student',  label: 'Delete Students',  danger: true },
  { key: 'delete_staff',    label: 'Delete Staff',     danger: true },
  { key: 'delete_expenses', label: 'Delete Expenses',  danger: true },
];

const ROLE_PRESETS: Record<string, PermissionSet> = {
  director: {
    modules: { students: true, academic: true, finance: true, services: true, reports: true, settings: true },
    actions: { delete_student: true, delete_staff: true, delete_expenses: true },
  },
  principal: {
    modules: { students: true, academic: true, finance: true, services: true, reports: true, settings: true },
    actions: { delete_student: true, delete_staff: false, delete_expenses: false },
  },
  admin: {
    modules: { students: true, academic: true, finance: true, services: true, reports: true, settings: true },
    actions: { delete_student: true, delete_staff: true, delete_expenses: true },
  },
  teacher: {
    modules: { students: true,  academic: true,  finance: false, services: false, reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expenses: false },
  },
  staff: {
    modules: { students: true,  academic: false, finance: true,  services: true,  reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expenses: false },
  },
  accountant: {
    modules: { students: false, academic: false, finance: true,  services: false, reports: true,  settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expenses: true },
  },
  librarian: {
    modules: { students: true,  academic: false, finance: false, services: true,  reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expenses: false },
  },
};

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StaffUserAccounts() {
  const { userRole } = useAuth();

  // Data
  const [staffList, setStaffList]       = useState<StaffWithAccount[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<StaffWithAccount | null>(null);

  // Filters
  const [search, setSearch]             = useState('');
  const [filterAccess, setFilterAccess] = useState<'all' | 'has' | 'none'>('all');

  // Create-account form
  const [showCreate, setShowCreate]     = useState(false);
  const [createRole, setCreateRole]     = useState<SystemRole>('teacher');
  const [createEmail, setCreateEmail]   = useState('');
  const [createPass, setCreatePass]     = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Reset-password form
  const [showReset, setShowReset]       = useState(false);
  const [resetPass, setResetPass]       = useState('');
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetting, setResetting]       = useState(false);

  // Permission editor
  const [showPerms, setShowPerms]       = useState(false);
  const [editPerms, setEditPerms]       = useState<PermissionSet>({ modules: {}, actions: {} });
  const [savingPerms, setSavingPerms]   = useState(false);

  // Confirm modal
  const [confirm, setConfirm]           = useState<{ action: string; label: string } | null>(null);
  const [working, setWorking]           = useState(false);

  // Admin-only guard (Allow Director, Principal as well)
  if (!['admin', 'director', 'principal'].includes(userRole?.role || '')) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Shield className="w-8 h-8 mr-3 text-red-400" />
        Access restricted — System Administrators/Directors only.
      </div>
    );
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    try {
      // Try with migration columns first; fall back to base columns if migration not yet run
      let staffData: any[] | null = null;
      const { data: d1, error: e1 } = await supabase
        .from('staff')
        .select('id, full_name, role, department, email, whatsapp_number, photograph_url, is_active, has_login, user_id')
        .eq('school_id', userRole.school_id)
        .eq('is_deleted', false)
        .order('full_name');

      if (e1) {
        // Migration not run yet — fetch without new columns
        console.warn('StaffUserAccounts: migration columns missing, using fallback query', e1.message);
        const { data: d2, error: e2 } = await supabase
          .from('staff')
          .select('id, full_name, role, department, email, whatsapp_number, photograph_url, is_active')
          .eq('school_id', userRole.school_id)
          .order('full_name');
        if (e2) { console.error('fetchStaff fallback error:', e2); setLoading(false); return; }
        staffData = (d2 ?? []).map(s => ({ ...s, has_login: false, user_id: null }));
      } else {
        staffData = d1 ?? [];
      }

      // Fetch user_roles — try with new columns, fallback without staff_id/permissions/last_login
      let rolesData: any[] | null = null;
      const { data: r1, error: re1 } = await supabase
        .from('user_roles')
        .select('id, user_id, staff_id, role, is_active, last_login, permissions')
        .eq('school_id', userRole.school_id)
        .neq('role', 'admin')
        .neq('role', 'parent');

      if (re1) {
        console.warn('StaffUserAccounts: user_roles migration columns missing', re1.message);
        const { data: r2 } = await supabase
          .from('user_roles')
          .select('id, user_id, role')
          .eq('school_id', userRole.school_id)
          .neq('role', 'admin')
          .neq('role', 'parent');
        rolesData = (r2 ?? []).map(r => ({ ...r, staff_id: null, is_active: true, last_login: null, permissions: null }));
      } else {
        rolesData = r1 ?? [];
      }

      // Build staff_id → role map; also match by user_id for pre-migration rows
      const rolesMapByStaff = new Map<string, any>();
      const rolesMapByUser  = new Map<string, any>();
      rolesData.forEach(r => {
        if (r.staff_id) rolesMapByStaff.set(r.staff_id, r);
        if (r.user_id)  rolesMapByUser.set(r.user_id, r);
      });

      const merged: StaffWithAccount[] = staffData.map(s => {
        const r = rolesMapByStaff.get(s.id) ?? (s.user_id ? rolesMapByUser.get(s.user_id) : undefined);
        return {
          ...s,
          system_role:    r?.role ?? null,
          account_active: r?.is_active ?? null,
          last_login:     r?.last_login ?? null,
          permissions:    r?.permissions ?? null,
          user_roles_id:  r?.id ?? null,
        };
      });

      setStaffList(merged);
      if (selected) {
        const updated = merged.find(m => m.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch (err) {
      console.error('fetchStaff unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // ── Derived list ───────────────────────────────────────────────────────────

  const filtered = staffList.filter(s => {
    const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.role ?? '').toLowerCase().includes(search.toLowerCase());
    const matchAccess = filterAccess === 'all' ? true
      : filterAccess === 'has' ? s.has_login
      : !s.has_login;
    return matchSearch && matchAccess;
  });

  // ── Helper: extract error message from edge function response ────────────────
  // Edge function always returns HTTP 200; errors land in data.error.
  const edgeFnError = (_error: any, data: any): string => {
    return data?.error ?? 'Edge function unreachable — check it is deployed.';
  };

  // ── Account creation (needs edge fn — creates auth user) ──────────────────

  const handleCreate = async () => {
    if (!selected || !createEmail || !createPass) return;
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      const permissions = ROLE_PRESETS[createRole];

      console.log('Creating staff account:', {
        email: createEmail,
        role: createRole,
        staff_id: selected.id,
        school_id: userRole!.school_id,
      });

      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: {
          action: 'create',
          email: createEmail,
          password: createPass,
          school_id: userRole!.school_id,
          role: createRole,
          staff_id: selected.id,
          permissions,
        },
      });

      console.log('Edge function response:', { data, error });

      if (error || data?.error) {
        const msg = edgeFnError(error, data);
        console.error('Create account error:', msg);
        throw new Error(msg);
      }

      setCreateSuccess(`Account created! Email: ${createEmail}  Password: ${createPass}`);
      await fetchStaff();
      setShowCreate(false);
    } catch (err: any) {
      console.error('handleCreate caught:', err);
      setCreateError(err.message ?? 'Unknown error — check browser console for details.');
    } finally {
      setCreating(false);
    }
  };

  // ── Password reset (needs edge fn — uses auth.admin API) ──────────────────

  const handleResetPassword = async () => {
    if (!selected?.user_id || !resetPass) return;
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: { action: 'reset_password', user_id: selected.user_id, new_password: resetPass },
      });
      if (error || data?.error) throw new Error(edgeFnError(error, data));
      alert(`Password reset successfully.\nNew password: ${resetPass}`);
      setShowReset(false);
      setResetPass('');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  // ── Suspend / Reactivate (direct DB — no edge fn needed) ──────────────────

  const handleSetActive = async (is_active: boolean) => {
    if (!selected?.user_id) return;
    setWorking(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active })
        .eq('user_id', selected.user_id)
        .eq('school_id', userRole!.school_id);
      if (error) throw error;
      await fetchStaff();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  // ── Revoke access (needs edge fn — deletes auth user) ─────────────────────

  const handleRevoke = async () => {
    if (!selected?.user_id) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: { action: 'revoke', user_id: selected.user_id, staff_id: selected.id },
      });
      if (error || data?.error) throw new Error(edgeFnError(error, data));
      await fetchStaff();
      setSelected(prev => prev ? { ...prev, has_login: false, user_id: null, system_role: null } : null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  // ── Permissions save (direct DB — no edge fn needed) ─────────────────────

  const openPermEditor = (s: StaffWithAccount) => {
    const base = s.system_role ? ROLE_PRESETS[s.system_role as SystemRole] ?? { modules: {}, actions: {} } : { modules: {}, actions: {} };
    setEditPerms(s.permissions ?? base);
    setShowPerms(true);
  };

  const handleSavePerms = async () => {
    if (!selected?.user_id) return;
    setSavingPerms(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ permissions: editPerms })
        .eq('user_id', selected.user_id)
        .eq('school_id', userRole!.school_id);
      if (error) throw error;
      await fetchStaff();
      setShowPerms(false);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSavingPerms(false);
    }
  };

  const applyPreset = (role: SystemRole) => {
    setEditPerms({ ...ROLE_PRESETS[role] });
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text).catch(() => {});

  const statusBadge = (s: StaffWithAccount) => {
    if (!s.has_login) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
        No Access
      </span>
    );
    if (s.account_active === false) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />Suspended
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active
      </span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4 overflow-hidden">

      {/* ── Left: Staff list ──────────────────────────────────────── */}
      <div className="w-80 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden shrink-0">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">Staff Members</h2>
            <span className="text-xs text-gray-400 font-medium">{staffList.length} total</span>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or role…"
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'has', 'none'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterAccess(f)}
                className={`flex-1 text-[10px] font-semibold py-1 rounded-md transition-colors ${
                  filterAccess === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'All' : f === 'has' ? 'Has Access' : 'No Access'}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No staff found</div>
          ) : (
            filtered.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelected(s); setShowCreate(false); setShowReset(false); setShowPerms(false); setCreateSuccess(''); }}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left ${
                  selected?.id === s.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
                }`}
              >
                {/* Avatar */}
                {s.photograph_url ? (
                  <img src={s.photograph_url} alt={s.full_name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {s.full_name[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.full_name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{s.role}{s.department ? ` · ${s.department}` : ''}</p>
                </div>
                <div className="shrink-0">{statusBadge(s)}</div>
              </button>
            ))
          )}
        </div>

        {/* Refresh */}
        <div className="px-4 py-2 border-t border-gray-100">
          <button onClick={fetchStaff} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Right: Detail panel ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
            <Users className="w-12 h-12 opacity-20" />
            <p className="text-sm">Select a staff member to manage their account</p>
          </div>
        ) : (
          <div className="space-y-4 pb-8">

            {/* ── Profile card ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-start gap-4">
                {selected.photograph_url ? (
                  <img src={selected.photograph_url} alt={selected.full_name} className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-black text-xl">
                    {selected.full_name[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-gray-900">{selected.full_name}</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{selected.role}{selected.department ? ` · ${selected.department}` : ''}</p>
                  {selected.email && <p className="text-xs text-gray-400 mt-1">{selected.email}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {statusBadge(selected)}
                    {selected.system_role && (
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[selected.system_role] ?? ''}`}>
                        {selected.system_role.charAt(0).toUpperCase() + selected.system_role.slice(1)}
                      </span>
                    )}
                    {selected.last_login && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock className="w-3 h-3" />
                        Last login: {new Date(selected.last_login).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Success banner ── */}
            {createSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-800 mb-1">Account Created Successfully</p>
                  <p className="text-xs text-emerald-700 font-mono bg-emerald-100 px-2 py-1 rounded">{createSuccess}</p>
                </div>
                <button onClick={() => copyToClipboard(createSuccess)} className="text-emerald-600 hover:text-emerald-800">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── No account yet ── */}
            {!selected.has_login && !showCreate && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                <UserPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-700 mb-1">No System Access</h3>
                <p className="text-xs text-gray-400 mb-4">{selected.full_name} doesn't have a login account yet.</p>
                <button
                  onClick={() => {
                    setCreateEmail(selected.email ?? '');
                    setCreatePass(generatePassword());
                    setShowCreate(true);
                    setCreateError('');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Grant Login Access
                </button>
              </div>
            )}

            {/* ── Create account form ── */}
            {!selected.has_login && showCreate && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">Create Login Account</h3>
                  <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* System Role */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">System Role</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {SYSTEM_ROLES.map(r => (
                        <button
                          key={r}
                          onClick={() => setCreateRole(r)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            createRole === r
                              ? `${ROLE_COLORS[r]} border-current`
                              : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Role preset will be applied — permissions can be customised after creation.
                    </p>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Login Email</label>
                    <input
                      type="email"
                      value={createEmail}
                      onChange={e => setCreateEmail(e.target.value)}
                      placeholder="staff@school.com"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Initial Password</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={createPass}
                          onChange={e => setCreatePass(e.target.value)}
                          className="w-full px-3 py-2 pr-9 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(p => !p)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        onClick={() => setCreatePass(generatePassword())}
                        className="px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={() => copyToClipboard(createPass)}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Copy and share this password with the staff member — it won't be shown again.
                    </p>
                  </div>

                  {createError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-700 mb-1">Account creation failed</p>
                          <p className="text-xs text-red-600 font-mono break-all">{createError}</p>
                          <p className="text-xs text-red-400 mt-2">
                            Check browser console (F12 → Console) for full details.
                            Common causes: migration SQL not run, edge function not deployed, or email already exists.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCreate}
                      disabled={creating || !createEmail || !createPass}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {creating ? 'Creating…' : 'Create Account'}
                    </button>
                    <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Existing account management ── */}
            {selected.has_login && (
              <>
                {/* Action buttons */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Account Management</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                    {/* Reset Password */}
                    <button
                      onClick={() => { setResetPass(generatePassword()); setShowReset(true); setShowPerms(false); }}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                    >
                      <Key className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                      <span className="text-xs font-semibold text-gray-600 group-hover:text-indigo-700 text-center">Reset Password</span>
                    </button>

                    {/* Edit Permissions */}
                    <button
                      onClick={() => { openPermEditor(selected); setShowReset(false); }}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all group"
                    >
                      <Settings className="w-5 h-5 text-gray-400 group-hover:text-violet-600 transition-colors" />
                      <span className="text-xs font-semibold text-gray-600 group-hover:text-violet-700 text-center">Permissions</span>
                    </button>

                    {/* Suspend / Reactivate */}
                    {selected.account_active !== false ? (
                      <button
                        onClick={() => setConfirm({ action: 'suspend', label: 'Suspend this account?' })}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all group"
                      >
                        <Lock className="w-5 h-5 text-gray-400 group-hover:text-amber-600 transition-colors" />
                        <span className="text-xs font-semibold text-gray-600 group-hover:text-amber-700 text-center">Suspend</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirm({ action: 'reactivate', label: 'Reactivate this account?' })}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                      >
                        <Unlock className="w-5 h-5 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
                        <span className="text-xs font-semibold text-emerald-600 text-center">Reactivate</span>
                      </button>
                    )}

                    {/* Revoke */}
                    <button
                      onClick={() => setConfirm({ action: 'revoke', label: 'Revoke all access? The staff HR record will be kept.' })}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all group"
                    >
                      <Trash2 className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" />
                      <span className="text-xs font-semibold text-gray-600 group-hover:text-red-600 text-center">Revoke Access</span>
                    </button>
                  </div>
                </div>

                {/* Reset password inline form */}
                {showReset && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-900">Reset Password</h3>
                      <button onClick={() => setShowReset(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showResetPass ? 'text' : 'password'}
                          value={resetPass}
                          onChange={e => setResetPass(e.target.value)}
                          className="w-full px-3 py-2 pr-9 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        />
                        <button type="button" onClick={() => setShowResetPass(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                          {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button onClick={() => setResetPass(generatePassword())} className="px-3 text-xs font-semibold bg-gray-100 rounded-lg hover:bg-gray-200">New</button>
                      <button onClick={() => copyToClipboard(resetPass)} className="p-2 text-gray-400 hover:text-indigo-600"><Copy className="w-4 h-4" /></button>
                    </div>
                    <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Share this new password with the staff member.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleResetPassword}
                        disabled={resetting || !resetPass}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                        {resetting ? 'Resetting…' : 'Reset Password'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Permission editor */}
                {showPerms && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-gray-900">Permission Editor</h3>
                      <button onClick={() => setShowPerms(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>

                    {/* Presets */}
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">Apply preset then customise:</p>
                      <div className="flex flex-wrap gap-2">
                        {SYSTEM_ROLES.map(r => (
                          <button
                            key={r}
                            onClick={() => applyPreset(r)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${ROLE_COLORS[r]}`}
                          >
                            {r.charAt(0).toUpperCase() + r.slice(1)} preset
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Module visibility */}
                    <div className="mb-4">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Module Visibility</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {MODULES.map(m => (
                          <label key={m.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 cursor-pointer hover:border-indigo-200 transition-colors">
                            <input
                              type="checkbox"
                              checked={editPerms.modules[m.key] !== false}
                              onChange={e => setEditPerms(p => ({ ...p, modules: { ...p.modules, [m.key]: e.target.checked } }))}
                              className="w-3.5 h-3.5 rounded text-indigo-600"
                            />
                            <span className="text-xs font-medium text-gray-700">{m.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Dangerous actions */}
                    <div className="mb-5">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Dangerous Actions</p>
                      <div className="space-y-2">
                        {ACTIONS.map(a => (
                          <label key={a.key} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50 cursor-pointer hover:border-red-200 transition-colors">
                            <span className="flex items-center gap-2 text-xs font-medium text-gray-700">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              {a.label}
                            </span>
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={editPerms.actions[a.key] === true}
                                onChange={e => setEditPerms(p => ({ ...p, actions: { ...p.actions, [a.key]: e.target.checked } }))}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-checked:bg-red-500 rounded-full transition-colors peer" />
                              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleSavePerms}
                      disabled={savingPerms}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {savingPerms ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {savingPerms ? 'Saving…' : 'Save Permissions'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Confirm modal ─────────────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Confirm Action</p>
                <p className="text-xs text-gray-500 mt-0.5">{confirm.label}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirm.action === 'suspend')    handleSetActive(false);
                  if (confirm.action === 'reactivate') handleSetActive(true);
                  if (confirm.action === 'revoke')     handleRevoke();
                }}
                disabled={working}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 ${
                  confirm.action === 'reactivate' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {working ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                {confirm.action === 'suspend' ? 'Suspend' : confirm.action === 'reactivate' ? 'Reactivate' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
