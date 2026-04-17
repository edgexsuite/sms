import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  History, Search, Download, Printer, FileText,
  Users, TrendingUp, TrendingDown, BarChart3, X
} from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import {
  downloadChallanPDF,
  DEFAULT_CHALLAN_CONFIG,
  type ChallanRecord,
  type SchoolInfo,
} from '../../lib/challanUtils';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface FeeRecord {
  id: string;
  invoice_number?: string;
  month_year: string;
  due_date?: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_mode?: string;
  breakdown?: { item: string; amount: number }[];
  remarks?: string;
  students?: {
    full_name?: string;
    roll_number?: number | string;
    class_id?: string;
    classes?: { name?: string; section?: string } | null;
    parents?: { father_name?: string } | null;
  };
}

const STATUS_FILTERS = ['All', 'paid', 'partial', 'pending', 'overdue'] as const;

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  partial: 'bg-amber-100 text-amber-800',
  pending: 'bg-red-100 text-red-800',
  overdue: 'bg-red-200 text-red-900',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentFeeHistory() {
  const { userRole } = useAuth();

  // Data
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [school, setSchool] = useState<any>(null);

  // Student autocomplete
  const [studentQuery, setStudentQuery] = useState('');
  const [studentSuggestions, setStudentSuggestions] = useState<any[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudentLabel, setSelectedStudentLabel] = useState('');
  const studentDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [classId, setClassId] = useState('');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  const fetchBootstrap = useCallback(async () => {
    if (!userRole?.school_id) return;

    const [{ data: sch }, { data: cls }] = await Promise.all([
      supabase.from('schools').select('name, logo_url, address, contact_phone').eq('id', userRole.school_id).maybeSingle(),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole.school_id).order('name'),
    ]);

    if (sch) setSchool(sch);
    if (cls) setClasses(cls);
  }, [userRole?.school_id]);

  useEffect(() => { fetchBootstrap(); }, [fetchBootstrap]);

  // ── Student autocomplete (debounced) ───────────────────────────────────────

  useEffect(() => {
    if (studentDebounce.current) clearTimeout(studentDebounce.current);

    if (!studentQuery.trim() || studentQuery.length < 2) {
      setStudentSuggestions([]);
      return;
    }

    studentDebounce.current = setTimeout(async () => {
      setIsSearchingStudents(true);
      const { data } = await supabase
        .from('students')
        .select('id, full_name, roll_number, class:class_id(name, section)')
        .eq('school_id', userRole!.school_id)
        .or(`full_name.ilike.%${studentQuery}%,roll_number.eq.${parseInt(studentQuery) || 0}`)
        .limit(8);
      setStudentSuggestions(data || []);
      setIsSearchingStudents(false);
    }, 300);

    return () => { if (studentDebounce.current) clearTimeout(studentDebounce.current); };
  }, [studentQuery, userRole?.school_id]);

  // ── Fetch Records ──────────────────────────────────────────────────────────

  const fetchRecords = useCallback(async () => {
    if (!userRole?.school_id) return;
    setLoading(true);

    let query = supabase
      .from('fee_records')
      .select('id, invoice_number, month_year, due_date, total_amount, paid_amount, status, payment_mode, breakdown, remarks, students(full_name, roll_number, class_id, classes(name, section), parents(father_name))')
      .eq('school_id', userRole.school_id)
      .order('month_year', { ascending: false });

    if (selectedStudentId) {
      query = query.eq('student_id', selectedStudentId);
    }
    if (monthFrom) {
      query = query.gte('month_year', `${monthFrom}-01`);
    }
    if (monthTo) {
      // End of selected month
      query = query.lte('month_year', `${monthTo}-31`);
    }
    if (statusFilter !== 'All') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.limit(500);
    if (error) console.error('FeeHistory fetch error:', error);

    // Normalize Supabase join — `students` may come back as array or single object
    const normalized = (data || []).map((r: any) => ({
      ...r,
      students: Array.isArray(r.students) ? r.students[0] : r.students,
    }));
    let result: FeeRecord[] = normalized;

    // Client-side class filter (joined table column)
    if (classId) {
      result = result.filter(r => r.students?.class_id === classId);
    }

    setRecords(result);
    setLoading(false);
  }, [userRole?.school_id, selectedStudentId, monthFrom, monthTo, statusFilter, classId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalBilled = records.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalCollected = records.reduce((s, r) => s + Number(r.paid_amount), 0);
  const totalOutstanding = totalBilled - totalCollected;

  // ── Challan record builder ─────────────────────────────────────────────────

  const buildChallanRecord = (rec: FeeRecord): ChallanRecord => {
    const cls = rec.students?.classes;
    return {
      id: rec.id,
      invoice_number: rec.invoice_number || undefined,
      month_year: rec.month_year,
      due_date: rec.due_date || undefined,
      total_amount: Number(rec.total_amount),
      paid_amount: Number(rec.paid_amount),
      status: rec.status,
      breakdown: rec.breakdown?.length
        ? rec.breakdown
        : [{ item: 'Tuition Fee', amount: Number(rec.total_amount) }],
      student_name: rec.students?.full_name || '-',
      roll_number: rec.students?.roll_number,
      class_name: cls ? `${cls.name || ''}${cls.section ? `-${cls.section}` : ''}` : '-',
      father_name: (rec.students?.parents as any)?.father_name || '',
      issue_date: rec.month_year,
    };
  };

  const schoolInfo: SchoolInfo = {
    name: school?.name || 'School',
    address: school?.address || undefined,
    contact_phone: school?.contact_phone || undefined,
    logo_url: school?.logo_url || undefined,
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handlePrintOne = (rec: FeeRecord) => {
    downloadChallanPDF([buildChallanRecord(rec)], schoolInfo, DEFAULT_CHALLAN_CONFIG);
  };

  const handlePrintAll = () => {
    if (!records.length) return;
    downloadChallanPDF(
      records.map(buildChallanRecord),
      schoolInfo,
      DEFAULT_CHALLAN_CONFIG,
      'fee-history-report.pdf',
    );
  };

  const handleExport = () => {
    exportToCSV(`fee-history-${new Date().toISOString().split('T')[0]}`, records, [
      { header: 'Invoice #', key: 'invoice_number' },
      { header: 'Student', key: (r: FeeRecord) => r.students?.full_name || '-' },
      { header: 'Class', key: (r: FeeRecord) => {
        const cls = r.students?.classes;
        return cls ? `${cls.name || ''}${cls.section ? `-${cls.section}` : ''}` : '-';
      }},
      { header: 'Month', key: (r: FeeRecord) => new Date(r.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
      { header: 'Billed', key: 'total_amount' },
      { header: 'Paid', key: 'paid_amount' },
      { header: 'Balance', key: (r: FeeRecord) => Number(r.total_amount) - Number(r.paid_amount) },
      { header: 'Status', key: 'status' },
      { header: 'Mode', key: 'payment_mode' },
    ]);
  };

  const clearStudentFilter = () => {
    setSelectedStudentId('');
    setSelectedStudentLabel('');
    setStudentQuery('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" />
            Fee History
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Reporting and batch challan printing across date ranges and classes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={handlePrintAll}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print All Challans
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Student autocomplete */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-500 mb-1">Student</label>
            {selectedStudentId ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-indigo-300 bg-indigo-50 rounded-lg">
                <span className="flex-1 text-sm font-medium text-indigo-900 truncate">{selectedStudentLabel}</span>
                <button onClick={clearStudentFilter} className="text-indigo-400 hover:text-indigo-700 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  value={studentQuery}
                  onChange={e => setStudentQuery(e.target.value)}
                  placeholder="Search student..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Dropdown suggestions */}
            {!selectedStudentId && studentQuery && studentSuggestions.length > 0 && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                {studentSuggestions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedStudentId(s.id);
                      setSelectedStudentLabel(`${s.full_name} (#${s.roll_number})`);
                      setStudentQuery('');
                      setStudentSuggestions([]);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 border-b border-gray-100 last:border-0 flex justify-between items-center text-sm"
                  >
                    <span className="font-medium text-gray-900">{s.full_name}</span>
                    <span className="text-gray-500 text-xs">
                      Roll #{s.roll_number} · {s.class ? `${s.class.name}-${s.class.section}` : '-'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!selectedStudentId && studentQuery && !isSearchingStudents && studentSuggestions.length === 0 && studentQuery.length >= 2 && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-400 text-center">
                No students found
              </div>
            )}
          </div>

          {/* Class filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Month From */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month From</label>
            <input
              type="month"
              value={monthFrom}
              onChange={e => setMonthFrom(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
            />
          </div>

          {/* Month To */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month To</label>
            <input
              type="month"
              value={monthTo}
              onChange={e => setMonthTo(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700"
            />
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">Status:</span>
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
          {(selectedStudentId || classId || monthFrom || monthTo || statusFilter !== 'All') && (
            <button
              onClick={() => {
                clearStudentFilter();
                setClassId('');
                setMonthFrom('');
                setMonthTo('');
                setStatusFilter('All');
              }}
              className="ml-2 text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* ── Summary Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Billed</p>
          </div>
          <p className="text-2xl font-black text-gray-800">Rs. {totalBilled.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Collected</p>
          </div>
          <p className="text-2xl font-black text-emerald-600">Rs. {totalCollected.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outstanding</p>
          </div>
          <p className={`text-2xl font-black ${totalOutstanding > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            Rs. {totalOutstanding.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Records</p>
          </div>
          <p className="text-2xl font-black text-gray-800">{records.length.toLocaleString()}</p>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
            Loading records...
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium mb-1">No fee records found</p>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Fee History is for reporting and batch printing across date ranges and classes.
              Use Student Ledgers to process individual payments.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Billed</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mode</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(r => {
                  const balance = Number(r.total_amount) - Number(r.paid_amount);
                  const cls = r.students?.classes;
                  const className = cls
                    ? `${cls.name || ''}${cls.section ? `-${cls.section}` : ''}`
                    : '-';
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {r.invoice_number || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[140px]">
                          {r.students?.full_name || '—'}
                        </p>
                        {r.students?.roll_number && (
                          <p className="text-xs text-gray-400">Roll #{r.students.roll_number}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{className}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {new Date(r.month_year).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        Rs. {Number(r.total_amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700 font-medium">
                        Rs. {Number(r.paid_amount).toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {balance > 0 ? `Rs. ${balance.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{r.payment_mode || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handlePrintOne(r)}
                          title="Print Challan"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
