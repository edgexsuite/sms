import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Save, AlertCircle, Plus, Trash2, Camera, X, CheckCircle, Receipt, ArrowRight, ClipboardCheck, MessageCircle, Send, Calendar } from 'lucide-react';
import { processStudentPhoto, uploadFile, PHOTO_WIDTH, PHOTO_HEIGHT, PHOTO_MAX_BYTES } from '../../lib/uploadUtils';
import StudentFeeModal from '../../components/StudentFeeModal';
import * as templatesLib from '../../lib/whatsappTemplates';
import { formatDate, toYYYYMMDD } from '../../lib/utils';

// Generates an alphanumeric password of length 6
const generatePassword = () => Math.random().toString(36).slice(-6).toUpperCase();
const generateRandomNumber = () => Math.floor(1000 + Math.random() * 9000).toString();

const NATIONALITIES = [
  'Pakistani', 'Afghan', 'Bangladeshi', 'Indian', 'Iranian', 'Saudi Arabian',
  'Emirati', 'British', 'American', 'Canadian', 'Chinese', 'Other'
];

const RELIGIONS = ['Islam', 'Christianity', 'Hinduism', 'Sikhism', 'Buddhism', 'Other'];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

const initialStudentState = {
  full_name: '', dob: '', gender: '', religion: 'Islam', hobbies: '',
  class_id: '', last_school: '', remarks: '', other_kids: '', reason_for_choosing: '',
  admission_date: new Date().toISOString().split('T')[0],
  insurance_opt_in: false,
  blood_group: '', physical_disability: '', chronic_disease: '', emergency_doctor_name: '', emergency_doctor_phone: '',
  height: '', weight: '',
  eye_sight_normal: true, glasses_number: '', other_eye_disease: '',
  allergies: '', contagious_disease: '', medical_caution: '', photograph_url: '',
  fee_waiver_percentage: 0,
  custom_data: {} as Record<string, any>
};

