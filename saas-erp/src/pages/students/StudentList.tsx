import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Upload, Download, Trash2, BookOpen, FileSpreadsheet, UserPlus, Eye, X, ChevronDown, Users, CheckCircle, MoreVertical, Edit, UserX, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import DeletePinModal from '../../components/DeletePinModal';
import Papa from 'papaparse';
import { exportToExcel } from '../../lib/exportUtils';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

interface Student {
  id: string;
  full_name: string;
  roll_number: number;
  b_form_cnic: string;
  status: string;
  admission_date: string;
  class_id?: string;
  parent_id?: string;
  photograph_url?: string;
  dob?: string;
  gender?: string;
  religion?: string;
  nationality?: string;
  address?: string;
  blood_group?: string;
  medical_caution?: string;
  emergency_doctor_name?: string;
  emergency_doctor_phone?: string;
  [key: string]: any;
}

type FeeFilter = 'all' | 'pending' | 'paid';
type DetailTab = 'overview' | 'attendance' | 'fees' | 'results';

export default function StudentList() {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('');
  const [feeFilter, setFeeFilter] = useState<FeeFilter>('all');
  const [genderFilter, setGenderFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [admissionYearFilter, setAdmissionYearFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [studentsWithDues, setStudentsWithDues] = useState<Set<string>>(new Set());
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [familyGroups, setFamilyGroups] = useState<any[]>([]);

  // Import Modal State
  const [classes, setClasses] = useState<any[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importClassId, setImportClassId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.dropdown-container')) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [isBulkClassOpen, setIsBulkClassOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkTargetClass, setBulkTargetClass] = useState('');

  // Detail drawer state
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [detailParent, setDetailParent] = useState<any | null>(null);
  const [detailAttendance, setDetailAttendance] = useState<any[]>([]);
  const [detailFees, setDetailFees] = useState<any[]>([]);
  const [detailResults, setDetailResults] = useState<any[]>([]);
  const fetchedTabsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (userRole?.school_id) {
      fetchStudents();
      fetchClasses();
      fetchFamilyGroups();
    }
  }, [userRole]);

  const fetchFamilyGroups = async () => {
    const { data } = await supabase.from('family_groups').select('id, family_name').eq('school_id', userRole?.school_id).order('family_name');
    if (data) setFamilyGroups(data);
  };

  const updateStudentStatus = async (studentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ status: newStatus })
        .eq('id', studentId);
      
      if (error) throw error;
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: newStatus } : s));
      setOpenMenu(null);
    } catch (err) {
      console.error('Status Update Error:', err);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('students')
        .select(`
          *,
          classes (
            id,
            name,
            section
          )
        `)
        .eq('is_deleted', false)
        .order('roll_number', { ascending: true });

      if (userRole?.role === 'parent') {
        const { data: parentData } = await supabase
          .from('parents')
          .select('id')
          .eq('user_id', userRole.user_id)
          .single();

        if (parentData) {
          query = query.eq('parent_id', parentData.id);
        } else {
          setStudents([]);
          setLoading(false);
          return;
        }
      } else {
        query = query.eq('school_id', userRole?.school_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      const studentList = data || [];
      setStudents(studentList);

      // Fetch fee dues for all students
      if (studentList.length > 0) {
        const ids = studentList.map((s: Student) => s.id);
        const { data: feeData } = await supabase
          .from('fee_records')
          .select('student_id, total_amount, paid_amount')
          .eq('school_id', userRole?.school_id)
          .in('student_id', ids)
          .in('status', ['pending', 'partial']);

        if (feeData && feeData.length > 0) {
          const duesSet = new Set<string>(feeData.map((f: any) => f.student_id));
          setStudentsWithDues(duesSet);
        } else {
          setStudentsWithDues(new Set());
        }
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const { data } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', userRole?.school_id)
        .order('name');
      if (data) setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  // ── Detail tab lazy loaders ──────────────────────────────────────────────

  const openStudentDetail = (student: Student) => {
    setSelectedStudent(student);
    setDetailTab('overview');
    setDetailParent(null);
    setDetailAttendance([]);
    setDetailFees([]);
    setDetailResults([]);
    fetchedTabsRef.current = new Set();
    // Pre-fetch overview (parent)
    fetchDetailTab('overview', student);
  };

  const fetchDetailTab = async (tab: DetailTab, student: Student) => {
    const key = `${student.id}:${tab}`;
    if (fetchedTabsRef.current.has(key)) return;
    fetchedTabsRef.current.add(key);

    if (tab === 'overview') {
      if (student.parent_id) {
        const { data } = await supabase
          .from('parents')
          .select('*')
          .eq('id', student.parent_id)
          .maybeSingle();
        setDetailParent(data || null);
      }
    }

    if (tab === 'attendance') {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .gte('date', since.toISOString().slice(0, 10))
        .order('date', { ascending: false });
      setDetailAttendance(data || []);
    }

    if (tab === 'fees') {
      const { data } = await supabase
        .from('fee_records')
        .select('*')
        .eq('student_id', student.id)
        .order('month_year', { ascending: false });
      setDetailFees(data || []);
    }

    if (tab === 'results') {
      const { data } = await supabase
        .from('exam_results')
        .select(`
          *,
          exam_types ( name ),
          subjects ( subject_name )
        `)
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });
      setDetailResults(data || []);
    }
  };

  const switchDetailTab = (tab: DetailTab) => {
    setDetailTab(tab);
    if (selectedStudent) fetchDetailTab(tab, selectedStudent);
  };

  // ── Filtering ────────────────────────────────────────────────────────────

  const admissionYears = [...new Set(students.map(s => s.admission_date?.slice(0, 4)).filter((y): y is string => !!y))].sort((a: string, b: string) => b.localeCompare(a));

  const activeFilterCount = [classFilter, genderFilter, familyFilter, admissionYearFilter, feeFilter !== 'all' ? feeFilter : '', statusFilter !== 'all' ? statusFilter : ''].filter(Boolean).length;

  const filteredStudents = students.filter(s => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.b_form_cnic && s.b_form_cnic.includes(search)) ||
      (s.roll_number && s.roll_number.toString().includes(search)) ||
      (s.father_name && s.father_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesClass = classFilter === '' || s.class_id === classFilter;
    const matchesFee = feeFilter === 'all' ? true : feeFilter === 'pending' ? studentsWithDues.has(s.id) : !studentsWithDues.has(s.id);
    const matchesGender = genderFilter === '' || (s.gender || '').toLowerCase() === genderFilter.toLowerCase();
    const matchesFamily = familyFilter === '' || s.family_group_id === familyFilter;
    const matchesYear = admissionYearFilter === '' || (s.admission_date || '').startsWith(admissionYearFilter);
    return matchesSearch && matchesStatus && matchesClass && matchesFee && matchesGender && matchesFamily && matchesYear;
  });

  // ── Import / Export ──────────────────────────────────────────────────────

  const executeImport = async () => {
    if (!importFile || !importClassId || !userRole?.school_id) return;
    setImporting(true);

    Papa.parse(importFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const newStudents = results.data.map((row: any) => ({
            school_id: userRole.school_id,
            class_id: importClassId,
            full_name: row.full_name || row.Name || row.name || 'Unknown Student',
            b_form_cnic: row.b_form_cnic || row.CNIC || null,
            dob: row.dob || row.DOB || null,
            roll_number: row.roll_number || row.RollNo || Math.floor(Math.random() * 9000) + 1000,
            status: 'active',
          }));

          const { error } = await supabase.from('students').insert(newStudents);
          if (error) throw error;

          alert('Students imported successfully!');
          setIsImportModalOpen(false);
          setImportFile(null);
          setImportClassId('');
          fetchStudents();
        } catch (error: any) {
          alert('Error importing data: ' + error.message);
        } finally {
          setImporting(false);
        }
      },
    });
  };

  const executeDelete = async () => {
    if (!deleteModal.id) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', deleteModal.id);
      if (error) throw error;
      fetchStudents();
    } catch (error: any) {
      alert('Error moving student to trash: ' + error.message);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (!userRole?.school_id || selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ status: newStatus })
        .in('id', selectedIds);
      if (error) throw error;
      alert(`Updated status for ${selectedIds.length} students.`);
      setSelectedIds([]);
      setIsBulkStatusOpen(false);
      fetchStudents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkClassUpdate = async () => {
    if (!userRole?.school_id || !bulkTargetClass || selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ class_id: bulkTargetClass })
        .in('id', selectedIds);
      if (error) throw error;
      alert(`Moved ${selectedIds.length} students to new class.`);
      setSelectedIds([]);
      setBulkTargetClass('');
      setIsBulkClassOpen(false);
      fetchStudents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!userRole?.school_id || selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .in('id', selectedIds);
      if (error) throw error;
      alert(`Moved ${selectedIds.length} students to trash.`);
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExport = () => {
    exportToExcel('students_list', filteredStudents, [
      { header: 'Roll No', key: 'roll_number' },
      { header: 'Full Name', key: 'full_name' },
      { header: 'Login Username', key: 'student_unique_id' },
      { header: 'Login Password', key: 'auth_password' },
      { header: 'Class', key: (row: any) => row.classes ? `${row.classes.name} (${row.classes.section})` : '-' },
      { header: 'Admission Date', key: 'admission_date' },
      { header: 'B-Form / CNIC', key: 'b_form_cnic' },
      { header: 'Date of Birth', key: 'dob' },
      { header: 'Address', key: 'address' },
      { header: 'Status', key: 'status' },
    ]);
  };

  const handleDownloadTemplate = () => {
    const headers = ['full_name', 'roll_number', 'admission_date', 'dob', 'gender', 'father_name', 'father_contact', 'mother_name', 'address'];
    const sampleRows = [
      ['Ahmed Ali', '1001', '2022-09-01', '2015-05-12', 'Male', 'Ali Khan', '03001234567', 'Sara Bibi', 'Street 4, Sector G'],
    ];
    const csvContent = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const feeStatusColor = (status: string) => {
    if (status === 'paid') return 'bg-emerald-500 text-white';
    if (status === 'partial') return 'bg-amber-500 text-white';
    if (status === 'pending') return 'bg-rose-500 text-white';
    return 'bg-slate-300 text-slate-700';
  };

  const gradeLabel = (pct: number) => {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
  };

  const attendanceDotColor = (status: string) => {
    if (status === 'present') return 'bg-emerald-500';
    if (status === 'absent') return 'bg-rose-500';
    if (status === 'late') return 'bg-amber-400';
    return 'bg-slate-200';
  };

  // ── Derived fee data ─────────────────────────────────────────────────────

  const totalOutstanding = detailFees.reduce((sum, r) => {
    const bal = (r.total_amount || 0) - (r.paid_amount || 0);
    return sum + (bal > 0 ? bal : 0);
  }, 0);

  // ── Attendance summary ───────────────────────────────────────────────────

  const attSummary = detailAttendance.reduce(
    (acc, r) => {
      if (r.status === 'present') acc.present++;
      else if (r.status === 'absent') acc.absent++;
      else if (r.status === 'late') acc.late++;
      return acc;
    },
    { present: 0, absent: 0, late: 0 }
  );

  // ── Results grouped by exam ───────────────────────────────────────────────

  const groupedResults: Record<string, any[]> = {};
  detailResults.forEach(r => {
    const examName = r.exam_types?.name || 'Unknown Exam';
    if (!groupedResults[examName]) groupedResults[examName] = [];
    groupedResults[examName].push(r);
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-aura-in">
      {/* Header Row */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
      >
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight font-display">Student Directory</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage and track your student enrollment across all classes.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Name, roll no, CNIC, father..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
            />
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
            {['all', 'active', 'left'].map((status) => (
              <button key={status} onClick={() => setStatusFilter(status)}
                className={cn('px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                  statusFilter === status ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {status}
              </button>
            ))}
          </div>

          {/* Class filter */}
          <div className="relative">
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
              className="appearance-none pl-4 pr-9 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 shadow-sm cursor-pointer uppercase tracking-widest">
              <option value="">All Classes</option>
              {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name} ({cls.section})</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Advanced Filters Toggle */}
          <button onClick={() => setShowAdvancedFilters(p => !p)}
            className={cn('relative flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all shadow-sm',
              showAdvancedFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200')}>
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button onClick={handleExport} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95" title="Export to Excel">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={handleDownloadTemplate} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm active:scale-95" title="Download Template">
              <FileSpreadsheet className="w-5 h-5" />
            </button>
            {userRole?.role === 'admin' && (
              <>
                <button onClick={() => setIsImportModalOpen(true)} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95" title="Import CSV">
                  <Upload className="w-5 h-5" />
                </button>
                <Link to="/students/register" className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                  <UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Register</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Advanced Filter Panel ── */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="aura-card p-5 border border-indigo-100 bg-indigo-50/30">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Fee Status */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Fee Status</label>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  {([{ val: 'all', label: 'All' }, { val: 'pending', label: 'Has Dues' }, { val: 'paid', label: 'Paid Up' }] as { val: FeeFilter; label: string }[]).map(({ val, label }) => (
                    <button key={val} onClick={() => setFeeFilter(val)}
                      className={cn('px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                        feeFilter === val ? (val === 'pending' ? 'bg-rose-500 text-white' : val === 'paid' ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white') : 'text-slate-500 hover:text-slate-700')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Gender */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Gender</label>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  {['', 'Male', 'Female'].map(g => (
                    <button key={g} onClick={() => setGenderFilter(g)}
                      className={cn('px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                        genderFilter === g ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700')}>
                      {g || 'All'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Admission Year */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Admission Year</label>
                <select value={admissionYearFilter} onChange={e => setAdmissionYearFilter(e.target.value)}
                  className="appearance-none pl-4 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 cursor-pointer">
                  <option value="">All Years</option>
                  {admissionYears.map(y => <option key={y} value={y!}>{y}</option>)}
                </select>
              </div>
              {/* Family Group */}
              {familyGroups.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Family Group</label>
                  <select value={familyFilter} onChange={e => setFamilyFilter(e.target.value)}
                    className="appearance-none pl-4 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 cursor-pointer max-w-[180px]">
                    <option value="">All Families</option>
                    {familyGroups.map(f => <option key={f.id} value={f.id}>{f.family_name}</option>)}
                  </select>
                </div>
              )}
              {/* Clear all */}
              {activeFilterCount > 0 && (
                <button onClick={() => { setFeeFilter('all'); setGenderFilter(''); setFamilyFilter(''); setAdmissionYearFilter(''); setStatusFilter('all'); }}
                  className="px-4 py-2 text-[10px] font-black text-rose-600 border border-rose-200 bg-white rounded-xl uppercase tracking-widest hover:bg-rose-50 transition-all ml-auto">
                  Clear All ({activeFilterCount})
                </button>
              )}
              <div className="ml-auto text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {filteredStudents.length} of {students.length} students
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Table */}
      <div className="aura-card overflow-hidden border-none shadow-xl shadow-slate-200/50">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-6 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length > 0 && selectedIds.length === filteredStudents.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filteredStudents.map(s => s.id));
                      else setSelectedIds([]);
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="p-6 text-premium-label">Roll No</th>
                <th className="p-6 text-premium-label">Student Information</th>
                <th className="p-6 text-premium-label">Class Details</th>
                <th className="p-6 text-premium-label">Date Joined</th>
                <th className="p-6 text-premium-label">Status</th>
                <th className="p-6 text-premium-label">Fees</th>
                <th className="p-6 text-premium-label text-right">Menu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Synchronizing...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-slate-400 italic">
                    No records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, i) => (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.002, x: 5 }}
                    className={cn('hover:bg-indigo-50/30 transition-all group', selectedIds.includes(student.id) ? 'bg-indigo-50/50' : '')}
                  >
                    <td className="p-6 text-center" onClick={(e) => e.stopPropagation()}>
                       <input 
                         type="checkbox" 
                         checked={selectedIds.includes(student.id)}
                         onChange={(e) => {
                           if (e.target.checked) setSelectedIds([...selectedIds, student.id]);
                           else setSelectedIds(selectedIds.filter(id => id !== student.id));
                         }}
                         className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                       />
                    </td>
                    <td className="p-6">
                      <span className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl text-xs font-black text-slate-600 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100">
                        {student.roll_number}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{student.full_name}</span>
                        <span className="text-xs text-slate-400 font-medium">CNIC: {student.b_form_cnic || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 group-hover:bg-white transition-colors">
                        <BookOpen className="w-3 h-3 opacity-50" />
                        {student.classes ? `${student.classes.name} (${student.classes.section})` : 'Unassigned'}
                      </div>
                    </td>
                    <td className="p-6 text-sm text-slate-500 font-medium">
                      {student.admission_date
                        ? new Date(student.admission_date).toLocaleDateString(undefined, { dateStyle: 'medium' })
                        : '-'}
                    </td>
                    <td className="p-6">
                      <span
                        className={cn(
                          'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm',
                          student.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                        )}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="p-6">
                      {studentsWithDues.has(student.id) ? (
                        <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-600 shadow-sm">
                          Dues
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600 shadow-sm">
                          Clear
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/students/edit/${student.id}`)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Edit Profile"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/students/detail/${student.id}`)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View Portfolio"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {/* ── Administrative Action Menu (Three Dots) ── */}
                        <div className="relative dropdown-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu(openMenu === student.id ? null : student.id);
                            }}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              openMenu === student.id ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            )}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenu === student.id && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-slate-100 z-[100] py-1.5 overflow-hidden animate-in fade-in zoom-in duration-200">
                              <div className="px-3 py-1.5 border-b border-slate-50 mb-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Operations</p>
                              </div>
                              <button onClick={() => updateStudentStatus(student.id, 'left')} className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                <span className="w-2 h-2 rounded-full bg-slate-400" /> Withdraw Student
                              </button>
                              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors">
                                <span className="w-2 h-2 rounded-full bg-rose-500" /> Disable Student
                              </button>
                              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                <UserX className="w-3.5 h-3.5" /> Disable App Login
                              </button>
                              <button onClick={() => updateStudentStatus(student.id, 'graduated')} className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-teal-600 hover:bg-teal-50 transition-colors border-t border-slate-50 mt-1">
                                <span className="w-2 h-2 rounded-full bg-teal-500" /> Mark as Alumni
                              </button>
                              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-[#0d1526] hover:bg-slate-50 transition-colors border-t border-slate-50 mt-1">
                                <Key className="w-3.5 h-3.5" /> Change Password
                              </button>
                              <button 
                                onClick={() => setDeleteModal({ isOpen: true, id: student.id, name: student.full_name })}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete Record
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Student Detail Drawer (Full-Screen Side Panel) ── */}
      <AnimatePresence>
      {selectedStudent && (
        <>
          {/* Backdrop */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedStudent(null)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50" />
          {/* Drawer */}
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-3xl bg-white shadow-2xl flex flex-col overflow-hidden">

            {/* Drawer Header */}
            <div className="shrink-0 bg-gradient-to-br from-slate-900 to-indigo-900 px-6 py-6">
              <div className="flex items-start gap-5">
                {selectedStudent.photograph_url ? (
                  <img src={selectedStudent.photograph_url} alt={selectedStudent.full_name}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-xl shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-indigo-600/40 border-2 border-indigo-400/30 flex items-center justify-center text-3xl font-black text-white shadow-xl shrink-0">
                    {selectedStudent.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{selectedStudent.full_name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs text-indigo-300 font-bold bg-indigo-500/20 px-2.5 py-1 rounded-lg">
                      {selectedStudent.classes ? `${selectedStudent.classes.name} (${selectedStudent.classes.section})` : 'Unassigned'}
                    </span>
                    {selectedStudent.roll_number && <span className="text-xs text-slate-400">Roll #{selectedStudent.roll_number}</span>}
                    <span className={cn('px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest',
                      selectedStudent.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>
                      {selectedStudent.status}
                    </span>
                  </div>
                  {/* Credentials */}
                  {selectedStudent.student_unique_id && (
                    <div className="mt-3 flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">Login</p>
                        <p className="text-xs font-black text-white font-mono">{selectedStudent.student_unique_id}</p>
                      </div>
                      <div className="border-l border-white/10 pl-3">
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">Password</p>
                        <p className="text-xs font-black text-white font-mono">{selectedStudent.auth_password || '—'}</p>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => setSelectedStudent(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tab Nav */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 shrink-0">
              {(['overview', 'attendance', 'fees', 'results'] as DetailTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => switchDetailTab(tab)}
                  className={cn(
                    'flex-1 px-4 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2',
                    detailTab === tab
                      ? 'border-indigo-600 text-indigo-600 bg-white'
                      : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100/50'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

              {/* ── Overview Tab ─────────────────────────────────────────── */}
              {detailTab === 'overview' && (
                <div className="space-y-8">
                  {/* Personal Info */}
                  <div>
                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">
                      Personal Information
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
                      {[
                        { label: 'Full Name', val: selectedStudent.full_name },
                        { label: 'Roll Number', val: selectedStudent.roll_number ? `#${selectedStudent.roll_number}` : '-' },
                        { label: 'Date of Birth', val: selectedStudent.dob || '-' },
                        { label: 'Gender', val: selectedStudent.gender || '-' },
                        { label: 'Religion', val: selectedStudent.religion || '-' },
                        { label: 'Nationality', val: selectedStudent.nationality || '-' },
                        { label: 'Blood Group', val: selectedStudent.blood_group || '-' },
                        { label: 'Admission Date', val: selectedStudent.admission_date || '-' },
                        { label: 'B-Form / CNIC', val: selectedStudent.b_form_cnic || '-' },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                          <span className="font-bold text-slate-800">{val}</span>
                        </div>
                      ))}
                      <div className="col-span-2 md:col-span-3 flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</span>
                        <span className="font-medium text-slate-700 italic">
                          "{selectedStudent.address || 'No address provided'}"
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Medical */}
                  {(selectedStudent.medical_caution || selectedStudent.emergency_doctor_name) && (
                    <div>
                      <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-4">
                        Medical & Emergency
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
                        {[
                          { label: 'Medical Caution', val: selectedStudent.medical_caution || '-' },
                          { label: 'Emergency Doctor', val: selectedStudent.emergency_doctor_name || '-' },
                          { label: 'Doctor Phone', val: selectedStudent.emergency_doctor_phone || '-' },
                        ].map(({ label, val }) => (
                          <div key={label} className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                            <span className="font-bold text-slate-800">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Admin: status edit */}
                  {userRole?.role === 'admin' && (
                    <div>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                        Academic Status
                      </h4>
                      <select
                        value={selectedStudent.status}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          try {
                            const { error } = await supabase
                              .from('students')
                              .update({ status: newStatus })
                              .eq('id', selectedStudent.id);
                            if (error) throw error;
                            setSelectedStudent({ ...selectedStudent, status: newStatus });
                            fetchStudents();
                          } catch (err: any) {
                            alert('Error updating status: ' + err.message);
                          }
                        }}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold capitalize focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="active">Active</option>
                        <option value="left">Left</option>
                        <option value="graduated">Graduated</option>
                      </select>
                    </div>
                  )}

                  {/* Parent / Family */}
                  <div>
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4">
                      Parent & Family
                    </h4>
                    {detailParent ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
                        {[
                          { label: "Father's Name", val: detailParent.father_name || selectedStudent.father_name || '-' },
                          { label: "Mother's Name", val: detailParent.mother_name || selectedStudent.mother_name || '-' },
                          { label: 'WhatsApp', val: detailParent.whatsapp_number || '-' },
                          { label: 'Primary Contact', val: detailParent.father_contact || selectedStudent.father_contact || '-' },
                          { label: 'Secondary Contact', val: detailParent.mother_contact || selectedStudent.mother_contact || '-' },
                          { label: 'Email', val: detailParent.email || '-' },
                        ].map(({ label, val }) => (
                          <div key={label} className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                            <span className="font-bold text-slate-800">{val}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
                        {[
                          { label: "Father's Name", val: selectedStudent.father_name || '-' },
                          { label: "Mother's Name", val: selectedStudent.mother_name || '-' },
                          { label: 'Primary Contact', val: selectedStudent.father_contact || '-' },
                          { label: 'Secondary Contact', val: selectedStudent.mother_contact || '-' },
                        ].map(({ label, val }) => (
                          <div key={label} className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                            <span className="font-bold text-slate-800">{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Attendance Tab ────────────────────────────────────────── */}
              {detailTab === 'attendance' && (
                <div className="space-y-6">
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Present', count: attSummary.present, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                      { label: 'Absent', count: attSummary.absent, color: 'bg-rose-50 border-rose-200 text-rose-700' },
                      { label: 'Late', count: attSummary.late, color: 'bg-amber-50 border-amber-200 text-amber-700' },
                    ].map(({ label, count, color }) => (
                      <div key={label} className={cn('rounded-2xl border p-4 text-center', color)}>
                        <div className="text-3xl font-black">{count}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest mt-1">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Dot strip */}
                  {detailAttendance.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Last 30 Days</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...Array(30)].map((_, idx) => {
                          const d = new Date();
                          d.setDate(d.getDate() - (29 - idx));
                          const dateStr = d.toISOString().slice(0, 10);
                          const rec = detailAttendance.find(r => r.date === dateStr);
                          return (
                            <div
                              key={dateStr}
                              title={`${dateStr}: ${rec ? rec.status : 'no record'}`}
                              className={cn(
                                'w-6 h-6 rounded-md',
                                rec ? attendanceDotColor(rec.status) : 'bg-slate-100'
                              )}
                            />
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4 mt-3">
                        {[
                          { color: 'bg-emerald-500', label: 'Present' },
                          { color: 'bg-rose-500', label: 'Absent' },
                          { color: 'bg-amber-400', label: 'Late' },
                          { color: 'bg-slate-100', label: 'No Record' },
                        ].map(({ color, label }) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <div className={cn('w-3 h-3 rounded-sm', color)} />
                            <span className="text-[10px] font-bold text-slate-500">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attendance list */}
                  {detailAttendance.length === 0 ? (
                    <p className="text-center text-slate-400 italic py-8">No attendance records in the last 30 days.</p>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                            <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Arrival</th>
                            <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Departure</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {detailAttendance.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50/50">
                              <td className="px-5 py-3 font-medium text-slate-700">{rec.date}</td>
                              <td className="px-5 py-3">
                                <span
                                  className={cn(
                                    'px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest',
                                    rec.status === 'present'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : rec.status === 'absent'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-amber-100 text-amber-700'
                                  )}
                                >
                                  {rec.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-slate-500">{rec.arrival_time || '-'}</td>
                              <td className="px-5 py-3 text-slate-500">{rec.departure_time || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Fees Tab ──────────────────────────────────────────────── */}
              {detailTab === 'fees' && (
                <div className="space-y-6">
                  {/* Outstanding banner */}
                  <div
                    className={cn(
                      'rounded-2xl p-5 flex items-center justify-between',
                      totalOutstanding > 0 ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'
                    )}
                  >
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Outstanding</p>
                      <p
                        className={cn(
                          'text-3xl font-black',
                          totalOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600'
                        )}
                      >
                        {totalOutstanding.toLocaleString()} PKR
                      </p>
                    </div>
                    {totalOutstanding === 0 && (
                      <span className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest">
                        All Clear
                      </span>
                    )}
                  </div>

                  {/* Fee records table */}
                  {detailFees.length === 0 ? (
                    <p className="text-center text-slate-400 italic py-8">No fee records found.</p>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            {['Month', 'Invoice #', 'Total', 'Paid', 'Balance', 'Status'].map((h) => (
                              <th key={h} className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {detailFees.map((fee) => {
                            const balance = (fee.total_amount || 0) - (fee.paid_amount || 0);
                            return (
                              <tr key={fee.id} className="hover:bg-slate-50/50">
                                <td className="px-5 py-3 font-bold text-slate-800">
                                  {fee.month_year ? new Date(fee.month_year).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                                </td>
                                <td className="px-5 py-3 text-slate-500 font-mono text-xs">{fee.invoice_number || '-'}</td>
                                <td className="px-5 py-3 font-medium">{(fee.total_amount || 0).toLocaleString()}</td>
                                <td className="px-5 py-3 font-medium text-emerald-600">{(fee.paid_amount || 0).toLocaleString()}</td>
                                <td className="px-5 py-3 font-bold text-rose-600">{balance > 0 ? balance.toLocaleString() : '0'}</td>
                                <td className="px-5 py-3">
                                  <span className={cn('px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest', feeStatusColor(fee.status))}>
                                    {fee.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Results Tab ───────────────────────────────────────────── */}
              {detailTab === 'results' && (
                <div className="space-y-8">
                  {Object.keys(groupedResults).length === 0 ? (
                    <p className="text-center text-slate-400 italic py-8">No exam results found.</p>
                  ) : (
                    Object.entries(groupedResults).map(([examName, rows]) => {
                      const totalMarks = rows.reduce((s, r) => s + (r.obtained_marks || 0), 0);
                      const totalMax = rows.reduce((s, r) => s + (r.total_marks || 0), 0);
                      const overallPct = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
                      const passed = overallPct >= 50;
                      return (
                        <div key={examName}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{examName}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500">
                                {totalMarks}/{totalMax} ({overallPct}%)
                              </span>
                              <span
                                className={cn(
                                  'px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest',
                                  passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                )}
                              >
                                {passed ? 'Pass' : 'Fail'}
                              </span>
                            </div>
                          </div>
                          <div className="overflow-hidden rounded-2xl border border-slate-100">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  {['Subject', 'Marks', 'Total', '%', 'Grade'].map((h) => (
                                    <th key={h} className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {rows.map((r) => {
                                  const pct = r.total_marks > 0 ? Math.round((r.obtained_marks / r.total_marks) * 100) : 0;
                                  const grade = gradeLabel(pct);
                                  const subjectPass = pct >= 50;
                                  return (
                                    <tr key={r.id} className="hover:bg-slate-50/50">
                                      <td className="px-5 py-3 font-bold text-slate-800">
                                        {r.subjects?.subject_name || '-'}
                                      </td>
                                      <td className="px-5 py-3 font-medium">{r.obtained_marks ?? '-'}</td>
                                      <td className="px-5 py-3 text-slate-500">{r.total_marks ?? '-'}</td>
                                      <td className="px-5 py-3 font-bold">{pct}%</td>
                                      <td className="px-5 py-3">
                                        <span
                                          className={cn(
                                            'px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest',
                                            subjectPass ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'
                                          )}
                                        >
                                          {grade}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center shrink-0 bg-slate-50">
              <Link to={`/students/register`} className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest transition-colors">
                Edit Student Profile →
              </Link>
              <button onClick={() => setSelectedStudent(null)}
                className="px-6 py-2.5 text-xs font-black text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl uppercase tracking-widest transition-colors">
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>

      {/* ── Import Modal ──────────────────────────────────────────────────── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Import Students Data</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Target Class</label>
                <select
                  value={importClassId}
                  onChange={(e) => setImportClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">Select a class to enroll imported students...</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.section})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">All uploaded students will be automatically enrolled in this class.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Select File (CSV)</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-300 rounded-md p-1"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex-1"
              >
                Cancel
              </button>
              <button
                onClick={executeImport}
                disabled={importing || !importClassId || !importFile}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 flex-1"
              >
                {importing ? 'Importing...' : 'Upload & Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Pin Modal */}
      <DeletePinModal
        isOpen={deleteModal.isOpen}
        schoolId={userRole?.school_id || ''}
        itemName={deleteModal.name}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={executeDelete}
      />

      {selectedIds.length > 0 && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl text-white px-8 py-4 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] flex items-center gap-10 z-[100] border border-white/10 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-4 border-r border-white/10 pr-10">
            <div className="bg-indigo-600 w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg shadow-indigo-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight leading-none">{selectedIds.length} Students Selected</p>
              <button 
                onClick={() => setSelectedIds([])}
                className="text-[10px] text-white/50 hover:text-white uppercase tracking-[0.2em] font-black mt-2 transition-colors"
              >
                Reset Selection
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsBulkStatusOpen(true)}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-xs font-black uppercase tracking-widest border border-white/5 active:scale-95"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Status
            </button>
            <button 
              onClick={() => setIsBulkClassOpen(true)}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-xs font-black uppercase tracking-widest border border-white/5 active:scale-95"
            >
              <Upload className="w-4 h-4 text-indigo-400" /> Reallocate
            </button>
            <button 
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-2xl transition-all text-xs font-black uppercase tracking-widest border border-rose-500/10 active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Move to Trash
            </button>
          </div>
        </div>
      )}

      {/* Bulk Status Modal */}
      {isBulkStatusOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Batch Status Update</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{selectedIds.length} Total Recipients</p>
              </div>
              <button onClick={() => setIsBulkStatusOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 transition-colors shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-3">
              {['active', 'left', 'graduated'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleBulkStatusUpdate(status)}
                  className="w-full px-6 py-4 text-left rounded-2xl border border-slate-100 hover:border-indigo-600 hover:bg-indigo-50/50 transition-all capitalize font-black text-slate-700 flex items-center justify-between group shadow-sm hover:shadow-indigo-100"
                >
                  <span className="tracking-tight">{status}</span>
                  <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg border border-slate-100 group-hover:bg-indigo-600 transition-colors">
                    <CheckCircle className="w-4 h-4 text-slate-200 group-hover:text-white" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Class Modal */}
      {isBulkClassOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Institutional Reallocation</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Targeting {selectedIds.length} Students</p>
              </div>
              <button onClick={() => setIsBulkClassOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 transition-colors shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Destination Class</label>
                <select 
                  value={bulkTargetClass} 
                  onChange={(e) => setBulkTargetClass(e.target.value)} 
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-inner"
                >
                  <option value="">Choose Class & Section...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleBulkClassUpdate}
                disabled={!bulkTargetClass}
                className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-indigo-600 shadow-xl shadow-slate-200 disabled:opacity-30 transition-all mt-2 active:scale-95"
              >
                Perform Batch Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {isBulkDeleteModalOpen && (
        <DeletePinModal 
          isOpen={isBulkDeleteModalOpen}
          schoolId={userRole?.school_id || ''}
          onConfirm={handleBulkDelete}
          onCancel={() => setIsBulkDeleteModalOpen(false)}
          itemName={`${selectedIds.length} Student Records`}
        />
      )}
    </div>
  );
}
