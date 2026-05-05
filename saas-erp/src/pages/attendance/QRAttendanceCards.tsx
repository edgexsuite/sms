import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import QRCode from 'react-qr-code';
import {
  Printer, QrCode, GraduationCap, Briefcase, ChevronDown,
  Users, Search, CheckSquare, Square, Download
} from 'lucide-react';
import { PageHeader, Card, Btn, Badge, Select, Input, EmptyState } from '../../components/ui';
import { motion, AnimatePresence } from 'framer-motion';
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
      .eq('is_deleted', false)
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
      .eq('is_deleted', false)
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #qr-cards-print, #qr-cards-print * { visibility: visible !important; }
          #qr-cards-print { 
            position: absolute !important; 
            top: 0 !important; 
            left: 0 !important; 
            width: 100% !important; 
            background: white !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
          @page { size: portrait; margin: 10mm; }
        }
      `}</style>

      <PageHeader
        title="QR Attendance Cards"
        subtitle="Generate and print secure QR identifiers for students and staff personnel."
        actions={
          <Btn 
            variant="primary" 
            onClick={handlePrint} 
            icon={Printer}
            className="px-8 shadow-indigo-200"
          >
            Print {toPrint.length} Card{toPrint.length !== 1 ? 's' : ''}
          </Btn>
        }
      />

      <div className="no-print space-y-8">
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <Card className="p-1 flex bg-slate-100 rounded-2xl w-fit shrink-0">
            {([
              { key: 'students', label: 'Students', Icon: GraduationCap },
              { key: 'staff',    label: 'Staff',    Icon: Briefcase },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSelected(new Set()); setSearch(''); }}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                  tab === key
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50',
                )}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </Card>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name..."
              icon={Search}
              className="font-bold"
            />
            {tab === 'students' && (
              <Select
                value={classFilter}
                onChange={e => { setClassFilter(e.target.value); setSelected(new Set()); }}
                icon={Users}
              >
                <option value="all">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section ? `(${c.section})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>

        <Card className="p-4 bg-slate-50/50 border-none shadow-inner flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="neutral" className="px-3 py-1.5 text-[10px]">
              <Users className="w-3.5 h-3.5 mr-2" />
              {items.length} {tab.toUpperCase()}
            </Badge>
            {selected.size > 0 && (
              <Badge variant="indigo" className="px-3 py-1.5 text-[10px] animate-pulse">
                {selected.size} SELECTED FOR PRINT
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={selectAll} icon={CheckSquare} className="text-[10px] tracking-widest">
              Select All
            </Btn>
            {selected.size > 0 && (
              <Btn variant="outline" size="sm" onClick={selectNone} icon={Square} className="text-[10px] tracking-widest text-rose-600 border-rose-200 hover:bg-rose-50">
                Clear Selection
              </Btn>
            )}
          </div>
        </Card>

        {loading ? (
          <div className="p-20 text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Generating Card Matrix...</p>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={QrCode}
            title={`No ${tab} Found`}
            description={`We couldn't find any ${tab} matching your current filters.`}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6">
            {items.map((item, i) => {
              const isSelected = selected.has(item.id);
              const cls = (item.classes as any);
              const className = cls ? `${cls.name}${cls.section ? ` · ${cls.section}` : ''}` : '';
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => toggleSelect(item.id)}
                  className={cn(
                    'group cursor-pointer rounded-[2rem] border-2 p-5 flex flex-col items-center gap-4 transition-all relative',
                    isSelected
                      ? 'border-indigo-500 bg-white shadow-xl shadow-indigo-100 -translate-y-1'
                      : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-lg',
                  )}
                >
                  <div className={cn(
                    "absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected ? "bg-indigo-600 border-indigo-600 scale-110" : "bg-white border-slate-200 group-hover:border-indigo-300"
                  )}>
                    {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
                  </div>

                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 border-2 border-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-500">
                    {item.photograph_url ? (
                      <img src={item.photograph_url} alt={item.full_name}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200 font-black text-3xl">
                        {item.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm group-hover:shadow-md transition-shadow">
                    <QRCode
                      value={tab === 'students'
                        ? studentQR(item.id, item.roll_number)
                        : staffQR(item.id)}
                      size={96}
                      level="M"
                      className="rounded-lg"
                    />
                  </div>

                  <div className="text-center w-full">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate px-2">{item.full_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate px-2">
                      {tab === 'students'
                        ? `${className}${item.roll_number ? ` · #${item.roll_number}` : ''}`
                        : item.role}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PRINT LAYOUT (Legacy but functional for direct window.print) ── */}
      <div id="qr-cards-print" className="hidden">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '15mm',
          padding: '10mm',
        }}>
          {toPrint.map(item => {
            const cls = (item.classes as any);
            const className = cls ? `${cls.name}${cls.section ? ` · ${cls.section}` : ''}` : '';
            return (
              <div
                key={`print-${item.id}`}
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: 24,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                  background: '#fff',
                  pageBreakInside: 'avoid',
                  height: '85mm',
                  position: 'relative',
                }}
              >
                <div style={{
                  background: '#4f46e5',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  padding: '6px 20px',
                  borderRadius: 30,
                  width: 'fit-content',
                  textAlign: 'center',
                }}>
                  Attendance Pass
                </div>

                <div style={{
                  width: 80, height: 80,
                  borderRadius: 20,
                  overflow: 'hidden',
                  border: '3px solid #f1f5f9',
                  background: '#f8fafc',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, fontWeight: 900, color: '#e2e8f0',
                }}>
                  {item.photograph_url ? (
                    <img src={item.photograph_url} alt={item.full_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    item.full_name.charAt(0).toUpperCase()
                  )}
                </div>

                <div style={{ textAlign: 'center', width: '100%' }}>
                  <p style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    {item.full_name}
                  </p>
                  <p style={{ fontSize: 10, color: '#64748b', margin: '4px 0 0', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {tab === 'students'
                      ? `${className}${item.roll_number ? ` · #${item.roll_number}` : ''}`
                      : `${item.role}${item.department ? ` · ${item.department}` : ''}`}
                  </p>
                </div>

                <div style={{ background: '#fff', padding: 12, borderRadius: 16, border: '1px solid #f1f5f9' }}>
                  <QRCode
                    value={tab === 'students'
                      ? studentQR(item.id, item.roll_number)
                      : staffQR(item.id)}
                    size={120}
                    level="M"
                  />
                </div>

                <p style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', margin: 0, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Electronic ID · EdgeX Suite
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
