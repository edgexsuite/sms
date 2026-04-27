import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Upload, Download, MoreVertical, Camera } from 'lucide-react';
import Papa from 'papaparse';
import { exportToCSV } from '../lib/exportUtils';
import { uploadFile } from '../lib/uploadUtils';
import DeletePinModal from '../components/DeletePinModal';
import { ShieldAlert, Trash2, Users, CheckCircle, X } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  roll_number: number;
  b_form_cnic: string;
  status: string;
  admission_date: string;
  [key: string]: any;
}

export default function Students() {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [promoteCurrentClass, setPromoteCurrentClass] = useState('');
  const [promoteTargetClass, setPromoteTargetClass] = useState('');
  const [promoteSelectedStudents, setPromoteSelectedStudents] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLeavingCertModalOpen, setIsLeavingCertModalOpen] = useState(false);
  const [photographFile, setPhotographFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkClassOpen, setIsBulkClassOpen] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [bulkTargetClass, setBulkTargetClass] = useState('');

  const [formData, setFormData] = useState({
    // Student Details
    full_name: '',
    b_form_cnic: '',
    dob: '',
    gender: '',
    blood_group: '',
    address: '',
    religion: '',
    nationality: '',
    class_id: '',
    
    // Parent Details
    parent_id: '',
    father_name: '',
    father_cnic: '',
    father_contact: '',
    father_occupation: '',
    mother_name: '',
    mother_cnic: '',
    mother_contact: '',
    mother_occupation: '',
    
    // Siblings
    siblings_in_school: '',
    
    // Physical & Medical
    height: '',
    weight: '',
    eyesight: '',
    medical_issues: '',
  });

  useEffect(() => {
    if (userRole?.school_id) {
      fetchStudents();
      fetchParents();
      fetchClasses();
    }
  }, [userRole]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', userRole?.school_id || '')
        .order('name');
      if (!error && data) {
        setClasses(data);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchParents = async () => {
    try {
      const { data, error } = await supabase
        .from('parents')
        .select('id, full_name, cnic')
        .eq('school_id', userRole?.school_id || '');
      if (!error && data) {
        setParents(data);
      }
    } catch (error) {
      console.error('Error fetching parents:', error);
    }
  };

  const fetchStudents = async () => {
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
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;

    try {
      const { data: inserted, error } = await supabase.from('students').insert([
        {
          school_id: userRole.school_id,
          parent_id: formData.parent_id || null,
          class_id: formData.class_id || null,
          full_name: formData.full_name,
          b_form_cnic: formData.b_form_cnic,
          dob: formData.dob || null,
          gender: formData.gender || null,
          blood_group: formData.blood_group || null,
          address: formData.address || null,
          religion: formData.religion || null,
          nationality: formData.nationality || null,
          father_name: formData.father_name || null,
          father_cnic: formData.father_cnic || null,
          father_contact: formData.father_contact || null,
          father_occupation: formData.father_occupation || null,
          mother_name: formData.mother_name || null,
          mother_cnic: formData.mother_cnic || null,
          mother_contact: formData.mother_contact || null,
          mother_occupation: formData.mother_occupation || null,
          siblings_in_school: formData.siblings_in_school || null,
          height: formData.height || null,
          weight: formData.weight || null,
          eyesight: formData.eyesight || null,
          medical_issues: formData.medical_issues || null,
          status: 'active',
        },
      ]).select('id');

      if (error) throw error;

      // Upload photo if selected
      if (photographFile && inserted?.[0]?.id) {
        try {
          const photoUrl = await uploadFile(`${userRole.school_id}/students/${inserted[0].id}`, photographFile);
          await supabase.from('students').update({ photograph_url: photoUrl }).eq('id', inserted[0].id);
        } catch (_) { /* Photo upload failure is non-fatal */ }
      }

      setIsAddModalOpen(false);
      setPhotographFile(null);
      setPhotoPreview(null);
      setFormData({
        full_name: '', b_form_cnic: '', dob: '', gender: '', blood_group: '', address: '', religion: '', nationality: '', class_id: '',
        parent_id: '', father_name: '', father_cnic: '', father_contact: '', father_occupation: '',
        mother_name: '', mother_cnic: '', mother_contact: '', mother_occupation: '',
        siblings_in_school: '', height: '', weight: '', eyesight: '', medical_issues: ''
      });
      fetchStudents();
    } catch (error: any) {
      alert(error.message || 'Error adding student. Please ensure your database schema is updated to accept all fields.');
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userRole?.school_id) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const newStudents = results.data.map((row: any) => ({
            school_id: userRole.school_id,
            full_name: row.full_name,
            b_form_cnic: row.b_form_cnic,
            dob: row.dob || null,
            status: 'active',
          }));

          const { error } = await supabase.from('students').insert(newStudents);
          if (error) throw error;
          
          alert('Students imported successfully!');
          fetchStudents();
        } catch (error: any) {
          alert('Error importing CSV: ' + error.message);
        }
      },
    });
  };

  const handlePromoteStudents = async () => {
    if (!userRole?.school_id || !promoteTargetClass || promoteSelectedStudents.length === 0) return;
    
    try {
      const { error } = await supabase
        .from('students')
        .update({ class_id: promoteTargetClass })
        .in('id', promoteSelectedStudents);

      if (error) throw error;
      
      alert('Students promoted successfully!');
      setIsPromoteModalOpen(false);
      setPromoteCurrentClass('');
      setPromoteTargetClass('');
      setPromoteSelectedStudents([]);
      fetchStudents();
    } catch (error: any) {
      alert('Error promoting students: ' + error.message);
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
        .delete()
        .in('id', selectedIds);
      if (error) throw error;
      alert(`Permanently deleted ${selectedIds.length} students.`);
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) || 
      s.b_form_cnic?.includes(search) ||
      s.roll_number.toString().includes(search);
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExport = () => {
    exportToCSV('students_list', filteredStudents, [
      { header: 'Roll No', key: 'roll_number' },
      { header: 'Full Name', key: 'full_name' },
      { header: 'B-Form / CNIC', key: 'b_form_cnic' },
      { header: 'Admission Date', key: (row) => new Date(row.admission_date).toLocaleDateString() },
      { header: 'Status', key: 'status' }
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        
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
              <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Import CSV</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
              </label>

              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Student</span>
              </button>
              
              <button 
                onClick={() => setIsPromoteModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
              >
                <span className="hidden sm:inline">Promote Students</span>
              </button>
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
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length > 0 && selectedIds.length === filteredStudents.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filteredStudents.map(s => s.id));
                      else setSelectedIds([]);
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="p-4 font-medium text-sm text-gray-600 w-12"></th>
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
                    className={`hover:bg-gray-50 cursor-pointer ${selectedIds.includes(student.id) ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds([...selectedIds, student.id]);
                          else setSelectedIds(selectedIds.filter(id => id !== student.id));
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-4">
                      {student.photograph_url
                        ? <img src={student.photograph_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                        : <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">{student.full_name.charAt(0).toUpperCase()}</div>}
                    </td>
                    <td className="p-4 text-sm text-gray-900 font-medium">{student.roll_number}</td>
                    <td className="p-4 text-sm text-gray-900">{student.full_name}</td>
                    <td className="p-4 text-sm text-gray-500">{student.classes ? `${student.classes.name} (${student.classes.section})` : '-'}</td>
                    <td className="p-4 text-sm text-gray-500">{student.b_form_cnic || '-'}</td>
                    <td className="p-4 text-sm text-gray-500">{new Date(student.admission_date).toLocaleDateString()}</td>
                    <td className="p-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-right" onClick={(e) => e.stopPropagation()}>
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-5 h-5" />
                      </button>
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
              {selectedStudent.photograph_url && (
                <div className="flex justify-center">
                  <img src={selectedStudent.photograph_url} className="w-24 h-24 rounded-full object-cover border-4 border-gray-100 shadow" alt={selectedStudent.full_name} />
                </div>
              )}
              <div>
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2 mb-3">Personal Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
                        className="ml-2 px-2 py-1 border border-gray-300 rounded-md text-sm font-medium capitalize"
                      >
                        <option value="active">Active</option>
                        <option value="left">Left</option>
                        <option value="graduated">Graduated</option>
                      </select>
                    ) : (
                      <span className="font-medium capitalize">{selectedStudent.status}</span>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Father's Name:</span> <span className="font-medium">{selectedStudent.father_name || '-'}</span></div>
                  <div><span className="text-gray-500">Father's Contact:</span> <span className="font-medium">{selectedStudent.father_contact || '-'}</span></div>
                  <div><span className="text-gray-500">Mother's Name:</span> <span className="font-medium">{selectedStudent.mother_name || '-'}</span></div>
                  <div><span className="text-gray-500">Mother's Contact:</span> <span className="font-medium">{selectedStudent.mother_contact || '-'}</span></div>
                </div>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-800 border-b pb-2 mb-3">Medical & Other</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Height:</span> <span className="font-medium">{selectedStudent.height || '-'}</span></div>
                  <div><span className="text-gray-500">Weight:</span> <span className="font-medium">{selectedStudent.weight || '-'}</span></div>
                  <div><span className="text-gray-500">Eyesight:</span> <span className="font-medium">{selectedStudent.eyesight || '-'}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Medical Issues:</span> <span className="font-medium">{selectedStudent.medical_issues || '-'}</span></div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between shrink-0 bg-gray-50 rounded-b-xl">
              {userRole?.role === 'admin' ? (
                <button
                  onClick={() => setIsLeavingCertModalOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                >
                  Generate Leaving Certificate
                </button>
              ) : (
                <div />
              )}
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

      {/* Leaving Certificate Modal */}
      {isLeavingCertModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0 print:hidden">
              <h3 className="text-lg font-bold text-gray-900">School Leaving Certificate</h3>
              <button onClick={() => setIsLeavingCertModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-8 bg-gray-50 print:bg-white print:p-0">
              <div id="printable-certificate" className="bg-white p-12 border-4 border-double border-gray-800 mx-auto max-w-3xl shadow-sm print:shadow-none print:border-none">
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-serif font-bold text-gray-900 uppercase tracking-wider">School Leaving Certificate</h1>
                  <div className="w-64 h-1 bg-gray-800 mx-auto mt-4 mb-2"></div>
                  <p className="text-gray-600 italic">This is to certify that</p>
                </div>
                
                <div className="space-y-6 text-lg leading-relaxed">
                  <p>
                    <span className="font-semibold">Name of Pupil:</span> <span className="border-b border-gray-400 border-dashed pb-1 px-4 inline-block min-w-[300px]">{selectedStudent.full_name}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Father's Name:</span> <span className="border-b border-gray-400 border-dashed pb-1 px-4 inline-block min-w-[300px]">{selectedStudent.father_name || '_________________________'}</span>
                  </p>
                  <div className="flex gap-8">
                    <p className="flex-1">
                      <span className="font-semibold">Roll No:</span> <span className="border-b border-gray-400 border-dashed pb-1 px-4 inline-block min-w-[150px]">{selectedStudent.roll_number}</span>
                    </p>
                    <p className="flex-1">
                      <span className="font-semibold">Admission Date:</span> <span className="border-b border-gray-400 border-dashed pb-1 px-4 inline-block min-w-[150px]">{new Date(selectedStudent.admission_date).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <p>
                    <span className="font-semibold">Date of Birth:</span> <span className="border-b border-gray-400 border-dashed pb-1 px-4 inline-block min-w-[300px]">{selectedStudent.dob ? new Date(selectedStudent.dob).toLocaleDateString() : '_________________________'}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Class Last Attended:</span> <span className="border-b border-gray-400 border-dashed pb-1 px-4 inline-block min-w-[300px]">{selectedStudent.classes ? `${selectedStudent.classes.name} (${selectedStudent.classes.section})` : '_________________________'}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Reason for Leaving:</span> <span className="border-b border-gray-400 border-dashed pb-1 px-4 inline-block min-w-[300px]">_________________________</span>
                  </p>
                  <p>
                    <span className="font-semibold">Conduct & Character:</span> <span className="border-b border-gray-400 border-dashed pb-1 px-4 inline-block min-w-[300px]">Good</span>
                  </p>
                </div>

                <div className="mt-24 flex justify-between items-end">
                  <div className="text-center">
                    <div className="w-48 border-t border-gray-800 pt-2">
                      <p className="font-semibold">Date of Issue</p>
                      <p className="text-sm text-gray-600">{new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="w-48 border-t border-gray-800 pt-2">
                      <p className="font-semibold">Principal's Signature</p>
                      <p className="text-sm text-gray-600">School Seal</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0 bg-gray-50 rounded-b-xl print:hidden">
              <button
                type="button"
                onClick={() => setIsLeavingCertModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Print Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote Students Modal */}
      {isPromoteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Promote Students</h3>
              <button onClick={() => setIsPromoteModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Class</label>
                  <select 
                    value={promoteCurrentClass} 
                    onChange={(e) => {
                      setPromoteCurrentClass(e.target.value);
                      // Auto-select all active students in this class
                      const studentsInClass = students.filter(s => s.class_id === e.target.value && s.status === 'active');
                      setPromoteSelectedStudents(studentsInClass.map(s => s.id));
                    }} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Current Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.section ? `(Sec ${c.section})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Class</label>
                  <select 
                    value={promoteTargetClass} 
                    onChange={(e) => setPromoteTargetClass(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Target Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.section ? `(Sec ${c.section})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {promoteCurrentClass && (
                <div>
                  <h4 className="text-md font-semibold text-gray-800 mb-3">Select Students to Promote</h4>
                  <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="p-3 w-12 text-center">
                            <input 
                              type="checkbox" 
                              checked={promoteSelectedStudents.length > 0 && promoteSelectedStudents.length === students.filter(s => s.class_id === promoteCurrentClass && s.status === 'active').length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPromoteSelectedStudents(students.filter(s => s.class_id === promoteCurrentClass && s.status === 'active').map(s => s.id));
                                } else {
                                  setPromoteSelectedStudents([]);
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          <th className="p-3 font-medium text-gray-600">Roll No</th>
                          <th className="p-3 font-medium text-gray-600">Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {students.filter(s => s.class_id === promoteCurrentClass && s.status === 'active').map(student => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="p-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={promoteSelectedStudents.includes(student.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setPromoteSelectedStudents([...promoteSelectedStudents, student.id]);
                                  } else {
                                    setPromoteSelectedStudents(promoteSelectedStudents.filter(id => id !== student.id));
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-3">{student.roll_number}</td>
                            <td className="p-3">{student.full_name}</td>
                          </tr>
                        ))}
                        {students.filter(s => s.class_id === promoteCurrentClass && s.status === 'active').length === 0 && (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-gray-500">No active students found in this class.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setIsPromoteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePromoteStudents}
                disabled={!promoteTargetClass || promoteSelectedStudents.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Promote Selected ({promoteSelectedStudents.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Student Admission Form</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form id="add-student-form" onSubmit={handleAddStudent}>
                
                {/* Section 1: Student Details */}
              <div className="mb-8">
                <h4 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">1. Student Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input type="text" required value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">B-Form / CNIC</label>
                    <input type="text" value={formData.b_form_cnic} onChange={(e) => setFormData({...formData, b_form_cnic: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input type="date" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                    <input type="text" placeholder="e.g., O+" value={formData.blood_group} onChange={(e) => setFormData({...formData, blood_group: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Religion</label>
                    <input type="text" value={formData.religion} onChange={(e) => setFormData({...formData, religion: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                    <input type="text" value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class Assignment</label>
                    <select value={formData.class_id} onChange={(e) => setFormData({...formData, class_id: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Select Class</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.section ? `(Sec ${c.section})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Residential Address</label>
                    <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </div>
              </div>

              {/* Section 2: Parent Details */}
              <div className="mb-8">
                <h4 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">2. Parent Details</h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link to Parent Profile (Optional)</label>
                  <select 
                    value={formData.parent_id} 
                    onChange={(e) => setFormData({...formData, parent_id: e.target.value})} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Select Parent --</option>
                    {parents.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.cnic})</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Linking a parent allows them to access the Parent Portal.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Father Details */}
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <h5 className="font-medium text-gray-700">Father's Information</h5>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
                      <input type="text" value={formData.father_name} onChange={(e) => setFormData({...formData, father_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Father's CNIC</label>
                      <input type="text" value={formData.father_cnic} onChange={(e) => setFormData({...formData, father_cnic: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Father's Contact Number</label>
                      <input type="text" value={formData.father_contact} onChange={(e) => setFormData({...formData, father_contact: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Father's Occupation</label>
                      <input type="text" value={formData.father_occupation} onChange={(e) => setFormData({...formData, father_occupation: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                  
                  {/* Mother Details */}
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <h5 className="font-medium text-gray-700">Mother's Information</h5>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Name</label>
                      <input type="text" value={formData.mother_name} onChange={(e) => setFormData({...formData, mother_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mother's CNIC</label>
                      <input type="text" value={formData.mother_cnic} onChange={(e) => setFormData({...formData, mother_cnic: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Contact Number</label>
                      <input type="text" value={formData.mother_contact} onChange={(e) => setFormData({...formData, mother_contact: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Occupation</label>
                      <input type="text" value={formData.mother_occupation} onChange={(e) => setFormData({...formData, mother_occupation: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Siblings & Medical */}
              <div className="mb-8">
                <h4 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">3. Additional Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Siblings studying in this school (Names / Roll Nos)</label>
                    <input type="text" value={formData.siblings_in_school} onChange={(e) => setFormData({...formData, siblings_in_school: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                    <input type="text" placeholder="e.g., 120 cm" value={formData.height} onChange={(e) => setFormData({...formData, height: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                    <input type="text" placeholder="e.g., 30 kg" value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Eyesight (L/R)</label>
                    <input type="text" placeholder="e.g., 6/6" value={formData.eyesight} onChange={(e) => setFormData({...formData, eyesight: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Medical Issues / Allergies (if any)</label>
                    <textarea value={formData.medical_issues} onChange={(e) => setFormData({...formData, medical_issues: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" rows={2}></textarea>
                  </div>
                </div>
              </div>

              {/* Section 4: Photo */}
              <div className="mb-4">
                <h4 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">4. Student Photo (Optional)</h4>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                    {photoPreview
                      ? <img src={photoPreview} className="w-full h-full object-cover" alt="Preview" />
                      : <Camera className="w-7 h-7 text-gray-300" />}
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> Choose photo
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const f = e.target.files?.[0] || null;
                        setPhotographFile(f);
                        setPhotoPreview(f ? URL.createObjectURL(f) : null);
                      }} />
                    </label>
                    <p className="text-xs text-gray-400 mt-1">JPG or PNG, max 2 MB</p>
                  </div>
                </div>
              </div>

              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => { setIsAddModalOpen(false); setPhotographFile(null); setPhotoPreview(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-student-form"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Save Student
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Action Floating Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-8 z-[70] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 border-r border-gray-700 pr-6">
            <div className="bg-blue-600 p-2 rounded-full">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">{selectedIds.length} Selected</p>
              <button 
                onClick={() => setSelectedIds([])}
                className="text-[10px] text-gray-400 hover:text-white uppercase tracking-widest font-bold mt-1"
              >
                Clear Selection
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsBulkStatusOpen(true)}
              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-full transition-colors text-sm font-medium"
            >
              <CheckCircle className="w-4 h-4 text-green-400" /> Update Status
            </button>
            <button 
              onClick={() => setIsBulkClassOpen(true)}
              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-full transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4 text-blue-400" /> Move Class
            </button>
            <button 
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 hover:bg-red-900/40 text-red-400 rounded-full transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Bulk Status Modal */}
      {isBulkStatusOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Update Status: {selectedIds.length} Students</h3>
              <button onClick={() => setIsBulkStatusOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-4">
              <p className="text-sm text-gray-500">Select the new status for all selected students:</p>
              <div className="grid grid-cols-1 gap-2">
                {['active', 'left', 'graduated'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleBulkStatusUpdate(status)}
                    className="w-full px-4 py-3 text-left rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all capitalize font-medium flex items-center justify-between group"
                  >
                    {status}
                    <CheckCircle className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Class Modal */}
      {isBulkClassOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Move Class: {selectedIds.length} Students</h3>
              <button onClick={() => setIsBulkClassOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-4">
              <label className="block text-sm font-medium text-gray-700">Target Class</label>
              <select 
                value={bulkTargetClass} 
                onChange={(e) => setBulkTargetClass(e.target.value)} 
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="">Select Target Class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.section ? `(Sec ${c.section})` : ''}</option>
                ))}
              </select>
              <button
                onClick={handleBulkClassUpdate}
                disabled={!bulkTargetClass}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all mt-4"
              >
                Apply Reallocation
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
          onClose={() => setIsBulkDeleteModalOpen(false)}
          itemName={`${selectedIds.length} Student Records`}
        />
      )}
    </div>
  );
}

