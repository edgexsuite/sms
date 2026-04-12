import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GraduationCap, LogOut, Download, MessageCircle, ChevronRight, Eye, EyeOff, BookOpen } from 'lucide-react';
import { downloadChallanPDF, DEFAULT_CHALLAN_CONFIG, ChallanRecord, SchoolInfo } from '../lib/challanUtils';

interface ParentData {
  id: string;
  full_name: string;
  family_number: string;
  school_id: string;
}

interface ChildData {
  id: string;
  full_name: string;
  roll_number: number | string;
  photograph_url?: string;
  classes?: { name: string; section?: string } | null;
}

const SESSION_KEY = 'parent_portal_session';

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  overdue: 'bg-red-100 text-red-800',
};

export default function ParentPortal() {
  const [parentData, setParentData] = useState<ParentData | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [familyNumber, setFamilyNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [school, setSchool] = useState<SchoolInfo>({ name: '' });
  const [children, setChildren] = useState<ChildData[]>([]);
  const [activeChildId, setActiveChildId] = useState<string>('');
  const [feeRecords, setFeeRecords] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (parentData) {
      fetchDashboardData();
    }
  }, [parentData]);

  const fetchDashboardData = async () => {
    if (!parentData) return;
    setLoadingData(true);
    try {
      // Fetch school info
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name, address, contact_phone, logo_url')
        .eq('id', parentData.school_id)
        .maybeSingle();
      if (schoolData) setSchool(schoolData);

      // Fetch children linked to this family number
      const { data: childData } = await supabase
        .from('students')
        .select('id, full_name, roll_number, photograph_url, classes(name, section)')
        .eq('school_id', parentData.school_id)
        .eq('parent_id', parentData.id)
        .eq('status', 'active');

      const childList: ChildData[] = (childData || []).map((c: any) => ({
        id: c.id,
        full_name: c.full_name,
        roll_number: c.roll_number,
        photograph_url: c.photograph_url,
        classes: c.classes,
      }));
      setChildren(childList);
      if (childList.length > 0) setActiveChildId(childList[0].id);

      // Fetch all fee records for all children
      if (childList.length > 0) {
        const childIds = childList.map(c => c.id);
        const { data: fees } = await supabase
          .from('fee_records')
          .select('*')
          .eq('school_id', parentData.school_id)
          .in('student_id', childIds)
          .order('month_year', { ascending: false });
        setFeeRecords(fees || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyNumber.trim() || !password.trim()) {
      setLoginError('Please enter your Family Number and Password.');
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const { data, error } = await supabase
        .from('parents')
        .select('id, full_name, family_number, school_id')
        .eq('family_number', familyNumber.trim())
        .eq('auth_password', password.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setLoginError('Invalid Family Number or Password. Please try again.');
        return;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      setParentData(data);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setParentData(null);
    setChildren([]);
    setFeeRecords([]);
    setFamilyNumber('');
    setPassword('');
  };

  const handleDownloadChallan = async (fee: any) => {
    const child = children.find(c => c.id === fee.student_id);
    if (!child) return;

    // Sum previous unpaid fees
    const { data: prevFees } = await supabase
      .from('fee_records')
      .select('total_amount, paid_amount')
      .eq('school_id', parentData!.school_id)
      .eq('student_id', fee.student_id)
      .in('status', ['pending', 'overdue'])
      .neq('id', fee.id)
      .lt('month_year', fee.month_year);

    const previousFee = (prevFees || []).reduce(
      (sum: number, r: any) => sum + Math.max(0, (r.total_amount || 0) - (r.paid_amount || 0)), 0
    );

    const record: ChallanRecord = {
      id: fee.id,
      invoice_number: fee.invoice_number,
      month_year: fee.month_year,
      due_date: fee.due_date,
      total_amount: fee.total_amount,
      paid_amount: fee.paid_amount || 0,
      status: fee.status,
      breakdown: fee.breakdown,
      student_name: child.full_name,
      roll_number: child.roll_number,
      class_name: child.classes
        ? `${child.classes.name}${child.classes.section ? ' - ' + child.classes.section : ''}`
        : '',
      family_number: parentData!.family_number,
      previous_fee: previousFee,
      discount_amount: fee.discount_amount || 0,
      fine_amount: 0,
    };

    const config = { ...DEFAULT_CHALLAN_CONFIG, copies: 1, show_depositor_info: false };
    await downloadChallanPDF([record], school, config);
  };

  const handleShareWhatsApp = (fee: any) => {
    const child = children.find(c => c.id === fee.student_id);
    const balance = (fee.total_amount || 0) - (fee.paid_amount || 0);
    const dueDate = fee.due_date ? new Date(fee.due_date).toLocaleDateString() : 'N/A';
    const monthLabel = new Date(fee.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const msg = `Fee Challan — ${child?.full_name || ''}\nMonth: ${monthLabel}\nAmount Due: Rs. ${balance.toLocaleString()}\nDue Date: ${dueDate}\nInvoice: ${fee.invoice_number || fee.id.substring(0, 10)}\n\n— ${school.name}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const activeChild = children.find(c => c.id === activeChildId);
  const activeChildFees = feeRecords.filter(f => f.student_id === activeChildId);
  const totalDue = activeChildFees.reduce((sum, f) => sum + ((f.total_amount || 0) - (f.paid_amount || 0)), 0);
  const totalPaid = activeChildFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);

  // ─── LOGIN SCREEN ─────────────────────────────────────────────────────────
  if (!parentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
              <GraduationCap className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Parent Portal</h1>
            <p className="text-gray-500 text-sm mt-1">Access your child's fee records and challans</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">Sign in to your account</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Family Number</label>
                <input
                  type="text"
                  value={familyNumber}
                  onChange={e => setFamilyNumber(e.target.value)}
                  placeholder="Enter your family number"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {loginError}
                </div>
              )}

              <button type="submit" disabled={loggingIn}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loggingIn ? 'Signing in...' : <>Sign In <ChevronRight className="w-4 h-4" /></>}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              Your credentials are provided by the school administration.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">{school.name || 'School'}</p>
              <p className="text-xs text-gray-500">Parent Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-800">{parentData.full_name}</p>
              <p className="text-xs text-gray-500">Family #{parentData.family_number}</p>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-red-200 transition">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {loadingData ? (
          <div className="text-center py-16 text-gray-400">Loading your data...</div>
        ) : children.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No children linked to this account.</p>
            <p className="text-sm text-gray-400 mt-1">Please contact the school administration.</p>
          </div>
        ) : (
          <>
            {/* Children Tabs */}
            {children.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {children.map(child => (
                  <button key={child.id}
                    onClick={() => setActiveChildId(child.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition border ${
                      activeChildId === child.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}>
                    {child.photograph_url ? (
                      <img src={child.photograph_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">
                        {child.full_name.charAt(0)}
                      </span>
                    )}
                    {child.full_name}
                  </button>
                ))}
              </div>
            )}

            {/* Active Child Profile Card */}
            {activeChild && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-5">
                {activeChild.photograph_url ? (
                  <img src={activeChild.photograph_url} className="w-16 h-16 rounded-xl object-cover border border-gray-200" alt={activeChild.full_name} />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
                    {activeChild.full_name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">{activeChild.full_name}</h2>
                  <p className="text-sm text-gray-500">
                    Roll #{activeChild.roll_number}
                    {activeChild.classes && ` · Class ${activeChild.classes.name}${activeChild.classes.section ? ' ' + activeChild.classes.section : ''}`}
                  </p>
                </div>
                <div className="hidden sm:grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Paid</p>
                    <p className="text-lg font-black text-green-600">Rs. {totalPaid.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Balance Due</p>
                    <p className={`text-lg font-black ${totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Rs. {totalDue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary cards (mobile) */}
            <div className="grid grid-cols-2 gap-4 sm:hidden">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                <p className="text-xs text-green-700 font-medium uppercase">Total Paid</p>
                <p className="text-xl font-black text-green-700 mt-1">Rs. {totalPaid.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                <p className="text-xs text-red-700 font-medium uppercase">Balance Due</p>
                <p className={`text-xl font-black mt-1 ${totalDue > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  Rs. {totalDue.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Fee Records Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Fee Records</h3>
                <p className="text-sm text-gray-500 mt-0.5">{activeChildFees.length} record{activeChildFees.length !== 1 ? 's' : ''} found</p>
              </div>

              {activeChildFees.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  No fee records found for this student.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3 font-medium text-gray-600">Month</th>
                        <th className="px-5 py-3 font-medium text-gray-600">Invoice #</th>
                        <th className="px-5 py-3 font-medium text-gray-600">Due Date</th>
                        <th className="px-5 py-3 font-medium text-gray-600 text-right">Amount</th>
                        <th className="px-5 py-3 font-medium text-gray-600 text-right">Paid</th>
                        <th className="px-5 py-3 font-medium text-gray-600 text-right">Balance</th>
                        <th className="px-5 py-3 font-medium text-gray-600">Status</th>
                        <th className="px-5 py-3 font-medium text-gray-600 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeChildFees.map(fee => {
                        const balance = (fee.total_amount || 0) - (fee.paid_amount || 0);
                        const monthLabel = new Date(fee.month_year).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                        return (
                          <tr key={fee.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-gray-900">{monthLabel}</td>
                            <td className="px-5 py-3 font-mono text-xs text-gray-500">{fee.invoice_number || fee.id.substring(0, 10)}</td>
                            <td className="px-5 py-3 text-gray-600">
                              {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-5 py-3 text-right font-medium text-gray-900">
                              Rs. {Number(fee.total_amount).toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-right text-green-600 font-medium">
                              Rs. {Number(fee.paid_amount || 0).toLocaleString()}
                            </td>
                            <td className={`px-5 py-3 text-right font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              Rs. {balance.toLocaleString()}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${STATUS_STYLES[fee.status] || 'bg-gray-100 text-gray-700'}`}>
                                {fee.status}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleDownloadChallan(fee)}
                                  title="Download Challan PDF"
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition font-medium">
                                  <Download className="w-3.5 h-3.5" /> Challan
                                </button>
                                <button onClick={() => handleShareWhatsApp(fee)}
                                  title="Share via WhatsApp"
                                  className="p-1.5 text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 rounded-lg transition">
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="text-center py-6 text-xs text-gray-400">
        {school.name} · Parent Portal · Powered by School ERP
      </footer>
    </div>
  );
}
