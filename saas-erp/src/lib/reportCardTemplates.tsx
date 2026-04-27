import React from 'react';

export type ReportTemplateId = 'classic' | 'modern' | 'minimal' | 'elegant' | 'compact' | 'royal' | 'prestige' | 'pearl';

export interface ReportCardCustomization {
  headerFontSize: number;
  tableFontSize: number;
  remarksFontSize: number;
  logoSize: number;
  watermarkOpacity: number;
  primaryColor: string;
  tableHeaderColor: string;
  borderColor: string;
  titleFont: string;
  signatures: { label: string; active: boolean }[];
}

export const DEFAULT_REPORT_CUSTOM: ReportCardCustomization = {
  headerFontSize: 16,
  tableFontSize: 10,
  remarksFontSize: 12,
  logoSize: 60,
  watermarkOpacity: 0.1,
  primaryColor: '#1d4ed8',
  tableHeaderColor: '#eff6ff',
  borderColor: '#e2e8f0',
  titleFont: 'serif',
  signatures: [
    { label: 'Class Teacher', active: true },
    { label: 'Coordinator', active: false },
    { label: 'Controller of Exams', active: false },
    { label: 'Principal / Director', active: true },
  ],
};

export interface ReportCardProps {
  studentName: string;
  rollNumber: string;
  className: string;
  schoolName: string;
  schoolLogo: string | null;
  activeFields: string[];
  studentPhoto?: string | null;
  customization?: ReportCardCustomization;
  examName?: string;
  examSession?: string;
  positionInClass?: number;
  totalStudents?: number;
  finalStatus?: string;
  subjects: { name: string; marks: number; total: number; grade: string; status?: string }[];
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  attendance: string;
}

export const REPORT_TEMPLATES: { id: ReportTemplateId; name: string; description: string; preview: string }[] = [
  { id: 'classic',  name: 'Classic Results', description: 'Traditional with decorative frame & grade badges', preview: '#1d4ed8' },
  { id: 'modern',   name: 'Modern Edge',     description: 'Dark header, progress bars, colorful grades',     preview: '#0f172a' },
  { id: 'minimal',  name: 'Minimalist',      description: 'Clean lines, grade accent marks, zero clutter',   preview: '#475569' },
  { id: 'elegant',  name: 'Elegant Profile', description: 'Corner ornaments, circular photo, refined',       preview: '#7c3aed' },
  { id: 'compact',  name: 'Compact Summary', description: 'Dense layout with colored row performance',       preview: '#059669' },
  { id: 'royal',    name: 'Royal Gold',      description: 'Dark navy & gold wave accent, grading scale',     preview: '#b8860b' },
  { id: 'prestige', name: 'Prestige',        description: 'Forest green sidebar, photo strip, corporate',   preview: '#14532d' },
  { id: 'pearl',    name: 'Pearl',           description: 'Teal-navy gradient, grading legend, modern',      preview: '#0d9488' },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function getCustom(props: ReportCardProps): ReportCardCustomization {
  return { ...DEFAULT_REPORT_CUSTOM, ...(props.customization || {}) };
}

function gradeColor(grade: string): string {
  const g = (grade || '').toUpperCase();
  if (g === 'A+') return '#059669';
  if (g === 'A')  return '#10b981';
  if (g === 'B+') return '#3b82f6';
  if (g === 'B')  return '#6366f1';
  if (g === 'C')  return '#d97706';
  if (g === 'D')  return '#ea580c';
  return '#dc2626';
}
function gradeBg(grade: string, alpha = '20'): string { return gradeColor(grade) + alpha; }
function pct(marks: number, total: number): number { return total > 0 ? Math.round((marks / total) * 100) : 0; }

function ProgressBar({ value, color, height = 3 }: { value: number; color: string; height?: number }) {
  return (
    <div style={{ height, background: '#e2e8f0', borderRadius: height, overflow: 'hidden', marginTop: '2px' }}>
      <div style={{ height, width: `${Math.min(value, 100)}%`, background: color, borderRadius: height }} />
    </div>
  );
}

function GradeBadge({ grade, fontSize = 9 }: { grade: string; fontSize?: number }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', background: gradeBg(grade), color: gradeColor(grade), borderRadius: '12px', fontWeight: '900', fontSize }}>
      {grade}
    </span>
  );
}

function StatusBadge({ status, fontSize = 8.5 }: { status?: string; fontSize?: number }) {
  if (!status || status === '—') return <span style={{ color: '#94a3b8', fontSize }}>—</span>;
  const isPass = status.toLowerCase() === 'pass';
  const isFail = status.toLowerCase() === 'fail';
  const bg = isPass ? '#dcfce7' : isFail ? '#fee2e2' : '#f1f5f9';
  const color = isPass ? '#15803d' : isFail ? '#dc2626' : '#64748b';
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', background: bg, color, borderRadius: '12px', fontWeight: '700', fontSize }}>
      {status}
    </span>
  );
}

const GRADING_SCALE = [
  { grade: 'A+', range: '90–100', label: 'Outstanding' },
  { grade: 'A',  range: '80–89',  label: 'Excellent' },
  { grade: 'B+', range: '70–79',  label: 'Very Good' },
  { grade: 'B',  range: '60–69',  label: 'Good' },
  { grade: 'C',  range: '50–59',  label: 'Satisfactory' },
  { grade: 'D',  range: '40–49',  label: 'Needs Improvement' },
  { grade: 'F',  range: 'Below 40', label: 'Unsatisfactory' },
];

// ─── CLASSIC ─────────────────────────────────────────────────────────────────

