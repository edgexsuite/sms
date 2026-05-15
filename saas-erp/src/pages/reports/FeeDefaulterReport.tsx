import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Download, Search, Printer, MessageCircle, X, Send } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';
import { PageHeader, Card, Btn, Select, Input } from '../../components/ui';
import { openWhatsApp, feeDueTemplate } from '../../lib/whatsappTemplates';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function FeeDefaulterReport() {
  const { userRole } = useAuth();
  const [loading, setLoading]     = useState(false);
  const [records, setRecords]     = useState<any[]>([]);
  const [classes, setClasses]     = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [search, setSearch]       = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [sentIds, setSentIds]     = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userRole?.school_id) return;
    Promise.all([
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
      supabase.from('schools').select('name, logo_url, address').eq('id', userRole.school_id).single(),
    ]).then(([{ data: cls }, { data: sch }]) => {
      if (cls) setClasses(cls);
      if (sch) setSchoolInfo(sch);
    });
    fetchData();
  }, [userRole]);

  const fetchData = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    let query = supabase
      .from('fee_records')
      .select(`id, student_id, total_amount, paid_amount, status, month_year,
        students!inner(id, full_name, roll_number, is_deleted, class_id,
          classes(name, section),
          parents(whatsapp_number))`)
      .eq('school_id', userRole.school_id)
      .is('deleted_at', null)
      .in('status', ['pending', 'partially paid', 'partial', 'unpaid'])
      .order('month_year', { ascending: false });

    if (selectedMonth) query = query.eq('month_year', `${selectedMonth}-01`);

    const { data } = await query;
    let filtered = (data || []).filter(r => (r.students as any)?.is_deleted === false);
    if (selectedClass) filtered = filtered.filter(r => (r.students as any)?.class_id === selectedClass);
    setRecords(filtered);
    setLoading(false);
  }, [userRole, selectedClass, selectedMonth]);

  useEffect(() => { fetchData(); }, [selectedClass, selectedMonth]);

  const displayed = records.filter(r => {
    const name = (r.students as any)?.full_name?.toLowerCase() || '';
    return !search || name.includes(search.toLowerCase());
  });

  const totalDue = displayed.reduce((s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.paid_amount)), 0);

  const handleExportCSV = () => {
    exportToCSV('Fee_Defaulters', displayed.map(r => ({
      name: (r.students as any)?.full_name,
      class: classLabel((r.students as any)?.classes),
      roll: (r.students as any)?.roll_number,
      month: r.month_year?.slice(0, 7),
      total: r.total_amount,
      paid: r.paid_amount,
      due: Math.max(0, Number(r.total_amount) - Number(r.paid_amount)),
      status: r.status,
    })), [
      { header: 'Student Name', key: 'name' },
      { header: 'Class', key: 'class' },
      { header: 'Roll #', key: 'roll' },
      { header: 'Month', key: 'month' },
      { header: 'Total Fee', key: 'total' },
      { header: 'Paid', key: 'paid' },
      { header: 'Due', key: 'due' },
      { header: 'Status', key: 'status' },
    ]);
  };

  const handlePDF = async () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.width;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(schoolInfo?.name || 'School', pw / 2, 16, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Fee Defaulter Report', pw / 2, 24, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${formatDate(new Date().toISOString().split('T')[0])} · Total Due: Rs. ${totalDue.toLocaleString()}`, pw / 2, 31, { align: 'center' });

    autoTable(doc, {
      startY: 36,
      head: [['#', 'Student', 'Class', 'Month', 'Total', 'Paid', 'Due', 'Status']],
      body: displayed.map((r, i) => [
        i + 1,
        (r.students as any)?.full_name,
        classLabel((r.students as any)?.classes),
        r.month_year?.slice(0, 7),
        Number(r.total_amount).toLocaleString(),
        Number(r.paid_amount).toLocaleString(),
        Math.max(0, Number(r.total_amount) - Number(r.paid_amount)).toLocaleString(),
        r.status,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 6: { halign: 'right' } },
    });
    doc.save(`Fee_Defaulters_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const classLabel = (cls: any) => cls ? `${cls.name}${cls.section ? `-${cls.section}` : ''}` : '—';

  return (
    <div className="space-y-5">
      <PageHeader title="Fee Defaulter Report" subtitle="Students with pending or partial fee balances" icon={AlertCircle} />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Class</label>
            <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? `-${c.section}` : ''}</option>)}
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Month</label>
            <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9" placeholder="Student name..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Btn variant="secondary" icon={Download} onClick={handleExportCSV}>CSV</Btn>
            <Btn variant="secondary" icon={Printer} onClick={handlePDF}>PDF</Btn>
            {displayed.filter(r => (r.students as any)?.parents?.whatsapp_number).length > 0 && (
              <Btn variant="secondary" icon={Send} onClick={() => { setSentIds(new Set()); setShowBulkModal(true); }}>
                Send Reminders ({displayed.filter(r => (r.students as any)?.parents?.whatsapp_number).length})
              </Btn>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Defaulters', value: displayed.length, color: 'text-rose-600' },
          { label: 'Total Due', value: `Rs. ${totalDue.toLocaleString()}`, color: 'text-amber-600' },
          { label: 'Avg Due / Student', value: displayed.length ? `Rs. ${Math.round(totalDue / displayed.length).toLocaleString()}` : '—', color: 'text-indigo-600' },
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
        ) : displayed.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400">No defaulters found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['#', 'Student Name', 'Class', 'Roll #', 'Month', 'Total', 'Paid', 'Due', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayed.map((r, i) => {
                  const due = Math.max(0, Number(r.total_amount) - Number(r.paid_amount));
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{(r.students as any)?.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{classLabel((r.students as any)?.classes)}</td>
                      <td className="px-4 py-3 text-slate-500">{(r.students as any)?.roll_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{r.month_year?.slice(0, 7)}</td>
                      <td className="px-4 py-3 text-slate-700">Rs. {Number(r.total_amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-emerald-600">Rs. {Number(r.paid_amount).toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-rose-600">Rs. {due.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.status === 'pending' || r.status === 'unpaid' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(r.students as any)?.parents?.whatsapp_number && (
                          <button
                            title="Send WhatsApp Reminder"
                            onClick={() => openWhatsApp(
                              (r.students as any).parents.whatsapp_number,
                              feeDueTemplate({
                                studentName: (r.students as any)?.full_name,
                                className: classLabel((r.students as any)?.classes),
                                month: r.month_year?.slice(0, 7),
                                balance: Math.max(0, Number(r.total_amount) - Number(r.paid_amount)),
                              })
                            )}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Bulk WhatsApp Reminder Modal */}
      {showBulkModal && (() => {
        const contactable = displayed.filter(r => (r.students as any)?.parents?.whatsapp_number);
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Send Fee Reminders</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{sentIds.size} of {contactable.length} sent</p>
                </div>
                <button onClick={() => setShowBulkModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
                {contactable.map(r => {
                  const stu = r.students as any;
                  const due = Math.max(0, Number(r.total_amount) - Number(r.paid_amount));
                  const wasSent = sentIds.has(r.id);
                  return (
                    <div key={r.id} className={`flex items-center gap-3 px-6 py-3 ${wasSent ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{stu?.full_name}</p>
                        <p className="text-xs text-slate-400">{classLabel(stu?.classes)} · {r.month_year?.slice(0, 7)} · <span className="text-rose-600 font-bold">Rs. {due.toLocaleString()} due</span></p>
                      </div>
                      <button
                        onClick={() => {
                          openWhatsApp(stu.parents.whatsapp_number, feeDueTemplate({
                            studentName: stu?.full_name,
                            className: classLabel(stu?.classes),
                            month: r.month_year?.slice(0, 7),
                            balance: due,
                            schoolName: schoolInfo?.name,
                          }));
                          setSentIds(prev => new Set([...prev, r.id]));
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-colors shrink-0 ${
                          wasSent
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {wasSent ? '✓ Sent' : <><Send className="w-3 h-3" /> Send</>}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-xs text-slate-400">Click Send per row — browser opens WhatsApp</p>
                <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors">
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
