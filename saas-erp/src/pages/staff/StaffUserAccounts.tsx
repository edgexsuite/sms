import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth, PermissionSet } from '../../contexts/AuthContext';
import {
  UserPlus, Shield, Key, Trash2, Search, RefreshCw,
  CheckCircle, XCircle, Clock, Eye, EyeOff, Copy, AlertTriangle,
  Users, Lock, Unlock, Settings, X, Save, MessageCircle,
  ChevronLeft, Mail, Phone, Building2, ShieldCheck,
  Wand2, CheckCheck, Filter, ChevronDown, Activity,
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
  // from user_roles
  system_role: string | null;
  account_active: boolean | null;
  last_login: string | null;
  permissions: PermissionSet | null;
  user_roles_id: string | null;
  plain_password: string | null;
  login_email: string | null;
}

const SYSTEM_ROLES = ['director', 'principal', 'admin', 'teacher', 'staff', 'accountant', 'librarian'] as const;
type SystemRole = typeof SYSTEM_ROLES[number];

const ROLE_COLORS: Record<string, string> = {
  director:   'bg-slate-900 text-white border-slate-700 shadow-md ring-1 ring-slate-800',
  principal:  'bg-blue-700 text-white border-blue-600 shadow-sm',
  admin:      'bg-red-600 text-white border-red-500 shadow-sm',
  teacher:    'bg-blue-500/15 text-blue-700 border-blue-300',
  staff:      'bg-violet-500/15 text-violet-700 border-violet-300',
  accountant: 'bg-amber-500/15 text-amber-700 border-amber-300',
  librarian:  'bg-emerald-500/15 text-emerald-700 border-emerald-300',
};

const ROLE_BG: Record<string, string> = {
  director:   'from-slate-800 to-slate-900',
  principal:  'from-blue-700 to-blue-900',
  admin:      'from-red-600 to-red-800',
  teacher:    'from-blue-500 to-indigo-600',
  staff:      'from-violet-500 to-purple-600',
  accountant: 'from-amber-500 to-orange-600',
  librarian:  'from-emerald-500 to-teal-600',
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
  director:   { modules: { students: true,  academic: true,  finance: true,  services: true,  reports: true,  settings: true  }, actions: { delete_student: true,  delete_staff: true,  delete_expenses: true  } },
  principal:  { modules: { students: true,  academic: true,  finance: true,  services: true,  reports: true,  settings: true  }, actions: { delete_student: true,  delete_staff: false, delete_expenses: false } },
  admin:      { modules: { students: true,  academic: true,  finance: true,  services: true,  reports: true,  settings: true  }, actions: { delete_student: true,  delete_staff: true,  delete_expenses: true  } },
  teacher:    { modules: { students: true,  academic: true,  finance: false, services: false, reports: false, settings: false }, actions: { delete_student: false, delete_staff: false, delete_expenses: false } },
  staff:      { modules: { students: true,  academic: false, finance: true,  services: true,  reports: false, settings: false }, actions: { delete_student: false, delete_staff: false, delete_expenses: false } },
  accountant: { modules: { students: false, academic: false, finance: true,  services: false, reports: true,  settings: false }, actions: { delete_student: false, delete_staff: false, delete_expenses: true  } },
  librarian:  { modules: { students: true,  academic: false, finance: false, services: true,  reports: false, settings: false }, actions: { delete_student: false, delete_staff: false, delete_expenses: false } },
};

function generatePassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `Edge@${digits}`;
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  const colorMap: Record<string, string> = {
    indigo:  'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber:   'bg-amber-50 text-amber-600 border-amber-100',
    slate:   'bg-slate-50 text-slate-500 border-slate-200',
    red:     'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colorMap[color]} `}>
      <Icon className="w-5 h-5 shrink-0" />
      <div>
        <p className="text-xl font-black leading-none">{value}</p>
        <p className="text-[11px] font-medium mt-0.5 opacity-75">{label}</p>
      </div>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ s }: { s: StaffWithAccount }) {
  if (!s.has_login)
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">No Access</span>;
  if (s.account_active === false)
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Suspended</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active</span>;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StaffUserAccounts() {
  const { userRole } = useAuth();

  // Data
  const [staffList,  setStaffList]  = useState<StaffWithAccount[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<StaffWithAccount | null>(null);

  // Filters
  const [search,        setSearch]       = useState('');
  const [filterAccess,  setFilterAccess] = useState<'all' | 'has' | 'none'>('all');
  const [filterDept,    setFilterDept]   = useState('');
  const [showFilters,   setShowFilters]  = useState(false);

  // Mobile navigation
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Credential card
  const [credReveal,   setCredReveal]   = useState(false);
  const [copiedField,  setCopiedField]  = useState<string | null>(null);

  // Create-account form
  const [showCreate,    setShowCreate]    = useState(false);
  const [createRole,    setCreateRole]    = useState<SystemRole>('teacher');
  const [createEmail,   setCreateEmail]   = useState('');
  const [createPass,    setCreatePass]    = useState('');
  const [showPass,      setShowPass]      = useState(false);
  const [creating,      setCreating]      = useState(false);
  const [createError,   setCreateError]   = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Reset-password
  const [showReset,     setShowReset]     = useState(false);
  const [resetPass,     setResetPass]     = useState('');
  const [resetEmail,    setResetEmail]    = useState('');
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetting,     setResetting]     = useState(false);

  // Permissions
  const [showPerms,    setShowPerms]    = useState(false);
  const [editPerms,    setEditPerms]    = useState<PermissionSet>({ modules: {}, actions: {} });
  const [savingPerms,  setSavingPerms]  = useState(false);

  // Confirm modal
  const [confirm, setConfirm] = useState<{ action: string; label: string } | null>(null);
  const [working, setWorking] = useState(false);

  // Bulk grant
  const [bulkGranting, setBulkGranting] = useState(false);

  // Guard
  if (!['admin', 'director', 'principal'].includes(userRole?.role || '')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
        <Shield className="w-10 h-10 text-red-300" />
        <p className="text-sm font-medium">Access restricted — Administrators / Directors only.</p>
      </div>
    );
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    try {
      const { data: staffData, error: staffErr } = await supabase
        .from('staff')
        .select('id, full_name, role, department, email, whatsapp_number, photograph_url, is_active, has_login, user_id')
        .eq('school_id', userRole.school_id)
        .eq('is_deleted', false)
        .order('full_name');

      if (staffErr) throw staffErr;

      // Try full query first; fall back gracefully if migration columns missing
      let rolesData: any[] = [];
      const { data: r1, error: re1 } = await supabase
        .from('user_roles')
        .select('id, user_id, staff_id, role, is_active, last_login, permissions, plain_password, login_email')
        .eq('school_id', userRole.school_id)
        .neq('role', 'admin')
        .neq('role', 'parent');

      if (!re1) {
        rolesData = r1 ?? [];
      } else {
        // Fallback: columns plain_password/login_email/staff_id may not exist yet
        const { data: r2 } = await supabase
          .from('user_roles')
          .select('id, user_id, role, is_active, last_login, permissions')
          .eq('school_id', userRole.school_id)
          .neq('role', 'admin')
          .neq('role', 'parent');
        rolesData = (r2 ?? []).map((r: any) => ({ ...r, staff_id: null, plain_password: null, login_email: null }));
      }

      const byStaff = new Map<string, any>();
      const byUser  = new Map<string, any>();
      rolesData.forEach((r: any) => {
        if (r.staff_id) byStaff.set(r.staff_id, r);
        if (r.user_id)  byUser.set(r.user_id, r);
      });

      const merged: StaffWithAccount[] = (staffData ?? []).map((s: any) => {
        // Match by staff_id first, then by staff.user_id, then by email scan
        const r = byStaff.get(s.id)
          ?? (s.user_id ? byUser.get(s.user_id) : undefined)
          ?? rolesData.find((rd: any) => rd.login_email && rd.login_email === s.email);
        return {
          ...s,
          // Always prefer user_roles.user_id — it's the Supabase auth UUID
          user_id:        r?.user_id       ?? s.user_id ?? null,
          has_login:      !!r,
          system_role:    r?.role          ?? null,
          account_active: r?.is_active     ?? null,
          last_login:     r?.last_login    ?? null,
          permissions:    r?.permissions   ?? null,
          user_roles_id:  r?.id            ?? null,
          plain_password: r?.plain_password ?? null,
          login_email:    r?.login_email   ?? null,
        };
      });

      setStaffList(merged);
      if (selected) {
        const upd = merged.find(m => m.id === selected.id);
        if (upd) setSelected(upd);
      }
    } catch (err) {
      console.error('fetchStaff error:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole?.school_id]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const departments = Array.from(new Set(staffList.map(s => s.department).filter(Boolean))) as string[];

  const filtered = staffList.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.full_name.toLowerCase().includes(q) || (s.role ?? '').toLowerCase().includes(q) || (s.department ?? '').toLowerCase().includes(q);
    const matchAccess = filterAccess === 'all' ? true : filterAccess === 'has' ? s.has_login : !s.has_login;
    const matchDept   = !filterDept || s.department === filterDept;
    return matchSearch && matchAccess && matchDept;
  });

  const totalStaff    = staffList.length;
  const activeAccounts = staffList.filter(s => s.has_login && s.account_active !== false).length;
  const suspended     = staffList.filter(s => s.account_active === false).length;
  const noAccess      = staffList.filter(s => !s.has_login).length;

  // ── Edge fn helper ────────────────────────────────────────────────────────

  const edgeFnError = (_err: any, data: any): string => data?.error ?? 'Edge function unreachable.';

  // ── Credential helpers ────────────────────────────────────────────────────

  const copyField = async (field: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => { });
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAllCredentials = () => {
    if (!selected) return;
    const email = selected.login_email || selected.email || '';
    const pass  = selected.plain_password || '';
    const text  = `Staff Login Credentials\n\nName: ${selected.full_name}\nEmail: ${email}\nPassword: ${pass}\nPortal: ${window.location.origin}`;
    copyField('all', text);
  };

  const sendViaWhatsApp = (phone: string | null, email: string, password: string, name: string) => {
    if (!phone) { alert('No WhatsApp number on file for this staff member.'); return; }
    let num = phone.replace(/[\s\-()+]/g, '');
    if (num.startsWith('0')) num = '92' + num.slice(1);
    const msg = encodeURIComponent(
      `*Your School Login Credentials*\n\nDear ${name},\n\nEmail: ${email}\nPassword: ${password}\nPortal: ${window.location.origin}\n\n_Please log in and change your password._`
    );
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  // ── Store credentials in user_roles after create/reset ────────────────────

  const storeCredentials = async (email: string, password: string, userId: string): Promise<string | null> => {
    // Try with both columns; if columns don't exist yet, return the migration hint
    const { error } = await supabase
      .from('user_roles')
      .update({ plain_password: password, login_email: email })
      .eq('user_id', userId)
      .eq('school_id', userRole!.school_id);
    if (error) {
      console.error('storeCredentials error:', error.message);
      return error.message; // caller can show this
    }
    return null;
  };

  // Resolve auth user_id — tries every available strategy
  const resolveAuthUserId = async (staffId: string, knownUserId?: string | null, email?: string | null): Promise<string | null> => {
    // 1. Already known
    if (knownUserId) return knownUserId;
    // 2. Query user_roles by staff_id
    const { data: byStaffId } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('staff_id', staffId)
      .eq('school_id', userRole!.school_id)
      .maybeSingle();
    if (byStaffId?.user_id) return byStaffId.user_id;
    // 3. Last resort — ask edge function to find auth user by email
    if (email) {
      const { data: found } = await supabase.functions.invoke('create-staff-user', {
        body: { action: 'find_user_by_email', email },
      });
      if (found?.user_id) return found.user_id;
    }
    return null;
  };

  // ── Create account ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!selected || !createEmail || !createPass) return;
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      const permissions = ROLE_PRESETS[createRole];
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: { action: 'create', email: createEmail, password: createPass, school_id: userRole!.school_id, role: createRole, staff_id: selected.id, permissions },
      });
      if (error || data?.error) throw new Error(edgeFnError(error, data));
      setCreateSuccess(`Account created! Email: ${createEmail}  Password: ${createPass}`);
      // Resolve auth user_id — edge fn may or may not return it; query DB as fallback
      const authUserId = await resolveAuthUserId(selected.id, data?.user_id, createEmail);
      if (authUserId) {
        const credErr = await storeCredentials(createEmail, createPass, authUserId);
        if (credErr) setCreateError(`Account created but credentials card failed to save: ${credErr}\n\nRun staff_credentials_migration.sql in Supabase.`);
      }
      await fetchStaff();
      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err.message ?? 'Unknown error — check console.');
    } finally {
      setCreating(false);
    }
  };

  // ── Reset password ────────────────────────────────────────────────────────

  const handleResetPassword = async () => {
    if (!resetPass) return;
    setResetting(true);
    try {
      const email = resetEmail || selected?.login_email || selected?.email || '';
      // Resolve auth user_id via all available strategies including email lookup
      const authUserId = await resolveAuthUserId(selected!.id, selected?.user_id, email);

      // Call edge function — passes both user_id AND email so it can find the user either way
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: {
          action: 'reset_password',
          user_id: authUserId,   // may be null — edge fn will use email instead
          email,                 // always send email as fallback
          new_password: resetPass,
          school_id: userRole!.school_id,
          staff_id: selected!.id,
        },
      });
      if (error || data?.error) throw new Error(edgeFnError(error, data));

      // Use the resolved user_id from the response (edge fn returns it)
      const finalUserId = data?.user_id || authUserId;
      if (finalUserId) {
        await storeCredentials(email, resetPass, finalUserId);
      }
      await fetchStaff();
      setShowReset(false);
      setResetPass('');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  // ── Suspend / Reactivate ──────────────────────────────────────────────────

  const handleSetActive = async (is_active: boolean) => {
    if (!selected?.user_id) return;
    setWorking(true);
    try {
      await supabase.from('user_roles').update({ is_active }).eq('user_id', selected.user_id).eq('school_id', userRole!.school_id);
      await fetchStaff();
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setWorking(false); setConfirm(null); }
  };

  // ── Revoke ────────────────────────────────────────────────────────────────

  const handleRevoke = async () => {
    if (!selected?.user_id) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: { action: 'revoke', user_id: selected.user_id, staff_id: selected.id },
      });
      if (error || data?.error) throw new Error(edgeFnError(error, data));
      await fetchStaff();
      setSelected(prev => prev ? { ...prev, has_login: false, user_id: null, system_role: null, plain_password: null, login_email: null } : null);
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setWorking(false); setConfirm(null); }
  };

  // ── Permissions ───────────────────────────────────────────────────────────

  const openPermEditor = (s: StaffWithAccount) => {
    const base = s.system_role ? ROLE_PRESETS[s.system_role as SystemRole] ?? { modules: {}, actions: {} } : { modules: {}, actions: {} };
    setEditPerms(s.permissions ?? base);
    setShowPerms(true);
    setShowReset(false);
  };

  const handleSavePerms = async () => {
    if (!selected?.user_id) return;
    setSavingPerms(true);
    try {
      await supabase.from('user_roles').update({ permissions: editPerms }).eq('user_id', selected.user_id).eq('school_id', userRole!.school_id);
      await fetchStaff();
      setShowPerms(false);
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setSavingPerms(false); }
  };

  // ── Bulk grant ────────────────────────────────────────────────────────────

  const handleBulkGrant = async () => {
    const noAccountStaff = staffList.filter(s => !s.has_login && s.email);
    if (!noAccountStaff.length) { alert('All staff with an email on file already have accounts.'); return; }
    if (!window.confirm(`Create system accounts for ${noAccountStaff.length} staff members? Each will get email + auto-generated password.\n\nYou can send credentials via WhatsApp after creation.`)) return;
    setBulkGranting(true);
    let success = 0; let failed = 0;
    for (const s of noAccountStaff) {
      try {
        const pw = generatePassword();
        const role = (SYSTEM_ROLES.includes(s.role?.toLowerCase() as SystemRole) ? s.role?.toLowerCase() : 'teacher') as SystemRole;
        const { data, error } = await supabase.functions.invoke('create-staff-user', {
          body: { action: 'create', email: s.email, password: pw, school_id: userRole!.school_id, role, staff_id: s.id, permissions: ROLE_PRESETS[role] },
        });
        if (error || data?.error) { failed++; continue; }
        const authId = await resolveAuthUserId(s.id, data?.user_id);
        if (authId) await storeCredentials(s.email!, pw, authId);
        success++;
      } catch { failed++; }
    }
    await fetchStaff();
    setBulkGranting(false);
    alert(`Done! ${success} accounts created${failed ? `, ${failed} failed (check email conflicts)` : ''}.`);
  };

  // ── Select staff (handles mobile navigation) ──────────────────────────────

  const selectStaff = (s: StaffWithAccount) => {
    setSelected(s);
    setShowCreate(false); setShowReset(false); setShowPerms(false); setCreateSuccess('');
    setCredReveal(false);
    setMobileView('detail');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Stats bar ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Staff"     value={totalStaff}     icon={Users}        color="indigo" />
        <StatCard label="Active Accounts" value={activeAccounts} icon={ShieldCheck}   color="emerald" />
        <StatCard label="Suspended"       value={suspended}      icon={Lock}          color="amber" />
        <StatCard label="No Access"       value={noAccess}       icon={Shield}        color="slate" />
      </div>

      {/* ── Main panel ───────────────────────────────────── */}
      <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 260px)' }}>

        {/* ══ LEFT: Staff list ══ */}
        <div className={`
          flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden shrink-0
          w-full md:w-80
          ${mobileView === 'detail' ? 'hidden md:flex' : 'flex'}
        `}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Staff Members</h2>
              <div className="flex items-center gap-2">
                {noAccess > 0 && (
                  <button
                    onClick={handleBulkGrant}
                    disabled={bulkGranting}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    title="Grant accounts to all staff with email"
                  >
                    {bulkGranting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Bulk Grant ({noAccess})
                  </button>
                )}
                <span className="text-xs text-gray-400 font-medium">{staffList.length}</span>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, role, dept…"
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Access filter pills */}
            <div className="flex gap-1">
              {(['all', 'has', 'none'] as const).map(f => (
                <button key={f} onClick={() => setFilterAccess(f)}
                  className={`flex-1 text-[10px] font-semibold py-1 rounded-md transition-colors ${filterAccess === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {f === 'all' ? 'All' : f === 'has' ? 'Has Access' : 'No Access'}
                </button>
              ))}
            </div>

            {/* Department filter */}
            {departments.length > 0 && (
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>

          {/* Staff list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
                <Users className="w-8 h-8 opacity-20" />
                <span className="text-xs">No staff found</span>
              </div>
            ) : filtered.map(s => (
              <button key={s.id} onClick={() => selectStaff(s)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left ${selected?.id === s.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}`}>
                {s.photograph_url ? (
                  <img src={s.photograph_url} alt={s.full_name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${ROLE_BG[s.role?.toLowerCase() ?? ''] ?? 'from-indigo-400 to-violet-500'} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {s.full_name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.full_name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{s.role}{s.department ? ` · ${s.department}` : ''}</p>
                </div>
                <StatusBadge s={s} />
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100">
            <button onClick={fetchStaff} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>

        {/* ══ RIGHT: Detail panel ══ */}
        <div className={`flex-1 overflow-y-auto space-y-4 pb-8 ${mobileView === 'list' ? 'hidden md:block' : 'block'}`}>

          {/* Back button — mobile only */}
          {mobileView === 'detail' && (
            <button onClick={() => setMobileView('list')}
              className="md:hidden inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 mb-1">
              <ChevronLeft className="w-4 h-4" /> Back to Staff List
            </button>
          )}

          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
              <Users className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a staff member to manage their account</p>
            </div>
          ) : (
            <>
              {/* ── Profile card ── */}
              <div className={`rounded-2xl p-5 bg-gradient-to-br ${selected.system_role ? (ROLE_BG[selected.system_role] ?? 'from-indigo-600 to-violet-700') : 'from-slate-700 to-slate-800'} text-white shadow-lg`}>
                <div className="flex items-start gap-4">
                  {selected.photograph_url ? (
                    <img src={selected.photograph_url} alt={selected.full_name} className="w-16 h-16 rounded-xl object-cover ring-2 ring-white/30" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-2xl ring-2 ring-white/30">
                      {selected.full_name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-white">{selected.full_name}</h1>
                    <p className="text-sm text-white/70 mt-0.5">{selected.role}{selected.department ? ` · ${selected.department}` : ''}</p>

                    {/* Info pills */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(selected.login_email || selected.email) && (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-white/15 px-2.5 py-1 rounded-full">
                          <Mail className="w-3 h-3" /> {selected.login_email || selected.email}
                        </span>
                      )}
                      {selected.whatsapp_number && (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-white/15 px-2.5 py-1 rounded-full">
                          <Phone className="w-3 h-3" /> {selected.whatsapp_number}
                        </span>
                      )}
                      {selected.last_login && (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-white/15 px-2.5 py-1 rounded-full">
                          <Clock className="w-3 h-3" /> Last login: {new Date(selected.last_login).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    <StatusBadge s={selected} />
                  </div>
                </div>
              </div>

              {/* ── Credentials card ── */}
              {selected.has_login && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                        <Key className="w-4 h-4 text-amber-400" />
                      </div>
                      <h3 className="text-sm font-bold text-white">Login Credentials</h3>
                    </div>
                    <button onClick={() => setCredReveal(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-all">
                      {credReveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {credReveal ? 'Hide' : 'Reveal'}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {/* Email */}
                    <div className="bg-white/8 rounded-xl p-3.5 border border-white/10">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5 font-semibold">Email / Username</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-sm text-white truncate flex-1">
                          {selected.login_email || selected.email || <span className="text-slate-500 italic">Not set</span>}
                        </p>
                        {(selected.login_email || selected.email) && (
                          <button onClick={() => copyField('email', selected.login_email || selected.email || '')}
                            className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                            {copiedField === 'email'
                              ? <CheckCheck className="w-4 h-4 text-emerald-400" />
                              : <Copy className="w-4 h-4 text-slate-400 hover:text-white" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Password */}
                    <div className="bg-white/8 rounded-xl p-3.5 border border-white/10">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5 font-semibold">Password</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-sm text-white flex-1">
                          {selected.plain_password
                            ? (credReveal ? selected.plain_password : '•'.repeat(selected.plain_password.length))
                            : <span className="text-slate-500 italic text-xs">Not stored — reset to capture</span>}
                        </p>
                        {selected.plain_password && (
                          <button onClick={() => copyField('pass', selected.plain_password || '')}
                            className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                            {copiedField === 'pass'
                              ? <CheckCheck className="w-4 h-4 text-emerald-400" />
                              : <Copy className="w-4 h-4 text-slate-400 hover:text-white" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dispatch actions */}
                  <div className="flex gap-2 mt-4">
                    <button onClick={copyAllCredentials}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold transition-colors">
                      {copiedField === 'all' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedField === 'all' ? 'Copied!' : 'Copy All'}
                    </button>
                    <button
                      onClick={() => sendViaWhatsApp(
                        selected.whatsapp_number,
                        selected.login_email || selected.email || '',
                        selected.plain_password || '(see admin)',
                        selected.full_name,
                      )}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/80 hover:bg-emerald-500 rounded-xl text-xs font-semibold transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    {selected.system_role && (
                      <span className={`hidden sm:inline-flex items-center text-[10px] font-bold px-3 rounded-xl border ${ROLE_COLORS[selected.system_role] ?? 'bg-white/10 text-white border-white/20'}`}>
                        {selected.system_role.charAt(0).toUpperCase() + selected.system_role.slice(1)}
                      </span>
                    )}
                  </div>

                  {!selected.plain_password && (
                    <p className="mt-3 text-[10px] text-slate-500 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      Password not on file. Use "Reset Password" below to set a new one — it will be saved here.
                    </p>
                  )}
                </div>
              )}

              {/* ── Success banner ── */}
              {createSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-800 mb-1">Account Created Successfully</p>
                    <p className="text-xs text-emerald-700 font-mono bg-emerald-100 px-2 py-1 rounded break-all">{createSuccess}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(createSuccess); }} className="shrink-0 text-emerald-600 hover:text-emerald-800 p-1 rounded-lg hover:bg-emerald-100">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* ── No account yet ── */}
              {!selected.has_login && !showCreate && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <UserPlus className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">No System Access</h3>
                  <p className="text-xs text-gray-400 mb-4">{selected.full_name} doesn't have a login account yet.</p>
                  {!selected.email && (
                    <p className="text-xs text-amber-600 mb-3 flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> No email on file — add email in Staff HR first.
                    </p>
                  )}
                  <button
                    onClick={() => { setCreateEmail(selected.email ?? ''); setCreatePass(generatePassword()); setShowCreate(true); setCreateError(''); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                    <UserPlus className="w-4 h-4" /> Grant Login Access
                  </button>
                </div>
              )}

              {/* ── Create account form ── */}
              {!selected.has_login && showCreate && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-bold text-gray-900">Create Login Account</h3>
                    <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  </div>

                  <div className="space-y-5">
                    {/* System Role */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">System Role</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {SYSTEM_ROLES.map(r => (
                          <button key={r} onClick={() => setCreateRole(r)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${createRole === r ? `${ROLE_COLORS[r]} border-current` : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">Role preset applied. Permissions can be customised after creation.</p>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Login Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="staff@school.com"
                          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Initial Password</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input type={showPass ? 'text' : 'password'} value={createPass} onChange={e => setCreatePass(e.target.value)}
                            className="w-full px-3 py-2.5 pr-9 text-sm font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                          <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button onClick={() => setCreatePass(generatePassword())} className="px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap">New</button>
                        <button onClick={() => copyField('create', createPass)} className="p-2.5 text-gray-400 hover:text-indigo-600 transition-colors rounded-xl hover:bg-indigo-50">
                          {copiedField === 'create' ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Copy this password — it will be saved in credentials for future reference.
                      </p>
                    </div>

                    {createError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-red-700 mb-1">Account creation failed</p>
                            <p className="text-xs text-red-600 font-mono break-all">{createError}</p>
                            <p className="text-xs text-red-400 mt-2">Common causes: edge function not deployed, SQL migration not run, email already exists.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button onClick={handleCreate} disabled={creating || !createEmail || !createPass}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        {creating ? 'Creating…' : 'Create Account'}
                      </button>
                      <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Existing account management ── */}
              {selected.has_login && (
                <>
                  {/* Action grid */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Account Management</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                      <button onClick={() => { setResetPass(generatePassword()); setResetEmail(selected.login_email || selected.email || ''); setShowReset(true); setShowPerms(false); }}
                        className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors">
                          <Key className="w-4.5 h-4.5 text-indigo-600" />
                        </div>
                        <span className="text-xs font-semibold text-gray-600 group-hover:text-indigo-700 text-center">Reset Password</span>
                      </button>

                      <button onClick={() => { openPermEditor(selected); }}
                        className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all group">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center transition-colors">
                          <Settings className="w-4.5 h-4.5 text-violet-600" />
                        </div>
                        <span className="text-xs font-semibold text-gray-600 group-hover:text-violet-700 text-center">Permissions</span>
                      </button>

                      {selected.account_active !== false ? (
                        <button onClick={() => setConfirm({ action: 'suspend', label: 'Suspend this account? The staff member won\'t be able to log in.' })}
                          className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all group">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                            <Lock className="w-4.5 h-4.5 text-amber-600" />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 group-hover:text-amber-700 text-center">Suspend</span>
                        </button>
                      ) : (
                        <button onClick={() => setConfirm({ action: 'reactivate', label: 'Reactivate this account?' })}
                          className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center transition-colors">
                            <Unlock className="w-4.5 h-4.5 text-emerald-600" />
                          </div>
                          <span className="text-xs font-semibold text-emerald-600 text-center">Reactivate</span>
                        </button>
                      )}

                      <button onClick={() => setConfirm({ action: 'revoke', label: 'Revoke all system access? The HR staff record is kept intact.' })}
                        className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all group">
                        <div className="w-9 h-9 rounded-xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center transition-colors">
                          <Trash2 className="w-4.5 h-4.5 text-red-500" />
                        </div>
                        <span className="text-xs font-semibold text-gray-600 group-hover:text-red-600 text-center">Revoke Access</span>
                      </button>
                    </div>
                  </div>

                  {/* Reset password form */}
                  {showReset && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-900">Reset Password</h3>
                        <button onClick={() => setShowReset(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                      </div>

                      {/* Email — editable so admin can correct it at reset time */}
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Login Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                            placeholder="staff@school.com"
                            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Correct the email here if it has changed — will be saved to credentials.</p>
                      </div>

                      {/* New password */}
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">New Password</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input type={showResetPass ? 'text' : 'password'} value={resetPass} onChange={e => setResetPass(e.target.value)}
                              className="w-full px-3 py-2.5 pr-9 text-sm font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                            <button type="button" onClick={() => setShowResetPass(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                              {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <button onClick={() => setResetPass(generatePassword())} className="px-3 text-xs font-semibold bg-gray-100 rounded-xl hover:bg-gray-200">New</button>
                          <button onClick={() => copyField('reset', resetPass)} className="p-2.5 text-gray-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors">
                            {copiedField === 'reset' ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] text-amber-600 flex items-center gap-1 mb-3">
                        <AlertTriangle className="w-3 h-3" /> Both email and password will be saved to the credentials card.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={handleResetPassword} disabled={resetting || !resetPass}
                          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                          {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                          {resetting ? 'Resetting…' : 'Reset Password'}
                        </button>
                        {selected.whatsapp_number && (
                          <button onClick={() => sendViaWhatsApp(selected.whatsapp_number, resetEmail || selected.email || '', resetPass, selected.full_name)}
                            disabled={!resetPass}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                            <MessageCircle className="w-4 h-4" /> Send via WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Permission editor */}
                  {showPerms && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-900">Permission Editor</h3>
                        <button onClick={() => setShowPerms(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                      </div>

                      {/* Presets */}
                      <div className="mb-5">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Quick Presets</p>
                        <div className="flex flex-wrap gap-2">
                          {SYSTEM_ROLES.map(r => (
                            <button key={r} onClick={() => setEditPerms({ ...ROLE_PRESETS[r] })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${ROLE_COLORS[r]}`}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Module visibility */}
                      <div className="mb-5">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Module Visibility</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {MODULES.map(m => (
                            <label key={m.key} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 cursor-pointer hover:border-indigo-200 transition-colors">
                              <span className="text-xs font-medium text-gray-700">{m.label}</span>
                              <div className="relative shrink-0">
                                <input type="checkbox" checked={editPerms.modules[m.key] !== false}
                                  onChange={e => setEditPerms(p => ({ ...p, modules: { ...p.modules, [m.key]: e.target.checked } }))}
                                  className="sr-only peer" />
                                <div className="w-9 h-5 bg-gray-200 peer-checked:bg-indigo-500 rounded-full transition-colors" />
                                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Dangerous actions */}
                      <div className="mb-5">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Dangerous Actions</p>
                        <div className="space-y-2">
                          {ACTIONS.map(a => (
                            <label key={a.key} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 cursor-pointer hover:border-red-200 transition-colors">
                              <span className="flex items-center gap-2 text-xs font-medium text-gray-700">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> {a.label}
                              </span>
                              <div className="relative">
                                <input type="checkbox" checked={editPerms.actions[a.key] === true}
                                  onChange={e => setEditPerms(p => ({ ...p, actions: { ...p.actions, [a.key]: e.target.checked } }))}
                                  className="sr-only peer" />
                                <div className="w-9 h-5 bg-gray-200 peer-checked:bg-red-500 rounded-full transition-colors peer" />
                                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <button onClick={handleSavePerms} disabled={savingPerms}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                        {savingPerms ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {savingPerms ? 'Saving…' : 'Save Permissions'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Confirm modal ─────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Confirm Action</p>
                <p className="text-xs text-gray-500 mt-0.5">{confirm.label}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button
                onClick={() => {
                  if (confirm.action === 'suspend')    handleSetActive(false);
                  if (confirm.action === 'reactivate') handleSetActive(true);
                  if (confirm.action === 'revoke')     handleRevoke();
                }}
                disabled={working}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50 ${confirm.action === 'reactivate' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {working && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {confirm.action === 'suspend' ? 'Suspend' : confirm.action === 'reactivate' ? 'Reactivate' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
