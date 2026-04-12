import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { History, Search, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';

interface FeeRecord {
  id: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_mode: string;
  invoice_number: string;
  created_at: string;
}

export default function StudentFeeHistory() {
  const { userRole } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (userRole?.school_id) fetchStudents();
  }, [userRole]);

  useEffect(() => {
    if (selectedStudent) fetchHistory();
  }, [selectedStudent]);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number, class:class_id(name, section)')
      .eq('school_id', userRole!.school_id)
      .order('full_name');
    setStudents(data || []);
  };

  const fetchHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fee_records')
      .select('id, month_year, total_amount, paid_amount, status, payment_mode, invoice_number, created_at')
      .eq('school_id', userRole!.school_id)
      .eq('student_id', selectedStudent)
      .order('month_year', { ascending: false });
    setRecords(data || []);
    setLoading(false);
  };

  const filtered = records.filter(r => statusFilter === 'all' || r.status === statusFilter);

  const student = students.find(s => s.id === selectedStudent);
  const totalBilled = filtered.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalPaid = filtered.reduce((s, r) => s + Number(r.paid_amount), 0);
  const totalDue = totalBilled - totalPaid;

  const statusColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-red-100 text-red-800',
    overdue: 'bg-red-200 text-red-900',
  };

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    String(s.roll_number).includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" /> Student Fee History
          </h1>
          <p className="text-gray-500 text-sm mt-1">Complete fee payment timeline for any student.</p>
        </div>
        {records.length > 0 && (
          <button onClick={() => exportToCSV(`fee-history-${student?.full_name || 'student'}`, filtered, [
            { header: 'Month', key: 'month_year' },
            { header: 'Total', key: 'total_amount' },
            { header: 'Paid', key: 'paid_amount' },
            { header: 'Balance', key: (r: FeeRecord) => Number(r.total_amount) - Number(r.paid_amount) },
            { header: 'Status', key: 'status' },
            { header: 'Mode', key: 'payment_mode' },
            { header: 'Invoice', key: 'invoice_number' },
          ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
        )}
      </div>

      {/* Student Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Search student by name or roll number..." />
        </div>
        {search && filteredStudents.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {filteredStudents.map(s => (
              <button key={s.id} onClick={() => { setSelectedStudent(s.id); setSearch(''); }}
                className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 border-b border-gray-100 last:border-0 flex justify-between items-center text-sm">
                <span className="font-medium text-gray-900">{s.full_name}</span>
                <span className="text-gray-500">Roll #{s.roll_number} · {s.class ? `${s.class.name}-${s.class.section}` : '-'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {student && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-indigo-900 text-lg">{student.full_name}</p>
            <p className="text-indigo-600 text-sm">Roll #{student.roll_number} · {student.class ? `${student.class.name}-${student.class.section}` : '-'}</p>
          </div>
          <button onClick={() => { setSelectedStudent(''); setRecords([]); }}
            className="text-indigo-400 hover:text-indigo-600 text-xl leading-none">×</button>
        </div>
      )}

      {selectedStudent && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Billed</p>
              <p className="text-2xl font-black text-gray-800 mt-1">Rs. {totalBilled.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Paid</p>
              <p className="text-2xl font-black text-green-600 mt-1">Rs. {totalPaid.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Balance Due</p>
              <p className={`text-2xl font-black mt-1 ${totalDue > 0 ? 'text-red-600' : 'text-gray-800'}`}>Rs. {totalDue.toLocaleString()}</p>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filter:</span>
            {['all', 'paid', 'partial', 'pending', 'overdue'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No fee records found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Month</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Billed</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Paid</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Balance</th>
                    <th className="px-6 py-3 text-center font-medium text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Mode</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map(r => {
                    const balance = Number(r.total_amount) - Number(r.paid_amount);
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {new Date(r.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-gray-700">Rs. {Number(r.total_amount).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-mono text-green-700 font-medium">Rs. {Number(r.paid_amount).toLocaleString()}</td>
                        <td className={`px-6 py-4 text-right font-mono font-medium ${balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {balance > 0 ? `Rs. ${balance.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${statusColors[r.status] || 'bg-gray-100 text-gray-700'}`}>{r.status}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{r.payment_mode || '—'}</td>
                        <td className="px-6 py-4 text-gray-400 font-mono text-xs">{r.invoice_number || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!selectedStudent && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <History className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>Search and select a student above to view their fee history.</p>
        </div>
      )}
    </div>
  );
}