export default function RegisterStudent() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [classes, setClasses] = useState<any[]>([]);
  const { id } = useParams();
  const isEditMode = !!id;
  // Prefill data passed from Admission Pipeline → "Register as Student"
  const prefill = (location.state as any)?.prefill as {
    student_name?: string;
    student_dob?: string;
    student_gender?: string;
    father_name?: string;
    mother_name?: string;
    contact_number?: string;
    email?: string;
    address?: string;
    applying_for_class?: string;
    inquiry_id?: string;
  } | undefined;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [schoolName, setSchoolName] = useState('');

  // Post-admission state
  const [admissionSuccess, setAdmissionSuccess] = useState<{
    familyNumber: string;
    parentPassword: string;
    students: Array<{ id: string; full_name: string; class_id: string; roll_number: number | null; fee_waiver_percentage: number; student_unique_id: string; auth_password: string }>;
  } | null>(null);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeModalStudent, setFeeModalStudent] = useState<any>(null);

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
    father_name: '', father_occupation: '', father_qualification: '', father_cnic: '',
    mother_name: '', mother_occupation: '', mother_qualification: '',
    guardian_name: '', guardian_cnic: '', is_father_guardian: true,
    nationality: 'Pakistani', home_address: '',
    father_mobile: '', mother_mobile: '', emergency_mobile: '',
    home_telephone: '', office_telephone: '', email: '',
    custom_data: {} as Record<string, any>
  });

  // Family Group State
  const [familyGroups, setFamilyGroups] = useState<any[]>([]);
  const [selectedFamilyGroupId, setSelectedFamilyGroupId] = useState<string | null>(null);
  const [familySearch, setFamilySearch] = useState('');

  // Dynamic Array for Siblings
  const [students, setStudents] = useState([{ ...initialStudentState, custom_data: {} as Record<string, any> }]);

  // Per-student photo files + preview URLs
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([null]);
  const [photoPreviews, setPhotoPreviews] = useState<(string | null)[]>([null]);
  const [photoErrors, setPhotoErrors] = useState<(string | null)[]>([null]);
  const [photoProcessing, setPhotoProcessing] = useState<boolean[]>([false]);
  const [photoSizes, setPhotoSizes] = useState<(string | null)[]>([null]); // "12.3 KB WebP"
  const photoInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dobRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const admissionRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (userRole?.school_id) {
      fetchClasses();
      fetchFormConfig();
      if (isEditMode) fetchStudentForEdit();
      // Fetch school name for WhatsApp message
      supabase.from('schools').select('name').eq('id', userRole.school_id).maybeSingle()
        .then(({ data }) => { if (data?.name) setSchoolName(data.name); });
    }
  }, [userRole, id]);

  // Apply prefill from Admission Pipeline when navigated with state
  useEffect(() => {
    if (!prefill || isEditMode) return;
    // Pre-fill parent/family data
    if (prefill.father_name || prefill.contact_number || prefill.mother_name || prefill.email || prefill.address) {
      setParentData(prev => ({
        ...prev,
        father_name: prefill.father_name || prev.father_name,
        mother_name: prefill.mother_name || prev.mother_name,
        father_mobile: prefill.contact_number || prev.father_mobile,
        email: prefill.email || prev.email,
        home_address: prefill.address || prev.home_address,
      }));
    }
    // Pre-fill first student data
    setStudents(prev => {
      const updated = [...prev];
      updated[0] = {
        ...updated[0],
        full_name: prefill.student_name || updated[0].full_name,
        dob: prefill.student_dob || updated[0].dob,
        gender: prefill.student_gender || updated[0].gender,
      };
      return updated;
    });
    // Note: applying_for_class is a text name — we'll try to match after classes load
  }, [prefill, isEditMode]);

  const fetchStudentForEdit = async () => {
    setLoading(true);
    try {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select(`
          *,
          parents (*)
        `)
        .eq('id', id)
        .single();

      if (studentError) throw studentError;
      if (student) {
        // Set student data
        setStudents([{
          full_name: student.full_name || '',
          dob: student.dob || '',
          gender: student.gender || '',
          religion: student.religion || 'Islam',
          hobbies: student.hobbies || '',
          class_id: student.class_id || '',
          last_school: student.last_school || '',
          remarks: student.remarks || '',
          other_kids: student.other_kids || '',
          reason_for_choosing: student.reason_for_choosing || '',
          admission_date: student.admission_date || '',
          insurance_opt_in: student.insurance_opt_in || false,
          blood_group: student.blood_group || '',
          physical_disability: student.physical_disability || '',
          chronic_disease: student.chronic_disease || '',
          emergency_doctor_name: student.emergency_doctor_name || '',
          emergency_doctor_phone: student.emergency_doctor_phone || '',
          height: student.height?.toString() || '',
          weight: student.weight?.toString() || '',
          eye_sight_normal: student.eye_sight_normal ?? true,
          glasses_number: student.glasses_number || '',
          other_eye_disease: student.other_eye_disease || '',
          allergies: student.allergies || '',
          contagious_disease: student.contagious_disease || '',
          medical_caution: student.medical_caution || '',
          photograph_url: student.photograph_url || '',
          fee_waiver_percentage: student.fee_waiver_percentage || 0,
          custom_data: student.custom_data || {}
        }]);

        if (student.photograph_url) {
          setPhotoPreviews([student.photograph_url]);
        }

        setSelectedFamilyGroupId(student.family_group_id);

        if (student.parents) {
          const p = student.parents;
          setParentData({
            father_name: p.father_name || '',
            father_occupation: p.father_occupation || '',
            father_qualification: p.father_qualification || '',
            father_cnic: p.father_cnic || '',
            mother_name: p.mother_name || '',
            mother_occupation: p.mother_occupation || '',
            mother_qualification: p.mother_qualification || '',
            nationality: p.nationality || 'Pakistani',
            home_address: p.address || '',
            father_mobile: p.whatsapp_number || '',
            mother_mobile: p.mother_mobile || '',
            emergency_mobile: p.emergency_mobile || '',
            guardian_name: p.guardian_name || '',
            guardian_cnic: p.guardian_cnic || '',
            is_father_guardian: p.is_father_guardian ?? (p.guardian_name === p.father_name && p.guardian_cnic === p.father_cnic),
            home_telephone: p.home_telephone || '',
            office_telephone: p.office_telephone || '',
            email: p.email || '',
            custom_data: p.custom_data || {}
          });
        }
      }
    } catch (err: any) {
      setError('Error fetching student details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id || '').order('name');
      if (data) {
        setClasses(data);
        // Try to match prefill class name to actual class_id
        if (prefill?.applying_for_class && !isEditMode) {
          const matchedClass = data.find(
            (c: any) =>
              `${c.name}${c.section ? '-' + c.section : ''}`.toLowerCase() === prefill.applying_for_class!.toLowerCase() ||
              c.name.toLowerCase() === prefill.applying_for_class!.toLowerCase()
          );
          if (matchedClass) {
            setStudents(prev => {
              const updated = [...prev];
              updated[0] = { ...updated[0], class_id: matchedClass.id };
              return updated;
            });
          }
        }
      }
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

  const handleFamilySearch = async (val: string) => {
    setFamilySearch(val);
    if (val.length < 3) { setFamilyGroups([]); return; }
    const { data } = await supabase
      .from('family_groups')
      .select('*')
      .eq('school_id', userRole?.school_id)
      .ilike('family_name', `%${val}%`)
      .limit(5);
    setFamilyGroups(data || []);
  };

  const selectFamily = (family: any) => {
    setSelectedFamilyGroupId(family.id);
    setParentData({
      ...parentData,
      father_name: family.primary_contact || '',
      father_mobile: family.primary_phone || '',
      home_address: family.address || '', // Assuming family_groups might have address, or we'll fetch from a linked parent
    });
    // Attempt to fetch more details from the last student linked to this family
    fetchExistingParentInfo(family.id);
    setFamilyGroups([]);
    setFamilySearch(family.family_name);
  };

  const fetchExistingParentInfo = async (familyId: string) => {
    const { data } = await supabase
      .from('students')
      .select('parent:parents(*)')
      .eq('family_group_id', familyId)
      .limit(1)
      .maybeSingle();
    
    if (data?.parent) {
      const raw = data.parent;
      const p: any = Array.isArray(raw) ? raw[0] : raw;
      setParentData({
        father_name: p.father_name || '',
        father_occupation: p.father_occupation || '',
        father_qualification: p.father_qualification || '',
        mother_name: p.mother_name || '',
        mother_occupation: p.mother_occupation || '',
        mother_qualification: p.mother_qualification || '',
        nationality: p.nationality || '',
        home_address: p.address || '',
        father_mobile: p.whatsapp_number || '',
        mother_mobile: p.mother_mobile || '',
        emergency_mobile: p.emergency_mobile || '',
        home_telephone: p.home_telephone || '',
        office_telephone: p.office_telephone || '',
        email: p.email || '',
        custom_data: p.custom_data || {}
      });
    }
  };

  const checkExistingFamily = async (val: string, type: 'phone' | 'cnic') => {
    if (val.length < 5 || isEditMode) return;
    try {
      const field = type === 'phone' ? 'whatsapp_number' : 'father_cnic';
      const { data } = await supabase
        .from('parents')
        .select('id, family_group_id, full_name, father_name, whatsapp_number, address')
        .eq('school_id', userRole?.school_id)
        .eq(field, val)
        .maybeSingle();

      if (data) {
        if (window.confirm(`A family already exists for this ${type === 'phone' ? 'phone number' : 'CNIC'} (${data.father_name || data.full_name}). Would you like to link this registration to the existing family?`)) {
          setSelectedFamilyGroupId(data.family_group_id);
          setParentData({
            ...parentData,
            father_name: data.father_name || '',
            father_mobile: data.whatsapp_number || '',
            home_address: data.address || '',
          });
          fetchExistingParentInfo(data.family_group_id);
        }
      }
    } catch (err) {
      console.error('Error checking existing family:', err);
    }
  };

  const handleParentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setParentData(prev => {
      const updated = { ...prev, [name]: val };
      
      // If "Father as Guardian" is checked, sync guardian info
      if (name === 'is_father_guardian' && val) {
        updated.guardian_name = prev.father_name;
        updated.guardian_cnic = prev.father_cnic;
      } else if (name === 'father_name' && prev.is_father_guardian) {
        updated.guardian_name = value;
      } else if (name === 'father_cnic' && prev.is_father_guardian) {
        updated.guardian_cnic = value;
      }
      
      return updated;
    });

    if (name === 'father_mobile') checkExistingFamily(value, 'phone');
    if (name === 'father_cnic') checkExistingFamily(value, 'cnic');
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

  const handlePhotoChange = async (index: number, file: File | null) => {
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      const errs = [...photoErrors]; errs[index] = 'Please select an image file.'; setPhotoErrors(errs);
      return;
    }

    // Show raw preview immediately while processing runs in background
    const prev = [...photoPreviews];
    if (prev[index]) URL.revokeObjectURL(prev[index]!);
    prev[index] = URL.createObjectURL(file);
    setPhotoPreviews(prev);

    // Clear old error + size, mark processing
    const errs = [...photoErrors]; errs[index] = null; setPhotoErrors(errs);
    const sizes = [...photoSizes]; sizes[index] = null; setPhotoSizes(sizes);
    const proc = [...photoProcessing]; proc[index] = true; setPhotoProcessing(proc);

    try {
      const result = await import('../../lib/uploadUtils').then(m => m.processStudentPhoto(file));
      // Replace preview with compressed WebP blob URL
      if (prev[index]) URL.revokeObjectURL(prev[index]!);
      const newPrev = [...photoPreviews];
      newPrev[index] = URL.createObjectURL(result.blob);
      setPhotoPreviews(newPrev);

      // Store processed blob as a synthetic File so upload step can use it
      const processedFile = new File([result.blob], `photo.${result.format}`, { type: `image/${result.format}` });
      const files = [...photoFiles]; files[index] = processedFile; setPhotoFiles(files);

      const newSizes = [...photoSizes];
      newSizes[index] = `${result.sizeKB} KB · ${result.format.toUpperCase()}`;
      setPhotoSizes(newSizes);
    } catch (err: any) {
      const newErrs = [...photoErrors]; newErrs[index] = err.message || 'Failed to process image.'; setPhotoErrors(newErrs);
      clearPhoto(index);
    } finally {
      const proc = [...photoProcessing]; proc[index] = false; setPhotoProcessing(proc);
    }
  };

  const clearPhoto = (index: number) => {
    if (photoPreviews[index]) URL.revokeObjectURL(photoPreviews[index]!);
    const prev = [...photoPreviews]; prev[index] = null; setPhotoPreviews(prev);
    const files = [...photoFiles]; files[index] = null; setPhotoFiles(files);
    const errs = [...photoErrors]; errs[index] = null; setPhotoErrors(errs);
    const sizes = [...photoSizes]; sizes[index] = null; setPhotoSizes(sizes);
    if (photoInputRefs.current[index]) photoInputRefs.current[index]!.value = '';
  };

  const addStudent = () => {
    setStudents([...students, { ...initialStudentState, custom_data: {} as Record<string, any> }]);
    setPhotoFiles([...photoFiles, null]);
    setPhotoPreviews([...photoPreviews, null]);
    setPhotoErrors([...photoErrors, null]);
    setPhotoProcessing([...photoProcessing, false]);
    setPhotoSizes([...photoSizes, null]);
  };

  const removeStudent = (index: number) => {
    if (photoPreviews[index]) URL.revokeObjectURL(photoPreviews[index]!);
    setStudents(students.filter((_, i) => i !== index));
    setPhotoFiles(photoFiles.filter((_, i) => i !== index));
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index));
    setPhotoErrors(photoErrors.filter((_, i) => i !== index));
    setPhotoProcessing(photoProcessing.filter((_, i) => i !== index));
    setPhotoSizes(photoSizes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;
    setLoading(true);
    setError('');

    try {
      let finalFamilyGroupId = selectedFamilyGroupId;

      if (isEditMode) {
        const studentId = id;
        const stu = students[0];

        // 1. Update Parent Record linked to this student
        const { data: currentStudent } = await supabase.from('students').select('parent_id').eq('id', studentId).single();
        if (currentStudent?.parent_id) {
          const { error: parentUpdateErr } = await supabase.from('parents').update({
            full_name: parentData.father_name || parentData.mother_name || 'Parent',
            father_name: parentData.father_name,
            mother_name: parentData.mother_name,
            father_qualification: parentData.father_qualification,
            mother_qualification: parentData.mother_qualification,
            father_occupation: parentData.father_occupation,
            mother_occupation: parentData.mother_occupation,
            father_cnic: parentData.father_cnic,
            whatsapp_number: parentData.father_mobile, 
            emergency_mobile: parentData.emergency_mobile,
            home_telephone: parentData.home_telephone,
            office_telephone: parentData.office_telephone,
            email: parentData.email,
            address: parentData.home_address,
            guardian_name: parentData.guardian_name,
            guardian_cnic: parentData.guardian_cnic,
            is_father_guardian: parentData.is_father_guardian,
            custom_data: parentData.custom_data
          }).eq('id', currentStudent.parent_id);
          if (parentUpdateErr) throw parentUpdateErr;
        }

        // 2. Update Student Record
        const { error: studentUpdateErr } = await supabase.from('students').update({
          class_id: stu.class_id || null,
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
          admission_date: stu.admission_date,
          insurance_opt_in: stu.insurance_opt_in,
          blood_group: stu.blood_group || null,
          physical_disability: stu.physical_disability || null,
          chronic_disease: stu.chronic_disease || null,
          emergency_doctor_name: stu.emergency_doctor_name || null,
          emergency_doctor_phone: stu.emergency_doctor_phone || null,
          height: stu.height ? parseFloat(stu.height) : null,
          weight: stu.weight ? parseFloat(stu.weight) : null,
          eye_sight_normal: stu.eye_sight_normal,
          glasses_number: stu.glasses_number || null,
          other_eye_disease: stu.other_eye_disease || null,
          allergies: stu.allergies || null,
          contagious_disease: stu.contagious_disease || null,
          medical_caution: stu.medical_caution || null,
          fee_waiver_percentage: stu.fee_waiver_percentage || 0,
          custom_data: stu.custom_data
        }).eq('id', studentId);

        if (studentUpdateErr) throw studentUpdateErr;

        // 3. Handle photo upload — file is already processed (WebP/JPEG blob)
        const file = photoFiles[0];
        if (file) {
          const fmt = file.type.includes('webp') ? 'webp' : 'jpeg';
          const url = await uploadFile(`${userRole.school_id}/students/${studentId}`, file, fmt);
          await supabase.from('students').update({ photograph_url: url }).eq('id', studentId);
        }

        alert('Student profile updated successfully!');
        navigate('/students');
        return;
      }

      // --- CREATE MODE ---
      if (!finalFamilyGroupId) {
        const { data: newFam, error: famErr } = await supabase.from('family_groups').insert([{
          school_id: userRole.school_id,
          family_name: (parentData.father_name || parentData.mother_name || 'New') + ' Family',
          primary_contact: parentData.father_name || parentData.mother_name,
          primary_phone: parentData.father_mobile,
        }]).select().single();
        
    if (famErr) throw famErr;
        finalFamilyGroupId = newFam.id;
      }

      const suffix = generateRandomNumber(); 
      const fatherNamePart = (parentData.father_name || parentData.mother_name || 'Parent').trim().split(' ')[0] || 'User';
      const familyNumber = `${fatherNamePart}${suffix}`;
      const parentPassword = generatePassword();
      
      // Only insert parent if they don't already exist in this family group
      let parentId: string;
      const { data: checkParent } = await supabase
        .from('parents')
        .select('id')
        .eq('school_id', userRole.school_id)
        .eq('family_group_id', finalFamilyGroupId)
        .maybeSingle();

      if (checkParent) {
        parentId = checkParent.id;
        // Optional: Update existing parent with new info?
        await supabase.from('parents').update({
          guardian_name: parentData.guardian_name,
          guardian_cnic: parentData.guardian_cnic,
          is_father_guardian: parentData.is_father_guardian,
          father_cnic: parentData.father_cnic,
        }).eq('id', parentId);
      } else {
        const { data: parentResult, error: parentError } = await supabase.from('parents').insert([{
          school_id: userRole.school_id,
          family_group_id: finalFamilyGroupId,
          family_number: familyNumber,
          auth_password: parentPassword,
          full_name: parentData.father_name || parentData.mother_name || 'Parent',
          father_name: parentData.father_name,
          mother_name: parentData.mother_name,
          father_qualification: parentData.father_qualification,
          mother_qualification: parentData.mother_qualification,
          father_occupation: parentData.father_occupation,
          mother_occupation: parentData.mother_occupation,
          father_cnic: parentData.father_cnic,
          guardian_name: parentData.guardian_name,
          guardian_cnic: parentData.guardian_cnic,
          is_father_guardian: parentData.is_father_guardian,
          whatsapp_number: parentData.father_mobile, 
          emergency_mobile: parentData.emergency_mobile,
          home_telephone: parentData.home_telephone,
          office_telephone: parentData.office_telephone,
          email: parentData.email,
          address: parentData.home_address,
          custom_data: parentData.custom_data // JSONB inject
        }]).select().single();

        if (parentError) throw parentError;
        parentId = parentResult.id;
      }

      // 4. Fetch next roll numbers for each unique class in the batch
      const uniqueClassIds = [...new Set(students.map(s => s.class_id).filter(Boolean))];
      const rollNumberMap: Record<string, number> = {};
      
      for (const cid of uniqueClassIds) {
        const { data: maxRoll } = await supabase
          .from('students')
          .select('roll_number')
          .eq('class_id', cid)
          .order('roll_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        rollNumberMap[cid] = (maxRoll?.roll_number || 0);
      }

      const studentInserts = students.map((stu, idx) => {
        const studentNamePart = (stu.full_name || 'Student').trim().split(' ')[0];
        const suffix = `${familyNumber.replace(/\D/g, '').slice(-4)}${idx + 1}`;
        const studentUniqueId = `${studentNamePart}${suffix}`;
        const studentPassword = generatePassword();

        // Increment roll number for this class
        const targetClassId = stu.class_id || '';
        if (targetClassId) {
          rollNumberMap[targetClassId] = (rollNumberMap[targetClassId] || 0) + 1;
        }

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
          admission_date: stu.admission_date || new Date().toISOString().split('T')[0],
          insurance_opt_in: stu.insurance_opt_in,
          blood_group: stu.blood_group || null,
          physical_disability: stu.physical_disability || null,
          chronic_disease: stu.chronic_disease || null,
          emergency_doctor_name: stu.emergency_doctor_name || null,
          emergency_doctor_phone: stu.emergency_doctor_phone || null,
          height: stu.height ? parseFloat(stu.height) : null,
          weight: stu.weight ? parseFloat(stu.weight) : null,
          eye_sight_normal: stu.eye_sight_normal,
          glasses_number: stu.glasses_number || null,
          other_eye_disease: stu.other_eye_disease || null,
          allergies: stu.allergies || null,
          contagious_disease: stu.contagious_disease || null,
          medical_caution: stu.medical_caution || null,
          family_group_id: finalFamilyGroupId,
          roll_number: rollNumberMap[targetClassId] ?? Math.floor(1000 + Math.random() * 9000),
          fee_waiver_percentage: stu.fee_waiver_percentage || 0,
          status: 'active',
          custom_data: stu.custom_data // JSONB inject
        };
      });

      const { data: insertedStudents, error: studentError } = await supabase
        .from('students')
        .insert(studentInserts)
        .select('id');
      if (studentError) throw studentError;

      // Upload photos — already processed as WebP/JPEG blobs by handlePhotoChange
      if (insertedStudents) {
        for (let i = 0; i < insertedStudents.length; i++) {
          const file = photoFiles[i];
          if (!file) continue;
          try {
            const fmt = file.type.includes('webp') ? 'webp' : 'jpeg';
            const url = await uploadFile(
              `${userRole.school_id}/students/${insertedStudents[i].id}`,
              file,
              fmt
            );
            await supabase
              .from('students')
              .update({ photograph_url: url })
              .eq('id', insertedStudents[i].id);
          } catch (photoErr) {
            console.error('Photo upload failed for student', i, photoErr);
            // Non-fatal — student is still registered
          }
        }
      }

      // If we came from Admission Pipeline, link the first inserted student to the inquiry
      if (prefill?.inquiry_id && insertedStudents && insertedStudents[0]) {
        await supabase
          .from('admission_inquiries')
          .update({ student_id: insertedStudents[0].id, status: 'admitted' })
          .eq('id', prefill.inquiry_id);
      }

      // Show success screen with option to generate fee invoice
      // Map inserted IDs back to the generated credentials from studentInserts
      setAdmissionSuccess({
        familyNumber,
        parentPassword,
        students: (insertedStudents || []).map((s: any, idx: number) => ({
          id: s.id,
          full_name: students[idx]?.full_name || 'Student',
          class_id: students[idx]?.class_id || '',
          roll_number: null,
          fee_waiver_percentage: students[idx]?.fee_waiver_percentage || 0,
          student_unique_id: studentInserts[idx]?.student_unique_id || '',
          auth_password: studentInserts[idx]?.auth_password || '',
        })),
      });

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

  /* ── Send WhatsApp admission welcome message ─────────────────────── */
  const sendAdmissionWhatsApp = () => {
    if (!admissionSuccess) return;
    const portalLink = `https://portal.theedgeschool.com/parent-portal`;
    const studentLink = `https://portal.theedgeschool.com/student-portal`;

    // Build student credentials block
    const studentLines = admissionSuccess.students.map(stu => {
      const cls = classes.find(c => c.id === stu.class_id);
      const clsName = cls ? `${cls.name}${cls.section ? ' ' + cls.section : ''}` : '';
      return [
        `👤 *${stu.full_name}*${clsName ? ' — Class ' + clsName : ''}`,
        `   🆔 Student ID: ${stu.student_unique_id}`,
        `   🔑 Password: ${stu.auth_password}`,
        `   🔗 Login: ${studentLink}`,
      ].join('\n');
    }).join('\n\n');

    const msg = [
      `🎉 *Admission Confirmed — ${schoolName || 'School'}*`,
      '',
      `Assalam o Alaikum, Dear Parent,`,
      ``,
      `We are pleased to confirm the admission of your child at *${schoolName || 'our school'}*. Welcome to our school family! 🏫`,
      '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 *STUDENT LOGIN DETAILS*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      studentLines,
      '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `👨‍👩‍👧 *PARENT PORTAL LOGIN*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `   👤 Family ID: ${admissionSuccess.familyNumber}`,
      `   🔑 Password: ${admissionSuccess.parentPassword}`,
      `   🔗 Login: ${portalLink}`,
      '',
      `Through the Parent Portal you can view:`,
      `✅ Fee records & challans`,
      `📅 Attendance calendar`,
      `📝 Exam results`,
      `📚 Homework & teacher diary`,
      `🗓 Class timetable`,
      '',
      `Please keep your credentials safe. For any assistance, contact the school administration.`,
      '',
      `Regards,`,
      `*${schoolName || 'School Administration'}*`,
    ].join('\n');

    templatesLib.openWhatsApp(parentData.father_mobile || '', msg);
  };

  /* ── Post-admission success screen ─────────────────────────────────── */
  if (admissionSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        {showFeeModal && feeModalStudent && (
          <StudentFeeModal
            student={feeModalStudent}
            includeAdmissionFees
            onSave={() => { setShowFeeModal(false); setFeeModalStudent(null); }}
            onClose={() => { setShowFeeModal(false); setFeeModalStudent(null); }}
          />
        )}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white">Admission Successful!</h1>
            <p className="text-emerald-100 mt-1 text-sm">
              {admissionSuccess.students.length} student{admissionSuccess.students.length > 1 ? 's' : ''} registered
            </p>
          </div>
          <div className="px-8 py-7 space-y-6">
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Parent Login Credentials</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">Family Username</p>
                  <p className="text-lg font-black text-slate-800 font-mono mt-0.5">{admissionSuccess.familyNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">Password</p>
                  <p className="text-lg font-black text-slate-800 font-mono mt-0.5">{admissionSuccess.parentPassword}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">Full credentials available in the Credential Dispatch module</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Registered Students</p>
              <div className="space-y-3">
                {admissionSuccess.students.map(stu => (
                  <div key={stu.id} className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">{stu.full_name}</p>
                        <p className="text-xs text-slate-500">
                          {classes.find(c => c.id === stu.class_id)?.name || 'Class not assigned'}
                        </p>
                      </div>
                      <button
                        onClick={() => { setFeeModalStudent(stu); setShowFeeModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition"
                      >
                        <Receipt className="w-4 h-4" /> Generate Fee Invoice
                      </button>
                    </div>
                    {(stu.student_unique_id || stu.auth_password) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-100">
                        <div>
                          <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Student Login ID</p>
                          <p className="text-sm font-black text-indigo-800 font-mono mt-0.5">{stu.student_unique_id}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Student Password</p>
                          <p className="text-sm font-black text-indigo-800 font-mono mt-0.5">{stu.auth_password}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* WhatsApp welcome message */}
            <button
              onClick={sendAdmissionWhatsApp}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-black transition shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Send Admission Details on WhatsApp
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/students')}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-700 transition"
              >
                Go to Student List
              </button>
              <button
                onClick={() => { setAdmissionSuccess(null); }}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition"
              >
                <Plus className="w-4 h-4" /> Register Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Student Admission Form</h1>
        <button onClick={() => navigate('/students')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          Cancel
        </button>
      </div>

      {/* Prefill banner — shown when navigated from Admission Pipeline */}
      {prefill && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3.5 flex items-center gap-3">
          <ClipboardCheck className="w-5 h-5 text-indigo-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo-800">Pre-filled from Admission Pipeline</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              Details for <strong>{prefill.student_name}</strong> have been auto-populated from the inquiry. Please review and complete remaining fields.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/frontdesk/pipeline')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline shrink-0"
          >
            ← Back to Pipeline
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* --- PARENT/FAMILY BLOCK --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-800 px-6 py-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white tracking-wide">Family & Contact Information</h2>
            <div className="relative w-64">
              <input 
                type="text" 
                placeholder="Search Existing Family..." 
                value={familySearch}
                onChange={(e) => handleFamilySearch(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:bg-white focus:text-gray-900 transition-all outline-none"
              />
              {familyGroups.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl rounded-lg z-50 overflow-hidden">
                  {familyGroups.map(fg => (
                    <button 
                      key={fg.id} 
                      type="button"
                      onClick={() => selectFamily(fg)}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
                    >
                      <span className="font-bold text-gray-900">{fg.family_name}</span>
                      <span className="text-[10px] text-gray-400">{fg.primary_phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label><input type="text" name="father_name" value={parentData.father_name} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Mother's Name</label><input type="text" name="mother_name" value={parentData.mother_name} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500" /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                <select name="nationality" value={parentData.nationality} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 bg-white">
                  {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

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
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Father's CNIC</label><input type="text" name="father_cnic" value={parentData.father_cnic} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Mother Mobile</label><input type="text" name="mother_mobile" value={parentData.mother_mobile} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Emergency Mobile (SMS)</label><input type="text" name="emergency_mobile" value={parentData.emergency_mobile} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" name="email" value={parentData.email} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
              
              <div className="col-span-1 md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Home Address</label><input type="text" name="home_address" value={parentData.home_address} onChange={handleParentChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>

              {/* Guardian Information */}
              <div className="col-span-1 md:col-span-3 pt-4 border-t border-gray-100 mt-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Guardian Information</h3>
                  <label className="flex items-center gap-2 text-sm font-medium text-indigo-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="is_father_guardian" 
                      checked={parentData.is_father_guardian} 
                      onChange={handleParentChange}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Father is Guardian
                  </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label>
                    <input 
                      type="text" 
                      name="guardian_name" 
                      value={parentData.guardian_name} 
                      onChange={handleParentChange} 
                      disabled={parentData.is_father_guardian}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Guardian CNIC</label>
                    <input 
                      type="text" 
                      name="guardian_cnic" 
                      value={parentData.guardian_cnic} 
                      onChange={handleParentChange} 
                      disabled={parentData.is_father_guardian}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" 
                    />
                  </div>
                </div>
              </div>

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
                      <div 
                        className="relative cursor-pointer group"
                        onClick={(e) => {
                          const input = dobRefs.current[index];
                          if (input && 'showPicker' in HTMLInputElement.prototype) {
                            try {
                              input.showPicker();
                            } catch (err) {
                              // Fallback: the input is already there and clickable
                            }
                          }
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          value={formatDate(student.dob)}
                          placeholder="DD-MM-YYYY"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 bg-white group-hover:border-blue-400 transition-colors cursor-pointer"
                        />
                        <input
                          type="date"
                          required
                          name="dob"
                          ref={el => dobRefs.current[index] = el}
                          value={student.dob || ''}
                          onChange={(e) => handleStudentChange(index, e)}
                          className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
                        />
                        <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors">
                          <Calendar className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select name="gender" value={student.gender} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 bg-white">
                        <option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Religion</label>
                      <select name="religion" value={student.religion} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 bg-white">
                        {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Admission Date *</label>
                      <div 
                        className="relative cursor-pointer group"
                        onClick={(e) => {
                          const input = admissionRefs.current[index];
                          if (input && 'showPicker' in HTMLInputElement.prototype) {
                            try {
                              input.showPicker();
                            } catch (err) {
                              // Fallback
                            }
                          }
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          value={formatDate(student.admission_date)}
                          placeholder="DD-MM-YYYY"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 bg-white group-hover:border-blue-400 transition-colors cursor-pointer"
                        />
                        <input
                          type="date"
                          required
                          name="admission_date"
                          ref={el => admissionRefs.current[index] = el}
                          value={student.admission_date || ''}
                          onChange={(e) => handleStudentChange(index, e)}
                          className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
                        />
                        <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors">
                          <Calendar className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Dynamic Basic Custom Fields */}
                    {renderCustomFields('basic_info', false, index)}
                  </div>
                  
                  {/* Photo upload */}
                  <div className="flex flex-col items-center justify-center h-full">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={el => { photoInputRefs.current[index] = el; }}
                      onChange={e => handlePhotoChange(index, e.target.files?.[0] ?? null)}
                    />
                    {photoProcessing[index] ? (
                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-300 rounded-lg p-4 bg-indigo-50 w-full h-full gap-2">
                        <div className="w-7 h-7 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-indigo-600 font-semibold">Converting to WebP…</span>
                      </div>
                    ) : photoPreviews[index] ? (
                      <div className="relative flex flex-col items-center gap-1">
                        <img
                          src={photoPreviews[index]!}
                          alt="Preview"
                          style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT, objectFit: 'cover' }}
                          className="rounded border-2 border-blue-300"
                        />
                        {photoSizes[index] && (
                          <span className="text-[10px] font-bold tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {photoSizes[index]}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => clearPhoto(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => photoInputRefs.current[index]?.click()}
                          className="text-xs text-blue-600 hover:underline w-full text-center"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => photoInputRefs.current[index]?.click()}
                        className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 transition-colors w-full h-full"
                      >
                        <Camera className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600 font-medium">Upload Photo</span>
                        <span className="text-xs text-gray-400 mt-1">
                          {PHOTO_WIDTH}×{PHOTO_HEIGHT}px • auto-compressed
                        </span>
                      </button>
                    )}
                    {photoErrors[index] && (
                      <p className="text-xs text-red-600 mt-1">{photoErrors[index]}</p>
                    )}
                    <div className="mt-2 text-xs text-gray-500 text-center space-y-0.5">
                      <p className="font-medium text-gray-600">Photo Requirements:</p>
                      <p>• Output: max <span className="font-semibold">20 KB</span></p>
                      <p>• Dimensions: <span className="font-semibold">{PHOTO_WIDTH} × {PHOTO_HEIGHT} px</span></p>
                      <p className="text-indigo-500 font-semibold">Auto-converted to WebP ≤ 20 KB</p>
                    </div>
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
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section ? `(Sec ${c.section})` : ''}</option>)}
                      </select>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Last School Attended</label><input type="text" name="last_school" value={student.last_school} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason for Choosing</label><input type="text" name="reason_for_choosing" value={student.reason_for_choosing} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                  </div>
                  
                  <div className="mt-6 flex items-center bg-emerald-50 border border-emerald-200 p-4 rounded-xl group cursor-pointer" 
                    onClick={() => {
                      const updated = [...students];
                      updated[index].fee_waiver_percentage = student.fee_waiver_percentage >= 100 ? 0 : 100;
                      setStudents(updated);
                    }}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      student.fee_waiver_percentage >= 100 ? "bg-emerald-600 border-emerald-600" : "border-emerald-300 bg-white"
                    )}>
                      {student.fee_waiver_percentage >= 100 && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="ml-3 text-left">
                      <p className="text-sm font-black text-emerald-900 uppercase tracking-tight leading-none">Make Student Free (100% Waiver)</p>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1">Exempt this student from all recurring monthly tuition fees</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Medical Information conditionally rendered */}
              {sectionsConfig.medical_info && (
                <div>
                  <h4 className="text-md border-b pb-2 mb-4 font-medium text-gray-800 text-red-600">Medical Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-red-50 p-6 rounded-lg border border-red-100">
                    {/* Blood Group */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                      <select name="blood_group" value={student.blood_group} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm">
                        <option value="">-- Select --</option>
                        {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                    </div>
                    {/* Height & Weight */}
                    <div className="grid grid-cols-2 gap-3 md:col-span-1">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                        <input type="number" min="50" max="250" step="0.5" name="height" placeholder="e.g. 142" value={student.height} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                        <input type="number" min="5" max="200" step="0.5" name="weight" placeholder="e.g. 38" value={student.weight} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                      </div>
                    </div>
                    {/* Eye Sight */}
                    <div className="flex flex-col justify-center gap-2">
                      <label className="text-sm font-medium text-gray-700">Eye Sight Normal (6/6)?</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1 text-sm"><input type="radio" name={`eye_sight_${index}`} checked={student.eye_sight_normal} onChange={() => { const u = [...students]; u[index].eye_sight_normal = true; setStudents(u); }} className="text-blue-600" /> Yes</label>
                        <label className="flex items-center gap-1 text-sm"><input type="radio" name={`eye_sight_${index}`} checked={!student.eye_sight_normal} onChange={() => { const u = [...students]; u[index].eye_sight_normal = false; setStudents(u); }} className="text-blue-600" /> No</label>
                      </div>
                      {!student.eye_sight_normal && (
                        <input type="text" name="glasses_number" value={student.glasses_number} onChange={(e) => handleStudentChange(index, e)} placeholder="Glasses number / prescription" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                      )}
                    </div>
                    {/* Allergies */}
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Known Allergies</label><input type="text" name="allergies" placeholder="e.g. Penicillin, Peanuts, Dust" value={student.allergies} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
                    {/* Chronic Disease */}
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Chronic / Ongoing Disease</label><input type="text" name="chronic_disease" placeholder="e.g. Asthma, Diabetes, Epilepsy" value={student.chronic_disease} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
                    {/* Physical Disability */}
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Physical Disability (if any)</label><input type="text" name="physical_disability" placeholder="e.g. Hearing impairment, Mobility" value={student.physical_disability} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
                    {/* Medical Caution */}
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Special Medical Caution</label><input type="text" name="medical_caution" placeholder="Anything staff must know" value={student.medical_caution} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
                    {/* Emergency Doctor */}
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Family Doctor Name</label><input type="text" name="emergency_doctor_name" value={student.emergency_doctor_name} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Family Doctor Phone</label><input type="text" name="emergency_doctor_phone" value={student.emergency_doctor_phone} onChange={(e) => handleStudentChange(index, e)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
                    {/* Dynamic Medical Fields */}
                    {renderCustomFields('medical_info', false, index)}
                  </div>
                </div>
              )}

                  {/* Insurance Opt in */}
                  {sectionsConfig.insurance_info && (
                    <div className="flex items-center bg-gray-50 border border-gray-200 p-4 rounded-xl">
                      <input type="checkbox" name="insurance_opt_in" checked={student.insurance_opt_in} onChange={(e) => handleStudentChange(index, e)} className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                      <label className="ml-3 text-sm text-gray-700 font-medium">Want to avail of the insurance facility? (10% of monthly fee to be deposited)</label>
                    </div>
                  )}

            </div>
          </div>
        ))}

        {!isEditMode && (
          <div className="flex justify-center mt-6">
            <button type="button" onClick={addStudent} className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-full text-sm font-bold border-2 border-dashed border-gray-300 hover:bg-gray-200 transition-colors">
              <Plus className="w-5 h-5" /> Add Another Child (Sibling)
            </button>
          </div>
        )}

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 z-10 flex justify-end rounded-b-xl shadow-lg">
          <button 
            type="submit" 
            disabled={loading || photoProcessing.some(p => p)} 
            className="flex items-center gap-2 px-8 py-3 text-sm font-bold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Processing...' : photoProcessing.some(p => p) ? 'Processing Photos...' : (isEditMode ? 'Update Profile' : `Register ${students.length} Student${students.length > 1 ? 's' : ''}`)}
          </button>
        </div>
      </form>
      <div className="h-20"></div>
    </div>
  );
}
