import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, Upload, Download, Trash2, BookOpen, FileSpreadsheet, UserPlus, Eye, X, ChevronDown, Users, CheckCircle, MoreVertical, Edit, UserX, Key, GraduationCap, LogOut, Shield, Filter, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import DeletePinModal from '../../components/DeletePinModal';
import Papa from 'papaparse';
import { exportToExcel } from '../../lib/exportUtils';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cn, formatDate } from '../../lib/utils';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Btn } from '../../components/ui/Btn';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';

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

interface StudentListProps {
  /** When set, locks the list to this class and shows an onBack button */
  initialClassId?: string;
  onBack?: () => void;
}

export default function StudentList({ initialClassId, onBack }: StudentListProps = {}) {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // statusFilter kept for legacy bulk modal compatibility
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState(initialClassId ?? '');
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

  // Status tab & modals
  const [statusTab, setStatusTab] = useState<'active' | 'left' | 'graduated' | 'withdrawn'>('active');
  const [statusModal, setStatusModal] = useState<{ studentId: string; studentName: string; targetStatus: string } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [pwdModal, setPwdModal] = useState<{ studentId: string; studentName: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

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
  const [undoToast, setUndoToast] = useState<{ message: string; ids: string[] } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Quick Update state
  const [isBulkQuickUpdateOpen, setIsBulkQuickUpdateOpen] = useState(false);
  const [bulkUpdateField, setBulkUpdateField] = useState('');
  const [bulkUpdateValue, setBulkUpdateValue] = useState('');

  // ── Teacher / Staff role access control ─────────────────────────────────
  // Roles that can see ALL students (not filtered to their classes)
  const ADMIN_ROLES = [
    'admin', 'principal', 'director', 'vice_principal', 'vice principal',
    'coordinator', 'accountant', 'staff',
    'academic_coordinator', 'campus_coordinator', 'section_coordinator',
  ];
  const isStaffRole = !ADMIN_ROLES.includes((userRole?.role || '').toLowerCase());
  // Coordinator roles: can view all students but cannot edit/delete
  const isCoordinator = ['academic_coordinator', 'campus_coordinator', 'section_coordinator'].includes((userRole?.role || '').toLowerCase());
  // Class IDs this teacher is allowed to see (resolved below)
  const [allowedClassIds, setAllowedClassIds] = useState<string[] | null>(null); // null = not resolved yet
  const [staffId, setStaffId] = useState<string | null>(null);

  // Resolve the staff record and their allowed classes (incharge + timetable)
  const resolveTeacherClasses = async () => {
    if (!isStaffRole) { setAllowedClassIds(null); return; } // admins unrestricted
    const schoolId = userRole?.school_id;
    if (!schoolId) return;

    // 1. Find staff record
    let sid: string | null = userRole?.staff_id || null;
    if (!sid && userRole?.email) {
      const { data } = await supabase.from('staff').select('id').eq('school_id', schoolId).eq('email', userRole.email).maybeSingle();
      sid = data?.id || null;
    }
    setStaffId(sid);
    if (!sid) { setAllowedClassIds([]); return; }

    // 2. Classes where they are class incharge
    const { data: inchargeClasses } = await supabase.from('classes').select('id').eq('school_id', schoolId).eq('class_teacher_id', sid);
    const inchargeIds = (inchargeClasses || []).map((c: any) => c.id);

    // 3. Classes they appear in on the timetable
    const { data: slots } = await supabase.from('timetable_slots').select('class_id').eq('school_id', schoolId).eq('teacher_id', sid);
    const timetableIds = (slots || []).map((s: any) => s.class_id);

    // 4. Union of both
    const combined = Array.from(new Set([...inchargeIds, ...timetableIds]));
    setAllowedClassIds(combined);
  };

  useEffect(() => {
    if (userRole?.school_id) {
      resolveTeacherClasses().then(() => {
        fetchStudents();
        fetchClasses();
        fetchFamilyGroups();
      });
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

  const confirmStatusChange = async () => {
    if (!statusModal) return;
    setSavingStatus(true);
    try {
      const updates: any = { status: statusModal.targetStatus };
      if (statusReason.trim()) updates.remarks = statusReason.trim();
      const { error } = await supabase.from('students').update(updates).eq('id', statusModal.studentId);
      if (error) throw error;
      setStudents(prev => prev.map(s => s.id === statusModal.studentId ? { ...s, ...updates } : s));
      setStatusModal(null);
      setStatusReason('');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDisableLogin = async (studentId: string) => {
    if (!window.confirm('Disable app login for this student? They will not be able to log in to the student portal.')) return;
    const { error } = await supabase.from('students').update({ auth_password: null }).eq('id', studentId);
    if (!error) {
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, auth_password: null } : s));
      setOpenMenu(null);
      alert('Login disabled successfully.');
    }
  };

  const handleChangePassword = async () => {
    if (!pwdModal || !newPassword.trim()) return;
    setSavingStatus(true);
    const { error } = await supabase.from('students').update({ auth_password: newPassword.trim() }).eq('id', pwdModal.studentId);
    setSavingStatus(false);
    if (!error) {
      setPwdModal(null);
      setNewPassword('');
      alert('Password updated successfully.');
    } else {
      alert('Error: ' + error.message);
    }
  };

  const handleExportAll = () => {
    exportToExcel('all_students_' + new Date().toISOString().slice(0, 10), students, [
      { header: 'Roll No', key: 'roll_number' },
      { header: 'Full Name', key: 'full_name' },
      { header: 'Status', key: 'status' },
      { header: 'Login Username', key: 'student_unique_id' },
      { header: 'Login Password', key: 'auth_password' },
      { header: 'Class', key: (row: any) => row.classes ? `${row.classes.name} (${row.classes.section})` : '-' },
      { header: 'Admission Date', key: 'admission_date' },
      { header: 'B-Form / CNIC', key: 'b_form_cnic' },
      { header: 'Date of Birth', key: 'dob' },
      { header: 'Gender', key: 'gender' },
      { header: 'Father Name', key: 'father_name' },
      { header: 'Father Contact', key: 'father_contact' },
      { header: 'Address', key: 'address' },
      { header: 'Remarks', key: 'remarks' },
    ]);
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
      } else if (isStaffRole) {
        // Teacher/staff: re-resolve allowed classes inline (allowedClassIds state may not be set yet)
        const schoolId = userRole?.school_id;
        let sid: string | null = userRole?.staff_id || staffId || null;
        if (!sid && schoolId && userRole?.email) {
          const { data } = await supabase.from('staff').select('id').eq('school_id', schoolId).eq('email', userRole.email).maybeSingle();
          sid = data?.id || null;
        }
        if (sid && schoolId) {
          const { data: inchargeClasses } = await supabase.from('classes').select('id').eq('school_id', schoolId).eq('class_teacher_id', sid);
          const { data: slots } = await supabase.from('timetable_slots').select('class_id').eq('school_id', schoolId).eq('teacher_id', sid);
          const ids = Array.from(new Set([
            ...(inchargeClasses || []).map((c: any) => c.id),
            ...(slots || []).map((s: any) => s.class_id),
          ]));
          if (ids.length === 0) { setStudents([]); setLoading(false); return; }
          query = query.eq('school_id', schoolId).in('class_id', ids);
        } else {
          setStudents([]); setLoading(false); return;
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

  const ITEMS_PER_PAGE = 25;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever filters change
  useEffect(() => { setCurrentPage(1); }, [search, classFilter, feeFilter, genderFilter, familyFilter, admissionYearFilter, statusTab]);

  const admissionYears = [...new Set(students.map(s => s.admission_date?.slice(0, 4)).filter((y): y is string => !!y))].sort((a: string, b: string) => b.localeCompare(a));

  const activeFilterCount = [classFilter, genderFilter, familyFilter, admissionYearFilter, feeFilter !== 'all' ? feeFilter : ''].filter(Boolean).length;

  const statusCounts = {
    active: students.filter(s => s.status === 'active').length,
    left: students.filter(s => s.status === 'left').length,
    graduated: students.filter(s => s.status === 'graduated').length,
    withdrawn: students.filter(s => s.status === 'withdrawn').length,
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.b_form_cnic && s.b_form_cnic.includes(search)) ||
      (s.roll_number && s.roll_number.toString().includes(search)) ||
      (s.father_name && s.father_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = s.status === statusTab;
    const matchesClass = classFilter === '' || s.class_id === classFilter;
    const matchesFee = feeFilter === 'all' ? true : feeFilter === 'pending' ? studentsWithDues.has(s.id) : !studentsWithDues.has(s.id);
    const matchesGender = genderFilter === '' || (s.gender || '').toLowerCase() === genderFilter.toLowerCase();
    const matchesFamily = familyFilter === '' || s.family_group_id === familyFilter;
    const matchesYear = admissionYearFilter === '' || (s.admission_date || '').startsWith(admissionYearFilter);
    return matchesSearch && matchesStatus && matchesClass && matchesFee && matchesGender && matchesFamily && matchesYear;
  });

  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ── Import / Export ──────────────────────────────────────────────────────

  const executeImport = async () => {
    const file = importFile;
    const classId = importClassId;
    setImporting(true);

    // Fetch next roll number for the target class
    const { data: maxRollData } = await supabase
      .from('students')
      .select('roll_number')
      .eq('class_id', classId)
      .order('roll_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    let nextRollNumber = (maxRollData?.roll_number || 0) + 1;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const newStudents = results.data.map((row: any) => ({
            school_id: userRole.school_id,
            class_id: classId,
            full_name: row.full_name || row.Name || row.name || 'Unknown Student',
            b_form_cnic: row.b_form_cnic || row.CNIC || null,
            dob: row.dob || row.DOB || null,
            roll_number: row.roll_number || row.RollNo || nextRollNumber++,
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

  const showUndoToast = (message: string, ids: string[]) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ message, ids });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 6000);
  };

  const handleUndo = async () => {
    if (!undoToast) return;
    const { ids } = undoToast;
    setUndoToast(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    await supabase.from('students').update({ is_deleted: false, deleted_at: null }).in('id', ids);
    fetchStudents();
  };

  const executeDelete = async () => {
    if (!deleteModal.id) return;
    const deletedId = deleteModal.id;
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', deletedId);
      if (error) throw error;
      fetchStudents();
      showUndoToast('Student moved to trash.', [deletedId]);
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
    const deletedIds = [...selectedIds];
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .in('id', deletedIds);
      if (error) throw error;
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchStudents();
      showUndoToast(`${deletedIds.length} student${deletedIds.length > 1 ? 's' : ''} moved to trash.`, deletedIds);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkQuickUpdate = async () => {
    if (!userRole?.school_id || !bulkUpdateField || !bulkUpdateValue || selectedIds.length === 0) return;
    try {
      // Cast numerical fields appropriately
      let value: string | number = bulkUpdateValue;
      if (bulkUpdateField === 'fee_waiver_percentage') {
        value = Number(value);
      }

      const { error } = await supabase
        .from('students')
        .update({ [bulkUpdateField]: value })
        .in('id', selectedIds);
      if (error) throw error;
      alert(`Successfully updated ${bulkUpdateField.replace(/_/g, ' ')} for ${selectedIds.length} students.`);
      setSelectedIds([]);
      setBulkUpdateField('');
      setBulkUpdateValue('');
      setIsBulkQuickUpdateOpen(false);
      fetchStudents();
    } catch (err: any) {
      alert('Error updating values: ' + err.message);
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
    <div className="max-w-7xl mx-auto space-y-6 animate-aura-in">
      <PageHeader
        title={initialClassId
          ? (classes.find(c => c.id === initialClassId)
            ? `${classes.find(c => c.id === initialClassId)!.name} (${classes.find(c => c.id === initialClassId)!.section}) — Students`
            : 'Class Students')
          : 'Student List'}
        subtitle={initialClassId ? 'Full student management for this class.' : 'Manage and track your student enrollment across all classes.'}
        onBack={onBack}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isStaffRole && (
              <>
                <Btn variant="secondary" onClick={handleExport} title="Export current view to Excel">
                  <Download className="w-4 h-4" />
                </Btn>
                <Btn variant="secondary" onClick={handleExportAll} title="Export ALL students (all statuses)">
                  <Users className="w-4 h-4" />
                </Btn>
                <Btn variant="secondary" onClick={handleDownloadTemplate} title="Download Template">
                  <FileSpreadsheet className="w-4 h-4" />
                </Btn>
              </>
            )}
            {userRole?.role === 'admin' && (
              <>
                <Btn variant="secondary" onClick={() => setIsImportModalOpen(true)} title="Import CSV">
                  <Upload className="w-4 h-4" />
                </Btn>
                <Btn onClick={() => navigate('/students/register')}>
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Register</span>
                </Btn>
              </>
            )}
          </div>
        }
      />

      <Card className="p-4 border-none shadow-sm bg-white/80 backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search Name, roll no, CNIC, father..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
              icon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
              {([
                { key: 'active', label: 'Active', color: 'text-emerald-600' },
                { key: 'left', label: 'Left', color: 'text-amber-600' },
                { key: 'graduated', label: 'Passed Out', color: 'text-teal-600' },
                { key: 'withdrawn', label: 'Withdrawn', color: 'text-rose-600' },
              ] as { key: 'active' | 'left' | 'graduated' | 'withdrawn'; label: string; color: string }[]).map(({ key, label, color }) => (
                <button key={key} onClick={() => setStatusTab(key)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all',
                    statusTab === key ? 'bg-white shadow-sm ' + color : 'text-slate-500 hover:text-slate-700')}>
                  {label}
                  <Badge variant="secondary" className="px-1.5 py-0 min-w-[1.5rem] justify-center">
                    {statusCounts[key]}
                  </Badge>
                </button>
              ))}
            </div>

            {!initialClassId && (
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">All Classes</option>
                {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name} ({cls.section})</option>)}
              </select>
            )}

            <Btn
              variant={showAdvancedFilters ? 'primary' : 'secondary'}
              onClick={() => setShowAdvancedFilters(p => !p)}
              className="relative"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Btn>
          </div>
        </div>
      </Card>

      {/* ── Advanced Filter Panel ── */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="p-5 border-indigo-100 bg-indigo-50/30">
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
                    className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer outline-none">
                    <option value="">All Years</option>
                    {admissionYears.map(y => <option key={y} value={y!}>{y}</option>)}
                  </select>
                </div>
                {/* Family Group */}
                {familyGroups.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Family Group</label>
                    <select value={familyFilter} onChange={e => setFamilyFilter(e.target.value)}
                      className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer max-w-[180px] outline-none">
                      <option value="">All Families</option>
                      {familyGroups.map(f => <option key={f.id} value={f.id}>{f.family_name}</option>)}
                    </select>
                  </div>
                )}
                {/* Clear all */}
                {activeFilterCount > 0 && (
                  <Btn variant="danger" onClick={() => { setFeeFilter('all'); setGenderFilter(''); setFamilyFilter(''); setAdmissionYearFilter(''); setStatusFilter('all'); }}
                    className="ml-auto">
                    Clear All ({activeFilterCount})
                  </Btn>
                )}
                <div className="ml-auto text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {filteredStudents.length} of {students.length} students
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
        <div className="overflow-x-auto custom-scrollbar min-h-[320px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 w-10 text-center">
                  {!isStaffRole && !isCoordinator && (
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filteredStudents.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filteredStudents.map(s => s.id));
                        else setSelectedIds([]);
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  )}
                </th>
                <th className="px-4 py-3 text-premium-label">Roll</th>
                <th className="px-4 py-3 text-premium-label">Student</th>
                <th className="px-4 py-3 text-premium-label hidden sm:table-cell">Class</th>
                <th className="px-4 py-3 text-premium-label hidden md:table-cell">Joined</th>
                <th className="px-4 py-3 text-premium-label">Status</th>
                {!isCoordinator && <th className="px-4 py-3 text-premium-label hidden sm:table-cell">Fees</th>}
                <th className="px-4 py-3 text-premium-label text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Synchronizing...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <EmptyState
                      icon={<Users className="w-12 h-12" />}
                      title={search || activeFilterCount > 0 ? 'No Matches Found' : 'No Students Yet'}
                      description={search || activeFilterCount > 0
                        ? 'Try adjusting your search or filters.'
                        : 'Register your first student to get started.'}
                      action={!search && activeFilterCount === 0 && userRole?.role === 'admin' && (
                        <Btn onClick={() => navigate('/students/register')}>
                          <UserPlus className="w-4 h-4" /> Register First Student
                        </Btn>
                      )}
                    />
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student, i) => (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn('hover:bg-indigo-50/30 transition-all group', selectedIds.includes(student.id) ? 'bg-indigo-50/50' : '')}
                  >
                    <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      {!isStaffRole && !isCoordinator && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(student.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, student.id]);
                            else setSelectedIds(selectedIds.filter(id => id !== student.id));
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg text-xs font-black text-slate-600 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100">
                        {student.roll_number}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight leading-snug">{student.full_name}</span>
                        <span className="text-xs text-slate-400 font-medium">{student.b_form_cnic || 'No CNIC'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 group-hover:bg-white transition-colors">
                        <BookOpen className="w-3 h-3 opacity-50" />
                        {student.classes ? `${student.classes.name} (${student.classes.section})` : 'Unassigned'}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 font-medium hidden md:table-cell">
                      {formatDate(student.admission_date)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest',
                          student.status === 'active' ? 'bg-emerald-500 text-white' :
                            student.status === 'left' ? 'bg-amber-500 text-white' :
                              student.status === 'graduated' ? 'bg-teal-500 text-white' :
                                student.status === 'withdrawn' ? 'bg-rose-600 text-white' :
                                  'bg-slate-400 text-white'
                        )}
                      >
                        {student.status === 'graduated' ? 'Passed' : student.status}
                      </span>
                    </td>
                    {!isCoordinator && (
                      <td className="px-4 py-2 hidden sm:table-cell">
                        {studentsWithDues.has(student.id) ? (
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-600">
                            Dues
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600">
                            Clear
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2 transition-opacity">
                        {!isStaffRole && !isCoordinator && (
                          <button
                            onClick={() => navigate(`/students/edit/${student.id}`)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Edit Profile"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/students/detail/${student.id}`)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View Portfolio"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Administrative Action Menu - hidden for staff/coordinator roles */}
                        {!isStaffRole && !isCoordinator && (
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
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Change Status</p>
                                </div>
                                <button onClick={() => { setStatusModal({ studentId: student.id, studentName: student.full_name, targetStatus: 'left' }); setOpenMenu(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-amber-600 hover:bg-amber-50 transition-colors">
                                  <LogOut className="w-3.5 h-3.5" /> Mark as Left
                                </button>
                                <button onClick={() => { setStatusModal({ studentId: student.id, studentName: student.full_name, targetStatus: 'graduated' }); setOpenMenu(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-teal-600 hover:bg-teal-50 transition-colors">
                                  <GraduationCap className="w-3.5 h-3.5" /> Mark as Passed Out
                                </button>
                                <button onClick={() => { setStatusModal({ studentId: student.id, studentName: student.full_name, targetStatus: 'withdrawn' }); setOpenMenu(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors">
                                  <UserX className="w-3.5 h-3.5" /> Admission Withdrawn
                                </button>
                                <div className="border-t border-slate-50 my-1" />
                                <button onClick={() => handleDisableLogin(student.id)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                  <Shield className="w-3.5 h-3.5" /> Disable App Login
                                </button>
                                <button onClick={() => { setPwdModal({ studentId: student.id, studentName: student.full_name }); setOpenMenu(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                  <Key className="w-3.5 h-3.5" /> Change Password
                                </button>
                                <div className="border-t border-slate-50 my-1" />
                                <button onClick={() => setDeleteModal({ isOpen: true, id: student.id, name: student.full_name })}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" /> Delete Record
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[11px] font-bold text-slate-500">
              Showing <span className="font-black text-slate-700">{(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)}</span> of <span className="font-black text-slate-700">{filteredStudents.length}</span> students
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs font-black text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-indigo-50 transition-all"
              >«</button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs font-black text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-indigo-50 transition-all"
              >Prev</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                const page = start + i;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      'w-8 h-7 text-xs font-black rounded-lg transition-all',
                      page === currentPage
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                    )}
                  >{page}</button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs font-black text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-indigo-50 transition-all"
              >Next</button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs font-black text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-indigo-50 transition-all"
              >»</button>
            </div>
          </div>
        )}
        {/* Row count footer when single page */}
        {!loading && totalPages <= 1 && filteredStudents.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[11px] font-bold text-slate-400">
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} shown
            </p>
          </div>
        )}
      </Card>

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
                      loading="lazy"
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
                          <p className="text-xs font-black text-white font-mono">
                            {selectedStudent.auth_password ? '••••••••' : 'Not set'}
                          </p>
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
                          { label: 'Date of Birth', val: formatDate(selectedStudent.dob) },
                          { label: 'Gender', val: selectedStudent.gender || '-' },
                          { label: 'Religion', val: selectedStudent.religion || '-' },
                          { label: 'Nationality', val: selectedStudent.nationality || '-' },
                          { label: 'Blood Group', val: selectedStudent.blood_group || '-' },
                          { label: 'Admission Date', val: formatDate(selectedStudent.admission_date) },
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
                          <option value="withdrawn">Withdrawn</option>
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
                                <td className="px-5 py-3 font-medium text-slate-700">{formatDate(rec.date)}</td>
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
                                    {fee.month_year ? formatDate(fee.month_year) : '—'}
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
                {!isStaffRole && !isCoordinator ? (
                  <Link to={`/students/register?edit=${selectedStudent.id}`} className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest transition-colors">
                    Edit Student Profile →
                  </Link>
                ) : (
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">View Only</span>
                )}
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
      {isImportModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
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
        </div>,
        document.body
      )}

      {/* Delete Pin Modal */}
      <DeletePinModal
        isOpen={deleteModal.isOpen}
        schoolId={userRole?.school_id || ''}
        itemName={deleteModal.name}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={executeDelete}
      />

      {/* Bulk Action Bar — Relocated to Top for better visibility */}
      {selectedIds.length > 0 && createPortal(
        <div className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md text-slate-900 px-4 py-2 rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] flex items-center gap-4 z-[9998] border border-indigo-100 animate-in fade-in slide-in-from-top-4 duration-300 max-w-[calc(100vw-2rem)]">
          {/* Count + clear */}
          <div className="flex items-center gap-3 border-r border-slate-200 pr-4 shrink-0">
            <div className="bg-indigo-600 w-7 h-7 flex items-center justify-center rounded-lg shadow-lg shadow-indigo-500/30 shrink-0">
              <Users className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-black leading-none whitespace-nowrap">
                {selectedIds.length} {selectedIds.length === 1 ? 'Student' : 'Students'}
              </p>
              <button
                onClick={() => setSelectedIds([])}
                className="text-[9px] text-indigo-600 hover:text-indigo-800 uppercase tracking-widest font-black mt-0.5 transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsBulkStatusOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-transparent active:scale-95 whitespace-nowrap"
            >
              <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" /> Status
            </button>
            <button
              onClick={() => setIsBulkClassOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-transparent active:scale-95 whitespace-nowrap"
            >
              <Upload className="w-3 h-3 text-indigo-500 shrink-0" /> Move
            </button>
            <button
              onClick={() => setIsBulkQuickUpdateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-transparent active:scale-95 whitespace-nowrap"
            >
              <Edit className="w-3 h-3 text-amber-500 shrink-0" /> Edit
            </button>
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-rose-100 active:scale-95 whitespace-nowrap"
            >
              <Trash2 className="w-3 h-3 shrink-0" /> Trash
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Quick Update Modal */}
      {isBulkQuickUpdateOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Quick Batch Update</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Updating {selectedIds.length} Students</p>
              </div>
              <button onClick={() => setIsBulkQuickUpdateOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 transition-colors shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Field to Update</label>
                <select
                  value={bulkUpdateField}
                  onChange={(e) => {
                    setBulkUpdateField(e.target.value);
                    setBulkUpdateValue(''); // reset value when field changes
                  }}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-inner"
                >
                  <option value="">Select Field...</option>
                  <option value="gender">Gender</option>
                  <option value="religion">Religion</option>
                  <option value="blood_group">Blood Group</option>
                  <option value="fee_waiver_percentage">Fee Waiver (%)</option>
                </select>
              </div>

              {bulkUpdateField && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">New Value</label>

                  {bulkUpdateField === 'gender' ? (
                    <select value={bulkUpdateValue} onChange={(e) => setBulkUpdateValue(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-inner">
                      <option value="">Select Gender...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  ) : bulkUpdateField === 'religion' ? (
                    <select value={bulkUpdateValue} onChange={(e) => setBulkUpdateValue(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-inner">
                      <option value="">Select Religion...</option>
                      <option value="Islam">Islam</option>
                      <option value="Christianity">Christianity</option>
                      <option value="Hinduism">Hinduism</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : bulkUpdateField === 'blood_group' ? (
                    <select value={bulkUpdateValue} onChange={(e) => setBulkUpdateValue(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-inner">
                      <option value="">Select Blood Group...</option>
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  ) : bulkUpdateField === 'fee_waiver_percentage' ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Enter percentage (0-100)"
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-inner"
                    />
                  ) : null}
                </div>
              )}

              <button
                onClick={handleBulkQuickUpdate}
                disabled={!bulkUpdateField || !bulkUpdateValue}
                className="w-full bg-amber-500 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-amber-600 shadow-xl shadow-amber-500/20 disabled:opacity-30 transition-all mt-2 active:scale-95"
              >
                Apply Update
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Status Modal */}
      {isBulkStatusOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300">
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
        </div>,
        document.body
      )}

      {/* Bulk Class Modal */}
      {isBulkClassOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300">
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
        </div>,
        document.body
      )}

      {/* Bulk Delete Confirmation */}
      {isBulkDeleteModalOpen && (
        <DeletePinModal
          isOpen={isBulkDeleteModalOpen}
          schoolId={userRole?.school_id || ''}
          onConfirm={handleBulkDelete}
          onClose={() => setIsBulkDeleteModalOpen(false)}
          itemName={`${selectedIds.length} Student Records`}
        />
      )}

      {/* ── Status Change Modal ── */}
      {statusModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-black text-slate-900 mb-1">
              {statusModal.targetStatus === 'left' ? 'Mark as Left' :
                statusModal.targetStatus === 'graduated' ? 'Mark as Passed Out' :
                  'Admission Withdrawn'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Student: <strong>{statusModal.studentName}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Reason / Remarks (optional)</label>
              <textarea
                rows={3}
                value={statusReason}
                onChange={e => setStatusReason(e.target.value)}
                placeholder={
                  statusModal.targetStatus === 'left' ? 'e.g. Family relocated...' :
                    statusModal.targetStatus === 'graduated' ? 'e.g. Completed Grade 10...' :
                      'e.g. Fee non-payment, disciplinary action...'
                }
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>
            <div className={cn(
              'text-xs font-bold px-3 py-2 rounded-lg mb-4',
              statusModal.targetStatus === 'left' ? 'bg-amber-50 text-amber-700' :
                statusModal.targetStatus === 'graduated' ? 'bg-teal-50 text-teal-700' :
                  'bg-rose-50 text-rose-700'
            )}>
              ⚠ This student will be moved to the "{
                statusModal.targetStatus === 'graduated' ? 'Passed Out' :
                  statusModal.targetStatus.charAt(0).toUpperCase() + statusModal.targetStatus.slice(1)
              }" tab.
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setStatusModal(null); setStatusReason(''); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button onClick={confirmStatusChange} disabled={savingStatus}
                className={cn('flex-1 px-4 py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50',
                  statusModal.targetStatus === 'left' ? 'bg-amber-500 hover:bg-amber-600' :
                    statusModal.targetStatus === 'graduated' ? 'bg-teal-500 hover:bg-teal-600' :
                      'bg-rose-500 hover:bg-rose-600'
                )}>
                {savingStatus ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Change Password Modal ── */}
      {pwdModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-black text-slate-900 mb-1">Change Portal Password</h3>
            <p className="text-sm text-slate-500 mb-4">Student: <strong>{pwdModal.studentName}</strong></p>
            <div className="mb-4">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">New Password</label>
              <input
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setPwdModal(null); setNewPassword(''); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button onClick={handleChangePassword} disabled={savingStatus || !newPassword.trim()}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50">
                {savingStatus ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Undo Delete Toast ── */}
      <AnimatePresence>
        {undoToast && createPortal(
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 bg-slate-900 text-white text-sm font-semibold px-5 py-3.5 rounded-2xl shadow-2xl"
          >
            <Trash2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{undoToast.message}</span>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1.5 ml-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-xs font-black transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Undo
            </button>
            <button onClick={() => setUndoToast(null)} className="ml-1 p-1 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
}