export function ClassicReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;
  const font = c.titleFont || 'Georgia, serif';
  const activeSigs = (c.signatures || []).filter(s => s.active);

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#fff', fontFamily: font, color: '#000', position: 'relative', boxSizing: 'border-box', padding: '8mm' }}>

      {/* Outer decorative frame */}
      <div style={{ position: 'absolute', inset: '6mm', border: `3px double ${c.primaryColor}`, borderRadius: '2px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: '8mm', border: `1px solid ${c.borderColor}`, borderRadius: '1px', pointerEvents: 'none', zIndex: 0 }} />

      {/* Corner ornaments */}
      {[{ top: '5mm', left: '5mm' }, { top: '5mm', right: '5mm' }, { bottom: '5mm', left: '5mm' }, { bottom: '5mm', right: '5mm' }].map((pos, i) => (
        <div key={i} style={{ position: 'absolute', ...pos, width: '12px', height: '12px', borderTop: i < 2 ? `3px solid ${c.primaryColor}` : 'none', borderBottom: i >= 2 ? `3px solid ${c.primaryColor}` : 'none', borderLeft: i % 2 === 0 ? `3px solid ${c.primaryColor}` : 'none', borderRight: i % 2 === 1 ? `3px solid ${c.primaryColor}` : 'none', zIndex: 2 }} />
      ))}

      {/* Watermark */}
      {activeFields.includes('watermark') && props.schoolLogo && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, pointerEvents: 'none' }}>
          <img src={props.schoolLogo} alt="" style={{ width: '380px', height: '380px', objectFit: 'contain', opacity: c.watermarkOpacity, transform: 'rotate(-45deg)' }} />
        </div>
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, padding: '8mm 10mm 6mm' }}>

        {/* Header banner */}
        <div style={{ background: c.primaryColor, borderRadius: '6px', padding: '12px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px', color: '#fff' }}>
          {activeFields.includes('school_logo') && props.schoolLogo && (
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '4px' }}>
              <img src={props.schoolLogo} alt="" style={{ width: c.logoSize * 0.85, height: c.logoSize * 0.85, objectFit: 'contain', display: 'block' }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: c.headerFontSize, fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{props.schoolName}</div>
            <div style={{ fontSize: c.headerFontSize * 0.55, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '3px', marginTop: '3px' }}>Academic Report Card</div>
            {props.examName && <div style={{ fontSize: c.tableFontSize * 0.9, opacity: 0.8, marginTop: '2px' }}>{props.examName}{props.examSession ? ` · ${props.examSession}` : ''}</div>}
          </div>
          {/* Grade circle */}
          {activeFields.includes('gpa_summary') && (
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '64px', height: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: c.tableFontSize * 2, fontWeight: '900', lineHeight: 1 }}>{props.grade}</div>
              <div style={{ fontSize: c.tableFontSize * 0.75, opacity: 0.9 }}>{props.percentage}%</div>
            </div>
          )}
        </div>

        {/* Student info */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', fontSize: c.tableFontSize }}>
          <div style={{ flex: 1, border: `1px solid ${c.borderColor}`, borderRadius: '6px', padding: '8px 12px', background: c.tableHeaderColor }}>
            {[['Student', props.studentName], ['Roll No', props.rollNumber], ['Class', props.className]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', gap: '6px', marginBottom: '3px' }}>
                <span style={{ color: '#6b7280', minWidth: '54px' }}>{l}:</span>
                <span style={{ fontWeight: '600', color: '#111' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, border: `1px solid ${c.borderColor}`, borderRadius: '6px', padding: '8px 12px', background: c.tableHeaderColor }}>
            {activeFields.includes('attendance_stats') && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '3px' }}>
                <span style={{ color: '#6b7280', minWidth: '62px' }}>Attendance:</span>
                <span style={{ fontWeight: '600' }}>{props.attendance}</span>
              </div>
            )}
            {props.positionInClass && props.totalStudents && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '3px' }}>
                <span style={{ color: '#6b7280', minWidth: '62px' }}>Position:</span>
                <span style={{ fontWeight: '700', color: c.primaryColor }}>{props.positionInClass} / {props.totalStudents}</span>
              </div>
            )}
            {props.finalStatus && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ color: '#6b7280', minWidth: '62px' }}>Status:</span>
                <StatusBadge status={props.finalStatus} fontSize={c.tableFontSize * 0.9} />
              </div>
            )}
          </div>
          {activeFields.includes('student_photo') && props.studentPhoto && (
            <img src={props.studentPhoto} alt="Student" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: `2px solid ${c.primaryColor}`, flexShrink: 0 }} />
          )}
        </div>

        {/* Marks table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: c.tableFontSize }}>
          <thead>
            <tr style={{ background: c.primaryColor, color: '#fff' }}>
              {['Subject', 'Total Marks', 'Obtained', '%', 'Grade', 'Status'].map((h, i) => (
                <th key={h} style={{ padding: '7px 8px', textAlign: i === 0 ? 'left' : 'center', fontWeight: '700', fontSize: c.tableFontSize * 0.88, letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub, i) => {
              const sp = pct(sub.marks, sub.total);
              const gc = gradeColor(sub.grade);
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${c.borderColor}`, background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '6px 8px', fontWeight: '500' }}>
                    {sub.name}
                    <ProgressBar value={sp} color={gc} height={3} />
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: '#6b7280' }}>{sub.total}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', color: gc }}>{sub.marks}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: '#475569' }}>{sp}%</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}><GradeBadge grade={sub.grade} fontSize={c.tableFontSize * 0.85} /></td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}><StatusBadge status={sub.status} fontSize={c.tableFontSize * 0.85} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: c.tableHeaderColor, fontWeight: '700', borderTop: `2px solid ${c.primaryColor}` }}>
              <td style={{ padding: '7px 8px', color: c.primaryColor }}>TOTAL</td>
              <td style={{ padding: '7px 8px', textAlign: 'center' }}>{props.totalMarks}</td>
              <td style={{ padding: '7px 8px', textAlign: 'center', color: c.primaryColor }}>{props.obtainedMarks}</td>
              <td style={{ padding: '7px 8px', textAlign: 'center', color: c.primaryColor }}>{props.percentage}%</td>
              <td style={{ padding: '7px 8px', textAlign: 'center' }} colSpan={2}><GradeBadge grade={props.grade} fontSize={c.tableFontSize} /></td>
            </tr>
          </tfoot>
        </table>

        {/* Remarks */}
        {activeFields.includes('teacher_remarks') && (
          <div style={{ border: `1px solid ${c.borderColor}`, borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', background: '#fafafa' }}>
            <div style={{ fontSize: c.tableFontSize * 0.85, fontWeight: '700', color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Teacher Remarks</div>
            <div style={{ borderBottom: '1px dashed #d1d5db', height: '18px' }} />
            <div style={{ borderBottom: '1px dashed #d1d5db', height: '18px' }} />
          </div>
        )}

        {/* Signatures */}
        {activeSigs.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', borderTop: `2px solid ${c.primaryColor}`, paddingTop: '10px' }}>
            {activeSigs.map((sig, idx) => (
              <div key={idx} style={{ textAlign: 'center', minWidth: '100px' }}>
                <div style={{ height: '28px', borderBottom: `1px solid #9ca3af`, marginBottom: '5px' }} />
                <div style={{ fontSize: c.tableFontSize * 0.9, fontWeight: '600', color: '#374151' }}>{sig.label}</div>
                <div style={{ fontSize: c.tableFontSize * 0.75, color: '#9ca3af' }}>Signature</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODERN ──────────────────────────────────────────────────────────────────

export function ModernReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;
  const font = c.titleFont || 'sans-serif';
  const activeSigs = (c.signatures || []).filter(s => s.active);

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#f1f5f9', padding: '0', fontFamily: font, color: '#0f172a', position: 'relative', boxSizing: 'border-box' }}>

      {activeFields.includes('watermark') && props.schoolLogo && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, pointerEvents: 'none' }}>
          <img src={props.schoolLogo} alt="" style={{ width: '420px', height: '420px', objectFit: 'contain', opacity: c.watermarkOpacity, transform: 'rotate(-45deg)' }} />
        </div>
      )}

      {/* Colored header */}
      <div style={{ background: `linear-gradient(135deg, ${c.primaryColor} 0%, ${c.primaryColor}cc 100%)`, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', right: '-30px', top: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: '60px', bottom: '-40px', width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        {activeFields.includes('school_logo') && props.schoolLogo && (
          <div style={{ background: 'rgba(255,255,255,0.15)', padding: '6px', borderRadius: '10px', flexShrink: 0, zIndex: 1 }}>
            <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, objectFit: 'contain', display: 'block' }} />
          </div>
        )}
        <div style={{ flex: 1, zIndex: 1 }}>
          <h1 style={{ fontSize: c.headerFontSize * 1.2, fontWeight: '900', margin: 0, color: '#fff', letterSpacing: '-0.5px' }}>{props.schoolName}</h1>
          <div style={{ fontSize: c.headerFontSize * 0.55, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '4px' }}>
            Official Grade Report{props.examName ? ` · ${props.examName}` : ''}
          </div>
        </div>

        {/* Grade pill */}
        {activeFields.includes('gpa_summary') && (
          <div style={{ zIndex: 1, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)', borderRadius: '12px', padding: '10px 16px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: c.tableFontSize * 0.78, textTransform: 'uppercase', letterSpacing: '1px' }}>Result</div>
            <div style={{ color: '#fff', fontSize: c.tableFontSize * 2.4, fontWeight: '900', lineHeight: 1 }}>{props.grade}</div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: c.tableFontSize * 0.85, marginTop: '2px' }}>{props.percentage}%</div>
          </div>
        )}

        {activeFields.includes('student_photo') && props.studentPhoto && (
          <img src={props.studentPhoto} alt="Student" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', zIndex: 1, flexShrink: 0 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '14px 18px', position: 'relative', zIndex: 1 }}>

        {/* Info cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
          {[
            { label: 'Student Name', value: props.studentName },
            { label: 'Roll Number', value: props.rollNumber },
            { label: 'Class / Grade', value: props.className },
          ].map(item => (
            <div key={item.label} style={{ background: '#fff', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: c.tableFontSize * 0.78, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{item.label}</div>
              <div style={{ fontSize: c.tableFontSize * 1.05, fontWeight: '700', color: '#0f172a' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Subject table */}
        <div style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.tableFontSize }}>
            <thead>
              <tr style={{ background: c.tableHeaderColor, borderBottom: `2px solid ${c.primaryColor}30` }}>
                {['Subject', 'Max', 'Obtained', 'Progress', 'Grade', 'Status'].map((h, i) => (
                  <th key={h} style={{ padding: '9px 10px', textAlign: i === 0 ? 'left' : 'center', color: '#334155', fontWeight: '700', fontSize: c.tableFontSize * 0.85 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub, i) => {
                const sp = pct(sub.marks, sub.total);
                const gc = gradeColor(sub.grade);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid #f1f5f9` }}>
                    <td style={{ padding: '8px 10px', fontWeight: '500', color: '#1e293b' }}>{sub.name}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{sub.total}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: gc }}>{sub.marks}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', minWidth: '70px' }}>
                      <div style={{ fontSize: c.tableFontSize * 0.78, color: '#64748b', marginBottom: '2px' }}>{sp}%</div>
                      <ProgressBar value={sp} color={gc} height={5} />
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}><GradeBadge grade={sub.grade} fontSize={c.tableFontSize * 0.85} /></td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}><StatusBadge status={sub.status} fontSize={c.tableFontSize * 0.85} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom grid */}
        <div style={{ display: 'grid', gridTemplateColumns: activeFields.includes('teacher_remarks') ? '1fr 1.5fr' : '1fr', gap: '12px', marginBottom: '14px' }}>
          {/* Stats */}
          <div style={{ background: '#fff', borderRadius: '10px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Total Marks', value: `${props.obtainedMarks} / ${props.totalMarks}` },
              ...(activeFields.includes('attendance_stats') ? [{ label: 'Attendance', value: props.attendance }] : []),
              ...(props.positionInClass && props.totalStudents ? [{ label: 'Class Rank', value: `${props.positionInClass} of ${props.totalStudents}` }] : []),
              ...(props.finalStatus ? [{ label: 'Promotion', value: props.finalStatus }] : []),
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid #f1f5f9`, paddingBottom: '6px' }}>
                <span style={{ fontSize: c.tableFontSize * 0.88, color: '#64748b' }}>{item.label}</span>
                <span style={{ fontSize: c.tableFontSize * 0.95, fontWeight: '700', color: '#1e293b' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {activeFields.includes('teacher_remarks') && (
            <div style={{ background: '#fff', borderRadius: '10px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: c.tableFontSize * 0.8, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '8px' }}>Teacher / Principal Remarks</div>
              {[1, 2, 3].map(n => (
                <div key={n} style={{ borderBottom: '1px dashed #e2e8f0', height: '20px', marginBottom: '4px' }} />
              ))}
            </div>
          )}
        </div>

        {/* Signatures */}
        {activeSigs.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${c.primaryColor}40`, paddingTop: '10px' }}>
            {activeSigs.map((sig, idx) => (
              <div key={idx} style={{ textAlign: 'center', minWidth: '100px' }}>
                <div style={{ height: '26px', borderBottom: `1px solid #94a3b8`, marginBottom: '5px' }} />
                <div style={{ fontSize: c.tableFontSize * 0.9, fontWeight: '700', color: '#334155' }}>{sig.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MINIMAL ─────────────────────────────────────────────────────────────────

export function MinimalReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;
  const font = c.titleFont || 'monospace';
  const activeSigs = (c.signatures || []).filter(s => s.active);

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#fff', padding: '12mm 14mm', fontFamily: font, color: '#000', position: 'relative', boxSizing: 'border-box' }}>

      {activeFields.includes('watermark') && props.schoolLogo && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, pointerEvents: 'none' }}>
          <img src={props.schoolLogo} alt="" style={{ width: '380px', height: '380px', objectFit: 'contain', opacity: c.watermarkOpacity, transform: 'rotate(-15deg)', filter: 'grayscale(100%)' }} />
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header with left accent */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', borderBottom: `2px solid #000`, paddingBottom: '14px', marginBottom: '24px' }}>
          <div style={{ width: '5px', height: '52px', background: '#000', borderRadius: '3px', flexShrink: 0 }} />
          {activeFields.includes('school_logo') && props.schoolLogo && (
            <img src={props.schoolLogo} alt="" style={{ width: c.logoSize * 0.9, height: c.logoSize * 0.9, objectFit: 'contain', filter: 'grayscale(100%)', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: c.headerFontSize * 1.1, margin: 0, textTransform: 'uppercase', fontWeight: '900', letterSpacing: '2px' }}>{props.schoolName}</h1>
            <h2 style={{ fontSize: c.headerFontSize * 0.65, margin: '5px 0 0', fontWeight: 'normal', letterSpacing: '3px', color: '#555' }}>ACADEMIC TRANSCRIPT</h2>
            {props.examName && <div style={{ fontSize: c.tableFontSize, color: '#888', marginTop: '3px', letterSpacing: '1px' }}>{props.examName}</div>}
          </div>
          {activeFields.includes('student_photo') && props.studentPhoto && (
            <div style={{ border: '2px solid #000', padding: '2px', flexShrink: 0 }}>
              <img src={props.studentPhoto} alt="Student" style={{ width: '70px', height: '70px', objectFit: 'cover', display: 'block', filter: 'grayscale(100%)' }} />
            </div>
          )}
        </div>

        {/* Student info in 3 columns */}
        <div style={{ display: 'flex', gap: '30px', marginBottom: '24px', fontSize: c.tableFontSize }}>
          {[['NAME', props.studentName], ['ROLL NO', props.rollNumber], ['CLASS', props.className], ...(activeFields.includes('attendance_stats') ? [['ATTENDANCE', props.attendance]] : [])].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#888', fontSize: c.tableFontSize * 0.78, letterSpacing: '1.5px', marginBottom: '2px' }}>{l}</span>
              <span style={{ fontWeight: '900', fontSize: c.tableFontSize * 1.1, letterSpacing: '0.5px' }}>{v}</span>
            </div>
          ))}
          {props.finalStatus && (
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: c.tableFontSize * 0.78, letterSpacing: '1.5px', marginBottom: '2px' }}>STATUS</span>
              <span style={{ fontWeight: '900', fontSize: c.tableFontSize * 1.1, color: props.finalStatus === 'PROMOTED' ? '#15803d' : '#dc2626' }}>{props.finalStatus}</span>
            </div>
          )}
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: c.tableFontSize }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #000', borderTop: '2px solid #000' }}>
              {['SUBJECT', 'TOTAL', 'SCORE', '%', 'GRADE', 'STATUS'].map((h, i) => (
                <th key={h} style={{ padding: '8px 0', textAlign: i === 0 ? 'left' : 'right', fontWeight: '700', letterSpacing: '1px', fontSize: c.tableFontSize * 0.85 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub, i) => {
              const sp = pct(sub.marks, sub.total);
              const gc = gradeColor(sub.grade);
              return (
                <tr key={i}>
                  <td style={{ padding: '7px 0', borderBottom: '1px dotted #ccc' }}>
                    {/* Grade color accent */}
                    <span style={{ display: 'inline-block', width: '4px', height: '12px', background: gc, borderRadius: '2px', marginRight: '8px', verticalAlign: 'middle' }} />
                    {sub.name}
                  </td>
                  <td style={{ padding: '7px 0', textAlign: 'right', borderBottom: '1px dotted #ccc', color: '#555' }}>{sub.total}</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', borderBottom: '1px dotted #ccc', fontWeight: '700' }}>{sub.marks}</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', borderBottom: '1px dotted #ccc', color: '#555' }}>{sp}%</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', borderBottom: '1px dotted #ccc', fontWeight: '900', color: gc }}>{sub.grade}</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', borderBottom: '1px dotted #ccc', fontSize: c.tableFontSize * 0.85, color: sub.status === 'Pass' ? '#15803d' : sub.status === 'Fail' ? '#dc2626' : '#888' }}>{sub.status || '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderBottom: '2px solid #000', borderTop: '2px solid #000', fontWeight: '900' }}>
              <td style={{ padding: '9px 0' }}>TOTAL</td>
              <td style={{ padding: '9px 0', textAlign: 'right' }}>{props.totalMarks}</td>
              <td style={{ padding: '9px 0', textAlign: 'right' }}>{props.obtainedMarks}</td>
              <td style={{ padding: '9px 0', textAlign: 'right' }}>{props.percentage}%</td>
              <td style={{ padding: '9px 0', textAlign: 'right', color: gradeColor(props.grade) }}>{props.grade}</td>
              <td style={{ padding: '9px 0', textAlign: 'right' }} />
            </tr>
          </tfoot>
        </table>

        {activeFields.includes('teacher_remarks') && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: c.tableFontSize * 0.85, marginBottom: '6px', fontWeight: '700' }}>Remarks:</div>
            {[1, 2].map(n => <div key={n} style={{ borderBottom: '1px dashed #ccc', height: '20px', marginBottom: '4px' }} />)}
          </div>
        )}

        {activeSigs.length > 0 && (
          <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
            {activeSigs.map((sig, idx) => (
              <div key={idx} style={{ textAlign: 'center' }}>
                <div style={{ width: '140px', borderTop: '1px solid #000', paddingTop: '8px', fontSize: c.tableFontSize * 0.85, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                  {sig.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ELEGANT ─────────────────────────────────────────────────────────────────

export function ElegantReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;
  const font = c.titleFont || 'Georgia, serif';
  const activeSigs = (c.signatures || []).filter(s => s.active);

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#fafafa', padding: '0', fontFamily: font, color: '#111827', position: 'relative', boxSizing: 'border-box' }}>

      {/* Corner ornaments */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '80px', height: '80px', zIndex: 0 }} viewBox="0 0 80 80">
        <path d="M0,0 L50,0 Q40,10 30,8 Q15,6 8,20 Q6,30 0,40 Z" fill={c.primaryColor} opacity="0.12" />
        <path d="M0,0 L30,0 Q24,8 18,6 Q8,4 4,14 Q2,22 0,30 Z" fill={c.primaryColor} opacity="0.18" />
        <circle cx="8" cy="8" r="3" fill={c.primaryColor} opacity="0.4" />
      </svg>
      <svg style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', zIndex: 0 }} viewBox="0 0 80 80">
        <path d="M80,0 L30,0 Q40,10 50,8 Q65,6 72,20 Q74,30 80,40 Z" fill={c.primaryColor} opacity="0.12" />
        <path d="M80,0 L50,0 Q56,8 62,6 Q72,4 76,14 Q78,22 80,30 Z" fill={c.primaryColor} opacity="0.18" />
        <circle cx="72" cy="8" r="3" fill={c.primaryColor} opacity="0.4" />
      </svg>
      <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '80px', height: '80px', zIndex: 0 }} viewBox="0 0 80 80">
        <path d="M0,80 L50,80 Q40,70 30,72 Q15,74 8,60 Q6,50 0,40 Z" fill={c.primaryColor} opacity="0.12" />
        <circle cx="8" cy="72" r="3" fill={c.primaryColor} opacity="0.4" />
      </svg>
      <svg style={{ position: 'absolute', bottom: 0, right: 0, width: '80px', height: '80px', zIndex: 0 }} viewBox="0 0 80 80">
        <path d="M80,80 L30,80 Q40,70 50,72 Q65,74 72,60 Q74,50 80,40 Z" fill={c.primaryColor} opacity="0.12" />
        <circle cx="72" cy="72" r="3" fill={c.primaryColor} opacity="0.4" />
      </svg>

      {/* Outer border */}
      <div style={{ position: 'absolute', inset: '5mm', border: `1px solid ${c.primaryColor}40`, borderRadius: '3px', pointerEvents: 'none', zIndex: 0 }} />

      {activeFields.includes('watermark') && props.schoolLogo && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, pointerEvents: 'none' }}>
          <img src={props.schoolLogo} alt="" style={{ width: '420px', height: '420px', objectFit: 'contain', opacity: c.watermarkOpacity }} />
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1, padding: '12mm 14mm 8mm' }}>

        {/* Centered header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          {activeFields.includes('school_logo') && props.schoolLogo && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ width: c.logoSize + 12, height: c.logoSize + 12, borderRadius: '50%', background: `${c.primaryColor}15`, border: `2px solid ${c.primaryColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, objectFit: 'contain' }} />
              </div>
            </div>
          )}
          <div style={{ position: 'relative', marginBottom: '6px' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: `${c.borderColor}`, zIndex: 0 }} />
            <h1 style={{ fontSize: c.headerFontSize * 1.1, margin: 0, color: c.primaryColor, textTransform: 'uppercase', letterSpacing: '4px', background: '#fafafa', display: 'inline', padding: '0 16px', position: 'relative', zIndex: 1 }}>
              {props.schoolName}
            </h1>
          </div>
          <div style={{ fontSize: c.headerFontSize * 0.55, letterSpacing: '5px', color: '#6b7280', textTransform: 'uppercase' }}>
            Student Progress Report {props.examName ? `· ${props.examName}` : ''}
          </div>
          {props.examSession && <div style={{ fontSize: c.tableFontSize, color: '#9ca3af', marginTop: '3px' }}>{props.examSession}</div>}
        </div>

        {/* Student row with photo */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '18px', padding: '14px 16px', background: '#fff', borderRadius: '10px', border: `1px solid ${c.borderColor}`, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
          {activeFields.includes('student_photo') && props.studentPhoto ? (
            <img src={props.studentPhoto} alt="Student" style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '50%', border: `4px solid ${c.tableHeaderColor}`, boxShadow: `0 0 0 3px ${c.primaryColor}30`, flexShrink: 0 }} />
          ) : (
            <div style={{ width: '78px', height: '78px', borderRadius: '50%', background: `${c.primaryColor}15`, border: `3px solid ${c.primaryColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 28, color: c.primaryColor, fontWeight: '900' }}>{props.studentName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: c.tableFontSize * 1.7, fontWeight: '700', color: '#111827', marginBottom: '5px' }}>{props.studentName}</div>
            <div style={{ display: 'flex', gap: '20px', fontSize: c.tableFontSize * 1.05, color: '#4b5563', flexWrap: 'wrap' }}>
              <span><strong>Roll No:</strong> {props.rollNumber}</span>
              <span><strong>Class:</strong> {props.className}</span>
              {activeFields.includes('attendance_stats') && <span><strong>Attendance:</strong> {props.attendance}</span>}
            </div>
          </div>
          {(props.positionInClass || props.finalStatus) && (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              {props.positionInClass && props.totalStudents && (
                <div style={{ padding: '8px 14px', background: `${c.primaryColor}12`, border: `1px solid ${c.primaryColor}30`, borderRadius: '8px', marginBottom: '6px' }}>
                  <div style={{ fontSize: c.tableFontSize * 0.78, color: '#6b7280' }}>Rank</div>
                  <div style={{ fontSize: c.tableFontSize * 1.3, fontWeight: '900', color: c.primaryColor }}>{props.positionInClass}<span style={{ fontSize: c.tableFontSize * 0.8, color: '#6b7280' }}>/{props.totalStudents}</span></div>
                </div>
              )}
              {props.finalStatus && <StatusBadge status={props.finalStatus} fontSize={c.tableFontSize} />}
            </div>
          )}
        </div>

        {/* Marks table */}
        <div style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${c.borderColor}`, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.tableFontSize }}>
            <thead>
              <tr style={{ background: `linear-gradient(90deg, ${c.primaryColor}, ${c.primaryColor}cc)` }}>
                {['Subject', 'Max Marks', 'Obtained', 'Percentage', 'Grade', 'Status'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'center', color: '#fff', fontWeight: '700', fontSize: c.tableFontSize * 0.85 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub, i) => {
                const sp = pct(sub.marks, sub.total);
                const gc = gradeColor(sub.grade);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${c.borderColor}`, background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '9px 12px', fontWeight: '500' }}>{sub.name}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#6b7280' }}>{sub.total}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '700', color: gc }}>{sub.marks}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: c.tableFontSize * 0.85, marginBottom: '3px', color: '#475569' }}>{sp}%</div>
                      <ProgressBar value={sp} color={gc} height={4} />
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}><GradeBadge grade={sub.grade} fontSize={c.tableFontSize * 0.9} /></td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}><StatusBadge status={sub.status} fontSize={c.tableFontSize * 0.9} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: c.tableHeaderColor, borderTop: `2px solid ${c.primaryColor}` }}>
                <td style={{ padding: '9px 12px', fontWeight: '700', color: c.primaryColor }}>OVERALL</td>
                <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '600' }}>{props.totalMarks}</td>
                <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '700', color: gradeColor(props.grade) }}>{props.obtainedMarks}</td>
                <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '700', color: c.primaryColor }}>{props.percentage}%</td>
                <td style={{ padding: '9px 12px', textAlign: 'center' }} colSpan={2}><GradeBadge grade={props.grade} fontSize={c.tableFontSize} /></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remarks + Signatures */}
        <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
          {activeFields.includes('teacher_remarks') && (
            <div style={{ flex: 1.5, border: `1px solid ${c.borderColor}`, borderRadius: '10px', padding: '12px', background: '#fff' }}>
              <div style={{ fontSize: c.tableFontSize * 0.82, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700', marginBottom: '8px' }}>Instructor Remarks</div>
              {[1, 2].map(n => <div key={n} style={{ borderBottom: '1px dashed #e2e8f0', height: '20px', marginBottom: '6px' }} />)}
            </div>
          )}
          {activeFields.includes('gpa_summary') && (
            <div style={{ flex: 1, border: `1px solid ${c.borderColor}`, borderRadius: '10px', padding: '12px', background: c.tableHeaderColor, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: c.tableFontSize * 0.82, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Final Grade</div>
              <div style={{ fontSize: c.tableFontSize * 3, fontWeight: '900', color: gradeColor(props.grade), lineHeight: 1.1 }}>{props.grade}</div>
              <div style={{ fontSize: c.tableFontSize * 1.1, fontWeight: '700', color: '#374151' }}>{props.percentage}%</div>
            </div>
          )}
        </div>

        {activeSigs.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${c.borderColor}`, paddingTop: '12px' }}>
            {activeSigs.map((sig, idx) => (
              <div key={idx} style={{ textAlign: 'center', minWidth: '110px' }}>
                <div style={{ height: '32px', borderBottom: `1px solid ${c.borderColor}`, marginBottom: '8px' }} />
                <div style={{ fontSize: c.tableFontSize, fontWeight: '600', color: '#374151' }}>{sig.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COMPACT ─────────────────────────────────────────────────────────────────

export function CompactReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;
  const font = c.titleFont || 'sans-serif';
  const activeSigs = (c.signatures || []).filter(s => s.active);

  // Performance tier color
  function tierColor(p: number): string {
    if (p >= 90) return '#ecfdf5';
    if (p >= 75) return '#eff6ff';
    if (p >= 60) return '#fefce8';
    if (p >= 40) return '#fff7ed';
    return '#fef2f2';
  }

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#fff', padding: '7mm 9mm', fontFamily: font, color: '#1e293b', position: 'relative', boxSizing: 'border-box' }}>

      {activeFields.includes('watermark') && props.schoolLogo && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, pointerEvents: 'none' }}>
          <img src={props.schoolLogo} alt="" style={{ width: '340px', height: '340px', objectFit: 'contain', opacity: c.watermarkOpacity, transform: 'rotate(-30deg)' }} />
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Dense header */}
        <div style={{ display: 'flex', alignItems: 'center', background: c.primaryColor, padding: '10px 14px', borderRadius: '8px', marginBottom: '10px', gap: '12px' }}>
          {activeFields.includes('school_logo') && props.schoolLogo && (
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '6px', padding: '3px', flexShrink: 0 }}>
              <img src={props.schoolLogo} alt="" style={{ width: c.logoSize * 0.7, height: c.logoSize * 0.7, objectFit: 'contain', display: 'block' }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: c.headerFontSize * 0.95, fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>{props.schoolName}</div>
            <div style={{ fontSize: c.headerFontSize * 0.5, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Academic Report{props.examName ? ` · ${props.examName}` : ''}</div>
          </div>
          {activeFields.includes('student_photo') && props.studentPhoto && (
            <img src={props.studentPhoto} alt="Student" style={{ width: '55px', height: '55px', objectFit: 'cover', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />
          )}
          {/* Grade badge in header */}
          <div style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '8px', padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 7, textTransform: 'uppercase' }}>Grade</div>
            <div style={{ color: '#fff', fontSize: c.tableFontSize * 1.8, fontWeight: '900', lineHeight: 1 }}>{props.grade}</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 7, marginTop: '1px' }}>{props.percentage}%</div>
          </div>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px', fontSize: c.tableFontSize * 0.92 }}>
          {[['Name', props.studentName], ['Roll No', props.rollNumber], ['Class', props.className], ...(activeFields.includes('attendance_stats') ? [['Attendance', props.attendance]] : [{ label: 'Status', value: props.finalStatus || '—' }].map(i => [i.label, i.value]))].map(([l, v]) => (
            <div key={l} style={{ background: c.tableHeaderColor, borderRadius: '6px', padding: '6px 8px', border: `1px solid ${c.borderColor}` }}>
              <div style={{ fontSize: c.tableFontSize * 0.75, color: '#64748b', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l}</div>
              <div style={{ fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Subject table with color-coded rows */}
        <div style={{ border: `1px solid ${c.borderColor}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.tableFontSize * 0.9 }}>
            <thead>
              <tr style={{ background: c.tableHeaderColor, borderBottom: `2px solid ${c.primaryColor}40` }}>
                {['Subject', 'Max', 'Obt', '%', 'Progress', 'Grd', 'Status'].map((h, i) => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: i === 0 ? 'left' : 'center', fontWeight: '700', fontSize: c.tableFontSize * 0.8, color: '#334155', letterSpacing: '0.3px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub, i) => {
                const sp = pct(sub.marks, sub.total);
                const gc = gradeColor(sub.grade);
                return (
                  <tr key={i} style={{ background: tierColor(sp), borderBottom: `1px solid ${c.borderColor}` }}>
                    <td style={{ padding: '5px 8px', fontWeight: '500', borderLeft: `3px solid ${gc}` }}>{sub.name}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', color: '#64748b' }}>{sub.total}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: '700', color: gc }}>{sub.marks}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', color: '#475569' }}>{sp}%</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', minWidth: '60px' }}>
                      <ProgressBar value={sp} color={gc} height={4} />
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}><GradeBadge grade={sub.grade} fontSize={c.tableFontSize * 0.8} /></td>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}><StatusBadge status={sub.status} fontSize={c.tableFontSize * 0.8} /></td>
                  </tr>
                );
              })}
            </tbody>
            {activeFields.includes('gpa_summary') && (
              <tfoot>
                <tr style={{ background: c.tableHeaderColor, fontWeight: '700', borderTop: `2px solid ${c.primaryColor}` }}>
                  <td style={{ padding: '7px 8px', borderLeft: `3px solid ${gradeColor(props.grade)}` }}>OVERALL</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{props.totalMarks}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', color: gradeColor(props.grade) }}>{props.obtainedMarks}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', color: c.primaryColor }}>{props.percentage}%</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                    <ProgressBar value={props.percentage} color={gradeColor(props.grade)} height={5} />
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }} colSpan={2}><GradeBadge grade={props.grade} fontSize={c.tableFontSize} /></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          {activeFields.includes('teacher_remarks') && (
            <div style={{ flex: 1, padding: '8px 10px', border: `1px solid ${c.borderColor}`, borderRadius: '6px' }}>
              <strong style={{ fontSize: c.tableFontSize * 0.85, color: '#64748b', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Remarks:</strong>
              {[1, 2].map(n => <div key={n} style={{ borderBottom: '1px dashed #d1d5db', height: '16px', marginBottom: '3px' }} />)}
            </div>
          )}
          {activeSigs.length > 0 && (
            <div style={{ display: 'flex', gap: '14px' }}>
              {activeSigs.map((sig, idx) => (
                <div key={idx} style={{ width: '120px', textAlign: 'center' }}>
                  <div style={{ borderTop: `1px solid ${c.borderColor}`, paddingTop: '4px', fontSize: c.tableFontSize * 0.85, fontWeight: '600', color: '#374151' }}>{sig.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ROYAL ───────────────────────────────────────────────────────────────────

export function RoyalReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;
  const NAVY = '#1a2744';
  const GOLD = '#c8960c';
  const GOLD2 = '#e8b84b';
  const font = c.titleFont || 'Georgia, serif';
  const activeSigs = (c.signatures || []).filter(s => s.active);

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#ffffff', fontFamily: font, color: '#1a1a1a', position: 'relative', boxSizing: 'border-box' }}>

      {/* Wave decoration */}
      <svg viewBox="0 0 160 842" xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '160px', zIndex: 0 }} preserveAspectRatio="none">
        <path d="M160,0 L80,0 Q20,120 60,210 Q110,310 40,420 Q-10,530 50,630 Q100,720 60,842 L160,842 Z" fill={NAVY} />
        <path d="M160,0 L95,0 Q35,130 72,220 Q118,325 52,432 Q4,540 62,640 Q108,730 72,842 L85,842 Q52,730 100,640 Q42,540 90,432 Q156,325 108,220 Q72,130 110,0 Z" fill={GOLD} opacity="0.85" />
        <path d="M118,0 Q82,140 105,250 Q138,360 95,460 Q62,555 98,660 Q118,730 100,842" fill="none" stroke={GOLD2} strokeWidth="2" opacity="0.6" />
      </svg>

      {activeFields.includes('watermark') && props.schoolLogo && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: '160px', bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, pointerEvents: 'none' }}>
          <img src={props.schoolLogo} alt="" style={{ width: '320px', height: '320px', objectFit: 'contain', opacity: c.watermarkOpacity, transform: 'rotate(-20deg)' }} />
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1, padding: '8mm 52mm 6mm 10mm', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: `2px solid ${GOLD}`, paddingBottom: '8px', marginBottom: '10px' }}>
          <div style={{ marginRight: '12px', flexShrink: 0 }}>
            {activeFields.includes('school_logo') && props.schoolLogo ? (
              <img src={props.schoolLogo} alt="" style={{ width: c.logoSize * 0.9, height: c.logoSize * 0.9, objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 52, height: 52, background: NAVY, borderRadius: '6px 6px 50% 50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: GOLD, fontSize: 22, fontWeight: 'bold' }}>✦</span>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: c.headerFontSize * 1.35, fontWeight: 'bold', color: NAVY, textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1.1 }}>{props.schoolName}</div>
            <div style={{ fontSize: c.tableFontSize * 0.95, color: GOLD, fontStyle: 'italic', letterSpacing: '2px', marginTop: '3px' }}>INSPIRE · EMPOWER · EXCEL</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: c.headerFontSize * 1.1, fontWeight: '900', color: GOLD, textTransform: 'uppercase' }}>REPORT CARD</div>
            <div style={{ fontSize: c.tableFontSize * 1.1, color: NAVY, fontWeight: '600' }}>{props.examSession || props.examName || new Date().getFullYear()}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span style={{ color: GOLD, fontSize: 12 }}>◆ ◇ ◆</span>
        </div>

        {/* Student info */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 16px', fontSize: c.tableFontSize * 0.95 }}>
            {[['Student Name', props.studentName], ['Term', props.examName || '—'], ['Roll / ID', props.rollNumber], ['Academic Year', props.examSession || '—'],
              ['Grade / Class', props.className], ['Date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
              ...(activeFields.includes('attendance_stats') ? [['Attendance', props.attendance]] : []),
              ...(props.positionInClass && props.totalStudents ? [['Position', `${props.positionInClass} of ${props.totalStudents}`]] : []),
            ].map(([label, val], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '5px', borderBottom: '1px solid #e5e5e5', paddingBottom: '2px' }}>
                <span style={{ fontWeight: '600', color: '#444', minWidth: '78px', fontSize: c.tableFontSize * 0.85 }}>{label}:</span>
                <span style={{ flex: 1, color: '#222' }}>{val}</span>
              </div>
            ))}
          </div>
          {activeFields.includes('student_photo') && props.studentPhoto && (
            <img src={props.studentPhoto} alt="Student" style={{ width: '80px', height: '90px', objectFit: 'cover', border: `2px solid ${GOLD}`, borderRadius: '4px', flexShrink: 0 }} />
          )}
        </div>

        {/* Marks table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.tableFontSize, marginBottom: '10px' }}>
          <thead>
            <tr style={{ background: NAVY, color: GOLD, textTransform: 'uppercase', fontSize: c.tableFontSize * 0.85, letterSpacing: '0.5px' }}>
              {['Subject', 'Score', 'Pct', 'Grade', 'Remarks', 'Status'].map((h, i) => (
                <th key={h} style={{ padding: '7px 8px', textAlign: i === 0 ? 'left' : 'center' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub, i) => {
              const sp = pct(sub.marks, sub.total);
              const gc = gradeColor(sub.grade);
              const remark = sub.grade === 'A+' ? 'Outstanding' : sub.grade === 'A' ? 'Excellent' : sub.grade === 'B+' ? 'Very Good' : sub.grade === 'B' ? 'Good' : sub.grade === 'C' ? 'Satisfactory' : sub.grade === 'D' ? 'Needs Improvement' : 'Unsatisfactory';
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafaf7', borderBottom: '1px solid #e8e5d8' }}>
                  <td style={{ padding: '5px 8px', textTransform: 'uppercase', fontSize: c.tableFontSize * 0.9, fontWeight: '500' }}>{sub.name}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                    <span style={{ fontWeight: '700', color: gc }}>{sub.marks}</span>
                    <span style={{ color: '#aaa', fontSize: c.tableFontSize * 0.8 }}>/{sub.total}</span>
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: c.tableFontSize * 0.8, color: '#777', marginBottom: '2px' }}>{sp}%</div>
                    <ProgressBar value={sp} color={gc} height={3} />
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}><GradeBadge grade={sub.grade} fontSize={c.tableFontSize * 0.85} /></td>
                  <td style={{ padding: '5px 8px', textAlign: 'center', color: '#555', fontSize: c.tableFontSize * 0.85 }}>{remark}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}><StatusBadge status={sub.status} fontSize={c.tableFontSize * 0.8} /></td>
                </tr>
              );
            })}
          </tbody>
          {activeFields.includes('gpa_summary') && (
            <tfoot>
              <tr style={{ background: '#f5f0e0', fontWeight: 'bold', borderTop: `2px solid ${GOLD}` }}>
                <td style={{ padding: '6px 8px', color: NAVY }}>OVERALL</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: NAVY }}>{props.obtainedMarks}/{props.totalMarks}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: NAVY }}>{props.percentage}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }} colSpan={2}><GradeBadge grade={props.grade} fontSize={c.tableFontSize * 0.95} /></td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: NAVY }}>{props.finalStatus || '—'}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Bottom: remarks + grading scale */}
        <div style={{ display: 'flex', gap: '10px', flex: 1, marginBottom: '10px' }}>
          {activeFields.includes('teacher_remarks') && (
            <div style={{ flex: 1.2, border: '1px solid #e0d8c0', borderRadius: '6px', padding: '8px 10px', background: '#fffef9' }}>
              <div style={{ fontSize: c.tableFontSize * 0.85, fontWeight: '700', color: GOLD, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>👤 Teacher's Comments</div>
              {[1, 2, 3].map(n => <div key={n} style={{ borderBottom: '1px dashed #d4c48a', height: '18px', marginBottom: '4px' }} />)}
            </div>
          )}
          <div style={{ flex: 1, border: '1px solid #e0d8c0', borderRadius: '6px', padding: '8px 10px', background: '#fffef9' }}>
            <div style={{ fontSize: c.tableFontSize * 0.85, fontWeight: '700', color: GOLD, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>🏅 Grading Scale</div>
            {GRADING_SCALE.map(({ grade, range, label }) => (
              <div key={grade} style={{ display: 'flex', gap: '4px', fontSize: c.tableFontSize * 0.8, marginBottom: '2px', alignItems: 'center' }}>
                <span style={{ fontWeight: '900', width: '20px', color: gradeColor(grade) }}>{grade}</span>
                <span style={{ width: '54px', color: '#888' }}>{range}</span>
                <span style={{ color: '#555' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: '6px', borderTop: `1px solid ${GOLD}` }}>
          {activeSigs.map((sig, idx) => (
            <div key={idx} style={{ textAlign: 'center', minWidth: '100px' }}>
              <div style={{ height: '28px', borderBottom: '1px solid #aaa', marginBottom: '4px' }} />
              <div style={{ fontSize: c.tableFontSize * 0.9, color: '#333', fontWeight: '600' }}>{sig.label}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid ${GOLD}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
              <div style={{ fontSize: 7, fontWeight: 'bold', color: NAVY, textAlign: 'center', lineHeight: 1.3 }}>LEARN<br />LEAD<br />SUCCEED</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '6px', fontSize: c.tableFontSize * 0.8, color: NAVY, letterSpacing: '1.5px', fontStyle: 'italic', borderTop: `1px solid ${GOLD}`, paddingTop: '5px' }}>
          AT THE EDGE, WE SHAPE TOMORROW'S LEADERS.
        </div>
      </div>
    </div>
  );
}

// ─── PRESTIGE ─────────────────────────────────────────────────────────────────

export function PrestigeReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;
  const GREEN = '#14532d';
  const LIME  = '#4ade80';
  const GOLD  = '#d4af37';
  const font  = c.titleFont || 'Georgia, serif';
  const activeSigs = (c.signatures || []).filter(s => s.active);

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#fff', fontFamily: font, color: '#111', position: 'relative', boxSizing: 'border-box', display: 'flex' }}>

      {/* Left green sidebar */}
      <div style={{ width: '56px', background: GREEN, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 10px', gap: '10px', position: 'relative' }}>
        {/* Logo / initials */}
        {activeFields.includes('school_logo') && props.schoolLogo ? (
          <img src={props.schoolLogo} alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: '50%', background: '#fff', padding: '3px' }} />
        ) : (
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: GREEN, fontSize: 18 }}>P</div>
        )}

        {/* Student photo on sidebar */}
        {activeFields.includes('student_photo') && props.studentPhoto && (
          <img src={props.studentPhoto} alt="Student" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: '50%', border: `2px solid ${GOLD}` }} />
        )}

        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap', color: GOLD, fontSize: 8, fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {props.schoolName}
          </div>
        </div>
        <div style={{ width: 34, height: 2, background: GOLD, borderRadius: '2px' }} />
        <div style={{ color: '#fff', fontSize: 7, textAlign: 'center', padding: '0 4px', opacity: 0.7, letterSpacing: '1px' }}>
          {props.examSession || new Date().getFullYear().toString()}
        </div>
        {activeFields.includes('watermark') && props.schoolLogo && (
          <div style={{ position: 'absolute', bottom: '60px', left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: c.watermarkOpacity * 0.5 }}>
            <img src={props.schoolLogo} alt="" style={{ width: 46, objectFit: 'contain', filter: 'invert(1)' }} />
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '10mm 8mm 8mm', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ borderBottom: `3px solid ${GREEN}`, paddingBottom: '8px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: c.headerFontSize * 1.3, fontWeight: '900', color: GREEN, textTransform: 'uppercase', letterSpacing: '1.5px', lineHeight: 1.1 }}>{props.schoolName}</div>
            <div style={{ fontSize: c.tableFontSize, color: '#555', fontStyle: 'italic' }}>Academic Report Card{props.examName ? ` — ${props.examName}` : ''}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {props.finalStatus && <StatusBadge status={props.finalStatus} fontSize={c.tableFontSize} />}
            <div style={{ fontSize: c.tableFontSize * 1.4, fontWeight: 'bold', color: '#fff', background: GREEN, padding: '4px 12px', borderRadius: '6px' }}>
              <GradeBadge grade={props.grade} fontSize={c.tableFontSize * 1.1} />
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: c.tableFontSize, background: '#f0fdf4', border: `1px solid ${LIME}33`, borderRadius: '6px', padding: '8px 10px', marginBottom: '10px' }}>
          {[['Student', props.studentName], ['Roll No', props.rollNumber], ['Class', props.className],
            ...(activeFields.includes('attendance_stats') ? [['Attendance', props.attendance]] : []),
            ...(props.positionInClass && props.totalStudents ? [['Position', `${props.positionInClass} of ${props.totalStudents}`]] : []),
          ].map(([l, v], i) => (
            <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span style={{ color: '#555', minWidth: '58px', fontSize: c.tableFontSize * 0.85 }}>{l}:</span>
              <span style={{ fontWeight: '700', color: GREEN }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Marks table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.tableFontSize, marginBottom: '10px' }}>
          <thead>
            <tr style={{ background: GREEN, color: '#fff' }}>
              {['Subject', 'Max', 'Marks', '%', 'Progress', 'Grade', 'Status'].map((h, i) => (
                <th key={h} style={{ padding: '6px 7px', textAlign: i === 0 ? 'left' : 'center', fontSize: c.tableFontSize * 0.82 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s, i) => {
              const sp = pct(s.marks, s.total);
              const gc = gradeColor(s.grade);
              return (
                <tr key={i} style={{ background: i % 2 ? '#f0fdf4' : '#fff', borderBottom: '1px solid #dcfce7' }}>
                  <td style={{ padding: '5px 7px', fontWeight: '500', borderLeft: `3px solid ${gc}` }}>{s.name}</td>
                  <td style={{ padding: '5px 7px', textAlign: 'center', color: '#555' }}>{s.total}</td>
                  <td style={{ padding: '5px 7px', textAlign: 'center', fontWeight: 'bold', color: GREEN }}>{s.marks}</td>
                  <td style={{ padding: '5px 7px', textAlign: 'center', color: '#555' }}>{sp}%</td>
                  <td style={{ padding: '5px 7px', textAlign: 'center', minWidth: '55px' }}>
                    <ProgressBar value={sp} color={gc} height={4} />
                  </td>
                  <td style={{ padding: '5px 7px', textAlign: 'center' }}><GradeBadge grade={s.grade} fontSize={c.tableFontSize * 0.82} /></td>
                  <td style={{ padding: '5px 7px', textAlign: 'center' }}><StatusBadge status={s.status} fontSize={c.tableFontSize * 0.82} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: GREEN, color: '#fff', fontWeight: 'bold' }}>
              <td style={{ padding: '6px 7px' }} colSpan={2}>TOTAL</td>
              <td style={{ padding: '6px 7px', textAlign: 'center' }}>{props.obtainedMarks}/{props.totalMarks}</td>
              <td style={{ padding: '6px 7px', textAlign: 'center' }}>{props.percentage}%</td>
              <td style={{ padding: '6px 7px', textAlign: 'center' }}>
                <ProgressBar value={props.percentage} color={GOLD} height={5} />
              </td>
              <td style={{ padding: '6px 7px', textAlign: 'center', color: GOLD }}>{props.grade}</td>
              <td style={{ padding: '6px 7px', textAlign: 'center', color: LIME }}>{props.finalStatus || '—'}</td>
            </tr>
          </tfoot>
        </table>

        {/* Remarks + Grading scale */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flex: 1 }}>
          {activeFields.includes('teacher_remarks') && (
            <div style={{ flex: 1.5, background: '#f0fdf4', border: `1px solid ${LIME}55`, borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: c.tableFontSize * 0.8, fontWeight: 'bold', color: GREEN, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Teacher Remarks</div>
              {[1, 2, 3].map(n => <div key={n} style={{ borderBottom: '1px dashed #86efac', height: '18px', marginBottom: '3px' }} />)}
            </div>
          )}
          <div style={{ flex: 1, background: '#f0fdf4', border: `1px solid ${LIME}55`, borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ fontSize: c.tableFontSize * 0.8, fontWeight: 'bold', color: GREEN, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Grading Scale</div>
            {GRADING_SCALE.map(({ grade, range }) => (
              <div key={grade} style={{ display: 'flex', gap: '4px', fontSize: c.tableFontSize * 0.78, marginBottom: '2px', alignItems: 'center' }}>
                <span style={{ width: '22px', fontWeight: '900', color: gradeColor(grade) }}>{grade}</span>
                <span style={{ color: '#555' }}>{range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${GREEN}`, paddingTop: '8px', marginTop: 'auto' }}>
          {activeSigs.map((sig, i) => (
            <div key={i} style={{ textAlign: 'center', minWidth: '100px' }}>
              <div style={{ height: '26px', borderBottom: '1px solid #888', marginBottom: '4px' }} />
              <div style={{ fontSize: c.tableFontSize * 0.85, color: GREEN, fontWeight: '600' }}>{sig.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PEARL ───────────────────────────────────────────────────────────────────

export function PearlReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;
  const TEAL = '#0d9488';
  const NAVY = '#1e3a5f';
  const font = c.titleFont || 'sans-serif';
  const activeSigs = (c.signatures || []).filter(s => s.active);

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#f8fafc', fontFamily: font, color: '#0f172a', position: 'relative', boxSizing: 'border-box' }}>

      {/* Gradient header */}
      <div style={{ background: `linear-gradient(135deg, ${TEAL} 0%, ${NAVY} 100%)`, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: '40px', bottom: '-30px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        {activeFields.includes('school_logo') && props.schoolLogo ? (
          <img src={props.schoolLogo} alt="" style={{ width: c.logoSize * 0.85, height: c.logoSize * 0.85, objectFit: 'contain', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '4px', flexShrink: 0, zIndex: 1 }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>S</span>
          </div>
        )}

        <div style={{ flex: 1, zIndex: 1 }}>
          <div style={{ color: '#fff', fontSize: c.headerFontSize * 1.2, fontWeight: '900', letterSpacing: '0.5px' }}>{props.schoolName}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: c.tableFontSize * 0.9, marginTop: '2px' }}>Academic Progress Report{props.examName ? ` — ${props.examName}` : ''}</div>
        </div>

        {/* Grade badge */}
        <div style={{ zIndex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', padding: '8px 14px', border: '1.5px solid rgba(255,255,255,0.3)' }}>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: c.tableFontSize * 0.75, textTransform: 'uppercase', letterSpacing: '1px' }}>Overall</div>
          <div style={{ color: '#fff', fontSize: c.tableFontSize * 2.2, fontWeight: '900', lineHeight: 1 }}>{props.grade}</div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: c.tableFontSize * 0.85, marginTop: '2px' }}>{props.percentage}%</div>
        </div>

        {activeFields.includes('student_photo') && props.studentPhoto && (
          <img src={props.studentPhoto} alt="Student" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', zIndex: 1 }} />
        )}
      </div>

      {activeFields.includes('watermark') && props.schoolLogo && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: c.watermarkOpacity, zIndex: 0, pointerEvents: 'none' }}>
          <img src={props.schoolLogo} alt="" style={{ width: '350px', height: '350px', objectFit: 'contain' }} />
        </div>
      )}

      <div style={{ padding: '10px 14px', position: 'relative', zIndex: 1 }}>

        {/* Student info cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
          {[
            { l: 'Student', v: props.studentName },
            { l: 'Roll No', v: props.rollNumber },
            { l: 'Class', v: props.className },
            props.positionInClass && props.totalStudents
              ? { l: 'Rank', v: `${props.positionInClass}/${props.totalStudents}` }
              : { l: 'Status', v: props.finalStatus || '—' },
          ].map((item, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: '8px', padding: '8px 10px', border: `1px solid ${TEAL}22`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: c.tableFontSize * 0.75, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{item.l}</div>
              <div style={{ fontSize: c.tableFontSize * 1.0, fontWeight: '700', color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.v}</div>
            </div>
          ))}
        </div>

        {/* Subject table */}
        <div style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${TEAL}22`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.tableFontSize }}>
            <thead>
              <tr style={{ background: `linear-gradient(90deg,${TEAL},${NAVY})` }}>
                {['Subject', 'Max', 'Obtained', 'Progress', 'Grade', 'Status'].map((h, i) => (
                  <th key={h} style={{ padding: '7px 10px', color: '#fff', textAlign: i === 0 ? 'left' : 'center', fontSize: c.tableFontSize * 0.82, fontWeight: '700', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s, i) => {
                const sp = pct(s.marks, s.total);
                const gc = gradeColor(s.grade);
                return (
                  <tr key={i} style={{ background: i % 2 ? '#f8fafc' : '#fff', borderBottom: `1px solid ${TEAL}15` }}>
                    <td style={{ padding: '6px 10px', fontWeight: '500', color: '#1e293b' }}>{s.name}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b' }}>{s.total}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: gc }}>{s.marks}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', minWidth: '65px' }}>
                      <div style={{ fontSize: c.tableFontSize * 0.78, color: '#64748b', marginBottom: '2px' }}>{sp}%</div>
                      <ProgressBar value={sp} color={gc} height={5} />
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}><GradeBadge grade={s.grade} fontSize={c.tableFontSize * 0.85} /></td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}><StatusBadge status={s.status} fontSize={c.tableFontSize * 0.85} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: NAVY, color: '#fff', fontWeight: 'bold' }}>
                <td style={{ padding: '7px 10px' }}>OVERALL</td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>{props.totalMarks}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>{props.obtainedMarks}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                  <ProgressBar value={props.percentage} color="#5eead4" height={5} />
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'center', color: '#5eead4' }}>{props.grade}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', color: '#5eead4', fontSize: c.tableFontSize * 0.85 }}>{props.finalStatus || '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          {activeFields.includes('attendance_stats') && (
            <div style={{ background: '#fff', borderRadius: '8px', padding: '8px 12px', border: `1px solid ${TEAL}22`, flexShrink: 0 }}>
              <div style={{ fontSize: c.tableFontSize * 0.75, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Attendance</div>
              <div style={{ fontSize: c.tableFontSize * 1.2, fontWeight: 'bold', color: TEAL }}>{props.attendance}</div>
            </div>
          )}
          {activeFields.includes('teacher_remarks') && (
            <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '8px 12px', border: `1px solid ${TEAL}22` }}>
              <div style={{ fontSize: c.tableFontSize * 0.75, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px', fontWeight: '700' }}>Teacher Remarks</div>
              {[1, 2].map(n => <div key={n} style={{ borderBottom: '1px dashed #cbd5e1', height: '18px', marginBottom: '4px' }} />)}
            </div>
          )}
          {/* Grading scale */}
          <div style={{ background: '#fff', borderRadius: '8px', padding: '8px 12px', border: `1px solid ${TEAL}22`, flexShrink: 0 }}>
            <div style={{ fontSize: c.tableFontSize * 0.75, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '700' }}>Grading</div>
            {GRADING_SCALE.slice(0, 5).map(({ grade, range }) => (
              <div key={grade} style={{ display: 'flex', gap: '4px', fontSize: c.tableFontSize * 0.72, marginBottom: '2px' }}>
                <span style={{ width: '20px', fontWeight: '900', color: gradeColor(grade) }}>{grade}</span>
                <span style={{ color: '#555' }}>{range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${TEAL}`, paddingTop: '8px' }}>
          {activeSigs.map((sig, i) => (
            <div key={i} style={{ textAlign: 'center', minWidth: '90px' }}>
              <div style={{ height: '24px', borderBottom: '1px solid #94a3b8', marginBottom: '4px' }} />
              <div style={{ fontSize: c.tableFontSize * 0.82, color: NAVY, fontWeight: '600' }}>{sig.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

export function ReportCardLayoutRenderer(props: ReportCardProps & { template: ReportTemplateId }) {
  const { template, ...rest } = props;
  switch (template) {
    case 'modern':   return <ModernReport   {...rest} />;
    case 'minimal':  return <MinimalReport  {...rest} />;
    case 'elegant':  return <ElegantReport  {...rest} />;
    case 'compact':  return <CompactReport  {...rest} />;
    case 'royal':    return <RoyalReport    {...rest} />;
    case 'prestige': return <PrestigeReport {...rest} />;
    case 'pearl':    return <PearlReport    {...rest} />;
    default:         return <ClassicReport  {...rest} />;
  }
}
