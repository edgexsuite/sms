import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  CreditCard, Layout, Save, CheckCircle2, AlertCircle, 
  Settings as SettingsIcon, Users, Briefcase, ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

const STUDENT_FIELDS = [
  { id: 'roll_number', label: 'Roll Number' },
  { id: 'class_id', label: 'Class/Section' },
  { id: 'dob', label: 'Date of Birth' },
  { id: 'gender', label: 'Gender' },
  { id: 'blood_group', label: 'Blood Group' },
  { id: 'admission_date', label: 'Admission Date' },
  { id: 'emergency_contact', label: 'Emergency Contact' },
  { id: 'address', label: 'Home Address' },
];

const STAFF_FIELDS = [
  { id: 'designation', label: 'Designation' },
  { id: 'role', label: 'Security Role' },
  { id: 'department', label: 'Department' },
  { id: 'joining_date', label: 'Joining Date' },
  { id: 'whatsapp_number', label: 'WhatsApp' },
  { id: 'ref_id', label: 'Reference ID' },
];

export default function IDCardSettings() {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'student' | 'staff'>('student');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentFields, setStudentFields] = useState<string[]>([]);
  const [staffFields, setStaffFields] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (userRole?.school_id) fetchSettings();
  }, [userRole]);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('id_card_settings')
      .select('*')
      .eq('school_id', userRole?.school_id);
    
    if (data) {
      const student = data.find(d => d.card_type === 'student');
      const staff = data.find(d => d.card_type === 'staff');
      if (student) setStudentFields(student.fields || []);
      if (staff) setStaffFields(staff.fields || []);
    }
    setLoading(false);
  };

  const toggleField = (id: string) => {
    if (activeTab === 'student') {
      setStudentFields(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
    } else {
      setStaffFields(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
    }
  };

  const saveSettings = async () => {
    if (!userRole?.school_id) return;
    setSaving(true);
    setMessage(null);

    const targetFields = activeTab === 'student' ? studentFields : staffFields;

    const { error } = await supabase
      .from('id_card_settings')
      .upsert({
        school_id: userRole.school_id,
        card_type: activeTab,
        fields: targetFields,
      }, { onConflict: 'school_id,card_type' });

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } else {
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  const availableFields = activeTab === 'student' ? STUDENT_FIELDS : STAFF_FIELDS;
  const currentFields = activeTab === 'student' ? studentFields : staffFields;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-indigo-600" /> ID Card Designer Settings
          </h1>
          <p className="text-slate-500 text-sm mt-1">Select which data fields appear on each identity card.</p>
        </div>
        <button 
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-[#0d1526] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Configuration</>}
        </button>
      </div>

      {message && (
        <div className={cn(
          "p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2",
          message.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
        )}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm font-bold">{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('student')}
            className={cn(
              "flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'student' ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <Users className="w-4 h-4 inline-block mr-2" /> Student Card
          </button>
          <button 
            onClick={() => setActiveTab('staff')}
            className={cn(
              "flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'staff' ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <Briefcase className="w-4 h-4 inline-block mr-2" /> Staff Card
          </button>
        </div>

        <div className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableFields.map(field => (
                <div 
                  key={field.id}
                  onClick={() => toggleField(field.id)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group",
                    currentFields.includes(field.id) 
                      ? "bg-indigo-50 border-indigo-200 shadow-sm" 
                      : "bg-white border-slate-100 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                      currentFields.includes(field.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-300 group-hover:bg-slate-200"
                    )}>
                      {currentFields.includes(field.id) && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                    <p className={cn("text-xs font-bold uppercase tracking-tight", currentFields.includes(field.id) ? "text-indigo-900" : "text-slate-600")}>
                      {field.label}
                    </p>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 transition-all", currentFields.includes(field.id) ? "text-indigo-600 translate-x-1" : "text-slate-200 group-hover:text-slate-300")} />
                </div>
              ))}
           </div>

           <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-4">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                 <Layout className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                 <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">Live Preview Logic</p>
                 <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Changes saved here will immediately reflect in the {activeTab === 'student' ? 'Digital ID Cards' : 'Staff ID Cards'} module. Only selected fields will be rendered on the printable cards to ensure high density and clarity.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
