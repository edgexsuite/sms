import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { processStudentPhoto, uploadFile, PhotoProcessResult } from '../../lib/uploadUtils';
import {
  Camera, Upload, Trash2, CheckCircle2, AlertCircle, RefreshCw,
  Search, Users, Filter, Check, Eye, Image as ImageIcon, Sparkles,
  FolderUp, ArrowLeft, Shield, CheckCircle, X
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

  // File input refs
  const singleFileInputRef = useRef<HTMLInputElement>(null);
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

  // Trigger file picker
  const handlePickPhoto = (studentId: string) => {
    activeStudentIdRef.current = studentId;
    if (singleFileInputRef.current) {
      singleFileInputRef.current.value = '';
      singleFileInputRef.current.click();
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
    <div className="space-y-6">
      {/* Hidden File Inputs */}
      <input
        ref={singleFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        capture="environment"
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

      {/* Page Header */}
      <PageHeader
        title="Class Student Photos"
        subtitle="Upload and manage student pictures with automatic compression strictly under 20 KB."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="secondary" onClick={() => navigate('/students')}>
              <Users className="w-4 h-4" />
              <span>Student Directory</span>
            </Btn>
            <Btn
              variant={bulkMode ? 'primary' : 'secondary'}
              onClick={() => setBulkMode(!bulkMode)}
              className="flex items-center gap-1.5"
            >
              <FolderUp className="w-4 h-4" />
              <span>{bulkMode ? 'Hide Bulk Upload' : 'Bulk Match by Roll #'}</span>
            </Btn>
          </div>
        }
      />

      {/* Class Selection & Metric Banner */}
      <Card className="p-5 border-none shadow-sm bg-white/90 backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Class Picker */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Select Class:</span>
            {loadingClasses ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading classes...
              </div>
            ) : classes.length === 0 ? (
              <span className="text-xs text-slate-400">No classes found</span>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-black rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                  <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3 text-indigo-600" /> Class Incharge
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Ceilings & Format Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Auto-Compressed &lt; 20 KB (WebP/JPEG)
            </span>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Enrolled</span>
            <span className="text-base font-black text-slate-900">{totalCount}</span>
          </div>
          <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> With Photo
            </span>
            <span className="text-base font-black text-emerald-800">{withPhotoCount}</span>
          </div>
          <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-amber-600" /> Missing Photo
            </span>
            <span className="text-base font-black text-amber-800">{missingCount}</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-center">
            <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1">
              <span>Class Coverage</span>
              <span className="text-indigo-600 font-black">{coveragePercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${coveragePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bulk Upload Drop Area */}
        {bulkMode && (
          <div className="p-5 bg-indigo-50/90 rounded-2xl border border-indigo-200 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Auto-Match Multiple Photos by Roll Number
                </h4>
                <p className="text-xs text-indigo-800 mt-0.5">
                  Save your photo files as the student's roll number (e.g. <code>1.jpg</code>, <code>102.png</code>). Each image will be resized to passport size and compressed to &lt; 20 KB.
                </p>
              </div>
              <button
                onClick={() => bulkFileInputRef.current?.click()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-sm transition shrink-0 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Select Image Files
              </button>
            </div>

            {bulkProgress && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-bold text-indigo-900">
                  <span>Progress: {bulkProgress.done + bulkProgress.failed} / {bulkProgress.total}</span>
                  <span>{bulkProgress.done} updated successfully, {bulkProgress.failed} failed</span>
                </div>
                <div className="max-h-28 overflow-y-auto bg-white rounded-xl p-2.5 border border-indigo-200 font-mono text-[11px] text-slate-700 space-y-1">
                  {bulkLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student name or roll number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setFilterType('all')}
              className={cn(
                'px-3 py-1.5 text-xs font-bold rounded-lg transition',
                filterType === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
              )}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilterType('missing')}
              className={cn(
                'px-3 py-1.5 text-xs font-bold rounded-lg transition',
                filterType === 'missing' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
              )}
            >
              Missing ({missingCount})
            </button>
            <button
              onClick={() => setFilterType('has_photo')}
              className={cn(
                'px-3 py-1.5 text-xs font-bold rounded-lg transition',
                filterType === 'has_photo' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
              )}
            >
              With Photo ({withPhotoCount})
            </button>
          </div>
        </div>
      </Card>

      {/* Student Roster Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
        {loadingStudents ? (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading student roster...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold text-slate-600">No students match current filter</p>
            <p className="text-xs text-slate-400 mt-1">Try switching filters or clearing your search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map(student => {
              const isUploading = uploadingStudentId === student.id;
              const statusMsg = uploadStatusMsg?.studentId === student.id ? uploadStatusMsg : null;

              return (
                <div
                  key={student.id}
                  className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Avatar Thumbnail */}
                    <div className="relative group shrink-0">
                      {student.photograph_url ? (
                        <img
                          src={student.photograph_url}
                          alt={student.full_name}
                          className="w-16 h-20 rounded-xl object-cover border-2 border-white shadow-md"
                        />
                      ) : (
                        <div className="w-16 h-20 rounded-xl bg-slate-200/70 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="w-5 h-5 opacity-40 mb-1" />
                          <span className="text-[10px] font-black uppercase text-slate-400">No Photo</span>
                        </div>
                      )}

                      {student.photograph_url && (
                        <button
                          onClick={() => setPreviewStudent(student)}
                          className="absolute inset-0 bg-slate-900/50 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition"
                          title="Preview full photo"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {/* Student Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                          Roll #{student.roll_number || 'N/A'}
                        </span>
                        {student.photograph_url ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Added
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Missing
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-900 leading-snug line-clamp-1">
                        {student.full_name}
                      </h4>
                      {student.gender && (
                        <p className="text-[11px] text-slate-400 capitalize mt-0.5">Gender: {student.gender}</p>
                      )}

                      {statusMsg && (
                        <p
                          className={cn(
                            'text-[10px] font-bold mt-1.5 flex items-center gap-1',
                            statusMsg.type === 'success' && 'text-emerald-600',
                            statusMsg.type === 'error' && 'text-red-600',
                            statusMsg.type === 'info' && 'text-indigo-600 animate-pulse'
                          )}
                        >
                          {statusMsg.type === 'info' && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {statusMsg.msg}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-200/70">
                    <button
                      onClick={() => handlePickPhoto(student.id)}
                      disabled={isUploading}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl border transition shadow-xs',
                        student.photograph_url
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                      )}
                    >
                      {isUploading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Compressing...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5" />
                          <span>{student.photograph_url ? 'Replace' : 'Upload / Snap Photo'}</span>
                        </>
                      )}
                    </button>

                    {student.photograph_url && (
                      <button
                        onClick={() => handleRemovePhoto(student)}
                        disabled={isUploading}
                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition"
                        title="Remove student photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
            className="bg-white rounded-2xl p-5 max-w-sm w-full text-center space-y-3"
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
