import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { logActivity } from '../../lib/auditLog';
import {
  Shield, Users, Lock, Save, Trash2,
  Eye, CheckCircle2, XCircle, AlertCircle,
  Key, UserCog, ExternalLink, ShieldCheck,
  ChevronDown, Search, UserCheck, RefreshCw,
  BookOpen, DollarSign, GraduationCap, Settings,
  Library, Bus, BarChart2, LayoutDashboard,
  ClipboardList, CalendarCheck, CalendarOff,
  MessageSquare, Package, CreditCard, Wallet,
  Scale, Award, RotateCcw, Copy, Check, Filter,
  Sliders, ArrowRight, UserPlus, Info, CheckSquare, Square
} from 'lucide-react';
import {
  ROLE_ORDER, ROLE_LABELS, MODULES, ACTIONS,
  ROLE_PRESETS, ROLE_DISPLAY, getRoleDefaultPermissions,
  PermissionSet, ModuleDef, ActionDef
} from '../../lib/rolePermissions';

// Icon map for 17 modules
const MODULE_ICONS: Record<string, any> = {
  dashboard:     LayoutDashboard,
  students:      GraduationCap,
  staff:         Users,
  academic:      BookOpen,
  diary:         ClipboardList,
  exams:         Award,
  attendance:    CalendarCheck,
  leave:         CalendarOff,
  communication: MessageSquare,
  services:      Bus,
  inventory:     Package,
  fees:          CreditCard,
  expenses:      Wallet,
  payroll:       DollarSign,
  accounting:    Scale,
  reports:       BarChart2,
  settings:      Settings,
};

const MODULE_CATEGORIES = ['Core', 'Academic', 'Operations', 'Finance', 'Administration'] as const;
const ACTION_CATEGORIES = ['Academic', 'Exams', 'Students', 'Finance', 'Danger'] as const;

const ACTION_CATEGORY_LABELS: Record<string, string> = {
  Academic: 'Academic & Class Diary',
  Exams:    'Exams & Report Cards',
  Students: 'Students & Operations',
  Finance:  'Finance & Fee Collections',
  Danger:   'Destructive & Critical Deletions',
};

