import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, Search, Printer, ChevronRight, GraduationCap,
  Phone, ArrowLeft, BookOpen, User
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ClassStudents() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchClasses();
  }, [userRole]);

  const fetchClasses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('classes')
      .select('id, name, section, staff(full_name)')
      .eq('school_id', userRole!.school_id)
      .order('name').order('section');
    setClasses(data || []);
    setLoading(false);
  };

  const selectClass = async (cls: any) => {
    setSelectedClass(cls);
    setSearch('');
    setLoadingStudents(true);
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number, photograph_url, gender, blood_group, dob, status, parents(whatsapp_number)')
      .eq('class_id', cls.id)
      .eq('status', 'active')
      .order('roll_number');
    setStudents(data || []);
    setLoadingStudents(false);
  };

  const filtered = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    String(s.roll_number).includes(search)
  );

  const maleCount = students.filter(s => s.gender?.toLowerCase() === 'male').length;
  const femaleCount = students.filter(s => s.gender?.toLowerCase() === 'female').length;

  // Class list view
  if (!selectedClass) {
    return (
      <div className="space-y-6">
        <style>{`@media print { .no-print { display: none !important; } }`}</style>
        <div className="no-print">
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
            <GraduationCap className="w-7 h-7 text-indigo-600" /> Class Students
          </h1>
          <p className="text-slate-500 text-sm mt-1">Select a class to view its students.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {classes.map(cls => (
              <button
                key={cls.id}
                onClick={() => selectClass(cls)}
                className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50 transition-all group active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                    <BookOpen className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
                <h3 className="font-black text-slate-900 text-lg leading-tight">
                  {cls.name}
                  {cls.section && <span className="text-indigo-600"> – {cls.section}</span>}
                </h3>
                {cls.staff?.full_name && (
                  <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1">
                    <User className="w-3 h-3" /> {cls.staff.full_name}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Students view for selected class
  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-card { break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedClass(null); setStudents([]); }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {selectedClass.name}
              {selectedClass.section && ` – ${selectedClass.section}`}
            </h1>
            {selectedClass.staff?.full_name && (
              <p className="text-xs text-slate-400 font-medium">
                Class Teacher: {selectedClass.staff.full_name}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
        >
          <Printer className="w-4 h-4" /> Print Roster
        </button>
      </div>

      {/* Stats row */}
      <div className="no-print grid grid-cols-3 gap-3">
        {[
          { label: 'Total',   value: students.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Male',    value: maleCount,        color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Female',  value: femaleCount,      color: 'text-pink-600',   bg: 'bg-pink-50' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-2xl p-4 text-center', s.bg)}>
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="no-print relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or roll number…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition"
        />
      </div>

      {/* Print header (only shows on print) */}
      <div className="hidden print:block text-center mb-6">
        <h2 className="text-xl font-black uppercase">Class Roster — {selectedClass.name} {selectedClass.section}</h2>
        <p className="text-sm text-slate-500">Class Teacher: {selectedClass.staff?.full_name || '—'} · Total Students: {students.length}</p>
      </div>

      {loadingStudents ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-bold">No students found</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-3 sm:hidden">
            {filtered.map(s => (
              <div key={s.id} className="print-card bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 overflow-hidden shrink-0 flex items-center justify-center">
                  {s.photograph_url
                    ? <img src={s.photograph_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-indigo-600 font-black text-lg">{s.full_name?.charAt(0)}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-sm truncate">{s.full_name}</p>
                  <p className="text-xs text-slate-500">Roll # {s.roll_number}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {s.gender && <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{s.gender}</span>}
                    {s.blood_group && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">{s.blood_group}</span>}
                  </div>
                </div>
                {s.parents?.whatsapp_number && (
                  <a href={`tel:${s.parents.whatsapp_number}`} className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Desktop + Print: table */}
          <div className="hidden sm:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Roll #</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Blood</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">DOB</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.id} className={cn('print-card border-b border-slate-50 hover:bg-slate-50/50 transition-colors', i % 2 === 0 ? '' : 'bg-slate-50/30')}>
                      <td className="px-4 py-3">
                        <span className="font-black text-indigo-600 text-sm">#{s.roll_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 overflow-hidden shrink-0 flex items-center justify-center">
                            {s.photograph_url
                              ? <img src={s.photograph_url} alt="" className="w-full h-full object-cover" />
                              : <span className="text-indigo-600 font-black text-xs">{s.full_name?.charAt(0)}</span>
                            }
                          </div>
                          <span className="font-bold text-slate-900 text-sm">{s.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-bold px-2 py-1 rounded-full',
                          s.gender?.toLowerCase() === 'female' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'
                        )}>{s.gender || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-red-600">{s.blood_group || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">{s.dob || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">{s.parents?.whatsapp_number || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
