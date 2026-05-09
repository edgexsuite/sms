import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CreditCard, Layout, Save, CheckCircle2, AlertCircle,
  Settings as SettingsIcon, Users, Briefcase, ChevronRight, Eye,
  Minus, Plus, RotateCcw, Palette,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { TEMPLATES, TemplateId, CardTemplate } from '../../lib/idCardTemplates';

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

/* ── Default customization values ───────────────────────────────────────── */
export interface CardCustomization {
  nameFontSize: number;      // px, default 10
  fieldFontSize: number;     // px, default 6
  schoolFontSize: number;    // px, default 7
  photoSize: number;         // px, default 36
  qrSize: number;            // px, default 40
  primaryColor: string;      // header bg
  accentColor: string;       // badges, highlights
  textColor: string;         // name color
  logoSize: number;
  roleFontSize: number;
  roleColor: string;
  roleBgColor: string;
}

const DEFAULT_CUSTOM: CardCustomization = {
  nameFontSize: 10,
  fieldFontSize: 6,
  schoolFontSize: 7,
  photoSize: 36,
  qrSize: 40,
  primaryColor: '#1d4ed8',
  accentColor: '#3b82f6',
  textColor: '#0f172a',
  logoSize: 14,
  roleFontSize: 6,
  roleColor: '#1d4ed8',
  roleBgColor: '#eff6ff',
};

/* ── Sample dummy data for preview ───────────────────────────────────────── */
const SAMPLE_STUDENT = {
  mode: 'student' as const,
  name: 'Ahmed Raza Khan',
  photo: null,
  className: 'Class 9-A',
  rollNumber: 42,
  schoolName: 'The Edge School',
  schoolLogo: 'https://api.dicebear.com/7.x/initials/svg?seed=ES',
  qrValue: JSON.stringify({ type: 'student_attendance', student_id: 'preview' }),
  bloodGroup: 'B+',
  dob: '2009-03-15',
  phone: '+92 300 1234567',
  address: '24 Garden Town, Lahore',
};

const SAMPLE_STAFF = {
  mode: 'staff' as const,
  name: 'Sara Imtiaz',
  photo: null,
  role: 'Senior Teacher',
  designation: 'Head of Science',
  department: 'Science & Math',
  joiningDate: '2019-08-01',
  refId: 'EMP-0042',
  phone: '+92 321 9876543',
  schoolName: 'The Edge School',
  schoolLogo: 'https://api.dicebear.com/7.x/initials/svg?seed=ES',
  qrValue: JSON.stringify({ type: 'staff_attendance', staff_id: 'preview' }),
};

/* ── Slider component ───────────────────────────────────────────────────── */
function SizeControl({ label, value, onChange, min, max, step = 1, unit = 'px' }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold text-slate-600 w-28 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors active:scale-90 shrink-0"
        >
          <Minus className="w-3 h-3" />
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
        />
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors active:scale-90 shrink-0"
        >
          <Plus className="w-3 h-3" />
        </button>
        <span className="text-[10px] font-black text-indigo-600 w-10 text-right tabular-nums">{value}{unit}</span>
      </div>
    </div>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold text-slate-600 w-28 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border-2 border-slate-200 cursor-pointer p-0.5"
        />
        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{value}</span>
      </div>
    </div>
  );
}

