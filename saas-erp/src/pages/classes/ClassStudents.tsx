import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { GraduationCap, ChevronRight, BookOpen, User, Users } from 'lucide-react';
import StudentList from '../students/StudentList';

export default function ClassStudents() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole?.school_id) fetchClasses();
  }, [userRole]);

  const fetchClasses = async () => {
    setLoading(true);
    const [{ data: cls }, { data: counts }] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, section, staff(full_name)')
        .eq('school_id', userRole!.school_id)
        .order('name').order('section'),
      supabase
        .from('students')
        .select('class_id')
        .eq('school_id', userRole!.school_id)
        .eq('status', 'active')
        .eq('is_deleted', false),
    ]);
    setClasses(cls || []);
    const countMap: Record<string, number> = {};
    (counts || []).forEach((s: any) => {
      if (s.class_id) countMap[s.class_id] = (countMap[s.class_id] || 0) + 1;
    });
    setStudentCounts(countMap);
    setLoading(false);
  };

  /* ── When a class is selected → render full StudentList scoped to it ── */
  if (selectedClass) {
    return (
      <StudentList
        initialClassId={selectedClass.id}
        onBack={() => setSelectedClass(null)}
      />
    );
  }

  /* ── Class grid picker ───────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <GraduationCap className="w-7 h-7 text-indigo-600" /> Class Students
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Select a class to manage its students — search, edit, status changes, exports and more.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-bold">No classes found</p>
          <p className="text-sm mt-1">Add classes first from Class &amp; Section Setup.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classes.map(cls => {
            const count = studentCounts[cls.id] ?? 0;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls)}
                className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50 transition-all group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                    <BookOpen className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                </div>

                <h3 className="font-black text-slate-900 text-lg leading-tight">
                  {cls.name}
                  {cls.section && <span className="text-indigo-500"> — {cls.section}</span>}
                </h3>

                {cls.staff?.full_name ? (
                  <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1 truncate">
                    <User className="w-3 h-3 shrink-0" /> {cls.staff.full_name}
                  </p>
                ) : (
                  <p className="text-xs text-slate-300 mt-1 italic">No teacher assigned</p>
                )}

                <div className="mt-3">
                  <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full group-hover:bg-indigo-100 transition-colors">
                    <Users className="w-3 h-3" />
                    <span className="text-[11px] font-black">{count} student{count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
