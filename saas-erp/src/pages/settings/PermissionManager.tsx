import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  Shield, Users, Lock, Save, Trash2,
  Eye, CheckCircle2, XCircle, AlertCircle,
  Key, ChevronRight, UserCog, ExternalLink, ShieldCheck
} from 'lucide-react';

const MODULES = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'students', name: 'Students Module' },
  { id: 'staff', name: 'Staff & Payroll' },
  { id: 'finance', name: 'Financials (Fees/Expenses)' },
  { id: 'academic', name: 'Academic (Exams/Results)' },
  { id: 'services', name: 'School Services (Library/Transport)' },
  { id: 'reports', name: 'Management Reports' },
  { id: 'settings', name: 'System Settings' }
];

const ACTIONS = [
  { id: 'delete_student', name: 'Delete Students', color: 'text-red-600' },
  { id: 'delete_staff', name: 'Delete Staff', color: 'text-red-600' },
  { id: 'delete_expense', name: 'Delete Expenses', color: 'text-red-600' }
];

const ROLE_PRESETS: Record<string, { modules: Record<string, boolean>; actions: Record<string, boolean> }> = {
  teacher: {
    modules: { dashboard: true, students: true, staff: false, finance: false, academic: true, services: false, reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  accountant: {
    modules: { dashboard: true, students: false, staff: false, finance: true, academic: false, services: false, reports: true, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: true },
  },
  librarian: {
    modules: { dashboard: true, students: true, staff: false, finance: false, academic: false, services: true, reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  staff: {
    modules: { dashboard: true, students: true, staff: false, finance: true, academic: true, services: true, reports: false, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  principal: {
    modules: { dashboard: true, students: true, staff: true, finance: true, academic: true, services: true, reports: true, settings: false },
    actions: { delete_student: false, delete_staff: false, delete_expense: false },
  },
  director: {
    modules: { dashboard: true, students: true, staff: true, finance: true, academic: true, services: true, reports: true, settings: false },
    actions: { delete_student: true, delete_staff: true, delete_expense: true },
  },
};

export default function PermissionManager() {
  const { user, userRole } = useAuth();
  const [staffRoles, setStaffRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  // PIN Management State
  const [newPin, setNewPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [updatingPin, setUpdatingPin] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchPermissions();
      fetchCurrentPin();
    }
  }, [userRole]);

  const fetchCurrentPin = async () => {
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole?.school_id)
      .eq('form_name', 'security_settings')
      .maybeSingle();
    
    if (data?.sections_config?.delete_pin) {
      setCurrentPin(data.sections_config.delete_pin);
    } else {
      setCurrentPin('1122');
    }
  };

  const fetchPermissions = async () => {
    setLoading(true);
    // Fetch all staff accounts for this school
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('school_id', userRole?.school_id);
    
    if (data) {
      // Add default permissions object if missing
      const formatted = data.map(r => ({
        ...r,
        permissions: r.permissions || { modules: {}, actions: {} }
      }));
      setStaffRoles(formatted);
    }
    setLoading(false);
  };

  const handleUpdatePin = async () => {
    if (newPin.length !== 4) return alert('PIN must be exactly 4 digits.');
    setUpdatingPin(true);
    try {
      const { error } = await supabase
        .from('form_settings')
        .upsert({
          school_id: userRole?.school_id,
          form_name: 'security_settings',
          sections_config: { delete_pin: newPin }
        }, { onConflict: 'school_id,form_name' });
      
      if (error) throw error;
      setCurrentPin(newPin);
      setNewPin('');
      setPinSuccess(true);
      setTimeout(() => setPinSuccess(false), 3000);
    } catch (err: any) {
      alert('Error updating PIN: ' + err.message);
    } finally {
      setUpdatingPin(false);
    }
  };

  const applyPreset = (roleId: string, roleName: string) => {
    const preset = ROLE_PRESETS[roleName.toLowerCase()];
    if (!preset) return;
    setStaffRoles(prev => prev.map(r => {
      if (r.id === roleId) {
        return { ...r, permissions: { modules: { ...preset.modules }, actions: { ...preset.actions } } };
      }
      return r;
    }));
  };

  const togglePermission = (roleId: string, type: 'modules' | 'actions', key: string) => {
    setStaffRoles(prev => prev.map(r => {
      if (r.id === roleId) {
        const updatedPermissions = { ...r.permissions };
        if (!updatedPermissions[type]) updatedPermissions[type] = {};
        updatedPermissions[type][key] = !updatedPermissions[type][key];
        return { ...r, permissions: updatedPermissions };
      }
      return r;
    }));
  };

  const savePermissions = async (role: any) => {
    setSavingId(role.id);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ permissions: role.permissions })
        .eq('id', role.id);
      
      if (error) throw error;
      alert('Permissions updated for ' + role.role);
    } catch (err: any) {
      alert('Error saving permissions: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  if (userRole?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <Shield className="w-16 h-16 text-red-200 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Access Restricted</h1>
        <p className="text-gray-500">Only the School Director/Admin can access Permission Manager.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 italic uppercase tracking-tight">
            <Shield className="w-8 h-8 text-indigo-600" /> Permission Manager
          </h1>
          <p className="text-slate-500 font-medium mt-1">Control access rights and security protocols for school staff.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* PIN Management Section */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">System Security</h2>
            </div>
            
            <p className="text-sm text-slate-500 leading-relaxed">
              This master PIN is used to authorize sensitive deletions across the entire ERP. Keep it confidential.
            </p>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Current Active PIN</span>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-500" />
                <span className="text-2xl font-black text-slate-900 tracking-[0.2em]">{currentPin || '1122'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black uppercase text-slate-700">Update Security PIN</label>
              <div className="flex gap-2">
                <input 
                  type="password" 
                  maxLength={4} 
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="New 4-digit PIN"
                  className="flex-1 bg-white border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-slate-900 focus:border-indigo-600 outline-none transition-all shadow-inner" 
                />
                <button 
                  onClick={handleUpdatePin}
                  disabled={newPin.length !== 4 || updatingPin}
                  className="bg-indigo-600 hover:bg-slate-900 text-white font-black px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {updatingPin ? '...' : 'SET'}
                </button>
              </div>
              {pinSuccess && (
                <div className="flex items-center gap-2 text-green-600 font-bold text-xs animate-bounce">
                  <CheckCircle2 className="w-4 h-4" /> PIN Updated Security Hardened!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick link to User Accounts */}
        <div className="lg:col-span-3">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <UserCog className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-900">Individual Account Management</p>
                <p className="text-xs text-indigo-600 mt-0.5">
                  To create accounts, reset passwords, suspend users, or set per-person permission overrides, use the User Accounts page.
                </p>
              </div>
            </div>
            <Link
              to="/staff/accounts"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors shrink-0"
            >
              Open User Accounts <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Staff Permissions Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> Staff & Role Access
              </h2>
              <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-slate-500 border border-slate-200">
                {staffRoles.length} ACCOUNTS FOUND
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-20 text-center text-slate-400 font-bold">Scanning authorized users...</div>
              ) : staffRoles.length === 0 ? (
                <div className="p-20 text-center text-slate-400">No staff accounts managed yet.</div>
              ) : (
                staffRoles.map(role => (
                  <div key={role.id} className="p-8 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-100">
                          {role.role.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{role.role} ACCOUNT</h3>
                          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                            <Lock className="w-3 h-3" /> UID: {role.user_id?.slice(0, 8)}...
                            {role.is_active === false && (
                              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px]">SUSPENDED</span>
                            )}
                          </div>
                          {ROLE_PRESETS[role.role?.toLowerCase()] && (
                            <button
                              onClick={() => applyPreset(role.id, role.role)}
                              className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 text-[10px] font-black rounded-lg uppercase tracking-wide transition-all"
                              title={`Apply recommended defaults for ${role.role} role`}
                            >
                              <ShieldCheck className="w-3 h-3" /> Apply {role.role} Preset
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => savePermissions(role)}
                        disabled={savingId === role.id}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" /> {savingId === role.id ? 'SYNCING...' : 'SAVE SETTINGS'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Module Visibility */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                           <Eye className="w-3 h-3" /> Module Visibility
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {MODULES.map(m => (
                            <button 
                              key={m.id}
                              onClick={() => togglePermission(role.id, 'modules', m.id)}
                              className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all font-bold text-sm ${
                                role.permissions.modules?.[m.id] 
                                ? 'bg-indigo-50 border-indigo-100 text-indigo-700' 
                                : 'bg-white border-slate-100 text-slate-400 grayscale hover:grayscale-0'
                              }`}
                            >
                              <span>{m.name}</span>
                              {role.permissions.modules?.[m.id] ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Power Actions */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                           <AlertCircle className="w-3 h-3" /> Power Actions
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {ACTIONS.map(a => (
                            <button 
                              key={a.id}
                              onClick={() => togglePermission(role.id, 'actions', a.id)}
                              className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all font-bold text-sm ${
                                role.permissions.actions?.[a.id] 
                                ? 'bg-red-50 border-red-100 text-red-700 shadow-inner' 
                                : 'bg-white border-slate-100 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Trash2 className={`w-4 h-4 ${role.permissions.actions?.[a.id] ? 'text-red-600' : 'text-slate-300'}`} />
                                <span>{a.name}</span>
                              </div>
                              <div className={`w-10 h-5 rounded-full relative transition-all ${role.permissions.actions?.[a.id] ? 'bg-red-500' : 'bg-slate-200'}`}>
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${role.permissions.actions?.[a.id] ? 'left-6' : 'left-1'}`} />
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 mt-4">
                           <p className="text-[10px] text-orange-700 font-bold leading-relaxed">
                              WARNING: Enabling Power Actions allows this staff member to move records to Trashbin. 
                              Final permanent deletion still requires Director verification in Trashbin.
                           </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
