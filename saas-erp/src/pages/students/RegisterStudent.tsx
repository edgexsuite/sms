import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Save, AlertCircle, Plus, Trash2, Camera } from 'lucide-react';

// Generates an alphanumeric password of length 6
const generatePassword = () => Math.random().toString(36).slice(-6).toUpperCase();
const generateRandomNumber = () => Math.floor(1000 + Math.random() * 9000).toString();

const initialStudentState = {
  full_name: '', dob: '', gender: '', religion: '', hobbies: '',
  class_id: '', last_school: '', remarks: '', other_kids: '', reason_for_choosing: '',
  insurance_opt_in: false,
  eye_sight_normal: true, glasses_number: '', other_eye_disease: '',
  allergies: '', contagious_disease: '', medical_caution: '', photograph_url: '',
  custom_data: {} as Record<string, any>
};

export default function RegisterStudent() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Customization State
  const [sectionsConfig, setSectionsConfig] = useState({
    parent_info: true,
    admission_info: true,
    medical_info: true,
    insurance_info: true
  });
  const [customFields, setCustomFields] = useState<any[]>([]);

  // Parent/Family State
  const [parentData, setParentData] = useState({
    father_name: '', father_occupation: '', father_qualification: '',
    mother_name: '', mother_occupation: '', mother_qualification: '',
    nationality: '', home_address: '',
    father_mobile: '', mother_mobile: '', emergency_mobile: '',
    home_telephone: '', office_telephone: '', email: '',
    custom_data: {} as Record<string, any>
  });

  // Dynamic Array for Siblings
  const [students, setStudents] = useState([{ ...initialStudentState, custom_data: {} as Record<string, any> }]);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchClasses();
      fetchFormConfig();
    }
  }, [userRole]);

  const fetchClasses = async () => {
    try {
      const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id || '').order('name');
      if (data) setClasses(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFormConfig = async () => {
    try {
      // 1. Fetch Toggles
      const { data: configData } = await supabase
        .from('form_settings')
        .select('sections_config')
        .eq('school_id', userRole?.school_id)
        .eq('form_name', 'student_admission')
        .single();

      if (configData && configData.sections_config) {
        setSectionsConfig({ ...sectionsConfig, ...configData.sections_config });
      }

      // 2. Fetch Custom Fields
      const { data: fieldsData } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .eq('form_name', 'student_admission')
        .order('created_at', { ascending: true });

      if (fieldsData) {
        setCustomFields(fieldsData.map(d => ({
          ...d,
          options: Array.isArray(d.options)
            ? d.options
            : typeof d.options === 'string'
              ? JSON.parse(d.options)
              : [],
        })));
      }
    } catch (err) {
      console.error('Error fetching form config:', err);
    }
  };

  const handleParentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setParentData({ ...parentData, [e.target.name]: e.target.value });
  };

  const handleParentCustomChange = (label: string, value: any) => {
    setParentData({ ...parentData, custom_data: { ...parentData.custom_data, [label]: value } });
  };

  const handleStudentChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const updatedStudents = [...students];
    const { name, value, type } = e.target;
    // @ts-ignore
    updatedStudents[index][name] = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setStudents(updatedStudents);
  };

  const handleStudentCustomChange = (index: number, label: string, value: any) => {
    const updatedStudents = [...students];
    updatedStudents[index].custom_data = { ...updatedStudents[index].custom_data, [label]: value };
    setStudents(updatedStudents);
  };

  const addStudent = () => setStudents([...students, { ...initialStudentState, custom_data: {} as Record<string, any> }]);
  const removeStudent = (index: number) => setStudents(students.filter((_, i) => i !== index));

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;
    setLoading(true);
    setError('');

    try {
      const suffix = generateRandomNumber(); 
      const fatherNamePart = (parentData.father_name || parentData.mother_name || 'Parent').trim().split(' ')[0] || 'User';
      const familyNumber = `${fatherNamePart}${suffix}`;
      const parentPassword = generatePassword();
      
      const { data: parentResult, error: parentError } = await supabase.from('parents').insert([{
        school_id: userRole.school_id,
        family_number: familyNumber,
        auth_password: parentPassword,
        full_name: parentData.father_name || parentData.mother_name || 'Parent',
        father_name: parentData.father_name,
        mother_name: parentData.mother_name,
        father_qualification: parentData.father_qualification,
        mother_qualification: parentData.mother_qualification,
        father_occupation: parentData.father_occupation,
        mother_occupation: parentData.mother_occupation,
        whatsapp_number: parentData.father_mobile, 
        emergency_mobile: parentData.emergency_mobile,
        home_telephone: parentData.home_telephone,
        office_telephone: parentData.office_telephone,
        email: parentData.email,
        address: parentData.home_address,
        custom_data: parentData.custom_data // JSONB inject
      }]).select().single();

      if (parentError) throw parentError;
      const parentId = parentResult.id;

      const studentInserts = students.map((stu, idx) => {
        const studentNamePart = (stu.full_name || 'Student').trim().split(' ')[0];
        const suffix = `${familyNumber.replace(/\D/g, '').slice(-4)}${idx + 1}`;
        const studentUniqueId = `${studentNamePart}${suffix}`;
        const studentPassword = generatePassword();

        return {
          school_id: userRole.school_id,
          parent_id: parentId,
          class_id: stu.class_id || null,
          student_unique_id: studentUniqueId,
          auth_password: studentPassword,
          full_name: stu.full_name,
          gender: stu.gender || null,
          dob: stu.dob || null,
          religion: stu.religion || null,
          hobbies: stu.hobbies || null,
          nationality: parentData.nationality || null,
          address: parentData.home_address || null,
          last_school: stu.last_school || null,
          remarks: stu.remarks || null,
          reason_for_choosing: stu.reason_for_choosing || null,
          insurance_opt_in: stu.insurance_opt_in,
          eye_sight_normal: stu.eye_sight_normal,
          glasses_number: stu.glasses_number || null,
          other_eye_disease: stu.other_eye_disease || null,
          allergies: stu.allergies || null,
          contagious_disease: stu.contagious_disease || null,
          medical_caution: stu.medical_caution || null,
          roll_number: Math.floor(10000 + Math.random() * 90000),
          fee_waiver_percentage: 0,
          status: 'active',
          custom_data: stu.custom_data // JSONB inject
        };
      });

      const { error: studentError } = await supabase.from('students').insert(studentInserts);
      if (studentError) throw studentError;

      alert(`Success! Family Account Created: \nUsername: ${familyNumber}\nPassword: ${parentPassword}\n(You can access these credentials in the Dispatch Module)`);
      navigate('/students');

    } catch (err: any) {
      setError(err.message || 'Error processing admission form.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to render dynamic custom fields loop
  const renderCustomFields = (sectionName: string, isParent: boolean, studentIndex?: number) => {
    const fields = customFields.filter(f => f.section_name === sectionName);
    if (!fields.length) return null;

    return fields.map(field => {
      const value = isParent 
        ? parentData.custom_data[field.field_label] || '' 
        : students[studentIndex!]?.custom_data[field.field_label] || '';
        
      const onChange = (e: any) => {
        const val = field.field_type === 'checkbox' ? e.target.checked : e.target.value;
        if (isParent) handleParentCustomChange(field.field_label, val);
        else handleStudentCustomChange(studentIndex!, field.field_label, val);
      };

      return (
        <div key={field.id} className={field.field_type === 'checkbox' ? 'col-span-2 flex items-center mt-6' : ''}>
          {field.field_type !== 'checkbox' && (
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.field_label} {field.is_required && '*'}
            </label>
          )}

          {field.field_type === 'text' && (
            <input type="text" required={field.is_required} value={value} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
          )}

          {field.field_type === 'number' && (
            <input type="number" required={field.is_required} value={value} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
          )}

          {field.field_type === 'select' && (
            <select required={field.is_required} value={value} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 bg-white">
              <option value="">-- Select --</option>
              {field.options.map((opt: string, i: number) => <option key={i} value={opt}>{opt}</option>)}
            </select>
          )}

          {field.field_type === 'checkbox' && (
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={!!value} onChange={onChange} required={field.is_required} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
              {field.field_label} {field.is_required && '*'}
            </label>
          )}
        </div>
      );
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Student Admission Form</h1>
        <button onClick={() => navigate('/students')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleAddSubmit} className="space-y-6">

        {/* --- PARENT/FAMILY BLOCK --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-800 px-6 py-4">
            <h2 className="text-lg font-semibold text-white tracking-wide">Family & Contact Information</h2>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label><input type="text" name="father_name" value={parentData.father_name} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Mother's Name</label><input type="text" name="mother_name" value={parentData.mother_name} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label><input type="text" name="nationality" value={parentData.nationality} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500" /></div>

              {sectionsConfig.parent_info && (
                <>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Father's Occupation</label><input type="text" name="father_occupation" value={parentData.father_occupation} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Mother's Occupation</label><input type="text" name="mother_occupation" value={parentData.mother_occupation} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Father's Qualification</label><input type="text" name="father_qualification" value={parentData.father_qualification} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Mother's Qualification</label><input type="text" name="mother_qualification" value={parentData.mother_qualification} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                </>
              )}

              {/* Always show contacts */}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Father Mobile</label><input type="text" name="father_mobile" value={parentData.father_mobile} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Mother Mobile</label><input type="text" name="mother_mobile" value={parentData.mother_mobile} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Emergency Mobile (SMS)</label><input type="text" name="emergency_mobile" value={parentData.emergency_mobile} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" name="email" value={parentData.email} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
              
              <div className="col-span-1 md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Home Address</label><input type="text" name="home_address" value={parentData.home_address} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>

              {/* Dynamic Parent Custom Fields */}
              {renderCustomFields('parent_info', true)}
            </div>
          </div>
        </div>

        {/* --- STUDENT BLOCKS ARRAY --- */}
        {students.map((student, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden relative">
            <div className="bg-blue-50 px-6 py-4 flex justify-between items-center border-b border-blue-100">
              <h2 className="text-lg font-semibold text-blue-900 tracking-wide">Child {index + 1} Admission Details</h2>
              {index > 0 && (
                <button type="button" onClick={() => removeStudent(index)} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-medium">
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              )}
            </div>
            
            <div className="p-8 space-y-8">
              {/* Personal Info */}
              <div>
                <h4 className="text-md border-b pb-2 mb-4 font-medium text-gray-800">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                      <input type="text" required name="full_name" value={student.full_name} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                      <input type="date" required name="dob" value={student.dob} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select name="gender" value={student.gender} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 bg-white">
                        <option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option>
                      </select>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Religion</label><input type="text" name="religion" value={student.religion} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    
                    {/* Dynamic Basic Custom Fields */}
                    {renderCustomFields('basic_info', false, index)}
                  </div>
                  
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 h-full">
                    <Camera className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500 font-medium whitespace-nowrap">Photograph</span>
                  </div>
                </div>
              </div>

              {/* Admission Info conditionally rendered */}
              {sectionsConfig.admission_info && (
                <div>
                  <h4 className="text-md border-b pb-2 mb-4 font-medium text-gray-800">Admission Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Class Sought For</label>
                      <select name="class_id" value={student.class_id} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white">
                        <option value="">-- Select Class --</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name} (Sec {c.section})</option>)}
                      </select>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Last School Attended</label><input type="text" name="last_school" value={student.last_school} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason for Choosing</label><input type="text" name="reason_for_choosing" value={student.reason_for_choosing} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                  </div>
                </div>
              )}

              {/* Medical Information conditionally rendered */}
              {sectionsConfig.medical_info && (
                <div>
                  <h4 className="text-md border-b pb-2 mb-4 font-medium text-gray-800 text-red-600">Medical Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-red-50 p-6 rounded-lg border border-red-100">
                    <div className="col-span-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Eye Sight normal (6/6)?</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-1 text-sm"><input type="radio" name={`eye_sight_${index}`} checked={student.eye_sight_normal} onChange={() => {
                            const updatedStudents = [...students];
                            updatedStudents[index].eye_sight_normal = true;
                            setStudents(updatedStudents);
                          }} className="text-blue-600" /> Yes</label>
                          <label className="flex items-center gap-1 text-sm"><input type="radio" name={`eye_sight_${index}`} checked={!student.eye_sight_normal} onChange={() => {
                            const updatedStudents = [...students];
                            updatedStudents[index].eye_sight_normal = false;
                            setStudents(updatedStudents);
                          }} className="text-blue-600" /> No</label>
                        </div>
                      </div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label><input type="text" name="allergies" value={student.allergies} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    
                    {/* Dynamic Medical Fields */}
                    {renderCustomFields('medical_info', false, index)}
                  </div>
                </div>
              )}

              {/* Insurance Opt in */}
              {sectionsConfig.insurance_info && (
                 <div className="col-span-2 flex items-center bg-gray-50 border border-gray-200 p-4 rounded-md">
                   <input type="checkbox" name="insurance_opt_in" checked={student.insurance_opt_in} onChange={(e) => handleStudentChange(index, e)} className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                   <label className="ml-3 text-sm text-gray-700 font-medium">Want to avail of the insurance facility? (10% of monthly fee to be deposited)</label>
                 </div>
              )}

            </div>
          </div>
        ))}

        <div className="flex justify-center mt-6">
          <button type="button" onClick={addStudent} className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-full text-sm font-bold border-2 border-dashed border-gray-300 hover:bg-gray-200 transition-colors">
            <Plus className="w-5 h-5" /> Add Another Child (Sibling)
          </button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-10 flex justify-end px-10 shadow-up">
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-8 py-3 text-sm font-bold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50">
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : `Register ${students.length} Student${students.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
      <div className="h-20"></div>
    </div>
  );
}
