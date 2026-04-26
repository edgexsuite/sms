import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  Shield, Users, Lock, Save, Trash2,
  Eye, CheckCircle2, XCircle, AlertCircle,
  Key, UserCog, ExternalLink, ShieldCheck,
  ChevronDown, Search, UserCheck, RefreshCw,
  BookOpen, DollarSign, GraduationCap, Settings,
  Library, Bus, BarChart2, LayoutDashboard,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const MODULES = [
  { id: 'dashboard', name: 'Dashboard',           icon: LayoutDashboard },
  { id: 'students',  name: 'Students',             icon: GraduationCap  },
  { id: 'staff',     name: 'Staff & Payroll',      icon: Users          },
  { id: 'finance',   name: 'Fees & Expenses',      icon: DollarSign     },
  { id: 'academic',  name: 'Exams & Results',      icon: BookOpen       },
  { id: 'services',  name: 'Library & Transport',  icon: Library        },
  { id: 'reports',   name: 'Reports',              icon: BarChart2      },
  { id: 'settings',  name: 'System Settings',      icon: Settings       },
];

const ACTIONS = [
  { id: 'delete_student', name: 'Delete Students',  desc: 'Move student records to trash'  },
  { id: 'delete_staff',   name: 'Delete Staff',     desc: 'Move staff records to trash'    },
  { id: 'delete_expense', name: 'Delete Expenses',  desc: 'Remove financial transactions'  },
];

interface RolePreset {
  label:   string;
  color:   string;
  bgLight: string;
  ring:    string;
  modules: Record<string, boolean>;
  actions: Record<string, boolean>;
  desc:    string;
}

