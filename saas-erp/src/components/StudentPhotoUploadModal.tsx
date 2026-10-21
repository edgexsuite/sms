import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { processStudentPhoto, uploadFile, PhotoProcessResult } from '../lib/uploadUtils';
import {
  X, Camera, Image as ImageIcon, Upload, Trash2, CheckCircle2, AlertCircle, RefreshCw,
  Search, Users, Filter, Check, Eye, Sparkles, FolderUp
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

  const [classList, setClassList] = useState<ClassOption[]>(availableClasses);
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

  // Dual file inputs: direct camera vs mobile gallery / file picker
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const activeStudentIdRef = useRef<string | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

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

  // Trigger camera directly
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

  // Bulk upload matching files by Roll Number
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Hidden file input for camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Hidden file input for gallery / local files */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
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

      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col h-[94vh] sm:h-[90vh] overflow-hidden border border-slate-200">
        {/* Header - Slim on mobile */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3.5 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Camera className="w-4 h-4 text-indigo-100" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                Student Photo Upload <span className="text-[10px] font-bold bg-white/20 px-2 py-0.2 rounded-full border border-white/20">&lt; 20 KB</span>
              </h2>
              <p className="text-[11px] text-indigo-100 font-medium hidden sm:block">
                Take photo with camera or choose from gallery. Automatic passport resize.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Controls & Metrics Bar - Ultra-compact on mobile */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {/* Class Selector */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider shrink-0">Class:</span>
              {classList.length > 1 ? (
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none max-w-[200px] truncate"
                >
                  {classList.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.section ? `(${cls.section})` : ''}
                    </option>
                  ))}
                </select>
              ) : classList.length === 1 ? (
                <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-1 rounded-lg border border-indigo-200 truncate">
                  {classList[0].name} {classList[0].section ? `— ${classList[0].section}` : ''}
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-600">Assigned Class</span>
              )}
            </div>

            {/* Quick Bulk Button */}
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className={cn(
                'flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg border transition shrink-0',
                bulkMode
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              )}
            >
              <FolderUp className="w-3 h-3" />
              <span>{bulkMode ? 'Hide Bulk' : 'Bulk Match'}</span>
            </button>
          </div>

          {/* Compact Mobile Stats Line */}
          <div className="flex sm:hidden items-center justify-between text-[11px] bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            <span className="font-bold text-slate-700">
              <span className="text-emerald-700 font-black">{withPhotoCount}</span>/{totalCount} Photos · <span className="text-amber-700 font-black">{missingCount}</span> Missing
            </span>
            <span className="font-black text-indigo-600">{coveragePercent}%</span>
          </div>

          {/* Desktop Progress & Stat Badges */}
          <div className="hidden sm:grid grid-cols-4 gap-2 pt-0.5">
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">Total</span>
              <span className="text-xs font-black text-slate-900">{totalCount}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> With Photo
              </span>
              <span className="text-xs font-black text-emerald-800">{withPhotoCount}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-amber-200 bg-amber-50/30 shadow-xs flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-600" /> Missing
              </span>
              <span className="text-xs font-black text-amber-800">{missingCount}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-center">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-0.5">
                <span>Coverage</span>
                <span className="text-indigo-600 font-black">{coveragePercent}%</span>
              </div>
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bulk Dropzone (Conditional) */}
          {bulkMode && (
            <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-indigo-600" /> Auto-Match Photos by Roll #
                  </h4>
                  <p className="text-[10px] text-indigo-700">
                    Files named like <code>101.jpg</code> match student roll numbers automatically.
                  </p>
                </div>
                <button
                  onClick={() => bulkFileInputRef.current?.click()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm transition shrink-0 flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" /> Select Photos
                </button>
              </div>

              {bulkProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-indigo-900">
                    <span>Processing: {bulkProgress.done + bulkProgress.failed} / {bulkProgress.total}</span>
                    <span>{bulkProgress.done} updated, {bulkProgress.failed} skipped</span>
                  </div>
                  <div className="max-h-20 overflow-y-auto bg-white rounded-lg p-1.5 border border-indigo-200 font-mono text-[9px] text-slate-700 space-y-0.5">
                    {bulkLogs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search & Filter - Compact */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <div className="relative flex-1">
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search roll # or name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-6 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200 shrink-0">
              <button
                onClick={() => setFilterType('all')}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-bold rounded-md transition',
                  filterType === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setFilterType('missing')}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-bold rounded-md transition',
                  filterType === 'missing' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                Missing ({missingCount})
              </button>
              <button
                onClick={() => setFilterType('has_photo')}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-bold rounded-md transition',
                  filterType === 'has_photo' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                Done ({withPhotoCount})
              </button>
            </div>
          </div>
        </div>

        {/* Student Roster List - Maximum Height on Mobile */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-5 divide-y divide-slate-100">
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">Loading student roster...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-14 text-center text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">No students match current filter</p>
            </div>
          ) : (
            filteredStudents.map(student => {
              const isUploading = uploadingStudentId === student.id;
              const statusMsg = uploadStatusMsg?.studentId === student.id ? uploadStatusMsg : null;

              return (
                <div
                  key={student.id}
                  className="py-2 px-1 sm:px-2 flex items-center justify-between gap-2 hover:bg-slate-50/80 rounded-xl transition"
                >
                  {/* Left: Thumbnail & Student Info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="relative group shrink-0">
                      {student.photograph_url ? (
                        <img
                          src={student.photograph_url}
                          alt={student.full_name}
                          className="w-10 h-12 sm:w-11 sm:h-13 rounded-lg object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <div className="w-10 h-12 sm:w-11 sm:h-13 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="w-3.5 h-3.5 opacity-40 mb-0.5" />
                          <span className="text-[7px] font-black uppercase text-slate-400">Empty</span>
                        </div>
                      )}

                      {student.photograph_url && (
                        <button
                          onClick={() => setPreviewStudent(student)}
                          className="absolute inset-0 bg-slate-900/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition"
                          title="Preview full photo"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                          Roll #{student.roll_number || 'N/A'}
                        </span>
                        {student.photograph_url ? (
                          <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200 flex items-center gap-0.5">
                            <Check className="w-2 h-2" /> Added
                          </span>
                        ) : (
                          <span className="text-[8px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-full border border-amber-200">
                            Missing
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate mt-0.5">
                        {student.full_name}
                      </h4>

                      {/* Status / Compression Message */}
                      {statusMsg && (
                        <p
                          className={cn(
                            'text-[9px] font-bold mt-0.5 flex items-center gap-1',
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
                  </div>

                  {/* Right: Camera vs Gallery Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isUploading ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 px-2 py-1 bg-indigo-50 rounded-lg">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span className="hidden xs:inline">Saving...</span>
                      </div>
                    ) : (
                      <>
                        {/* Snap with Camera */}
                        <button
                          onClick={() => handlePickCamera(student.id)}
                          className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95"
                          title="Snap with mobile camera"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Camera</span>
                        </button>

                        {/* Pick from Gallery */}
                        <button
                          onClick={() => handlePickGallery(student.id)}
                          className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95"
                          title="Pick from mobile gallery or files"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="hidden sm:inline">Gallery</span>
                        </button>

                        {/* Remove Photo */}
                        {student.photograph_url && (
                          <button
                            onClick={() => handleRemovePhoto(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Strictly &lt; 20 KB (WebP/JPEG)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition text-xs"
          >
            Close
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
