import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DollarSign, CheckCircle, Play, Download } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';

interface StaffPayroll {
  staff_id: string;
  full_name: string;
  designation: string;
  employment_type: string;
  payment_basis: string;
  base_salary: number; // This acts as base, per-day, or per-lecture rate
  allowances: number;
  deductions: number;

  // Dynamic Attendance Counters
  absent_days: number;
  half_leaves: number;
  present_days: number;
  delivered_lectures: number;

  absent_deduction: number;
  advance_deduction: number;
  custom_deduction_pct: number;
  custom_deduction_amount: number;
  net_salary: number;
  status: 'pending' | 'paid';
  payroll_id?: string;
}

export default function Payroll() {
  const { userRole } = useAuth();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );
  const [staff, setStaff] = useState<StaffPayroll[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [components, setComponents] = useState<any[]>([]);
  const [componentsLoaded, setComponentsLoaded] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchComponents();
  }, [userRole]);

  useEffect(() => {
    if (userRole?.school_id && componentsLoaded) fetchPayroll();
  }, [selectedMonth, componentsLoaded]);

  const fetchComponents = async () => {
    const { data } = await supabase
      .from('salary_components')
      .select('*')
      .eq('school_id', userRole!.school_id)
      .eq('is_active', true);
    setComponents(data || []);
    setComponentsLoaded(true);
  };

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    // Core Data Fetch
    const [{ data: staffData }, { data: payrollData }, { data: attData }, { data: timeTableData }, { data: advanceData }] = await Promise.all([
      supabase.from('staff').select('id, full_name, role, department, salary, employment_type, payment_basis').eq('school_id', sid).eq('is_active', true).order('full_name'),
      supabase.from('payroll_records').select('*').eq('school_id', sid).eq('month_year', selectedMonth + '-01'),
      // Master Attendance Matrix for this month
      supabase.from('attendance').select('staff_id, status, date').eq('school_id', sid).like('date', `${selectedMonth}-%`).not('staff_id', 'is', null),
      // Master Timetable Matrix
      supabase.from('timetable_slots').select('teacher_id, day_of_week').eq('school_id', sid).not('teacher_id', 'is', null),
      // Active advances — to auto-suggest deduction amounts
      supabase.from('staff_advances').select('staff_id, remaining_balance, monthly_deduction').eq('school_id', sid).eq('status', 'active')
    ]);

    const payrollMap = new Map((payrollData || []).map((p: any) => [p.staff_id, p]));
    const allowComps = components.filter(c => c.component_type === 'allowance');
    const dedComps   = components.filter(c => c.component_type === 'deduction');

    // Build advance-deduction map: staff_id → amount to deduct this month
    const advanceMap = new Map<string, number>();
    (advanceData || []).forEach((adv: any) => {
      const monthly = Number(adv.monthly_deduction) || 0;
      const remaining = Number(adv.remaining_balance) || 0;
      if (remaining <= 0) return;
      const deduct = monthly > 0 ? Math.min(monthly, remaining) : 0;
      advanceMap.set(adv.staff_id, (advanceMap.get(adv.staff_id) || 0) + deduct);
    });

    // Build TimeTable Maps (count of periods per day_of_week per teacher)
    const slotCounts: Record<string, Record<string, number>> = {};
    (timeTableData || []).forEach((slot: any) => {
        if (!slotCounts[slot.teacher_id]) slotCounts[slot.teacher_id] = {};
        slotCounts[slot.teacher_id][slot.day_of_week] = (slotCounts[slot.teacher_id][slot.day_of_week] || 0) + 1;
    });

    const result: StaffPayroll[] = (staffData || []).map((s: any) => {
      const base = parseFloat(s.salary) || 0;
      const designation = s.role + (s.department ? ` (${s.department})` : '');

      // Parse Monthly Attendance Matrix for this staff member
      const staffAtt = (attData || []).filter(a => a.staff_id === s.id);
      let absentCount = 0;
      let halfCount = 0;
      let presentCount = 0;
      let automatedLecturesCount = 0;

      staffAtt.forEach(att => {
         if (att.status === 'absent') absentCount++;
         if (att.status === 'half-leave') halfCount++;
         if (att.status === 'present' || att.status === 'late') {
             presentCount++;
             if (s.payment_basis === 'per-lecture' && slotCounts[s.id]) {
                 // Convert ISO Date to Day of Week
                 const dateObj = new Date(att.date);
                 const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                 const dayStr = dayNames[dateObj.getDay()];
                 // Add assigned slots for this teacher on this exact day
                 automatedLecturesCount += (slotCounts[s.id][dayStr] || 0);
             }
         }
      });

      // Half-leave threshold math (1 half leave = 0.5 absent day penalty)
      const calculatedAbsentDays = absentCount + (halfCount * 0.5);
      
      const existing = payrollMap.get(s.id);
      if (existing) {
        const customDed = (existing.deductions || []).find((d: any) => d.name === 'Custom Deduction');
        return {
          staff_id: s.id, full_name: s.full_name, designation: designation,
          employment_type: s.employment_type || 'full-time', payment_basis: s.payment_basis || 'monthly',
          base_salary: base,
          allowances: (existing.allowances || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0),
          deductions: (existing.deductions || []).filter((d: any) => d.name !== 'Custom Deduction').reduce((sum: number, d: any) => sum + (d.amount || 0), 0),
          absent_days: existing.absent_days || 0,
          half_leaves: halfCount, present_days: presentCount, delivered_lectures: automatedLecturesCount,
          absent_deduction: existing.absent_deduction || 0,
          advance_deduction: existing.advance_deduction || 0,
          custom_deduction_pct: customDed?.percentage || 0,
          custom_deduction_amount: customDed?.amount || 0,
          net_salary: existing.net_salary || 0,
          status: existing.status,
          payroll_id: existing.id,
        };
      }

      // Live Calculation Engine
      let gross = base;
      let absentDed = 0;

      if (s.employment_type === 'visiting') {
         // Visiting Logic
         if (s.payment_basis === 'per-day') {
             gross = presentCount * base; 
         } else if (s.payment_basis === 'per-lecture') {
             gross = automatedLecturesCount * base;
         }
         // Visiting faculty typically don't have absent deductions, their gross is just based on physical presences
      } else {
         // Full-Time Monthly Logic
         const perDay = Math.round(base / 26);
         absentDed = perDay * Math.max(0, calculatedAbsentDays);
      }

      const allowTotal = allowComps.reduce((sum, c) => sum + (c.calculation_type === 'percentage' ? Math.round(base * c.percentage / 100) : (c.amount || 0)), 0);
      const dedTotal = dedComps.reduce((sum, c) => sum + (c.calculation_type === 'percentage' ? Math.round(base * c.percentage / 100) : (c.amount || 0)), 0);

      const advDed = advanceMap.get(s.id) || 0;
      return {
        staff_id: s.id, full_name: s.full_name, designation: designation,
        employment_type: s.employment_type || 'full-time', payment_basis: s.payment_basis || 'monthly',
        base_salary: base, allowances: allowTotal, deductions: dedTotal,
        absent_days: calculatedAbsentDays, half_leaves: halfCount, present_days: presentCount, delivered_lectures: automatedLecturesCount,
        absent_deduction: absentDed,
        advance_deduction: advDed,
        custom_deduction_pct: 0,
        custom_deduction_amount: 0,
        net_salary: Math.max(0, gross + allowTotal - dedTotal - absentDed - advDed),
        status: 'pending',
      };
    });

    setStaff(result);
    setLoading(false);
  }, [selectedMonth, components, userRole]);

  const updateAbsentDays = (staffId: string, days: number, lecturesOverride?: number) => {
    setStaff(prev => prev.map(s => {
      if (s.staff_id !== staffId) return s;
      
      if (s.employment_type === 'visiting') {
         if (s.payment_basis === 'per-lecture' && lecturesOverride !== undefined) {
             const gross = lecturesOverride * s.base_salary;
             return { ...s, delivered_lectures: lecturesOverride, net_salary: Math.max(0, gross + s.allowances - s.deductions - s.custom_deduction_amount) };
         }
         return s; // Per-day is purely based on physical attendance logs
      } else {
         const perDay = Math.round(s.base_salary / 26);
         const absDed = perDay * Math.max(0, days);
         return { ...s, absent_days: days, absent_deduction: absDed, net_salary: Math.max(0, s.base_salary + s.allowances - s.deductions - absDed - s.advance_deduction - s.custom_deduction_amount) };
      }
    }));
  };

  const updateCustomDeduction = (staffId: string, pct: number) => {
    setStaff(prev => prev.map(s => {
      if (s.staff_id !== staffId) return s;
      const customAmt = Math.round(s.base_salary * pct / 100);
      
      let gross = s.base_salary;
      if (s.employment_type === 'visiting') {
         if (s.payment_basis === 'per-day') gross = s.present_days * s.base_salary;
         if (s.payment_basis === 'per-lecture') gross = s.delivered_lectures * s.base_salary;
      }
      return { ...s, custom_deduction_pct: pct, custom_deduction_amount: customAmt, net_salary: Math.max(0, gross + s.allowances - s.deductions - s.absent_deduction - s.advance_deduction - customAmt) };
    }));
  };

  const processPayroll = async () => {
    setProcessing(true);
    const sid = userRole!.school_id;
    const allowComps = components.filter(c => c.component_type === 'allowance');
    const dedComps = components.filter(c => c.component_type === 'deduction');

    const records = staff.filter(s => !s.payroll_id).map(s => {
      let gross = s.base_salary;
      if (s.employment_type === 'visiting') {
         if (s.payment_basis === 'per-day') gross = s.present_days * s.base_salary;
         if (s.payment_basis === 'per-lecture') gross = s.delivered_lectures * s.base_salary;
      }

      const standardDeductions = dedComps.map(c => ({ name: c.name, amount: c.calculation_type === 'percentage' ? Math.round(s.base_salary * c.percentage / 100) : c.amount }));
      const customDed = s.custom_deduction_pct > 0 ? [{ name: 'Custom Deduction', percentage: s.custom_deduction_pct, amount: s.custom_deduction_amount }] : [];

      return {
        school_id: sid, staff_id: s.staff_id, month_year: selectedMonth + '-01',
        base_salary: s.base_salary,
        allowances: allowComps.map(c => ({ name: c.name, amount: c.calculation_type === 'percentage' ? Math.round(s.base_salary * c.percentage / 100) : c.amount })),
        deductions: [...standardDeductions, ...customDed],
        gross_salary: gross + s.allowances,
        absent_days: s.absent_days, per_day_salary: Math.round(s.base_salary / 26),
        absent_deduction: s.absent_deduction,
        advance_deduction: s.advance_deduction || 0,
        net_salary: s.net_salary, status: 'pending',
      }
    });

    if (records.length) await supabase.from('payroll_records').insert(records);
    await fetchPayroll();
    setProcessing(false);
  };

  const markPaid = async (payrollId: string) => {
    const member = staff.find(s => s.payroll_id === payrollId);
    const sid    = userRole!.school_id;
    const today  = new Date().toISOString().split('T')[0];

    await supabase.from('payroll_records').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payrollId);

    if (member) {
      const txns: any[] = [
        {
          school_id: sid, type: 'expense', category: 'Payroll',
          amount: member.net_salary,
          date: today, payment_mode: 'Bank Transfer', staff_id: member.staff_id,
          remarks: `Salary — ${member.full_name} (${selectedMonth})`,
        },
      ];
      // Advance Recovery: record as income so P&L shows the recovery offsetting the original advance expense
      if ((member.advance_deduction || 0) > 0) {
        txns.push({
          school_id: sid, type: 'income', category: 'Advance Recovery',
          amount: member.advance_deduction,
          date: today, payment_mode: 'Payroll Deduction', staff_id: member.staff_id,
          remarks: `Advance recovery — ${member.full_name} (${selectedMonth})`,
        });
        // Reduce remaining balance on active advances for this staff
        await supabase.rpc('reduce_advance_balance', {
          p_school_id: sid,
          p_staff_id: member.staff_id,
          p_amount: member.advance_deduction,
        }).then(({ error }) => {
          // If RPC doesn't exist, do a manual update instead
          if (error) {
            return updateAdvanceBalancesManual(sid, member.staff_id, member.advance_deduction);
          }
        });
      }
      await supabase.from('financial_transactions').insert(txns);
    }
    setStaff(prev => prev.map(s => s.payroll_id === payrollId ? { ...s, status: 'paid' } : s));
  };

  /** Fallback: manually reduce advance balances oldest-first */
  const updateAdvanceBalancesManual = async (schoolId: string, staffId: string, totalToReduce: number) => {
    const { data: advances } = await supabase
      .from('staff_advances')
      .select('id, remaining_balance')
      .eq('school_id', schoolId)
      .eq('staff_id', staffId)
      .eq('status', 'active')
      .order('given_date', { ascending: true });

    if (!advances) return;
    let left = totalToReduce;
    for (const adv of advances) {
      if (left <= 0) break;
      const reduce = Math.min(left, adv.remaining_balance);
      const newBal = adv.remaining_balance - reduce;
      await supabase.from('staff_advances').update({
        remaining_balance: newBal,
        status: newBal <= 0 ? 'cleared' : 'active',
      }).eq('id', adv.id);
      left -= reduce;
    }
  };

  const markAllPaid = async () => {
    const pending = staff.filter(s => s.status === 'pending' && s.payroll_id);
    const ids = pending.map(s => s.payroll_id!);
    if (!ids.length) return;

    const sid   = userRole!.school_id;
    const today = new Date().toISOString().split('T')[0];

    await supabase.from('payroll_records').update({ status: 'paid', paid_at: new Date().toISOString() }).in('id', ids);

    const txns: any[] = [];
    for (const s of pending) {
      // Payroll expense
      txns.push({
        school_id: sid, type: 'expense', category: 'Payroll',
        amount: s.net_salary,
        date: today, payment_mode: 'Bank Transfer', staff_id: s.staff_id,
        remarks: `Salary — ${s.full_name} (${selectedMonth})`,
      });
      // Advance Recovery income (if any)
      if ((s.advance_deduction || 0) > 0) {
        txns.push({
          school_id: sid, type: 'income', category: 'Advance Recovery',
          amount: s.advance_deduction,
          date: today, payment_mode: 'Payroll Deduction', staff_id: s.staff_id,
          remarks: `Advance recovery — ${s.full_name} (${selectedMonth})`,
        });
        await updateAdvanceBalancesManual(sid, s.staff_id, s.advance_deduction);
      }
    }
    if (txns.length) await supabase.from('financial_transactions').insert(txns);
    setStaff(prev => prev.map(s => ids.includes(s.payroll_id!) ? { ...s, status: 'paid' } : s));
  };

  const cols = [
    { header: 'Staff', key: 'full_name' }, { header: 'Designation', key: 'designation' },
    { header: 'Base Salary', key: 'base_salary' }, { header: 'Allowances', key: 'allowances' },
    { header: 'Deductions', key: 'deductions' }, { header: 'Cust. Ded (%)', key: 'custom_deduction_pct' },
    { header: 'Absent Days', key: 'absent_days' },
    { header: 'Absent Deduction', key: 'absent_deduction' }, { header: 'Net Salary', key: 'net_salary' },
    { header: 'Status', key: 'status' },
  ];

  const isProcessed = staff.some(s => s.payroll_id);
  const totalNet = staff.reduce((sum, s) => sum + s.net_salary, 0);
  const paidCount = staff.filter(s => s.status === 'paid').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" /> Payroll Processing
          </h1>
          <p className="text-gray-500 text-sm mt-1">Calculate and process monthly staff salaries.</p>
        </div>
        {staff.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => exportToExcel(`payroll-${selectedMonth}`, staff, cols, 'Payroll')}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button onClick={() => exportToPDF(`payroll-${selectedMonth}`, staff, cols, `Payroll — ${selectedMonth}`)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> PDF
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
          </div>
          {!isProcessed && staff.length > 0 && (
            <button onClick={processPayroll} disabled={processing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              <Play className="w-4 h-4" /> {processing ? 'Processing...' : 'Process Payroll'}
            </button>
          )}
          {isProcessed && staff.some(s => s.status === 'pending') && (
            <button onClick={markAllPaid}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              <CheckCircle className="w-4 h-4" /> Mark All Paid
            </button>
          )}
        </div>
      </div>

      {staff.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Staff</p>
            <p className="text-2xl font-black text-gray-800 mt-1">{staff.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Net Payroll</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{totalNet.toLocaleString()}</p>
          </div>
          <div className={`rounded-xl shadow-sm border p-5 ${paidCount === staff.length && staff.length > 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</p>
            <p className={`text-2xl font-black mt-1 ${paidCount === staff.length && staff.length > 0 ? 'text-green-600' : 'text-yellow-600'}`}>{paidCount} / {staff.length}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p>No active staff found. Add staff members in Staff Management.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Staff Member</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Base</th>
                  <th className="px-4 py-2 text-right font-medium text-green-600">+Allow.</th>
                  <th className="px-4 py-2 text-right font-medium text-red-500">−Deduct.</th>
                  <th className="px-4 py-2 text-center font-medium text-red-500">Cust. Ded (%)</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-500">Absent</th>
                  <th className="px-4 py-2 text-right font-medium text-amber-600">−Advance</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Net Salary</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
                  {isProcessed && <th className="px-4 py-2 w-24" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {staff.map(s => (
                  <tr key={s.staff_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <p className="font-medium text-gray-900">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{s.designation}</p>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">{s.base_salary.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-green-600">+{s.allowances.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-red-500">−{(s.deductions + s.absent_deduction).toLocaleString()}</td>
                    <td className="px-4 py-2 text-center">
                      {!isProcessed ? (
                        <div className="flex flex-col items-center gap-1">
                          <input type="number" min="0" max="100" value={s.custom_deduction_pct || ''} placeholder="0" title="Custom Deduction %"
                            onChange={e => updateCustomDeduction(s.staff_id, parseFloat(e.target.value) || 0)}
                            className="w-16 border border-slate-200 bg-white rounded-lg text-center text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                        </div>
                      ) : (
                        <span className={s.custom_deduction_pct > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{s.custom_deduction_pct}%</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {!isProcessed ? (
                        <>
                           {s.employment_type === 'visiting' && s.payment_basis === 'per-lecture' ? (
                               <div className="flex flex-col items-center gap-1">
                                  <input type="number" min="0" value={s.delivered_lectures} title="Delivered Lectures"
                                    onChange={e => updateAbsentDays(s.staff_id, s.absent_days, parseInt(e.target.value) || 0)}
                                    className="w-16 border border-slate-200 bg-white rounded-lg text-center text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                  <span className="text-[9px] text-gray-400 capitalize">Lectures</span>
                               </div>
                           ) : s.employment_type === 'visiting' && s.payment_basis === 'per-day' ? (
                               <div className="flex flex-col items-center gap-1">
                                  <span className="font-bold text-gray-700">{s.present_days}</span>
                                  <span className="text-[9px] text-gray-400 capitalize">Present</span>
                               </div>
                           ) : (
                               <div className="flex flex-col items-center gap-1">
                                  <input type="number" step="0.5" min="0" max="31" value={s.absent_days} title="Absent Days (including Half-Leaves mapping)"
                                    onChange={e => updateAbsentDays(s.staff_id, parseFloat(e.target.value) || 0)}
                                    className="w-16 border border-slate-200 bg-white rounded-lg text-center text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                  {s.half_leaves > 0 && <span className="text-[9px] text-purple-500 font-bold">{s.half_leaves} Half-Leave(s) Auto-Added</span>}
                               </div>
                           )}
                        </>
                      ) : (
                        <span className={s.absent_days > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{s.absent_days}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-amber-600 font-medium">
                      {(s.advance_deduction || 0) > 0 ? `−${s.advance_deduction.toLocaleString()}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-gray-900">{s.net_salary.toLocaleString()}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${s.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {s.status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    {isProcessed && (
                      <td className="px-4 py-2 text-center">
                        {s.status === 'pending' && s.payroll_id && (
                          <button onClick={() => markPaid(s.payroll_id!)}
                            className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 font-medium">
                            Mark Paid
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-4 py-2 font-bold text-gray-800" colSpan={7}>Total</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900 text-base">{totalNet.toLocaleString()}</td>
                  <td colSpan={isProcessed ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