const ROLE_PRESETS: Record<string, RolePreset> = {
  admin: {
    label: 'Admin', color: 'text-indigo-700', bgLight: 'bg-indigo-50', ring: 'ring-indigo-300',
    desc: 'Full access to all modules and system settings.',
    modules: { dashboard: true,  students: true,  staff: true,  finance: true,  academic: true,  services: true,  reports: true,  settings: true  },
    actions: { delete_student: true,  delete_staff: true,  delete_expense: true  },
  },
  principal: {
    label: 'Principal', color: 'text-violet-700', bgLight: 'bg-violet-50', ring: 'ring-violet-300',
    desc: 'Full view of all modules, no system settings or bulk deletes.',
    modules: { dashboard: true,  students: true,  staff: true,  finance: true,  academic: true,  services: true,  reports: true,  settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  director: {
    label: 'Director', color: 'text-purple-700', bgLight: 'bg-purple-50', ring: 'ring-purple-300',
    desc: 'All access including deletions. Same as admin.',
    modules: { dashboard: true,  students: true,  staff: true,  finance: true,  academic: true,  services: true,  reports: true,  settings: false },
    actions: { delete_student: true,  delete_staff: true,  delete_expense: true  },
  },
  teacher: {
    label: 'Teacher', color: 'text-blue-700', bgLight: 'bg-blue-50', ring: 'ring-blue-300',
    desc: 'Dashboard, students view, academic entry. No finance or settings.',
    modules: { dashboard: true,  students: true,  staff: false, finance: false, academic: true,  services: false, reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  accountant: {
    label: 'Accountant', color: 'text-emerald-700', bgLight: 'bg-emerald-50', ring: 'ring-emerald-300',
    desc: 'Finance and reports only. Can delete expenses.',
    modules: { dashboard: true,  students: false, staff: false, finance: true,  academic: false, services: false, reports: true,  settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: true  },
  },
  staff: {
    label: 'Staff', color: 'text-cyan-700', bgLight: 'bg-cyan-50', ring: 'ring-cyan-300',
    desc: 'General access — students, finance, academic, services.',
    modules: { dashboard: true,  students: true,  staff: false, finance: true,  academic: true,  services: true,  reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  librarian: {
    label: 'Librarian', color: 'text-amber-700', bgLight: 'bg-amber-50', ring: 'ring-amber-300',
    desc: 'Dashboard, student lookup, and library/transport services.',
    modules: { dashboard: true,  students: true,  staff: false, finance: false, academic: false, services: true,  reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
};

const ROLE_ORDER = ['admin', 'director', 'principal', 'teacher', 'accountant', 'staff', 'librarian'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PermissionManager() {
  const { userRole } = useAuth();

  // All accounts (for dropdown)
  const [accounts,    setAccounts]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);

  // Selected account editor
  const [selectedId,  setSelectedId]  = useState<string>('');
  const [editPerms,   setEditPerms]   = useState<{ modules: Record<string,boolean>; actions: Record<string,boolean> }>({ modules: {}, actions: {} });
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [searchQ,     setSearchQ]     = useState('');

  // PIN
  const [currentPin,  setCurrentPin]  = useState('1122');
  const [newPin,      setNewPin]      = useState('');
  const [updatingPin, setUpdatingPin] = useState(false);
  const [pinOk,       setPinOk]       = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (userRole?.school_id) { fetchAccounts(); fetchPin(); }
  }, [userRole]);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_roles')
      .select('id, role, login_email, user_id, is_active, permissions, staff_id')
      .eq('school_id', userRole!.school_id)
      .order('role');
    setAccounts((data || []).map(r => ({
      ...r,
      permissions: r.permissions || { modules: {}, actions: {} },
    })));
    setLoading(false);
  };

  const fetchPin = async () => {
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole!.school_id)
      .eq('form_name', 'security_settings')
      .maybeSingle();
    setCurrentPin(data?.sections_config?.delete_pin || '1122');
  };

  // ── Selected account sync ──────────────────────────────────────────────────

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedId) || null,
    [accounts, selectedId],
  );

  useEffect(() => {
    if (selectedAccount) {
      setEditPerms({
        modules: { ...selectedAccount.permissions.modules },
        actions: { ...selectedAccount.permissions.actions },
      });
      setSaved(false);
    }
  }, [selectedId]); // eslint-disable-line

  // ── Derived ────────────────────────────────────────────────────────────────

  const roleCounts = useMemo(() => {
    const m: Record<string, number> = {};
    accounts.forEach(a => { m[a.role] = (m[a.role] || 0) + 1; });
    return m;
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQ.toLowerCase();
    if (!q) return accounts;
    return accounts.filter(a =>
      a.role?.toLowerCase().includes(q) ||
      a.login_email?.toLowerCase().includes(q)
    );
  }, [accounts, searchQ]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const applyPreset = (roleName: string) => {
    const preset = ROLE_PRESETS[roleName.toLowerCase()];
    if (!preset) return;
    setEditPerms({ modules: { ...preset.modules }, actions: { ...preset.actions } });
    setSaved(false);
  };

  const toggleModule = (key: string) => {
    setEditPerms(p => ({ ...p, modules: { ...p.modules, [key]: !p.modules[key] } }));
    setSaved(false);
  };

  const toggleAction = (key: string) => {
    setEditPerms(p => ({ ...p, actions: { ...p.actions, [key]: !p.actions[key] } }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    const { error } = await supabase
      .from('user_roles')
      .update({ permissions: editPerms })
      .eq('id', selectedId);
    if (!error) {
      // Update local list too
      setAccounts(prev => prev.map(a => a.id === selectedId ? { ...a, permissions: editPerms } : a));
      setSaved(true);
    } else {
      alert('Save failed: ' + error.message);
    }
    setSaving(false);
  };

  const handleUpdatePin = async () => {
    if (newPin.length !== 4) return;
    setUpdatingPin(true);
    const { error } = await supabase.from('form_settings').upsert({
      school_id: userRole!.school_id,
      form_name: 'security_settings',
      sections_config: { delete_pin: newPin },
    }, { onConflict: 'school_id,form_name' });
    if (!error) { setCurrentPin(newPin); setNewPin(''); setPinOk(true); setTimeout(() => setPinOk(false), 3000); }
    else alert('PIN error: ' + error.message);
    setUpdatingPin(false);
  };

  // ── Access guard ───────────────────────────────────────────────────────────

  if (userRole?.role !== 'admin') return (
    <div className="flex flex-col items-center justify-center p-20 text-center">
      <Shield className="w-16 h-16 text-red-200 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900">Access Restricted</h1>
      <p className="text-gray-500">Only Admin can access Permission Manager.</p>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <Shield className="w-7 h-7 text-indigo-600" /> Permission Manager
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Select an account to configure module access and power actions.</p>
      </div>

      {/* Role summary pills */}
      <div className="flex flex-wrap gap-2">
        {ROLE_ORDER.filter(r => roleCounts[r]).map(r => {
          const p = ROLE_PRESETS[r];
          return (
            <span key={r} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black ${p.bgLight} ${p.color} border border-current/20`}>
              {p.label}
              <span className="bg-white/60 px-1.5 py-0.5 rounded-full text-[10px]">{roleCounts[r]}</span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-slate-100 text-slate-600">
          Total <span className="bg-white px-1.5 py-0.5 rounded-full text-[10px]">{accounts.length}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Account selector + Role presets ── */}
        <div className="space-y-5">

          {/* Account selector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" /> Select Account
              </h2>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by role or email…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>
            </div>

            {/* Account list */}
            <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-5 h-5 text-slate-300 animate-spin mx-auto" />
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No accounts found.</div>
              ) : (
                filteredAccounts.map(acct => {
                  const preset  = ROLE_PRESETS[acct.role?.toLowerCase()];
                  const isSelected = acct.id === selectedId;
                  return (
                    <button
                      key={acct.id}
                      onClick={() => setSelectedId(acct.id)}
                      className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${preset?.bgLight || 'bg-slate-100'} ${preset?.color || 'text-slate-600'}`}>
                        {acct.role?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black capitalize ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {acct.role}
                          {!acct.is_active && <span className="ml-1.5 text-[9px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Suspended</span>}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{acct.login_email || `ID: ${acct.user_id?.slice(0, 12)}…`}</p>
                      </div>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Role presets */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-violet-600" /> Role Presets
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Select an account then click a preset to apply defaults.</p>
            </div>
            <div className="divide-y divide-slate-50">
              {ROLE_ORDER.map(roleName => {
                const preset = ROLE_PRESETS[roleName];
                const canApply = !!selectedId;
                return (
                  <div key={roleName} className="px-4 py-3 flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${preset.bgLight} ${preset.color}`}>
                      {preset.label.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black ${preset.color}`}>{preset.label}</p>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{preset.desc}</p>
                    </div>
                    <button
                      onClick={() => applyPreset(roleName)}
                      disabled={!canApply}
                      title={canApply ? `Apply ${preset.label} defaults` : 'Select an account first'}
                      className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition ${
                        canApply
                          ? `${preset.bgLight} ${preset.color} hover:ring-2 ${preset.ring}`
                          : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      Apply
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security PIN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-500" /> Delete PIN
            </h2>
            <p className="text-xs text-slate-500">Required to confirm sensitive deletions across the system.</p>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
              <Key className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-lg font-black text-slate-900 tracking-[0.3em]">{currentPin}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password" maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="New 4-digit PIN"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-400 outline-none"
              />
              <button
                onClick={handleUpdatePin}
                disabled={newPin.length !== 4 || updatingPin}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-black text-xs rounded-xl disabled:opacity-40 transition"
              >
                {updatingPin ? '…' : 'Set'}
              </button>
            </div>
            {pinOk && <p className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> PIN updated!</p>}
          </div>

          {/* Quick link */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-indigo-900">User Accounts</p>
              <p className="text-[10px] text-indigo-500 mt-0.5">Create logins, reset passwords, revoke access.</p>
            </div>
            <Link to="/staff/accounts"
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 transition shrink-0">
              Open <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* ── RIGHT: Permission editor ── */}
        <div className="lg:col-span-2">
          {!selectedAccount ? (
            <div className="h-full min-h-[400px] bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
              <div className="text-center space-y-3 px-8">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                  <UserCog className="w-8 h-8 text-slate-300" />
                </div>
                <p className="font-black text-slate-400">Select an account from the list</p>
                <p className="text-sm text-slate-300">Choose a staff account on the left to view and edit their permissions.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* Editor header */}
              {(() => {
                const preset = ROLE_PRESETS[selectedAccount.role?.toLowerCase()];
                return (
                  <div className={`px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4 ${preset?.bgLight || 'bg-slate-50'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${preset?.bgLight || 'bg-white'} ${preset?.color || 'text-slate-600'} border border-current/20`}>
                        {selectedAccount.role?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className={`font-black text-base capitalize ${preset?.color || 'text-slate-900'}`}>
                          {selectedAccount.role} Account
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">{selectedAccount.login_email || `User ID: ${selectedAccount.user_id?.slice(0, 16)}…`}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-xl transition disabled:opacity-50 shadow-lg shadow-indigo-100"
                    >
                      {saving
                        ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                        : saved
                        ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                        : <><Save className="w-4 h-4" /> Save Permissions</>}
                    </button>
                  </div>
                );
              })()}

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Module access */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> Module Visibility
                    </h3>
                    <div className="flex gap-1.5">
                      <button onClick={() => { const m: Record<string,boolean> = {}; MODULES.forEach(mod => { m[mod.id] = true; }); setEditPerms(p => ({ ...p, modules: m })); setSaved(false); }}
                        className="text-[10px] font-black text-indigo-600 hover:underline">All on</button>
                      <span className="text-slate-200">·</span>
                      <button onClick={() => { const m: Record<string,boolean> = {}; MODULES.forEach(mod => { m[mod.id] = false; }); setEditPerms(p => ({ ...p, modules: m })); setSaved(false); }}
                        className="text-[10px] font-black text-slate-400 hover:underline">All off</button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {MODULES.map(mod => {
                      const on  = !!editPerms.modules[mod.id];
                      const Icon = mod.icon;
                      return (
                        <button
                          key={mod.id}
                          onClick={() => toggleModule(mod.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                            on
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                              : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${on ? 'text-indigo-500' : 'text-slate-300'}`} />
                          <span className="flex-1 text-sm font-bold">{mod.name}</span>
                          {on
                            ? <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                            : <XCircle     className="w-4 h-4 text-slate-200 shrink-0"   />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Power actions */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Power Actions
                  </h3>

                  <div className="space-y-2">
                    {ACTIONS.map(action => {
                      const on = !!editPerms.actions[action.id];
                      return (
                        <button
                          key={action.id}
                          onClick={() => toggleAction(action.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                            on
                              ? 'bg-red-50 border-red-200'
                              : 'bg-white border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <Trash2 className={`w-4 h-4 shrink-0 ${on ? 'text-red-500' : 'text-slate-300'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-black ${on ? 'text-red-700' : 'text-slate-400'}`}>{action.name}</p>
                            <p className={`text-[10px] mt-0.5 ${on ? 'text-red-400' : 'text-slate-300'}`}>{action.desc}</p>
                          </div>
                          {/* Toggle switch */}
                          <div className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${on ? 'bg-red-500' : 'bg-slate-200'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Warning */}
                  <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <p className="text-[10px] text-orange-700 font-bold leading-relaxed flex gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Power Actions allow this user to move records to Trash. Final deletion still requires Director verification.
                    </p>
                  </div>

                  {/* Permission summary */}
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Current Access Summary</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MODULES.filter(m => editPerms.modules[m.id]).map(m => (
                        <span key={m.id} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full">{m.name}</span>
                      ))}
                      {ACTIONS.filter(a => editPerms.actions[a.id]).map(a => (
                        <span key={a.id} className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full">{a.name}</span>
                      ))}
                      {Object.values(editPerms.modules).every(v => !v) && Object.values(editPerms.actions).every(v => !v) && (
                        <span className="text-[10px] text-slate-300 italic">No permissions set</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
