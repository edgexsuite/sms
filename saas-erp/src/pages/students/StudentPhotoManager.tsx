import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { processStudentPhoto, uploadFile, PhotoProcessResult } from '../../lib/uploadUtils';
import {
  Camera, Image as ImageIcon, Upload, Trash2, CheckCircle2, AlertCircle, RefreshCw,
  Search, Users, Filter, Check, Eye, Sparkles, FolderUp, ArrowLeft, Shield,
  CheckCircle, X
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Btn } from '../../components/ui/Btn';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

interface StudentItem {
  id: string;
  full_name: string;
  roll_number: string;
  photograph_url?: string | null;
  gender?: string | null;
  status: string;
  class_id?: string;
}

interface ClassItem {
  id: string;
  name: string;
  section?: string;
  class_teacher_id?: string;
}

export default function StudentPhotoManager() {
  const { userRole, inchargeClassIds } = useAuth();
  const schoolId = userRole?.school_id;
  const navigate = useNavigate();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'missing' | 'has_photo'>('all');

  // Single upload state
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{ studentId: string; msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Bulk upload state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ total: number; done: number; failed: number } | null>(null);
  const [bulkLogs, setBulkLogs] = useState<string[]>([]);

  // Preview zoom
  const [previewStudent, setPreviewStudent] = useState<StudentItem | null>(null);

  // Dual file inputs: direct camera vs mobile gallery / file picker
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const activeStudentIdRef = useRef<string | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch classes on mount
  useEffect(() => {
    if (!schoolId) return;
    fetchClasses();
  }, [schoolId]);

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, section, class_teacher_id')
        .eq('school_id', schoolId)
        .order('name')
        .order('section');

      if (error) throw error;
      const list = data || [];
      setClasses(list);

      // Default selection priority:
      // 1. First incharge class if available
      // 2. First class in list
      if (list.length > 0) {
        const inchargeClass = list.find(c => inchargeClassIds.includes(c.id));
        setSelectedClassId(inchargeClass ? inchargeClass.id : list[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoadingClasses(false);
    }
  };

  // Fetch students when selectedClassId changes
  useEffect(() => {
    if (!schoolId || !selectedClassId) return;
    fetchStudents(selectedClassId);
  }, [schoolId, selectedClassId]);

  const fetchStudents = async (classId: string) => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, roll_number, photograph_url, gender, status, class_id')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('status', 'active')
        .eq('is_deleted', false)
        .order('roll_number', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (err: any) {
      console.error('Error fetching students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  // Trigger camera directly (mobile capture)
  const handlePickCamera = (studentId: string) => {
    activeStudentIdRef.current = studentId;
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  // Trigger gallery / file picker
  const handlePickGallery = (studentId: string) => {
    activeStudentIdRef.current = studentId;
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
      galleryInputRef.current.click();
    }
  };

  // Process & upload single photo
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const studentId = activeStudentIdRef.current;
    if (!file || !studentId || !schoolId) return;

    if (!file.type.startsWith('image/')) {
      setUploadStatusMsg({ studentId, msg: 'Please select a valid image file.', type: 'error' });
      return;
    }

    setUploadingStudentId(studentId);
    setUploadStatusMsg({ studentId, msg: 'Compressing strictly under 20 KB...', type: 'info' });

    try {
      const compressed: PhotoProcessResult = await processStudentPhoto(file);

      // Verify ceiling before uploading
      if (compressed.blob.size >= 20 * 1024) {
        throw new Error(`Compression ceiling exceeded (${compressed.sizeKB} KB). Target is < 20 KB.`);
      }

      setUploadStatusMsg({
        studentId,
        msg: `Compressed to ${compressed.sizeKB} KB (${compressed.reductionPercent ?? 95}% smaller). Uploading...`,
        type: 'info',
      });

      const storagePath = `${schoolId}/students/${studentId}`;
      const publicUrl = await uploadFile(storagePath, compressed.blob, compressed.format);
      const refreshedUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('students')
        .update({ photograph_url: refreshedUrl })
        .eq('id', studentId);

      if (dbError) throw dbError;

      setStudents(prev =>
        prev.map(s => (s.id === studentId ? { ...s, photograph_url: refreshedUrl } : s))
      );

      setUploadStatusMsg({
        studentId,
        msg: `Photo updated! (${compressed.sizeKB} KB · < 20 KB)`,
        type: 'success',
      });

      setTimeout(() => setUploadStatusMsg(null), 3500);
    } catch (err: any) {
      console.error('Error processing photo:', err);
      setUploadStatusMsg({
        studentId,
        msg: err.message || 'Failed to compress or upload photo.',
        type: 'error',
      });
    } finally {
      setUploadingStudentId(null);
      activeStudentIdRef.current = null;
    }
  };

  // Remove photo
  const handleRemovePhoto = async (student: StudentItem) => {
    if (!window.confirm(`Are you sure you want to remove the photo for ${student.full_name}?`)) {
      return;
    }

    setUploadingStudentId(student.id);
    try {
      const { error } = await supabase
        .from('students')
        .update({ photograph_url: null })
        .eq('id', student.id);

      if (error) throw error;

      setStudents(prev =>
        prev.map(s => (s.id === student.id ? { ...s, photograph_url: null } : s))
      );

      setUploadStatusMsg({
        studentId: student.id,
        msg: 'Photo removed.',
        type: 'info',
      });
    } catch (err: any) {
      alert('Failed to remove photo: ' + err.message);
    } finally {
      setUploadingStudentId(null);
    }
  };

  // Bulk matching by Roll Number
  const handleBulkFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !schoolId) return;

    const files: File[] = Array.from(fileList);
    setBulkProgress({ total: files.length, done: 0, failed: 0 });
    setBulkLogs([]);

    const logs: string[] = [];
    let doneCount = 0;
    let failedCount = 0;

    for (const file of files) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').trim();
      const matched = students.find(
        s => s.roll_number?.trim().toLowerCase() === nameWithoutExt.toLowerCase()
      );

      if (!matched) {
        logs.push(`⚠️ ${file.name}: No matching student with Roll #${nameWithoutExt}`);
        failedCount++;
        setBulkProgress({ total: files.length, done: doneCount, failed: failedCount });
        continue;
      }

      try {
        const compressed = await processStudentPhoto(file);
        const storagePath = `${schoolId}/students/${matched.id}`;
        const publicUrl = await uploadFile(storagePath, compressed.blob, compressed.format);
        const refreshedUrl = `${publicUrl}?t=${Date.now()}`;

        await supabase
          .from('students')
          .update({ photograph_url: refreshedUrl })
          .eq('id', matched.id);

        setStudents(prev =>
          prev.map(s => (s.id === matched.id ? { ...s, photograph_url: refreshedUrl } : s))
        );

        doneCount++;
        logs.push(`✅ Roll #${matched.roll_number} (${matched.full_name}): ${compressed.sizeKB} KB (< 20 KB)`);
      } catch (err: any) {
        failedCount++;
        logs.push(`❌ ${file.name} (Roll #${matched.roll_number}): ${err.message}`);
      }

      setBulkProgress({ total: files.length, done: doneCount, failed: failedCount });
      setBulkLogs([...logs]);
    }
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    const matchesSearch =
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.roll_number?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType === 'missing') return !student.photograph_url;
    if (filterType === 'has_photo') return !!student.photograph_url;
    return true;
  });

  const totalCount = students.length;
  const withPhotoCount = students.filter(s => !!s.photograph_url).length;
  const missingCount = totalCount - withPhotoCount;
  const coveragePercent = totalCount > 0 ? Math.round((withPhotoCount / totalCount) * 100) : 0;
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const isInchargeOfSelected = inchargeClassIds.includes(selectedClassId);

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Hidden File Inputs: Camera vs Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      <input
        ref={bulkFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleBulkFiles}
      />

      {/* Page Header - Compact on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
            <span>Class Student Photos</span>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
              &lt; 20 KB
            </span>
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block mt-0.5">
            Passport format crop (150×180 px) with strict automatic compression under 20 KB.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            onClick={() => setBulkMode(!bulkMode)}
            className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition"
          >
            <FolderUp className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden xs:inline">{bulkMode ? 'Hide Bulk' : 'Bulk Match'}</span>
          </button>
          <button
            onClick={() => navigate('/students')}
            className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden xs:inline">Directory</span>
          </button>
        </div>
      </div>

      {/* Class Selection & Stats Bar */}
      <Card className="p-3 sm:p-5 border-none shadow-sm bg-white/95 backdrop-blur-sm space-y-2.5 sm:space-y-4">
        {/* Class Selector Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider shrink-0">Class:</span>
            {loadingClasses ? (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Loading...
              </span>
            ) : classes.length === 0 ? (
              <span className="text-xs text-slate-400">No classes found</span>
            ) : (
              <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-black rounded-xl px-3 py-1.5 sm:py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {classes.map(cls => {
                    const isIncharge = inchargeClassIds.includes(cls.id);
                    return (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} {cls.section ? `(${cls.section})` : ''} {isIncharge ? '★ (Your Incharge Class)' : ''}
                      </option>
                    );
                  })}
                </select>
                {isInchargeOfSelected && (
                  <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline-flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-indigo-600" /> Incharge
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Compact Mobile Stats Strip */}
          <div className="flex sm:hidden items-center gap-2 text-xs w-full justify-between bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="text-emerald-700">{withPhotoCount}/{totalCount} Photos</span>
              <span className="text-slate-400">·</span>
              <span className="text-amber-700">{missingCount} Missing</span>
            </div>
            <span className="text-[11px] font-black text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {coveragePercent}%
            </span>
          </div>
        </div>

        {/* Desktop Metrics Row (Hidden on mobile to save vertical space) */}
        <div className="hidden sm:grid grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Enrolled</span>
            <span className="text-base font-black text-slate-900">{totalCount}</span>
          </div>
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> With Photo
            </span>
            <span className="text-base font-black text-emerald-800">{withPhotoCount}</span>
          </div>
          <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-amber-600" /> Missing Photo
            </span>
            <span className="text-base font-black text-amber-800">{missingCount}</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-center">
            <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1">
              <span>Coverage</span>
              <span className="text-indigo-600 font-black">{coveragePercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${coveragePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bulk Upload Section */}
        {bulkMode && (
          <div className="p-3 sm:p-4 bg-indigo-50/90 rounded-xl border border-indigo-200 space-y-2 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Auto-Match Photos by Roll #
                </h4>
                <p className="text-[11px] text-indigo-800">
                  Select multiple photos named like <code>101.jpg</code> or <code>102.png</code>.
                </p>
              </div>
              <button
                onClick={() => bulkFileInputRef.current?.click()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-3.5 py-1.5 rounded-lg shadow-sm transition shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Upload className="w-3.5 h-3.5" /> Select Photos
              </button>
            </div>

            {bulkProgress && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] font-bold text-indigo-900">
                  <span>Progress: {bulkProgress.done + bulkProgress.failed} / {bulkProgress.total}</span>
                  <span>{bulkProgress.done} updated, {bulkProgress.failed} failed</span>
                </div>
                <div className="max-h-24 overflow-y-auto bg-white rounded-lg p-2 border border-indigo-200 font-mono text-[10px] text-slate-700 space-y-0.5">
                  {bulkLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search & Filter - Compact Toolbar */}
        <div className="flex items-center gap-2 pt-0.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search roll # or name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setFilterType('all')}
              className={cn(
                'px-2 sm:px-2.5 py-1 text-[11px] font-bold rounded-lg transition',
                filterType === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              )}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilterType('missing')}
              className={cn(
                'px-2 sm:px-2.5 py-1 text-[11px] font-bold rounded-lg transition',
                filterType === 'missing' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              )}
            >
              Missing ({missingCount})
            </button>
            <button
              onClick={() => setFilterType('has_photo')}
              className={cn(
                'px-2 sm:px-2.5 py-1 text-[11px] font-bold rounded-lg transition',
                filterType === 'has_photo' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              )}
            >
              Added ({withPhotoCount})
            </button>
          </div>
        </div>
      </Card>

      {/* Student Roster Section - Maximized Viewport on Mobile */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 sm:p-4">
        {loadingStudents ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading student roster...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold text-slate-600">No students match current filter</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 sm:divide-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3">
            {filteredStudents.map(student => {
              const isUploading = uploadingStudentId === student.id;
              const statusMsg = uploadStatusMsg?.studentId === student.id ? uploadStatusMsg : null;

              return (
                <div
                  key={student.id}
                  className="py-2.5 sm:p-3.5 sm:bg-slate-50/70 sm:border sm:border-slate-200 sm:rounded-2xl hover:border-indigo-300 transition flex flex-col justify-between"
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="relative group shrink-0">
                      {student.photograph_url ? (
                        <img
                          src={student.photograph_url}
                          alt={student.full_name}
                          className="w-11 h-13 sm:w-14 sm:h-17 rounded-xl object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <div className="w-11 h-13 sm:w-14 sm:h-17 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="w-4 h-4 opacity-40 mb-0.5" />
                          <span className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400">No Photo</span>
                        </div>
                      )}

                      {student.photograph_url && (
                        <button
                          onClick={() => setPreviewStudent(student)}
                          className="absolute inset-0 bg-slate-900/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition"
                          title="Preview full photo"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Student Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                          Roll #{student.roll_number || 'N/A'}
                        </span>
                        {student.photograph_url ? (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Added
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                            Missing
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate mt-0.5">
                        {student.full_name}
                      </h4>

                      {statusMsg && (
                        <p
                          className={cn(
                            'text-[10px] font-bold mt-1 flex items-center gap-1',
                            statusMsg.type === 'success' && 'text-emerald-600',
                            statusMsg.type === 'error' && 'text-red-600',
                            statusMsg.type === 'info' && 'text-indigo-600 animate-pulse'
                          )}
                        >
                          {statusMsg.type === 'info' && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                          {statusMsg.msg}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons: Camera vs Gallery */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isUploading ? (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 px-2 py-1 bg-indigo-50 rounded-lg">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span className="hidden xs:inline">Saving...</span>
                        </div>
                      ) : (
                        <>
                          {/* Snap with Camera */}
                          <button
                            onClick={() => handlePickCamera(student.id)}
                            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95"
                            title="Take photo with camera"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Camera</span>
                          </button>

                          {/* Pick from Gallery / Device Files */}
                          <button
                            onClick={() => handlePickGallery(student.id)}
                            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95"
                            title="Upload from mobile gallery or files"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="hidden sm:inline">Gallery</span>
                          </button>

                          {/* Delete Photo */}
                          {student.photograph_url && (
                            <button
                              onClick={() => handleRemovePhoto(student)}
                              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                              title="Remove photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Zoom Modal */}
      {previewStudent && previewStudent.photograph_url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewStudent(null)}
        >
          <div
            className="bg-white rounded-2xl p-4 max-w-sm w-full text-center space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-sm font-black text-slate-900">
                {previewStudent.full_name} (Roll #{previewStudent.roll_number})
              </h3>
              <button onClick={() => setPreviewStudent(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewStudent.photograph_url}
              alt={previewStudent.full_name}
              className="w-48 h-56 mx-auto rounded-xl object-cover border-2 border-indigo-200 shadow-xl"
            />
            <p className="text-xs text-slate-500">Compressed WebP &lt; 20 KB (Passport Format)</p>
          </div>
        </div>
      )}
    </div>
  );
}
