import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { GraduationCap, Download, Printer } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { PageHeader, Card, Btn, Select } from '../../components/ui';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#6366f1','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4','#84cc16','#ec4899','#14b8a6','#f97316'];

interface ClassRow {
  class_id: string;
  class_name: string;
  total: number;
  male: number;
  female: number;
  other: number;
}

export default function StudentStrengthReport() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('active');

  useEffect(() => {
    if (!userRole?.school_id) return;
    supabase.from('schools').select('name, logo_url').eq('id', userRole.school_id).single()
      .then(({ data }) => { if (data) setSchoolInfo(data); });
  }, [userRole?.school_id]);

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    let query = supabase
      .from('students')
      .select('id, gender, class_id, class:class_id(name, section)')
      .eq('school_id', userRole.school_id)
      .eq('is_deleted', false);

    if (statusFilter) query = query.eq('status', statusFilter);

    const { data } = await query;

    const map: Record<string, ClassRow> = {};
    (data || []).forEach((s: any) => {
      const cid = s.class_id;
      if (!cid) return;
      const cls = s.class;
      const name = cls ? `${cls.name}${cls.section ? `-${cls.section}` : ''}` : 'Unknown';
      if (!map[cid]) map[cid] = { class_id: cid, class_name: name, total: 0, male: 0, female: 0, other: 0 };
      map[cid].total++;
      const g = (s.gender || '').toLowerCase();
      if (g === 'male')        map[cid].male++;
      else if (g === 'female') map[cid].female++;
      else                     map[cid].other++;
    });

    const sorted = Object.values(map).sort((a, b) => a.class_name.localeCompare(b.class_name));
    setRows(sorted);
    setLoading(false);
  }, [userRole, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalStudents = rows.reduce((s, r) => s + r.total, 0);
  const totalMale = rows.reduce((s, r) => s + r.male, 0);
  const totalFemale = rows.reduce((s, r) => s + r.female, 0);

  const pieData = rows.map(r => ({ name: r.class_name, value: r.total }));

  const handleExportCSV = () => {
    exportToCSV('Student_Strength', rows.map(r => ({
      class: r.class_name, male: r.male, female: r.female, other: r.other, total: r.total,
    })), [
      { header: 'Class', key: 'class' },
      { header: 'Male', key: 'male' },
      { header: 'Female', key: 'female' },
      { header: 'Other', key: 'other' },
      { header: 'Total', key: 'total' },
    ]);
  };

  const handlePDF = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.width;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'School', pw / 2, 16, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Student Strength Report (${statusFilter})`, pw / 2, 24, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()} · Total Students: ${totalStudents}`, pw / 2, 31, { align: 'center' });

    autoTable(doc, {
      startY: 36,
      head: [['#', 'Class', 'Male', 'Female', 'Other', 'Total']],
      body: [
        ...rows.map((r, i) => [i + 1, r.class_name, r.male, r.female, r.other, r.total]),
        ['', 'TOTAL', totalMale, totalFemale, rows.reduce((s, r) => s + r.other, 0), totalStudents],
      ],
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      foot: [],
    });
    doc.save(`Student_Strength_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Student Strength Report" subtitle="Class-wise enrollment count and gender breakdown" icon={GraduationCap} />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Status</label>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="">All</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Btn variant="secondary" icon={Download} onClick={handleExportCSV}>CSV</Btn>
            <Btn variant="secondary" icon={Printer} onClick={handlePDF}>PDF</Btn>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Students', value: totalStudents, color: 'text-indigo-600' },
          { label: 'Male', value: totalMale, color: 'text-blue-600' },
          { label: 'Female', value: totalFemale, color: 'text-pink-600' },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>
          ) : pieData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400">No data.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v} students`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400">No students found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['#', 'Class', 'Male', 'Female', 'Other', 'Total'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((r, i) => (
                    <tr key={r.class_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2 font-semibold text-slate-800">{r.class_name}</td>
                      <td className="px-4 py-2 text-blue-600 font-semibold">{r.male}</td>
                      <td className="px-4 py-2 text-pink-600 font-semibold">{r.female}</td>
                      <td className="px-4 py-2 text-slate-500">{r.other || '—'}</td>
                      <td className="px-4 py-2 font-black text-indigo-600">{r.total}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 font-black text-slate-700">Total</td>
                    <td className="px-4 py-2 font-black text-blue-700">{totalMale}</td>
                    <td className="px-4 py-2 font-black text-pink-700">{totalFemale}</td>
                    <td className="px-4 py-2 font-black text-slate-600">{rows.reduce((s, r) => s + r.other, 0)}</td>
                    <td className="px-4 py-2 font-black text-indigo-700">{totalStudents}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