export default function IDCardSettings() {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'student' | 'staff'>('student');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentFields, setStudentFields] = useState<string[]>(['roll_number', 'blood_group', 'emergency_contact']);
  const [staffFields, setStaffFields] = useState<string[]>(['designation', 'department', 'joining_date']);
  const [studentTemplate, setStudentTemplate] = useState<TemplateId>('classic');
  const [staffTemplate, setStaffTemplate] = useState<TemplateId>('classic');
  const [studentCustom, setStudentCustom] = useState<CardCustomization>({ ...DEFAULT_CUSTOM });
  const [staffCustom, setStaffCustom] = useState<CardCustomization>({ ...DEFAULT_CUSTOM });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      const staff   = data.find(d => d.card_type === 'staff');
      if (student) {
        setStudentFields(student.fields || ['roll_number', 'blood_group', 'emergency_contact']);
        if (student.template) setStudentTemplate(student.template as TemplateId);
        if (student.layout_config?.customization) setStudentCustom({ ...DEFAULT_CUSTOM, ...student.layout_config.customization });
      }
      if (staff) {
        setStaffFields(staff.fields || ['designation', 'department', 'joining_date']);
        if (staff.template) setStaffTemplate(staff.template as TemplateId);
        if (staff.layout_config?.customization) setStaffCustom({ ...DEFAULT_CUSTOM, ...staff.layout_config.customization });
      }
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

  const currentCustom = activeTab === 'student' ? studentCustom : staffCustom;
  const setCurrentCustom = (updates: Partial<CardCustomization>) => {
    if (activeTab === 'student') {
      setStudentCustom(prev => ({ ...prev, ...updates }));
    } else {
      setStaffCustom(prev => ({ ...prev, ...updates }));
    }
  };

  const resetCustomization = () => {
    setCurrentCustom({ ...DEFAULT_CUSTOM });
  };

  const saveSettings = async () => {
    if (!userRole?.school_id) return;
    setSaving(true);
    setMessage(null);

    const targetFields   = activeTab === 'student' ? studentFields   : staffFields;
    const targetTemplate = activeTab === 'student' ? studentTemplate : staffTemplate;
    const targetCustom   = activeTab === 'student' ? studentCustom   : staffCustom;

    const { error } = await supabase
      .from('id_card_settings')
      .upsert({
        school_id: userRole.school_id,
        card_type: activeTab,
        fields:    targetFields,
        template:  targetTemplate,
        layout_config: { customization: targetCustom },
      }, { onConflict: 'school_id,card_type' });

    setMessage(error
      ? { type: 'error',   text: 'Failed to save settings.' }
      : { type: 'success', text: 'Settings saved!' });
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  const availableFields   = activeTab === 'student' ? STUDENT_FIELDS : STAFF_FIELDS;
  const currentFields     = activeTab === 'student' ? studentFields  : staffFields;
  const currentTemplate   = activeTab === 'student' ? studentTemplate : staffTemplate;
  const setCurrentTemplate = (t: TemplateId) =>
    activeTab === 'student' ? setStudentTemplate(t) : setStaffTemplate(t);

  const selectedTemplateMeta = TEMPLATES.find(t => t.id === currentTemplate)!;
  const isHorizontal = selectedTemplateMeta?.orientation === 'horizontal';

  /* Preview card props */
  const previewProps = activeTab === 'student'
    ? { ...SAMPLE_STUDENT, activeFields: studentFields, template: studentTemplate, customization: studentCustom }
    : { ...SAMPLE_STAFF,   activeFields: staffFields,   template: staffTemplate,  customization: staffCustom };

  /* Scale the physical mm card to fit the preview panel. */
  const SCALE = isHorizontal ? 0.60 : 0.72;
  const cardPxW = isHorizontal ? 325 : 204;
  const cardPxH = isHorizontal ? 204 : 325;
  const scaledW = Math.round(cardPxW * SCALE);
  const scaledH = Math.round(cardPxH * SCALE);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-indigo-600" /> ID Card Designer
          </h1>
          <p className="text-slate-500 text-sm mt-1">Choose a template, customize sizes & colors, and select fields.</p>
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
          'p-4 rounded-2xl flex items-center gap-3',
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
        )}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm font-bold">{message.text}</p>
        </div>
      )}

      {/* Main layout: settings left, preview right */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── LEFT: Settings panel ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('student')}
              className={cn(
                'flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all',
                activeTab === 'student'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:bg-slate-50',
              )}
            >
              <Users className="w-4 h-4 inline-block mr-2" /> Student Card
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={cn(
                'flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all',
                activeTab === 'staff'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-slate-400 hover:bg-slate-50',
              )}
            >
              <Briefcase className="w-4 h-4 inline-block mr-2" /> Staff Card
            </button>
          </div>

          <div className="p-6 space-y-8">

            {/* Template Picker */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Card Template</p>
              <div className="flex gap-3 flex-wrap">
                {TEMPLATES.map(t => {
                  const isSelected = currentTemplate === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setCurrentTemplate(t.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all w-24 relative',
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100'
                          : 'border-slate-100 hover:border-slate-300 bg-white',
                      )}
                    >
                      {/* Colour swatch shaped like the card orientation */}
                      <div style={{
                        width: t.orientation === 'horizontal' ? 44 : 30,
                        height: t.orientation === 'horizontal' ? 28 : 44,
                        borderRadius: 5,
                        background: t.preview,
                        border: '1px solid rgba(0,0,0,0.08)',
                        flexShrink: 0,
                      }} />
                      <div className={cn(
                        'text-[9px] font-black uppercase tracking-tight text-center leading-tight',
                        isSelected ? 'text-indigo-700' : 'text-slate-600',
                      )}>{t.name}</div>
                      <div className={cn(
                        'text-[8px] uppercase tracking-widest font-bold',
                        t.orientation === 'horizontal' ? 'text-cyan-500' : 'text-violet-400',
                      )}>{t.orientation}</div>
                      {isSelected && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Customization Controls ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5" /> Size & Color Customization
                </p>
                <button
                  onClick={resetCustomization}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Defaults
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4">
                {/* Size controls */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sizes</p>
                  <SizeControl label="Name Font" value={currentCustom.nameFontSize} onChange={v => setCurrentCustom({ nameFontSize: v })} min={6} max={18} />
                  <SizeControl label="School Font" value={currentCustom.schoolFontSize} onChange={v => setCurrentCustom({ schoolFontSize: v })} min={4} max={14} />
                  <SizeControl label="Field Font" value={currentCustom.fieldFontSize} onChange={v => setCurrentCustom({ fieldFontSize: v })} min={4} max={12} />
                  <SizeControl label="Role Font" value={currentCustom.roleFontSize} onChange={v => setCurrentCustom({ roleFontSize: v })} min={4} max={14} />
                  <SizeControl label="Photo Size" value={currentCustom.photoSize} onChange={v => setCurrentCustom({ photoSize: v })} min={20} max={60} step={2} />
                  <SizeControl label="Logo Size" value={currentCustom.logoSize} onChange={v => setCurrentCustom({ logoSize: v })} min={8} max={60} step={1} />
                  <SizeControl label="QR Code Size" value={currentCustom.qrSize} onChange={v => setCurrentCustom({ qrSize: v })} min={20} max={70} step={2} />
                </div>

                {/* Color controls */}
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Colors</p>
                  <ColorControl label="Primary Color" value={currentCustom.primaryColor} onChange={v => setCurrentCustom({ primaryColor: v })} />
                  <ColorControl label="Accent Color" value={currentCustom.accentColor} onChange={v => setCurrentCustom({ accentColor: v })} />
                  <ColorControl label="Name Color" value={currentCustom.textColor} onChange={v => setCurrentCustom({ textColor: v })} />
                  <ColorControl label="Role Text" value={currentCustom.roleColor} onChange={v => setCurrentCustom({ roleColor: v })} />
                  <ColorControl label="Role BG" value={currentCustom.roleBgColor} onChange={v => setCurrentCustom({ roleBgColor: v })} />
                </div>
              </div>
            </div>

            {/* Fields */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Visible Fields</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableFields.map(field => (
                  <div
                    key={field.id}
                    onClick={() => toggleField(field.id)}
                    className={cn(
                      'flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer group',
                      currentFields.includes(field.id)
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0',
                        currentFields.includes(field.id)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-300 group-hover:bg-slate-200',
                      )}>
                        {currentFields.includes(field.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <p className={cn(
                        'text-xs font-bold uppercase tracking-tight',
                        currentFields.includes(field.id) ? 'text-indigo-900' : 'text-slate-600',
                      )}>
                        {field.label}
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      'w-4 h-4 transition-all',
                      currentFields.includes(field.id)
                        ? 'text-indigo-600 translate-x-0.5'
                        : 'text-slate-200 group-hover:text-slate-300',
                    )} />
                  </div>
                ))}
              </div>
            </div>

            {/* Info footer */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="p-1.5 bg-white rounded-lg shadow-sm shrink-0">
                <Layout className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                Changes saved here reflect immediately in the{' '}
                <span className="font-black text-slate-600">
                  {activeTab === 'student' ? 'Digital ID Cards' : 'Staff ID Cards'}
                </span>{' '}
                module. The preview on the right updates live as you adjust settings.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Live Preview ────────────────────────────────────────── */}
        <div className="lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">

            {/* Preview header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Live Preview</p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {selectedTemplateMeta?.name} · {selectedTemplateMeta?.orientation}
                </p>
              </div>
            </div>

            {/* Card preview area */}
            <div className="flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)] bg-[size:12px_12px] bg-slate-50 min-h-[280px]">
              {/* Scale wrapper — card renders at physical mm size, we scale it down */}
              <div style={{
                width:  scaledW,
                height: scaledH,
                overflow: 'hidden',
                borderRadius: 6,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              }}>
                <div style={{
                  transform: `scale(${SCALE})`,
                  transformOrigin: 'top left',
                  width:  cardPxW,
                  height: cardPxH,
                }}>
                  <CardTemplate {...previewProps as any} />
                </div>
              </div>

              {/* Template name badge */}
              <div className="mt-4 flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: selectedTemplateMeta?.preview }}
                />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {selectedTemplateMeta?.name}
                </span>
                <span className={cn(
                  'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full',
                  isHorizontal
                    ? 'bg-cyan-50 text-cyan-600'
                    : 'bg-violet-50 text-violet-600',
                )}>
                  {selectedTemplateMeta?.orientation}
                </span>
              </div>
            </div>

            {/* Customization summary */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                  Name: {currentCustom.nameFontSize}px
                </span>
                <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                  Photo: {currentCustom.photoSize}px
                </span>
                <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                  QR: {currentCustom.qrSize}px
                </span>
                <span className="text-[9px] font-bold bg-white px-2 py-0.5 rounded-full border border-slate-100 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: currentCustom.primaryColor }} />
                  <span className="w-2 h-2 rounded-full" style={{ background: currentCustom.accentColor }} />
                  <span className="w-2 h-2 rounded-full" style={{ background: currentCustom.textColor }} />
                </span>
              </div>
            </div>

            {/* Sample data note */}
            <div className="px-5 py-3 border-t border-slate-100 bg-amber-50">
              <p className="text-[10px] text-amber-700 font-bold text-center">
                Preview uses sample data · Actual cards show real info
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
