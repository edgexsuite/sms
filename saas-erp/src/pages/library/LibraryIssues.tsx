import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Plus, X, RotateCcw, Download } from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';

interface Issue {
  id: string;
  issued_date: string;
  due_date: string;
  returned_date: string | null;
  fine_amount: number;
  status: string;
  book: { title: string; author: string };
  member: { member_name: string; member_type: string; card_number: string };
}

const EMPTY_FORM = { book_id: '', member_id: '', issued_date: new Date().toISOString().split('T')[0], due_days: 14 };

export default function LibraryIssues() {
  const { userRole } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (userRole?.school_id) { fetchIssues(); fetchBooks(); fetchMembers(); }
  }, [userRole]);

  const fetchIssues = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('library_issues')
      .select('*, book:book_id(title, author), member:member_id(member_name, member_type, card_number)')
      .eq('school_id', userRole!.school_id)
      .order('issued_date', { ascending: false });
    setIssues(data || []);
    setLoading(false);
  };

  const fetchBooks = async () => {
    const { data } = await supabase.from('library_books').select('id, title, author, available_copies').eq('school_id', userRole!.school_id).gt('available_copies', 0);
    setBooks(data || []);
  };

  const fetchMembers = async () => {
    const { data } = await supabase.from('library_members').select('id, member_name, member_type, card_number').eq('school_id', userRole!.school_id).eq('status', 'active');
    setMembers(data || []);
  };

  const issueBook = async () => {
    if (!form.book_id || !form.member_id) return;
    setSaving(true);
    const dueDate = new Date(form.issued_date);
    dueDate.setDate(dueDate.getDate() + form.due_days);
    await supabase.from('library_issues').insert({
      school_id: userRole!.school_id, book_id: form.book_id, member_id: form.member_id,
      issued_date: form.issued_date, due_date: dueDate.toISOString().split('T')[0], status: 'issued',
    });
    const { data: bookData } = await supabase.from('library_books').select('available_copies').eq('id', form.book_id).single();
    await supabase.from('library_books').update({ available_copies: Math.max(0, (bookData?.available_copies || 1) - 1) }).eq('id', form.book_id);
    setSaving(false); setShowModal(false); fetchIssues(); fetchBooks();
  };

  const returnBook = async (issue: Issue) => {
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(issue.due_date);
    const now = new Date();
    const overdueDays = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    const fine = overdueDays * 5; // PKR 5 per day — configurable

    await supabase.from('library_issues').update({ returned_date: today, status: 'returned', fine_amount: fine }).eq('id', issue.id);
    const book = books.find(b => b.id === (issue as any).book_id) || { available_copies: 0 };
    await supabase.from('library_books').update({ available_copies: (book.available_copies || 0) + 1 }).eq('id', (issue as any).book_id);
    fetchIssues(); fetchBooks();
  };

  const filtered = statusFilter === 'all' ? issues : issues.filter(i => i.status === statusFilter);
  const overdueCount = issues.filter(i => i.status === 'issued' && new Date(i.due_date) < new Date()).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-600" /> Issue / Return
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track book borrowing and returns.</p>
        </div>
        <div className="flex gap-2">
          {issues.length > 0 && (
            <button onClick={() => exportToExcel('library-issues', filtered, [
              { header: 'Book', key: (r: any) => r.book?.title }, { header: 'Member', key: (r: any) => r.member?.member_name },
              { header: 'Issued', key: 'issued_date' }, { header: 'Due', key: 'due_date' },
              { header: 'Returned', key: 'returned_date' }, { header: 'Fine', key: 'fine_amount' }, { header: 'Status', key: 'status' },
            ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700">
            <Plus className="w-4 h-4" /> Issue Book
          </button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        {['all', 'issued', 'returned'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === s ? 'bg-amber-100 text-amber-800' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'issued' && overdueCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{overdueCount} overdue</span>}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400">Loading...</div>
          : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>No records found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Book</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Member</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Issued</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Due Date</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Returned</th>
                  <th className="px-5 py-3 text-center font-medium text-gray-500">Fine</th>
                  <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
                  <th className="px-5 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(i => {
                  const isOverdue = i.status === 'issued' && new Date(i.due_date) < new Date();
                  return (
                    <tr key={i.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{i.book?.title}</p>
                        <p className="text-xs text-gray-400">{i.book?.author}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-gray-700">{i.member?.member_name}</p>
                        <p className="text-xs text-gray-400 capitalize">{i.member?.member_type} · #{i.member?.card_number}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{i.issued_date}</td>
                      <td className={`px-5 py-3 text-xs ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>{i.due_date}</td>
                      <td className="px-5 py-3 text-xs text-gray-500">{i.returned_date || '—'}</td>
                      <td className="px-5 py-3 text-center text-xs">{i.fine_amount > 0 ? <span className="text-red-600 font-medium">{i.fine_amount}</span> : '—'}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${i.status === 'returned' ? 'bg-green-100 text-green-800' : isOverdue ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                          {isOverdue ? 'Overdue' : i.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {i.status === 'issued' && (
                          <button onClick={() => returnBook(i)} title="Mark Returned"
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Issue Book</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Book *</label>
                <select value={form.book_id} onChange={e => setForm({ ...form, book_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="">Select book...</option>
                  {books.map(b => <option key={b.id} value={b.id}>{b.title} (avail: {b.available_copies})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Member *</label>
                <select value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="">Select member...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.member_name} ({m.member_type})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Issue Date</label>
                  <input type="date" value={form.issued_date} onChange={e => setForm({ ...form, issued_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Due in (days)</label>
                  <input type="number" min="1" value={form.due_days} onChange={e => setForm({ ...form, due_days: parseInt(e.target.value) || 14 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={issueBook} disabled={saving || !form.book_id || !form.member_id}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
                {saving ? 'Issuing...' : 'Issue Book'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
