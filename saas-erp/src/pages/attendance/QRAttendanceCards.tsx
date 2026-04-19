import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import QRCode from 'react-qr-code';
import {
  Printer, QrCode, GraduationCap, Briefcase, ChevronDown,
  Users, Search, CheckSquare, Square,
} from 'lucide-react';
import { cn } from '../../lib/utils';

type Tab = 'students' | 'staff';

export default function QRAttendanceCards() {
  const { userRole } = useAuth();

  const [tab, setTab]             = useState<Tab>('students');
  const [classes, setClasses]     = useState<any[]>([]);
  const [classFilter, setClassFilter] = useState('all');
  const [students, setStudents]   = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Set<string>>(new Set());

  /* ── Fetch classes ── */
  useEffect(() => {
    if (!userRole?.school_id) return;
    supabase.from('classes').select('id,name,section')
      .eq('school_id', userRole.school_id).order('name')
      .then(({ data }) => setClasses(data || []));
  }, [userRole?.school_id]);

  /* ── Fetch students ── */
  useEffect(() => {
    if (!userRole?.school_id || tab !== 'students') return;
    setLoading(true);
    let q = supabase.from('students')
      .select('id,full_name,roll_number,photograph_url,classes(name,section)')
      .eq('school_id', userRole.school_id)
      .eq('status', 'active')
      .order('full_name');
    if (classFilter !== 'all') q = q.eq('class_id', classFilter);
    q.then(({ data }) => { setStudents(data || []); setLoading(false); });
  }, [userRole?.school_id, classFilter, tab]);

  /* ── Fetch staff ── */
  useEffect(() => {
    if (!userRole?.school_id || tab !== 'staff') return;
    setLoading(true);
    supabase.from('staff')
      .select('id,full_name,role,department,photograph_url')
      .eq('school_id', userRole.school_id)
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => { setStaffList(data || []); setLoading(false); });
  }, [userRole?.school_id, tab]);

  /* ── Derived lists ── */
  const filteredStudents = students.filter(s =>
    !search || s.full_name.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredStaff = staffList.filter(s =>
    !search || s.full_name.toLowerCase().includes(search.toLowerCase()),
  );
  const items = tab === 'students' ? filteredStudents : filteredStaff;

  /* ── Selection helpers ── */
  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll  = () => setSelected(new Set(items.map(i => i.id)));
  const selectNone = () => setSelected(new Set());

  const toPrint = selected.size > 0 ? items.filter(i => selected.has(i.id)) : items;

  /* ── Print ── */
  const handlePrint = () => window.print();

  /* ── QR value builders ── */
  const studentQR = (id: string, roll: number) =>
    JSON.stringify({ type: 'student_attendance', student_id: id, roll });
  const staffQR = (id: string) =>
    JSON.stringify({ type: 'staff_attendance', staff_id: id });

  return (
    <div className="space-y-4 max-w-6xl mx-auto">

      {/* ── Page header ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #qr-cards-print, #qr-cards-print * { visibility: visible !important; }
          #qr-cards-print { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-600" /> QR Attendance Cards
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Print QR cards to hand out — students & staff scan these at the kiosk.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="no-print flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wide transition shadow-lg shadow-indigo-200"
        >
          <Printer className="w-4 h-4" />
          Print {toPrint.length} Card{toPrint.length !== 1 ? 's' : ''}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="no-print flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { key: 'students', label: 'Students', Icon: GraduationCap },
          { key: 'staff',    label: 'Staff',    Icon: Briefcase },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSelected(new Set()); setSearch(''); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-wide transition-all',
              tab === key
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="no-print flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name…"
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 w-52"
          />
        </div>

        {/* Class filter (students only) */}
        {tab === 'students' && (
          <div className="relative">
            <select
              value={classFilter}
              onChange={e => { setClassFilter(e.target.value); setSelected(new Set()); }}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.section ? ` (${c.section})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        )}

        {/* Selection buttons */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition"
          >
            <CheckSquare className="w-3.5 h-3.5" /> Select All
          </button>
          {selected.size > 0 && (
            <button
              onClick={selectNone}
              className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              <Square className="w-3.5 h-3.5" /> Clear ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* ── Info strip ── */}
      <div className="no-print flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
        <Users className="w-3.5 h-3.5 shrink-0" />
        <span>
          Showing <strong>{items.length}</strong> {tab}.
          {selected.size > 0
            ? ` ${selected.size} selected — only selected cards will print.`
            : ' All cards will print. Select specific ones to print a subset.'}
        </span>
      </div>

      {/* ── Card Grid (screen preview) ── */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <QrCode className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-bold">No {tab} found</p>
        </div>
      ) : (
        <div className="no-print grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map(item => {
            const isSelected = selected.has(item.id);
            const cls = (item.classes as any);
            const className = cls ? `${cls.name}${cls.section ? ` · ${cls.section}` : ''}` : '';
            return (
              <div
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className={cn(
                  'cursor-pointer rounded-2xl border-2 p-3 flex flex-col items-center gap-2 transition-all',
                  isSelected
                    ? 'border-indigo-400 bg-indigo-50 shadow-md shadow-indigo-100'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm',
                )}
              >
                {/* Photo */}
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                  {item.photograph_url ? (
                    <img src={item.photograph_url} alt={item.full_name}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-black text-xl">
                      {item.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {/* QR */}
                <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                  <QRCode
                    value={tab === 'students'
                      ? studentQR(item.id, item.roll_number)
                      : staffQR(item.id)}
                    size={64}
                    level="M"
                  />
                </div>
                {/* Info */}
                <div className="text-center">
                  <p className="text-xs font-black text-slate-900 truncate max-w-[120px]">{item.full_name}</p>
                  <p className="text-[10px] text-slate-500 truncate max-w-[120px]">
                    {tab === 'students'
                      ? `${className}${item.roll_number ? ` · #${item.roll_number}` : ''}`
                      : item.role}
                  </p>
                </div>
                {/* Selection indicator */}
                <div className={cn('w-4 h-4 rounded-full border-2 transition-all', isSelected
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'border-slate-300')} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── PRINT LAYOUT ─────────────────────────────────────────────────── */}
      <div id="qr-cards-print" className="hidden print:block">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          padding: '16px',
        }}>
          {toPrint.map(item => {
            const cls = (item.classes as any);
            const className = cls ? `${cls.name}${cls.section ? ` · ${cls.section}` : ''}` : '';
            return (
              <div
                key={`print-${item.id}`}
                style={{
                  border: '2px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  background: '#fff',
                  pageBreakInside: 'avoid',
                }}
              >
                {/* School badge */}
                <div style={{
                  background: '#4f46e5',
                  color: 'white',
                  fontSize: 8,
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: 20,
                  width: '100%',
                  textAlign: 'center',
                }}>
                  Attendance Card
                </div>

                {/* Photo */}
                <div style={{
                  width: 60, height: 60,
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '2px solid #e2e8f0',
                  background: '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 900, color: '#94a3b8',
                }}>
                  {item.photograph_url ? (
                    <img src={item.photograph_url} alt={item.full_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    item.full_name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Name & details */}
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <p style={{ fontSize: 11, fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1.3 }}>
                    {item.full_name}
                  </p>
                  <p style={{ fontSize: 9, color: '#64748b', margin: '2px 0 0', fontWeight: 700 }}>
                    {tab === 'students'
                      ? `${className}${item.roll_number ? ` · Roll #${item.roll_number}` : ''}`
                      : `${item.role}${item.department ? ` · ${item.department}` : ''}`}
                  </p>
                </div>

                {/* QR Code */}
                <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <QRCode
                    value={tab === 'students'
                      ? studentQR(item.id, item.roll_number)
                      : staffQR(item.id)}
                    size={88}
                    level="M"
                  />
                </div>

                {/* Instruction */}
                <p style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center', margin: 0, fontWeight: 600 }}>
                  Scan at attendance kiosk
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
