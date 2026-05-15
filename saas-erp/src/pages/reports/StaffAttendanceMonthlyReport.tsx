import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Download, Printer } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { PageHeader, Card, Btn, Input } from '../../components/ui';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const STATUSES = ['present', 'late', 'absent', 'half_day', 'complementary_off', 'vacation'];
const LABEL: Record<string, string> = {
  present: 'Present', late: 'Late', absent: 'Absent',
  half_day: 'Half Day', complementary_off: 'Paid Off', vacation: 'Vacation',
};

interface StaffRow {
  id: string;
  full_name: string;
  role: string;
  counts: Record<string, number>;
  total: number;
}

export default function StaffAttendanceMonthlyReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (!userRole?.school_id) return;
    supabase.from('schools').select('name, logo_url').eq('id', userRole.school_id).single()
      .then(({ data }) => { if (data) setSchoolInfo(data); });
  }, [userRole?.school_id]);

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id || !selectedMonth) return;
    setLoading(true);

    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const [{ data: staffData }, { data: attData }] = await Promise.all([
      supabase.from('staff')
        .select('id, full_name, role')
        .eq('school_id', userRole.school_id)
        .eq('is_deleted', false)
        .order('full_name'),
      supabase.from('attendance')
        .select('staff_id, status')
        .eq('school_id', userRole.school_id)
        .gte('date', startDate)
        .lte('date', endDate)
        .not('staff_id', 'is', null),
    ]);

    const attMap: Record<string, Record<string, number>> = {};
    (attData || []).forEach((a: any) => {
      if (!attMap[a.staff_id]) attMap[a.staff_id] = {};
      attMap[a.staff_id][a.status] = (attMap[a.staff_id][a.status] || 0) + 1;
    });

    const result: StaffRow[] = (staffData || []).map(s => {
      const counts = attMap[s.id] || {};
      const total = Object.values(counts).reduce((sum, v) => sum + v, 0);
      return { id: s.id, full_name: s.full_name, role: s.role, counts, total };
    });

    setRows(result);
    setLoading(false);
  }, [userRole, selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPresent = rows.reduce((s, r) => s + (r.counts.present || 0) + (r.counts.late || 0), 0);
  const totalAbsent = rows.reduce((s, r) => s + (r.counts.absent || 0), 0);

  const handleExportCSV = () => {
    exportToCSV('Staff_Attendance_Monthly', rows.map(r => ({
      name: r.full_name, role: r.role,
      ...Object.fromEntries(STATUSES.map(s => [LABEL[s], r.counts[s] || 0])),
      total: r.total,
    })), [
      { header: 'Staff Name', key: 'name' },
      { header: 'Role', key: 'role' },
      ...STATUSES.map(s => ({ header: LABEL[s], key: LABEL[s] })),
      { header: 'Total Days', key: 'total' },
    ]);
  };

  const handlePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pw = doc.internal.pageSize.width;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'School', pw / 2, 14, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Staff Attendance Summary — ${selectedMonth}`, pw / 2, 21, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pw / 2, 27, { align: 'center' });

    autoTable(doc, {
      startY: 32,
      head: [['#', 'Staff Name', 'Role', ...STATUSES.map(s => LABEL[s]), 'Total']],
      body: rows.map((r, i) => [
        i + 1, r.full_name, r.role,
        ...STATUSES.map(s => r.counts[s] || 0),
        r.total,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10 } },
    });
    doc.save(`Staff_Attendance_${selectedMonth}.pdf`);
  };

  const STATUS_COLOR: Record<string, string> = {
    present: 'text-emerald-700', late: 'text-amber-600', absent: 'text-rose-600',
    half_day: 'text-indigo-600', complementary_off: 'text-slate-600', vacation: 'text-purple-600',
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Staff Attendance Monthly Summary" subtitle="Monthly attendance breakdown per staff member" icon={Users} />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Month</label>
            <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Btn variant="secondary" icon={Download} onClick={handleExportCSV}>CSV</Btn>
            <Btn variant="secondary" icon={Printer} onClick={handlePDF}>PDF</Btn>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Staff', value: rows.length, color: 'text-indigo-600' },
          { label: 'Total Present (inc. Late)', value: totalPresent, color: 'text-emerald-600' },
          { label: 'Total Absences', value: totalAbsent, color: 'text-rose-600' },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400">No data for this month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Staff Name</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Role</th>
                  {STATUSES.map(s => (
                    <th key={s} className={`px-4 py-3 text-center text-xs font-black uppercase tracking-wider whitespace-nowrap ${STATUS_COLOR[s]}`}>
                      {LABEL[s]}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{r.full_name}</td>
                    <td className="px-4 py-3 text-slate-500 capitalize text-xs">{r.role}</td>
                    {STATUSES.map(s => (
                      <td key={s} className={`px-4 py-3 text-center font-bold text-sm ${r.counts[s] ? STATUS_COLOR[s] : 'text-slate-300'}`}>
                        {r.counts[s] || 0}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center text-slate-600 font-semibold">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
