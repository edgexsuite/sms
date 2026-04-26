import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText, Layout, Save, CheckCircle2, AlertCircle,
  Settings as SettingsIcon, ChevronRight, Eye,
  Minus, Plus, RotateCcw, Palette, LineChart
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  REPORT_TEMPLATES, ReportTemplateId, ReportCardCustomization,
  DEFAULT_REPORT_CUSTOM, ReportCardLayoutRenderer, ReportCardProps
} from '../../lib/reportCardTemplates';

const REPORT_FIELDS = [
  { id: 'school_logo', label: 'School Logo' },
  { id: 'watermark', label: 'Background Watermark' },
  { id: 'student_photo', label: 'Student Photo' },
  { id: 'attendance_stats', label: 'Attendance Statistics' },
  { id: 'gpa_summary', label: 'GPA & Percentage Summary' },
  { id: 'teacher_remarks', label: 'Teacher Remarks' },
  { id: 'position_in_class', label: 'Position in Class (Rank)' },
];

/* ── Sample dummy data for preview ───────────────────────────────────────── */
const SAMPLE_PREVIEW: ReportCardProps = {
  studentName: 'Zohan Fareed',
  rollNumber: '1042',
  className: '9th standard - Section A',
  schoolName: 'The Edge School',
  schoolLogo: null,
  studentPhoto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop',
  activeFields: [], // Injected dynamically
  subjects: [
    { name: 'Mathematics', marks: 95, total: 100, grade: 'A+' },
    { name: 'English', marks: 88, total: 100, grade: 'A' },
    { name: 'Science', marks: 92, total: 100, grade: 'A+' },
    { name: 'History', marks: 78, total: 100, grade: 'B' },
  ],
  totalMarks: 400,
  obtainedMarks: 353,
  percentage: 88.25,
  grade: 'A',
  attendance: '95% (40/42 Days)',
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

const FONT_OPTIONS = [
  { value: 'serif', label: 'Serif (Traditional)' },
  { value: 'sans-serif', label: 'Sans-Serif (Modern)' },
  { value: 'monospace', label: 'Monospace (Minimal)' },
  { value: 'Georgia, serif', label: 'Georgia (Elegant)' },
  { value: 'Verdana, sans-serif', label: 'Verdana (Clean)' },
  { value: 'cursive', label: 'Cursive (Decorative)' },
];

function FontControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold text-slate-600 w-28 shrink-0">Title Font</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        style={{ fontFamily: value }}
      >
        {FONT_OPTIONS.map(f => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function ReportCardSettings() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<string[]>(['school_logo', 'student_photo', 'gpa_summary', 'teacher_remarks']);
  const [template, setTemplate] = useState<ReportTemplateId>('classic');
  const [customization, setCustomization] = useState<ReportCardCustomization>({ ...DEFAULT_REPORT_CUSTOM });
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (userRole?.school_id) fetchSettings();
  }, [userRole]);

  const fetchSettings = async () => {
    setLoading(true);
    const [{ data: settings }, { data: school }] = await Promise.all([
      supabase.from('report_card_settings').select('*').eq('school_id', userRole?.school_id).maybeSingle(),
      supabase.from('schools').select('*').eq('id', userRole?.school_id).single()
    ]);
    
    if (school) setSchoolInfo(school);

    if (settings) {
      if (settings.fields) setFields(settings.fields);
      if (settings.template) setTemplate(settings.template as ReportTemplateId);
      if (settings.layout_config?.customization) setCustomization({ ...DEFAULT_REPORT_CUSTOM, ...settings.layout_config.customization });
    }
    setLoading(false);
  };

  const toggleField = (id: string) => {
    setFields(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const updateCustom = (updates: Partial<ReportCardCustomization>) => {
    setCustomization(prev => ({ ...prev, ...updates }));
  };

  const updateSignature = (index: number, updates: Partial<{label: string; active: boolean}>) => {
    const newSigs = [...(customization.signatures || DEFAULT_REPORT_CUSTOM.signatures)];
    newSigs[index] = { ...newSigs[index], ...updates };
    updateCustom({ signatures: newSigs });
  };

  const resetCustomization = () => {
    setCustomization({ ...DEFAULT_REPORT_CUSTOM });
  };

  const saveSettings = async () => {
    if (!userRole?.school_id) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('report_card_settings')
      .upsert({
        school_id: userRole.school_id,
        template: template,
        fields: fields,
        layout_config: { customization },
      }, { onConflict: 'school_id' });

    setMessage(error
      ? { type: 'error', text: 'Failed to save settings. Make sure the database migration was run.' }
      : { type: 'success', text: 'Report card template saved successfully!' });
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  const selectedTemplateMeta = REPORT_TEMPLATES.find(t => t.id === template)!;

  /* Scale the physical A4 card to fit the preview panel. */
  // A4 at 96dpi is roughly 794x1123 px. We use mm in the renderer roughly equal to that.
  const SCALE = 0.40;
  const cardPxW = 794;
  const cardPxH = 1123;
  const scaledW = Math.round(cardPxW * SCALE);
  const scaledH = Math.round(cardPxH * SCALE);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <LineChart className="w-6 h-6 text-indigo-600" /> Report Card Designer
          </h1>
          <p className="text-slate-500 text-sm mt-1">Configure layout, grading options, and styling for student results.</p>
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
          
          <div className="p-6 space-y-8">
            {/* Template Picker */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Report Template</p>
              <div className="flex gap-3 flex-wrap">
                {REPORT_TEMPLATES.map(t => {
                  const isSelected = template === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTemplate(t.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all w-28 relative',
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100'
                          : 'border-slate-100 hover:border-slate-300 bg-white',
                      )}
                    >
                      <div style={{
                        width: 35,
                        height: 50,
                        borderRadius: 3,
                        background: t.preview,
                        border: '1px solid rgba(0,0,0,0.08)',
                        flexShrink: 0,
                      }} />
                      <div className={cn(
                        'text-[9px] font-black uppercase tracking-tight text-center leading-tight',
                        isSelected ? 'text-indigo-700' : 'text-slate-600',
                      )}>{t.name}</div>
                      <div className="text-[8px] uppercase tracking-widest font-bold text-slate-400 px-1 text-center">
                        {t.description}
                      </div>
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
                  <Palette className="w-3.5 h-3.5" /> Typography & Colors
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
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Font Sizes (pt)</p>
                  <SizeControl label="Header Title" value={customization.headerFontSize} onChange={v => updateCustom({ headerFontSize: v })} min={10} max={30} />
                  <SizeControl label="Marks Table" value={customization.tableFontSize} onChange={v => updateCustom({ tableFontSize: v })} min={8} max={16} />
                  <SizeControl label="Remarks Block" value={customization.remarksFontSize} onChange={v => updateCustom({ remarksFontSize: v })} min={8} max={18} />
                  <SizeControl label="Logo Dimension" value={customization.logoSize} onChange={v => updateCustom({ logoSize: v })} min={30} max={120} step={5} />
                  <SizeControl label="Watermark Opacity" value={customization.watermarkOpacity} onChange={v => updateCustom({ watermarkOpacity: v })} min={0} max={1} step={0.05} unit="" />
                </div>

                {/* Font family */}
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Typography</p>
                  <FontControl value={customization.titleFont || 'serif'} onChange={v => updateCustom({ titleFont: v })} />
                </div>

                {/* Color controls */}
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Branding Colors</p>
                  <ColorControl label="Primary Brand" value={customization.primaryColor} onChange={v => updateCustom({ primaryColor: v })} />
                  <ColorControl label="Table Header Fill" value={customization.tableHeaderColor} onChange={v => updateCustom({ tableHeaderColor: v })} />
                  <ColorControl label="Border / Stroke" value={customization.borderColor} onChange={v => updateCustom({ borderColor: v })} />
                </div>
              </div>
            </div>

            {/* ── Signature Controls ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> Authorization Signatures
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <p className="text-[11px] text-slate-500 mb-2">Enable and customize up to 4 signature lines to display at the bottom of the report card.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(customization.signatures || DEFAULT_REPORT_CUSTOM.signatures).map((sig, idx) => (
                    <div key={idx} className={cn(
                      "flex flex-col gap-2 p-3 rounded-xl border transition-colors",
                      sig.active ? "bg-white border-indigo-200 shadow-sm" : "bg-transparent border-slate-200 opacity-60"
                    )}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={sig.active} 
                          onChange={e => updateSignature(idx, { active: e.target.checked })}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer border-slate-300"
                        />
                        <span className={cn("text-xs font-bold", sig.active ? "text-indigo-900" : "text-slate-500")}>
                          Signature Line {idx + 1}
                        </span>
                      </label>
                      <input 
                        type="text" 
                        value={sig.label}
                        onChange={e => updateSignature(idx, { label: e.target.value })}
                        disabled={!sig.active}
                        className="w-full h-8 text-xs border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 font-medium px-2"
                        placeholder="e.g. Class Coordinator"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Fields */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Display Elements</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REPORT_FIELDS.map(field => (
                  <div
                    key={field.id}
                    onClick={() => toggleField(field.id)}
                    className={cn(
                      'flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer group',
                      fields.includes(field.id)
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0',
                        fields.includes(field.id)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-300 group-hover:bg-slate-200',
                      )}>
                        {fields.includes(field.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <p className={cn(
                        'text-xs font-bold uppercase tracking-tight',
                        fields.includes(field.id) ? 'text-indigo-900' : 'text-slate-600',
                      )}>
                        {field.label}
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      'w-4 h-4 transition-all',
                      fields.includes(field.id)
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
                Changes saved here will reflect immediately across all printed 
                <span className="font-black text-slate-600"> Result Cards</span>. 
                The preview on the right demonstrates the A4 layout with sample data.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Live Preview ────────────────────────────────────────── */}
        <div className="lg:w-[350px] xl:w-[400px] shrink-0 lg:sticky lg:top-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">

            {/* Preview header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-widest">A4 Paper Preview</p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {selectedTemplateMeta?.name}
                </p>
              </div>
            </div>

            {/* Card preview area */}
            <div className="flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)] bg-[size:12px_12px] bg-slate-50 min-h-[400px]">
              
              {/* Scale wrapper */}
              <div style={{
                width: scaledW,
                height: scaledH,
                overflow: 'hidden',
                borderRadius: 2,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                background: '#fff'
              }}>
                <div style={{
                  transform: `scale(${SCALE})`,
                  transformOrigin: 'top left',
                  width: cardPxW,
                  height: cardPxH,
                }}>
                  <ReportCardLayoutRenderer 
                    template={template} 
                    {...SAMPLE_PREVIEW} 
                    schoolName={schoolInfo?.name || SAMPLE_PREVIEW.schoolName}
                    schoolLogo={schoolInfo?.logo_url || SAMPLE_PREVIEW.schoolLogo}
                    activeFields={fields}
                    customization={customization}
                  />
                </div>
              </div>

              {/* Template name badge */}
              <div className="mt-6 flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: selectedTemplateMeta?.preview }}
                />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {selectedTemplateMeta?.name} Layout
                </span>
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  STANDARD A4
                </span>
              </div>
            </div>

            {/* Sample data note */}
            <div className="px-5 py-3 border-t border-slate-100 bg-amber-50">
              <p className="text-[10px] text-amber-700 font-bold text-center">
                Rendering engine uses mock student #1042 for preview calibration.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
