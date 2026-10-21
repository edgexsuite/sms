import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { processStudentPhoto, uploadFile, PhotoProcessResult } from '../lib/uploadUtils';
import {
  X, Camera, Upload, Trash2, CheckCircle2, AlertCircle, RefreshCw,
  Search, Users, Filter, Check, Eye, Image as ImageIcon, Sparkles, FolderUp
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface ClassOption {
  id: string;
  name: string;
  section?: string;
}

interface StudentItem {
  id: string;
  full_name: string;
  roll_number: string;
  photograph_url?: string | null;
  gender?: string | null;
  status: string;
  class_id?: string;
}

interface StudentPhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClassId?: string;
  availableClasses?: ClassOption[];
  onPhotoUpdated?: (studentId: string, photoUrl: string | null) => void;
}

export default function StudentPhotoUploadModal({
  isOpen,
  onClose,
  initialClassId,
  availableClasses = [],
  onPhotoUpdated,
}: StudentPhotoUploadModalProps) {
  const { userRole } = useAuth();
  const schoolId = userRole?.school_id;

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'missing' | 'has_photo'>('all');

  // Per-student processing state: studentId -> message/stats
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{ studentId: string; msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Preview full image modal
  const [previewStudent, setPreviewStudent] = useState<StudentItem | null>(null);

  // Bulk upload state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ total: number; done: number; failed: number } | null>(null);
  const [bulkLogs, setBulkLogs] = useState<string[]>([]);

  // Hidden file inputs
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const activeStudentIdRef = useRef<string | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const [classList, setClassList] = useState<ClassOption[]>(availableClasses);

  useEffect(() => {
    if (availableClasses && availableClasses.length > 0) {
      setClassList(availableClasses);
      if (!selectedClassId) setSelectedClassId(initialClassId || availableClasses[0].id);
    } else if (isOpen && schoolId) {
      supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', schoolId)
        .order('name')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setClassList(data);
            if (!selectedClassId) setSelectedClassId(initialClassId || data[0].id);
          }
        });
    }
  }, [isOpen, availableClasses, initialClassId, schoolId]);

  useEffect(() => {
    if (isOpen && selectedClassId && schoolId) {
      fetchStudents(selectedClassId);
    }
  }, [isOpen, selectedClassId, schoolId]);

  const fetchStudents = async (classId: string) => {
    if (!schoolId || !classId) return;
    setLoading(true);
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
      console.error('Error fetching students for photo upload:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger file picker for a specific student
  const handlePickPhoto = (studentId: string) => {
    activeStudentIdRef.current = studentId;
    if (singleFileInputRef.current) {
      singleFileInputRef.current.value = '';
      singleFileInputRef.current.click();
    }
  };

  // Process and upload a single photo
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
      // Step 1: Compress client-side (< 20 KB hard ceiling)
      const compressed: PhotoProcessResult = await processStudentPhoto(file);

      // Verify ceiling before network call
      if (compressed.blob.size >= 20 * 1024) {
        throw new Error(`Compression ceiling exceeded (${compressed.sizeKB} KB). Target is < 20 KB.`);
      }

      setUploadStatusMsg({
        studentId,
        msg: `Compressed to ${compressed.sizeKB} KB (${compressed.reductionPercent ?? 95}% smaller). Uploading...`,
        type: 'info',
      });

      // Step 2: Upload to Supabase Storage: {school_id}/students/{student_id}.{format}
      const storagePath = `${schoolId}/students/${studentId}`;
      const publicUrl = await uploadFile(storagePath, compressed.blob, compressed.format);

      // Add cache-busting timestamp query for instant browser refresh
      const refreshedUrl = `${publicUrl}?t=${Date.now()}`;

      // Step 3: Update students table
      const { error: dbError } = await supabase
        .from('students')
        .update({ photograph_url: refreshedUrl })
        .eq('id', studentId);

      if (dbError) throw dbError;

      // Step 4: Update local state & trigger parent callback
      setStudents(prev =>
        prev.map(s => (s.id === studentId ? { ...s, photograph_url: refreshedUrl } : s))
      );

      setUploadStatusMsg({
        studentId,
        msg: `Photo updated! (${compressed.sizeKB} KB · < 20 KB)`,
        type: 'success',
      });

      if (onPhotoUpdated) {
        onPhotoUpdated(studentId, refreshedUrl);
      }

      setTimeout(() => {
        setUploadStatusMsg(null);
      }, 3500);
    } catch (err: any) {
      console.error('Error processing/uploading photo:', err);
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

  // Remove photo from student
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

      if (onPhotoUpdated) {
        onPhotoUpdated(student.id, null);
      }
    } catch (err: any) {
      alert('Failed to remove photo: ' + err.message);
    } finally {
      setUploadingStudentId(null);
    }
  };

  // Bulk upload matching files by Roll Number (e.g. "101.jpg", "05.png")
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
      // Parse roll number from filename: remove extension, trim
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').trim();
      // Match with student in current class
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

        if (onPhotoUpdated) onPhotoUpdated(matched.id, refreshedUrl);

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Hidden file input for single uploads */}
      <input
        ref={singleFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Hidden file input for bulk uploads */}
      <input
        ref={bulkFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleBulkFiles}
      />

      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Camera className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Student Photo Upload <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full border border-white/20">Class Incharge</span>
              </h2>
              <p className="text-xs text-indigo-100 font-medium">
                Upload & compress student pictures to strictly less than 20 KB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Controls & Metrics Bar */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Class Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Class:</span>
              {classList.length > 1 ? (
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {classList.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.section ? `(${cls.section})` : ''}
                    </option>
                  ))}
                </select>
              ) : classList.length === 1 ? (
                <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-3 py-1.5 rounded-lg border border-indigo-200">
                  {classList[0].name} {classList[0].section ? `— ${classList[0].section}` : ''}
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-600">Assigned Class</span>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkMode(!bulkMode)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg border transition',
                  bulkMode
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                )}
              >
                <FolderUp className="w-3.5 h-3.5" />
                {bulkMode ? 'Hide Bulk Upload' : 'Bulk Upload by Roll #'}
              </button>
            </div>
          </div>

          {/* Progress & Stat Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">Total Students</span>
              <span className="text-sm font-black text-slate-900">{totalCount}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> With Photo
              </span>
              <span className="text-sm font-black text-emerald-800">{withPhotoCount}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-xs flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Missing Photo
              </span>
              <span className="text-sm font-black text-amber-800">{missingCount}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-center">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                <span>Coverage</span>
                <span className="text-indigo-600 font-black">{coveragePercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bulk Dropzone (Conditional) */}
          {bulkMode && (
            <div className="p-4 bg-indigo-50/80 rounded-xl border border-indigo-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Auto-Match Photos by Roll Number
                  </h4>
                  <p className="text-[11px] text-indigo-700">
                    Name your photos with student roll numbers (e.g. <code>101.jpg</code>, <code>102.png</code>). Each will be auto-compressed &lt; 20 KB.
                  </p>
                </div>
                <button
                  onClick={() => bulkFileInputRef.current?.click()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-lg shadow-sm transition shrink-0 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> Select Images
                </button>
              </div>

              {bulkProgress && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-indigo-900">
                    <span>Processing: {bulkProgress.done + bulkProgress.failed} / {bulkProgress.total}</span>
                    <span>{bulkProgress.done} updated, {bulkProgress.failed} skipped</span>
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

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name or roll number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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

            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shrink-0">
              <button
                onClick={() => setFilterType('all')}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-bold rounded-md transition',
                  filterType === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setFilterType('missing')}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-bold rounded-md transition',
                  filterType === 'missing' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                Missing ({missingCount})
              </button>
              <button
                onClick={() => setFilterType('has_photo')}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-bold rounded-md transition',
                  filterType === 'has_photo' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                Uploaded ({withPhotoCount})
              </button>
            </div>
          </div>
        </div>

        {/* Student Roster List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-slate-100">
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">Loading student roster...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">No students match current filter or search</p>
            </div>
          ) : (
            filteredStudents.map(student => {
              const isUploading = uploadingStudentId === student.id;
              const statusMsg = uploadStatusMsg?.studentId === student.id ? uploadStatusMsg : null;

              return (
                <div
                  key={student.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition"
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative group shrink-0">
                      {student.photograph_url ? (
                        <img
                          src={student.photograph_url}
                          alt={student.full_name}
                          className="w-12 h-14 rounded-xl object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <div className="w-12 h-14 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="w-4 h-4 opacity-40 mb-0.5" />
                          <span className="text-[9px] font-black uppercase text-slate-400">Empty</span>
                        </div>
                      )}

                      {student.photograph_url && (
                        <button
                          onClick={() => setPreviewStudent(student)}
                          className="absolute inset-0 bg-slate-900/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition"
                          title="Preview full photo"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                          Roll #{student.roll_number || 'N/A'}
                        </span>
                        {student.photograph_url ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Photo Added
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            No Photo
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-black text-slate-900 truncate mt-0.5">
                        {student.full_name}
                      </h4>
                      {student.gender && (
                        <p className="text-[11px] text-slate-400 capitalize">Gender: {student.gender}</p>
                      )}

                      {/* Status / Reduction Message */}
                      {statusMsg && (
                        <p
                          className={cn(
                            'text-[10px] font-bold mt-1 flex items-center gap-1',
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

                  {/* Right: Upload / Replace / Remove Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => handlePickPhoto(student.id)}
                      disabled={isUploading}
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition shadow-xs',
                        student.photograph_url
                          ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                      )}
                    >
                      {isUploading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5" />
                          <span>{student.photograph_url ? 'Replace' : 'Upload / Snap'}</span>
                        </>
                      )}
                    </button>

                    {student.photograph_url && (
                      <button
                        onClick={() => handleRemovePhoto(student)}
                        disabled={isUploading}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition"
                        title="Remove student photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>All uploads auto-scale to 150×180 px &amp; compress strictly &lt; 20 KB</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition text-xs"
          >
            Done
          </button>
        </div>
      </div>

      {/* Image Zoom Preview Modal */}
      {previewStudent && previewStudent.photograph_url && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewStudent(null)}
        >
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full text-center space-y-3" onClick={e => e.stopPropagation()}>
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
              className="w-48 h-56 mx-auto rounded-xl object-cover border-2 border-indigo-200 shadow-lg"
            />
            <p className="text-xs text-slate-500">Compressed WebP &lt; 20 KB (Passport Format)</p>
          </div>
        </div>
      )}
    </div>
  );
}