export default function PermissionManagerPage() {
  const { userRole, roleTemplates, refreshRoleTemplates } = useAuth();

  // Active top-level tab: 'roles' (Role Defaults) vs 'users' (User Overrides)
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');

  // Accounts list
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  // ── Tab 1: Role Defaults State ──
  const [selectedRole, setSelectedRole] = useState<string>('teacher');
  const [roleEditPerms, setRoleEditPerms] = useState<Record<string, PermissionSet>>({});
  const [savingRole, setSavingRole] = useState(false);
  const [roleSaved, setRoleSaved]   = useState(false);

  // ── Tab 2: User Account Overrides State ──
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userEditPerms, setUserEditPerms]   = useState<PermissionSet>({ modules: {}, actions: {} });
  const [savingUser, setSavingUser]         = useState(false);
  const [userSaved, setUserSaved]           = useState(false);
  const [userSearchQ, setUserSearchQ]       = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');

  // Security Delete PIN
  const [currentPin, setCurrentPin]   = useState('1122');
  const [newPin, setNewPin]           = useState('');
  const [updatingPin, setUpdatingPin] = useState(false);
  const [pinOk, setPinOk]             = useState(false);

  // ── Initial Fetch ──
  useEffect(() => {
    if (userRole?.school_id) {
      fetchAccounts();
      fetchPin();
    }
  }, [userRole]);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_roles')
      .select('id, role, login_email, user_id, is_active, permissions, staff_id, staff(full_name, photograph_url, department)')
      .eq('school_id', userRole!.school_id)
      .order('role');

    const mapped = (data || []).map((r: any) => ({
      ...r,
      permissions: r.permissions || { modules: {}, actions: {} },
      staff_name:  r.staff?.full_name || null,
      staff_photo: r.staff?.photograph_url || null,
      staff_dept:  r.staff?.department || null,
    }));
    setAccounts(mapped);
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

  // Sync role defaults when selectedRole changes or roleTemplates change
  useEffect(() => {
    if (!roleEditPerms[selectedRole]) {
      const defs = getRoleDefaultPermissions(selectedRole, roleTemplates);
      setRoleEditPerms(prev => ({
        ...prev,
        [selectedRole]: {
          modules: { ...defs.modules },
          actions: { ...defs.actions },
        }
      }));
    }
  }, [selectedRole, roleTemplates]);

  // Sync user edit perms when selectedUserId changes
  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedUserId) || null,
    [accounts, selectedUserId]
  );

  useEffect(() => {
    if (selectedAccount) {
      const roleDefaults = getRoleDefaultPermissions(selectedAccount.role, roleTemplates);
      const userMods = selectedAccount.permissions?.modules || {};
      const userActs = selectedAccount.permissions?.actions || {};

      // Initialize with effective permissions (role default fallback)
      const mergedMods: Record<string, boolean> = {};
      MODULES.forEach(m => {
        mergedMods[m.id] = userMods[m.id] !== undefined ? !!userMods[m.id] : !!roleDefaults.modules[m.id];
      });

      const mergedActs: Record<string, boolean> = {};
      ACTIONS.forEach(a => {
        mergedActs[a.id] = userActs[a.id] !== undefined ? !!userActs[a.id] : !!roleDefaults.actions[a.id];
      });

      setUserEditPerms({ modules: mergedMods, actions: mergedActs });
      setUserSaved(false);
    }
  }, [selectedUserId, selectedAccount, roleTemplates]);

  // ── Derived Metrics ──
  const roleCounts = useMemo(() => {
    const m: Record<string, number> = {};
    accounts.forEach(a => { m[a.role] = (m[a.role] || 0) + 1; });
    return m;
  }, [accounts]);

  const hasCustomOverrides = (account: any): boolean => {
    if (!account?.permissions) return false;
    const roleDefault = getRoleDefaultPermissions(account.role, roleTemplates);
    const userModules = account.permissions.modules || {};
    const userActions = account.permissions.actions || {};

    for (const mod of MODULES) {
      if (userModules[mod.id] !== undefined && userModules[mod.id] !== !!roleDefault.modules[mod.id]) {
        return true;
      }
    }
    for (const act of ACTIONS) {
      if (userActions[act.id] !== undefined && userActions[act.id] !== !!roleDefault.actions[act.id]) {
        return true;
      }
    }
    return false;
  };

  const filteredAccounts = useMemo(() => {
    const q = userSearchQ.toLowerCase();
    return accounts.filter(a => {
      const matchesRole = userRoleFilter === 'all' || a.role === userRoleFilter;
      if (!matchesRole) return false;
      if (!q) return true;
      return (
        a.role?.toLowerCase().includes(q) ||
        a.login_email?.toLowerCase().includes(q) ||
        a.staff_name?.toLowerCase().includes(q) ||
        a.staff_dept?.toLowerCase().includes(q)
      );
    });
  }, [accounts, userSearchQ, userRoleFilter]);

  // Current active role edit permissions
  const currentRolePerms = useMemo(() => {
    return roleEditPerms[selectedRole] || getRoleDefaultPermissions(selectedRole, roleTemplates);
  }, [selectedRole, roleEditPerms, roleTemplates]);

  // ── Tab 1 Handlers: Role Defaults ──

  const toggleRoleModule = (modId: string) => {
    setRoleEditPerms(prev => {
      const current = prev[selectedRole] || getRoleDefaultPermissions(selectedRole, roleTemplates);
      return {
        ...prev,
        [selectedRole]: {
          ...current,
          modules: { ...current.modules, [modId]: !current.modules[modId] }
        }
      };
    });
    setRoleSaved(false);
  };

  const toggleRoleAction = (actId: string) => {
    setRoleEditPerms(prev => {
      const current = prev[selectedRole] || getRoleDefaultPermissions(selectedRole, roleTemplates);
      return {
        ...prev,
        [selectedRole]: {
          ...current,
          actions: { ...current.actions, [actId]: !current.actions[actId] }
        }
      };
    });
    setRoleSaved(false);
  };

  const setAllRoleModules = (val: boolean, category?: string) => {
    setRoleEditPerms(prev => {
      const current = prev[selectedRole] || getRoleDefaultPermissions(selectedRole, roleTemplates);
      const nextMods = { ...current.modules };
      MODULES.filter(m => !category || m.category === category).forEach(m => {
        nextMods[m.id] = val;
      });
      return {
        ...prev,
        [selectedRole]: { ...current, modules: nextMods }
      };
    });
    setRoleSaved(false);
  };

  const setAllRoleActions = (val: boolean, category?: string) => {
    setRoleEditPerms(prev => {
      const current = prev[selectedRole] || getRoleDefaultPermissions(selectedRole, roleTemplates);
      const nextActs = { ...current.actions };
      ACTIONS.filter(a => !category || a.category === category).forEach(a => {
        nextActs[a.id] = val;
      });
      return {
        ...prev,
        [selectedRole]: { ...current, actions: nextActs }
      };
    });
    setRoleSaved(false);
  };

  const handleResetRoleToPreset = () => {
    const factory = ROLE_PRESETS[selectedRole] || ROLE_PRESETS.staff;
    setRoleEditPerms(prev => ({
      ...prev,
      [selectedRole]: {
        modules: { ...factory.modules },
        actions: { ...factory.actions },
      }
    }));
    setRoleSaved(false);
  };

  const handleSaveRoleDefaults = async () => {
    if (!selectedRole || !userRole?.school_id) return;
    setSavingRole(true);
    try {
      const updatedTemplates = {
        ...roleTemplates,
        [selectedRole]: currentRolePerms,
      };

      const { error } = await supabase.from('form_settings').upsert({
        school_id: userRole.school_id,
        form_name: 'role_permission_templates',
        sections_config: updatedTemplates,
      }, { onConflict: 'school_id,form_name' });

      if (error) throw error;

      await refreshRoleTemplates();
      setRoleSaved(true);
      setTimeout(() => setRoleSaved(false), 3000);

      logActivity({
        school_id: userRole.school_id,
        user_id: userRole.user_id,
        user_name: 'Admin',
        user_role: userRole.role,
        action: 'UPDATE',
        module: 'Settings',
        description: `Saved default permission template for ${ROLE_LABELS[selectedRole] || selectedRole}`,
      });
    } catch (err: any) {
      alert('Failed to save role defaults: ' + err.message);
    } finally {
      setSavingRole(false);
    }
  };

  const handleApplyToAllRoleUsers = async () => {
    if (!selectedRole || !userRole?.school_id) return;
    const targetAccounts = accounts.filter(a => a.role === selectedRole);
    if (targetAccounts.length === 0) {
      alert(`No user accounts currently have the role "${ROLE_LABELS[selectedRole] || selectedRole}".`);
      return;
    }

    const roleName = ROLE_LABELS[selectedRole] || selectedRole;
    const confirmed = window.confirm(
      `Apply these template permissions to all ${targetAccounts.length} existing ${roleName} accounts?\n\nThis will synchronize their module visibility and action capabilities to match this template.`
    );
    if (!confirmed) return;

    setSavingRole(true);
    try {
      const permsToApply = currentRolePerms;

      const { error } = await supabase
        .from('user_roles')
        .update({ permissions: permsToApply })
        .eq('school_id', userRole.school_id)
        .eq('role', selectedRole);

      if (error) throw error;

      // Update local state
      setAccounts(prev => prev.map(a => a.role === selectedRole ? { ...a, permissions: permsToApply } : a));

      logActivity({
        school_id: userRole.school_id,
        user_id: userRole.user_id,
        user_name: 'Admin',
        user_role: userRole.role,
        action: 'UPDATE',
        module: 'Settings',
        description: `Applied ${roleName} permission template across ${targetAccounts.length} accounts`,
      });

      alert(`Successfully synchronized ${targetAccounts.length} accounts to the ${roleName} role template!`);
    } catch (err: any) {
      alert('Failed to apply permissions: ' + err.message);
    } finally {
      setSavingRole(false);
    }
  };

  // ── Tab 2 Handlers: User Overrides ──

  const toggleUserModule = (modId: string) => {
    setUserEditPerms(p => ({
      ...p,
      modules: { ...p.modules, [modId]: !p.modules[modId] }
    }));
    setUserSaved(false);
  };

  const toggleUserAction = (actId: string) => {
    setUserEditPerms(p => ({
      ...p,
      actions: { ...p.actions, [actId]: !p.actions[actId] }
    }));
    setUserSaved(false);
  };

  const handleResetUserToRoleDefaults = () => {
    if (!selectedAccount) return;
    const roleDefault = getRoleDefaultPermissions(selectedAccount.role, roleTemplates);
    setUserEditPerms({
      modules: { ...roleDefault.modules },
      actions: { ...roleDefault.actions },
    });
    setUserSaved(false);
  };

  const handleSaveUserOverrides = async () => {
    if (!selectedUserId || !userRole?.school_id) return;
    setSavingUser(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ permissions: userEditPerms })
        .eq('id', selectedUserId);

      if (error) throw error;

      setAccounts(prev => prev.map(a => a.id === selectedUserId ? { ...a, permissions: userEditPerms } : a));
      setUserSaved(true);
      setTimeout(() => setUserSaved(false), 3000);

      const targetName = selectedAccount?.staff_name || selectedAccount?.login_email || 'Staff';
      logActivity({
        school_id: userRole.school_id,
        user_id: userRole.user_id,
        user_name: 'Admin',
        user_role: userRole.role,
        action: 'UPDATE',
        module: 'Settings',
        description: `Updated custom permissions for account ${targetName}`,
      });
    } catch (err: any) {
      alert('Failed to save user permissions: ' + err.message);
    } finally {
      setSavingUser(false);
    }
  };

  // ── PIN Handler ──
  const handleUpdatePin = async () => {
    if (newPin.length !== 4 || !userRole?.school_id) return;
    setUpdatingPin(true);
    const { error } = await supabase.from('form_settings').upsert({
      school_id: userRole.school_id,
      form_name: 'security_settings',
      sections_config: { delete_pin: newPin },
    }, { onConflict: 'school_id,form_name' });
    if (!error) {
      setCurrentPin(newPin);
      setNewPin('');
      setPinOk(true);
      setTimeout(() => setPinOk(false), 3000);
    } else {
      alert('PIN error: ' + error.message);
    }
    setUpdatingPin(false);
  };

  // ── Access Guard ──
  if (userRole?.role !== 'admin' && userRole?.role !== 'director') {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <Shield className="w-16 h-16 text-rose-300 mb-4" />
        <h1 className="text-2xl font-black text-slate-900">Access Restricted</h1>
        <p className="text-slate-500 mt-1">Only Administrators and Directors can access the Permission Manager.</p>
      </div>
    );
  }

  const selectedRoleMeta = ROLE_DISPLAY[selectedRole] || ROLE_DISPLAY.staff;
  const isSelectedRoleCustomized = !!roleTemplates[selectedRole];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Role & Permission Manager
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage school-wide role permission templates and fine-tune individual staff overrides.
              </p>
            </div>
          </div>
        </div>

        {/* Tab switch pills */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl shrink-0 self-start md:self-auto border border-slate-200/50">
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'roles'
                ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            Role Defaults (Templates)
            <span className="text-[10px] bg-slate-200/70 px-2 py-0.5 rounded-full font-bold">11</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'users'
                ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            User Account Overrides
            <span className="text-[10px] bg-slate-200/70 px-2 py-0.5 rounded-full font-bold">{accounts.length}</span>
          </button>
        </div>
      </div>

      {/* Role Counts Summary Banner */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {ROLE_ORDER.map(r => {
          const count = roleCounts[r] || 0;
          const display = ROLE_DISPLAY[r] || { label: r, bgLight: 'bg-slate-50', color: 'text-slate-600' };
          const isCustom = !!roleTemplates[r];
          return (
            <button
              key={r}
              onClick={() => { setSelectedRole(r); setActiveTab('roles'); }}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                selectedRole === r && activeTab === 'roles'
                  ? 'ring-2 ring-indigo-500 border-transparent shadow-sm ' + display.bgLight + ' ' + display.color
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isCustom ? 'bg-amber-500' : 'bg-slate-300'}`} />
              <span>{display.label}</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: ROLE DEFAULTS (TEMPLATES)                                           */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Left Column: Role Selector List */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 space-y-2">
              <div className="px-2 py-1 mb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">System Roles</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Select a role to configure default access rules.</p>
              </div>

              <div className="space-y-1.5">
                {ROLE_ORDER.map(roleKey => {
                  const meta = ROLE_DISPLAY[roleKey] || ROLE_DISPLAY.staff;
                  const isSelected = selectedRole === roleKey;
                  const count = roleCounts[roleKey] || 0;
                  const isCustomized = !!roleTemplates[roleKey];

                  return (
                    <button
                      key={roleKey}
                      onClick={() => setSelectedRole(roleKey)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
                        isSelected
                          ? `${meta.bgLight} border-2 border-indigo-500 shadow-sm`
                          : 'hover:bg-slate-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${meta.bgLight} ${meta.color} ring-1 ring-black/5`}>
                          {meta.label.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-black truncate ${isSelected ? meta.color : 'text-slate-800'}`}>
                            {meta.label}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-medium">
                              {count} {count === 1 ? 'account' : 'accounts'}
                            </span>
                            {isCustomized && (
                              <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">
                                Custom
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mr-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Helper Box */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-3xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                How Role Templates Work
              </div>
              <p className="text-[11px] text-indigo-800/80 leading-relaxed">
                When you set permissions here, any staff user with the <strong>{selectedRoleMeta.label}</strong> role inherits these settings automatically.
              </p>
              <p className="text-[11px] text-indigo-800/80 leading-relaxed">
                Use <strong>"Apply to All Existing"</strong> to cascade changes to existing users, or configure one-off overrides in the <strong>User Overrides</strong> tab.
              </p>
            </div>
          </div>

          {/* Right Column: Role Editor (3 cols) */}
          <div className="lg:col-span-3 space-y-6">

            {/* Role Header Banner */}
            <div className={`p-6 rounded-3xl border border-slate-200/80 shadow-sm ${selectedRoleMeta.bgLight} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg bg-white shadow-sm ${selectedRoleMeta.color} border border-current/20 shrink-0`}>
                  {selectedRoleMeta.label.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className={`text-lg font-black ${selectedRoleMeta.color}`}>
                      {selectedRoleMeta.label} Role Template
                    </h2>
                    {isSelectedRoleCustomized ? (
                      <span className="text-[10px] font-black bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                        Customized for School
                      </span>
                    ) : (
                      <span className="text-[10px] font-black bg-slate-200/60 text-slate-700 px-2 py-0.5 rounded-full border border-slate-300/60">
                        Factory Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-xl font-medium">
                    {selectedRoleMeta.desc}
                  </p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-1">
                    {roleCounts[selectedRole] || 0} user accounts currently assigned this role.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  onClick={handleResetRoleToPreset}
                  title="Restore factory preset defaults"
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  Reset Preset
                </button>
                <button
                  onClick={handleApplyToAllRoleUsers}
                  disabled={savingRole || !roleCounts[selectedRole]}
                  title="Overwrite permissions for all accounts with this role"
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-600" />
                  Apply to All {roleCounts[selectedRole] || 0} Users
                </button>
                <button
                  onClick={handleSaveRoleDefaults}
                  disabled={savingRole}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {savingRole ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                  ) : roleSaved ? (
                    <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save Role Defaults</>
                  )}
                </button>
              </div>
            </div>

            {/* Module Visibility Section */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-600" /> Module Access & Navigation Visibility
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Control which top-level and sub-navigation sections appear in the sidebar for {selectedRoleMeta.label}.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-black">
                  <button
                    onClick={() => setAllRoleModules(true)}
                    className="px-2.5 py-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                  >
                    Enable All
                  </button>
                  <span className="text-slate-200">·</span>
                  <button
                    onClick={() => setAllRoleModules(false)}
                    className="px-2.5 py-1 text-slate-400 hover:bg-slate-100 rounded-lg transition"
                  >
                    Disable All
                  </button>
                </div>
              </div>

              {/* Categorized Modules */}
              <div className="space-y-6">
                {MODULE_CATEGORIES.map(category => {
                  const catModules = MODULES.filter(m => m.category === category);
                  if (catModules.length === 0) return null;

                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                          {category} Modules
                        </span>
                        <div className="flex gap-2 text-[10px] font-bold text-slate-400">
                          <button onClick={() => setAllRoleModules(true, category)} className="hover:text-indigo-600">All on</button>
                          <span>·</span>
                          <button onClick={() => setAllRoleModules(false, category)} className="hover:text-slate-600">All off</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {catModules.map(mod => {
                          const isEnabled = !!currentRolePerms.modules[mod.id];
                          const IconComp = MODULE_ICONS[mod.id] || LayoutDashboard;

                          return (
                            <button
                              key={mod.id}
                              onClick={() => toggleRoleModule(mod.id)}
                              className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                                isEnabled
                                  ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950 shadow-xs'
                                  : 'bg-white border-slate-200/70 hover:border-slate-300 text-slate-500'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                isEnabled ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-400'
                              }`}>
                                <IconComp className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className={`text-xs font-black truncate ${isEnabled ? 'text-indigo-900' : 'text-slate-700'}`}>
                                    {mod.name}
                                  </p>
                                  {isEnabled ? (
                                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-slate-300 shrink-0" />
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                                  {mod.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Permissions Section */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-600" /> Operational & Action Capabilities
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure granular permissions for marks entry, fee collection, diary publishing, and sensitive records.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-black">
                  <button
                    onClick={() => setAllRoleActions(true)}
                    className="px-2.5 py-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                  >
                    Enable All
                  </button>
                  <span className="text-slate-200">·</span>
                  <button
                    onClick={() => setAllRoleActions(false)}
                    className="px-2.5 py-1 text-slate-400 hover:bg-slate-100 rounded-lg transition"
                  >
                    Disable All
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {ACTION_CATEGORIES.map(category => {
                  const catActions = ACTIONS.filter(a => a.category === category);
                  if (catActions.length === 0) return null;
                  const isDangerCat = category === 'Danger';

                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-black uppercase tracking-wider ${
                          isDangerCat ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {ACTION_CATEGORY_LABELS[category] || category}
                        </span>
                        <div className="flex gap-2 text-[10px] font-bold text-slate-400">
                          <button onClick={() => setAllRoleActions(true, category)} className="hover:text-emerald-600">All on</button>
                          <span>·</span>
                          <button onClick={() => setAllRoleActions(false, category)} className="hover:text-slate-600">All off</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {catActions.map(act => {
                          const isEnabled = !!currentRolePerms.actions[act.id];

                          return (
                            <button
                              key={act.id}
                              onClick={() => toggleRoleAction(act.id)}
                              className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                                isEnabled
                                  ? isDangerCat
                                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                                    : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                  : 'bg-white border-slate-200/70 hover:border-slate-300 text-slate-500'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                isEnabled
                                  ? isDangerCat ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {isDangerCat ? <Trash2 className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className={`text-xs font-black ${
                                    isEnabled
                                      ? isDangerCat ? 'text-rose-900' : 'text-emerald-900'
                                      : 'text-slate-700'
                                  }`}>
                                    {act.name}
                                  </p>
                                  {/* Toggle pill */}
                                  <div className={`w-8 h-4.5 rounded-full relative transition-colors shrink-0 ${
                                    isEnabled
                                      ? isDangerCat ? 'bg-rose-600' : 'bg-emerald-600'
                                      : 'bg-slate-200'
                                  }`}>
                                    <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${
                                      isEnabled ? 'left-4' : 'left-0.5'
                                    }`} />
                                  </div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                                  {act.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: USER ACCOUNT OVERRIDES                                              */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Account Selector */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-xs flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600" /> Select Staff Account
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">
                    {filteredAccounts.length} / {accounts.length}
                  </span>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, role, email…"
                    value={userSearchQ}
                    onChange={e => setUserSearchQ(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                </div>

                {/* Role filter dropdown */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={userRoleFilter}
                    onChange={e => setUserRoleFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="all">All Roles ({accounts.length})</option>
                    {ROLE_ORDER.filter(r => roleCounts[r]).map(r => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r] || r} ({roleCounts[r]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Account list */}
              <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="w-5 h-5 text-slate-300 animate-spin mx-auto" />
                  </div>
                ) : filteredAccounts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">No accounts found.</div>
                ) : (
                  filteredAccounts.map(acct => {
                    const preset = ROLE_DISPLAY[acct.role?.toLowerCase()] || ROLE_DISPLAY.staff;
                    const isSelected = acct.id === selectedUserId;
                    const displayName = acct.staff_name || acct.login_email || acct.role;
                    const initials = displayName?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                    const isCustom = hasCustomOverrides(acct);

                    return (
                      <button
                        key={acct.id}
                        onClick={() => setSelectedUserId(acct.id)}
                        className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors ${
                          isSelected ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-50 border-l-4 border-transparent'
                        }`}
                      >
                        {acct.staff_photo ? (
                          <img src={acct.staff_photo} alt={displayName} className="w-10 h-10 rounded-2xl object-cover shrink-0 ring-1 ring-slate-200" />
                        ) : (
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${preset?.bgLight || 'bg-slate-100'} ${preset?.color || 'text-slate-600'}`}>
                            {initials || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-black truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                            {acct.staff_name || <span className="italic text-slate-400">{acct.login_email || 'Unknown'}</span>}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${preset?.bgLight || 'bg-slate-100'} ${preset?.color || 'text-slate-500'}`}>
                              {preset?.label || acct.role}
                            </span>
                            {isCustom ? (
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                                Custom Override
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                Role Default
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: User Override Editor (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedAccount ? (
              <div className="min-h-[460px] bg-white rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-center p-8">
                <div className="text-center space-y-3 max-w-sm">
                  <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
                    <UserCog className="w-8 h-8" />
                  </div>
                  <h3 className="font-black text-slate-800 text-sm">Select an Account to Configure</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pick a staff account from the list to view their effective permissions, add custom overrides, or reset them to match the role template.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">

                {/* User Header Card */}
                {(() => {
                  const roleMeta = ROLE_DISPLAY[selectedAccount.role?.toLowerCase()] || ROLE_DISPLAY.staff;
                  const isCustom = hasCustomOverrides(selectedAccount);
                  const displayName = selectedAccount.staff_name || selectedAccount.login_email || 'Unknown';
                  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

                  return (
                    <div className={`p-6 rounded-3xl border border-slate-200/80 shadow-sm ${roleMeta.bgLight} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                      <div className="flex items-center gap-4">
                        {selectedAccount.staff_photo ? (
                          <img src={selectedAccount.staff_photo} alt={displayName} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white shadow-sm" />
                        ) : (
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg bg-white shadow-sm ${roleMeta.color} border border-current/20 shrink-0`}>
                            {initials}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-black text-slate-900">{displayName}</h2>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${roleMeta.bgLight} ${roleMeta.color} border border-current/20`}>
                              {roleMeta.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{selectedAccount.login_email}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {isCustom ? (
                              <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Sliders className="w-3 h-3" /> Custom Overrides Active
                              </span>
                            ) : (
                              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Inheriting {roleMeta.label} Template
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* User Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleResetUserToRoleDefaults}
                          title="Clear overrides and restore role default"
                          className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                          Reset to Defaults
                        </button>
                        <button
                          onClick={handleSaveUserOverrides}
                          disabled={savingUser}
                          className="px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 transition disabled:opacity-50 flex items-center gap-2"
                        >
                          {savingUser ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                          ) : userSaved ? (
                            <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                          ) : (
                            <><Save className="w-4 h-4" /> Save Overrides</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* User Module Access */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-black text-slate-900 text-xs flex items-center gap-2">
                      <Eye className="w-4 h-4 text-indigo-600" /> Module Access Permissions
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {MODULES.map(mod => {
                      const on = !!userEditPerms.modules[mod.id];
                      const IconComp = MODULE_ICONS[mod.id] || LayoutDashboard;

                      return (
                        <button
                          key={mod.id}
                          onClick={() => toggleUserModule(mod.id)}
                          className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                            on
                              ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                              : 'bg-white border-slate-200/70 hover:border-slate-300 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <IconComp className={`w-4 h-4 shrink-0 ${on ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold truncate">{mod.name}</span>
                          </div>
                          {on ? (
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* User Action Permissions */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-black text-slate-900 text-xs flex items-center gap-2">
                      <Key className="w-4 h-4 text-emerald-600" /> Action & Operational Capabilities
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {ACTIONS.map(act => {
                      const on = !!userEditPerms.actions[act.id];
                      const isDanger = act.category === 'Danger';

                      return (
                        <button
                          key={act.id}
                          onClick={() => toggleUserAction(act.id)}
                          className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                            on
                              ? isDanger
                                ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                                : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                              : 'bg-white border-slate-200/70 hover:border-slate-300 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isDanger ? (
                              <Trash2 className={`w-4 h-4 shrink-0 ${on ? 'text-rose-600' : 'text-slate-400'}`} />
                            ) : (
                              <ShieldCheck className={`w-4 h-4 shrink-0 ${on ? 'text-emerald-600' : 'text-slate-400'}`} />
                            )}
                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${on ? (isDanger ? 'text-rose-900' : 'text-emerald-900') : 'text-slate-700'}`}>
                                {act.name}
                              </p>
                            </div>
                          </div>
                          {/* Toggle switch */}
                          <div className={`w-8 h-4.5 rounded-full relative transition-colors shrink-0 ${
                            on
                              ? isDanger ? 'bg-rose-600' : 'bg-emerald-600'
                              : 'bg-slate-200'
                          }`}>
                            <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${
                              on ? 'left-4' : 'left-0.5'
                            }`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* GLOBAL FOOTER: SECURITY PIN & LINKS                                       */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">

        {/* Delete PIN Widget */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-500" /> Security Deletion PIN
            </h3>
            <span className="text-[10px] font-bold text-slate-400">School-wide</span>
          </div>
          <p className="text-[11px] text-slate-500">
            A 4-digit code required to confirm permanent deletions across the system.
          </p>

          <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-200/70">
            <span className="text-xs font-bold text-slate-400">Current PIN</span>
            <span className="text-base font-black text-slate-800 tracking-[0.3em] font-mono">
              {currentPin}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              maxLength={4}
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="New 4-digit PIN"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-400"
            />
            <button
              onClick={handleUpdatePin}
              disabled={newPin.length !== 4 || updatingPin}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl disabled:opacity-40 transition"
            >
              {updatingPin ? '…' : 'Update'}
            </button>
          </div>
          {pinOk && (
            <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> PIN updated successfully!
            </p>
          )}
        </div>

        {/* User Accounts Management Link */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-3xl p-5 flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="font-black text-indigo-900 text-sm">Staff User Accounts</h3>
            <p className="text-xs text-indigo-700/80 mt-1 leading-relaxed">
              Create logins, send credentials via WhatsApp/SMS, reset passwords, or suspend inactive accounts.
            </p>
          </div>
          <Link
            to="/staff/accounts"
            className="mt-4 inline-flex items-center justify-between px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition"
          >
            <span>Manage User Logins</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Audit Log Link */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center mb-3">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="font-black text-slate-900 text-sm">Security & Audit Logs</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Review chronological security events, logins, role switches, and administrative modifications.
            </p>
          </div>
          <Link
            to="/audit-log"
            className="mt-4 inline-flex items-center justify-between px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition"
          >
            <span>View Audit Logs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>

    </div>
  );
}
