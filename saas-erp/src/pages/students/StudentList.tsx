import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Upload, Download, MoreVertical, ShieldCheck, Eye, Trash2 } from 'lucide-react';
import DeletePinModal from '../../components/DeletePinModal';
import Papa from 'papaparse';
import { exportToExcel } from '../../lib/exportUtils';
import { Link } from 'react-router-dom';

interface Student {
  id: string;
  full_name: string;
  roll_number: number;
  b_form_cnic: string;
  status: string;
  admission_date: string;
  [key: string]: any;
}

export default function StudentList() {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Import Modal State
  const [classes, setClasses] = useState<any[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importClassId, setImportClassId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });

  useEffect(() => {
    if (userRole?.school_id) {
      fetchStudents();
      fetchClasses();
    }
  }, [userRole]);

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
          return;
        }
      } else {
        query = query.eq('school_id', userRole?.school_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStudents(data || []);
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
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString() 
        })
        .eq('id', deleteModal.id);
        
      if (error) throw error;
      fetchStudents();
    } catch (error: any) {
      alert('Error moving student to trash: ' + error.message);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) || 
      (s.b_form_cnic && s.b_form_cnic.includes(search)) ||
      (s.roll_number && s.roll_number.toString().includes(search));
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExport = () => {
    exportToExcel('students_list', filteredStudents, [
      { header: 'Roll No', key: 'roll_number' },
      { header: 'Full Name', key: 'full_name' },
      { header: 'Class', key: (row) => row.classes ? `${row.classes.name} (${row.classes.section})` : '-' },
      { header: 'B-Form / CNIC', key: 'b_form_cnic' },
      { header: 'Date of Birth', key: (row) => row.dob ? new Date(row.dob).toLocaleDateString() : '-' },
      { header: 'Gender', key: (row) => row.gender || '-' },
      { header: 'Blood Group', key: (row) => row.blood_group || '-' },
      { header: 'Religion', key: (row) => row.religion || '-' },
      { header: 'Nationality', key: (row) => row.nationality || '-' },
      { header: 'Address', key: (row) => row.address || '-' },
      { header: 'Father Name', key: (row) => row.father_name || '-' },
      { header: 'Father Contact', key: (row) => row.father_contact || '-' },
      { header: 'Mother Name', key: (row) => row.mother_name || '-' },
      { header: 'Mother Contact', key: (row) => row.mother_contact || '-' },
      { header: 'Medical Issues', key: (row) => row.medical_issues || '-' },
      { header: 'Admission Date', key: (row) => row.admission_date ? new Date(row.admission_date).toLocaleDateString() : '-' },
      { header: 'Status', key: 'status' }
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Student List</h1>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="left">Left</option>
            <option value="graduated">Graduated</option>
          </select>
          
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {userRole?.role === 'admin' && (
            <>
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Import Data</span>
              </button>

              <Link 
                to="/students/register"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Register New Student
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-medium text-sm text-gray-600">Roll No</th>
                <th className="p-4 font-medium text-sm text-gray-600">Full Name</th>
                <th className="p-4 font-medium text-sm text-gray-600">Class</th>
                <th className="p-4 font-medium text-sm text-gray-600">B-Form / CNIC</th>
                <th className="p-4 font-medium text-sm text-gray-600">Admission Date</th>
                <th className="p-4 font-medium text-sm text-gray-600">Status</th>
                <th className="p-4 font-medium text-sm text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">Loading students...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">No students found.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr 
                    key={student.id} 
                    className="hover:bg-gray-50"
                  >
                    <td className="p-4 text-sm text-gray-900 font-medium">{student.roll_number}</td>
                    <td className="p-4 text-sm text-gray-900">{student.full_name}</td>
                    <td className="p-4 text-sm text-gray-500">{student.classes ? `${student.classes.name} (${student.classes.section})` : '-'}</td>
                    <td className="p-4 text-sm text-gray-500">{student.b_form_cnic || '-'}</td>
                    <td className="p-4 text-sm text-gray-500">{new Date(student.admission_date).toLocaleDateString()}</td>
                    <td className="p-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelectedStudent(student)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors">
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button onClick={() => setDeleteModal({ isOpen: true, id: student.id, name: student.full_name })} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Student Details</h3>
              <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              <div>
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2 mb-3">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Full Name:</span> <span className="font-medium">{selectedStudent.full_name}</span></div>
                  <div><span className="text-gray-500">Roll No:</span> <span className="font-medium">{selectedStudent.roll_number}</span></div>
                  <div><span className="text-gray-500">Class:</span> <span className="font-medium">{selectedStudent.classes ? `${selectedStudent.classes.name} (${selectedStudent.classes.section})` : '-'}</span></div>
                  <div><span className="text-gray-500">B-Form / CNIC:</span> <span className="font-medium">{selectedStudent.b_form_cnic || '-'}</span></div>
                  <div>
                    <span className="text-gray-500">Status:</span>{' '}
                    {userRole?.role === 'admin' ? (
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
                          } catch (error: any) {
                            alert('Error updating status: ' + error.message);
                          }
                        }}
                        className="ml-2 px-2 py-1 border border-gray-300 rounded-md text-sm font-medium capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="left">Left</option>
                        <option value="graduated">Graduated</option>
                      </select>
                    ) : (
                      <span className="font-medium capitalize">{selectedStudent.status}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Fee Waiver (%):</span>{' '}
                    {userRole?.role === 'admin' ? (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={selectedStudent.fee_waiver_percentage || 0}
                        onChange={async (e) => {
                          const newVal = parseInt(e.target.value) || 0;
                          try {
                            const { error } = await supabase
                              .from('students')
                              .update({ fee_waiver_percentage: newVal })
                              .eq('id', selectedStudent.id);
                            if (error) throw error;
                            setSelectedStudent({ ...selectedStudent, fee_waiver_percentage: newVal });
                            fetchStudents();
                          } catch (error: any) {
                            alert('Error updating waiver: ' + error.message);
                          }
                        }}
                        className="ml-2 w-20 px-2 py-1 border border-gray-300 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="font-medium">{selectedStudent.fee_waiver_percentage || 0}%</span>
                    )}
                  </div>
                  <div><span className="text-gray-500">Date of Birth:</span> <span className="font-medium">{selectedStudent.dob ? new Date(selectedStudent.dob).toLocaleDateString() : '-'}</span></div>
                  <div><span className="text-gray-500">Gender:</span> <span className="font-medium">{selectedStudent.gender || '-'}</span></div>
                  <div><span className="text-gray-500">Blood Group:</span> <span className="font-medium">{selectedStudent.blood_group || '-'}</span></div>
                  <div><span className="text-gray-500">Religion:</span> <span className="font-medium">{selectedStudent.religion || '-'}</span></div>
                  <div><span className="text-gray-500">Nationality:</span> <span className="font-medium">{selectedStudent.nationality || '-'}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium">{selectedStudent.address || '-'}</span></div>
                </div>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2 mb-3">Parent Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Father's Name:</span> <span className="font-medium">{selectedStudent.father_name || '-'}</span></div>
                  <div><span className="text-gray-500">Father's Contact:</span> <span className="font-medium">{selectedStudent.father_contact || '-'}</span></div>
                  <div><span className="text-gray-500">Mother's Name:</span> <span className="font-medium">{selectedStudent.mother_name || '-'}</span></div>
                  <div><span className="text-gray-500">Mother's Contact:</span> <span className="font-medium">{selectedStudent.mother_contact || '-'}</span></div>
                </div>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2 mb-3">Medical & Other</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Height:</span> <span className="font-medium">{selectedStudent.height || '-'}</span></div>
                  <div><span className="text-gray-500">Weight:</span> <span className="font-medium">{selectedStudent.weight || '-'}</span></div>
                  <div><span className="text-gray-500">Eyesight:</span> <span className="font-medium">{selectedStudent.eyesight || '-'}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Medical Issues:</span> <span className="font-medium">{selectedStudent.medical_issues || '-'}</span></div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end shrink-0 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Import Students Data</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
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
                    <option key={cls.id} value={cls.id}>{cls.name} ({cls.section})</option>
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
    </div>
  );
}
