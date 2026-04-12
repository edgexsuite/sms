import { useEffect, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Grade {
  id: string;
  score: number;
  max_score: number;
  type: string;
  term: string;
  comments: string;
  created_at: string;
  students: { profiles: { first_name: string; last_name: string } };
  classes: { name: string; subject: string };
}

interface Student { id: string; profiles: { first_name: string; last_name: string } }
interface ClassRow { id: string; name: string; subject: string }

const emptyForm = { studentId: '', classId: '', score: '', maxScore: '100', type: 'exam', term: '', comments: '' };

export default function Grades() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [{ data: g }, { data: s }, { data: c }] = await Promise.all([
      supabase.from('grades').select('*, students(profiles(first_name, last_name)), classes(name, subject)').order('created_at', { ascending: false }),
      supabase.from('students').select('id, profiles(first_name, last_name)'),
      supabase.from('classes').select('id, name, subject'),
    ]);
    setGrades((g as Grade[]) ?? []);
    setStudents((s as Student[]) ?? []);
    setClasses((c as ClassRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = grades.filter(g =>
    `${g.students?.profiles?.first_name} ${g.students?.profiles?.last_name} ${g.classes?.name} ${g.type} ${g.term}`
      .toLowerCase().includes(search.toLowerCase())
  );

  function percentage(score: number, max: number) {
    return Math.round((score / max) * 100);
  }

  function grade(pct: number) {
    if (pct >= 90) return { label: 'A', color: 'text-green-700 bg-green-100' };
    if (pct >= 80) return { label: 'B', color: 'text-blue-700 bg-blue-100' };
    if (pct >= 70) return { label: 'C', color: 'text-yellow-700 bg-yellow-100' };
    if (pct >= 60) return { label: 'D', color: 'text-orange-700 bg-orange-100' };
    return { label: 'F', color: 'text-red-700 bg-red-100' };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('grades').insert({
      student_id: form.studentId,
      class_id: form.classId,
      score: Number(form.score),
      max_score: Number(form.maxScore),
      type: form.type,
      term: form.term,
      comments: form.comments || null,
    });
    setShowModal(false);
    setForm(emptyForm);
    load();
    setSaving(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Grades</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Grade
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search grades..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  {['Student', 'Class', 'Type', 'Term', 'Score', 'Grade', 'Date'].map(h => (
                    <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No grades found</td></tr>
                ) : filtered.map(g => {
                  const pct = percentage(g.score, g.max_score);
                  const { label, color } = grade(pct);
                  return (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">{g.students?.profiles?.first_name} {g.students?.profiles?.last_name}</td>
                      <td className="px-6 py-4 text-gray-600">{g.classes?.name}</td>
                      <td className="px-6 py-4 capitalize text-gray-600">{g.type}</td>
                      <td className="px-6 py-4 text-gray-500">{g.term}</td>
                      <td className="px-6 py-4 text-gray-800">{g.score}/{g.max_score} <span className="text-gray-400 text-xs">({pct}%)</span></td>
                      <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>{label}</span></td>
                      <td className="px-6 py-4 text-gray-400">{new Date(g.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Grade</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Student</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.profiles.first_name} {s.profiles.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Class</label>
                <select required value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['exam', 'quiz', 'assignment', 'project', 'midterm', 'final'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Term</label><input required value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} placeholder="e.g. Term 1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Score</label><input required type="number" min="0" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Max Score</label><input required type="number" min="1" value={form.maxScore} onChange={e => setForm(f => ({ ...f, maxScore: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Comments</label><textarea value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
