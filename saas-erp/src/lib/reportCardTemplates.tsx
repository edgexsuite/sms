import React from 'react';

export type ReportTemplateId = 'classic' | 'modern' | 'minimal' | 'elegant' | 'compact';

export interface ReportCardCustomization {
  headerFontSize: number;
  tableFontSize: number;
  remarksFontSize: number;
  logoSize: number;
  primaryColor: string;
  tableHeaderColor: string;
  borderColor: string;
  signatures: { label: string; active: boolean }[];
}

export const DEFAULT_REPORT_CUSTOM: ReportCardCustomization = {
  headerFontSize: 16,
  tableFontSize: 10,
  remarksFontSize: 12,
  logoSize: 60,
  primaryColor: '#1d4ed8',
  tableHeaderColor: '#eff6ff',
  borderColor: '#e2e8f0',
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
  // Mock data for preview
  subjects: { name: string; marks: number; total: number; grade: string }[];
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  attendance: string;
}

export const REPORT_TEMPLATES: { id: ReportTemplateId; name: string; description: string; preview: string }[] = [
  { id: 'classic', name: 'Classic Results', description: 'Traditional academic report card', preview: '#1d4ed8' },
  { id: 'modern', name: 'Modern Edge', description: 'Clean headers, shaded tables', preview: '#0f172a' },
  { id: 'minimal', name: 'Minimalist', description: 'Simple grid, focus on numbers', preview: '#475569' },
  { id: 'elegant', name: 'Elegant Profile', description: 'Centric photo, refined layout', preview: '#7c3aed' },
  { id: 'compact', name: 'Compact Summary', description: 'Dense layout for extensive marks', preview: '#059669' },
];

function getCustom(props: ReportCardProps): ReportCardCustomization {
  return { ...DEFAULT_REPORT_CUSTOM, ...(props.customization || {}) };
}

export function ClassicReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#fff', padding: '15mm', fontFamily: 'serif', color: '#000', position: 'relative' }}>
      {/* Header Container */}
      <div style={{ borderBottom: `3px double ${c.borderColor}`, paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        {activeFields.includes('school_logo') && props.schoolLogo && (
          <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, objectFit: 'contain', marginBottom: '10px' }} />
        )}
        <h1 style={{ fontSize: c.headerFontSize, fontWeight: 'bold', color: c.primaryColor, margin: 0, textTransform: 'uppercase', textAlign: 'center' }}>{props.schoolName}</h1>
        <h2 style={{ fontSize: c.headerFontSize * 0.7, margin: '5px 0 0', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '2px' }}>Academic Report Card</h2>
      </div>

      {/* Student Detail Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', border: `1px solid ${c.borderColor}`, padding: '10px', marginBottom: '20px', borderRadius: '4px', fontSize: c.tableFontSize * 1.1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: '5px' }}><strong>Student Name:</strong> {props.studentName}</div>
          <div><strong>Roll Number:</strong> {props.rollNumber}</div>
        </div>
        <div style={{ display: 'flex', gap: '15px', textAlign: 'right' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ marginBottom: '5px' }}><strong>Class:</strong> {props.className}</div>
            {activeFields.includes('attendance_stats') && <div><strong>Attendance:</strong> {props.attendance}</div>}
          </div>
          {activeFields.includes('student_photo') && props.studentPhoto && (
            <img src={props.studentPhoto} alt="Student" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: `1px solid ${c.borderColor}` }} />
          )}
        </div>
      </div>

      {/* Marks Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: c.tableFontSize }}>
        <thead>
          <tr style={{ background: c.tableHeaderColor, color: c.primaryColor, borderBottom: `2px solid ${c.borderColor}` }}>
            <th style={{ padding: '8px', textAlign: 'left', border: `1px solid ${c.borderColor}` }}>Subject</th>
            <th style={{ padding: '8px', textAlign: 'center', border: `1px solid ${c.borderColor}` }}>Total Marks</th>
            <th style={{ padding: '8px', textAlign: 'center', border: `1px solid ${c.borderColor}` }}>Obtained</th>
            <th style={{ padding: '8px', textAlign: 'center', border: `1px solid ${c.borderColor}` }}>Grade</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((sub, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${c.borderColor}` }}>
              <td style={{ padding: '8px', border: `1px solid ${c.borderColor}` }}>{sub.name}</td>
              <td style={{ padding: '8px', textAlign: 'center', border: `1px solid ${c.borderColor}` }}>{sub.total}</td>
              <td style={{ padding: '8px', textAlign: 'center', border: `1px solid ${c.borderColor}` }}>{sub.marks}</td>
              <td style={{ padding: '8px', textAlign: 'center', border: `1px solid ${c.borderColor}`, fontWeight: 'bold' }}>{sub.grade}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
            <td style={{ padding: '8px', textAlign: 'right', border: `1px solid ${c.borderColor}` }}>Total</td>
            <td style={{ padding: '8px', textAlign: 'center', border: `1px solid ${c.borderColor}` }}>{props.totalMarks}</td>
            <td style={{ padding: '8px', textAlign: 'center', border: `1px solid ${c.borderColor}` }}>{props.obtainedMarks}</td>
            <td style={{ padding: '8px', textAlign: 'center', border: `1px solid ${c.borderColor}` }}>{props.percentage}%</td>
          </tr>
        </tfoot>
      </table>

      {/* Summary Row */}
      {activeFields.includes('gpa_summary') && (
        <div style={{ border: `1px solid ${c.borderColor}`, padding: '15px', borderRadius: '4px', textAlign: 'center', fontSize: c.tableFontSize * 1.2, fontWeight: 'bold', background: c.tableHeaderColor, color: c.primaryColor, marginBottom: '30px' }}>
          OVERALL GRADE: {props.grade} &nbsp;&nbsp;|&nbsp;&nbsp; PERCENTAGE: {props.percentage}%
        </div>
      )}

      {/* Remarks */}
      {activeFields.includes('teacher_remarks') && (
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: c.remarksFontSize, borderBottom: `1px solid ${c.borderColor}`, paddingBottom: '5px' }}>Teacher Remarks</h3>
          <p style={{ minHeight: '40px', padding: '10px', fontSize: c.remarksFontSize * 0.9, fontStyle: 'italic', color: '#4b5563', borderBottom: '1px dashed #cbd5e1' }}>
            Excellent performance this term. Keep up the good work!
          </p>
        </div>
      )}

      {/* Signatures */}
      {(() => {
        const activeSigs = (c.signatures || []).filter(s => s.active);
        if (activeSigs.length === 0) return null;
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
            {activeSigs.map((sig, idx) => (
              <div key={idx} style={{ borderTop: `1px solid ${c.borderColor}`, width: '200px', textAlign: 'center', paddingTop: '5px', fontSize: c.tableFontSize }}>{sig.label}</div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export function ModernReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#f8fafc', padding: '15mm', fontFamily: 'sans-serif', color: '#0f172a' }}>
      
      {/* Dynamic Header Block */}
      <div style={{ background: c.primaryColor, padding: '20px', borderRadius: '8px', color: '#fff', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '25px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        {activeFields.includes('school_logo') && props.schoolLogo && (
          <div style={{ background: '#fff', padding: '5px', borderRadius: '8px' }}>
            <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: c.headerFontSize * 1.2, fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>{props.schoolName}</h1>
          <h2 style={{ fontSize: c.headerFontSize * 0.6, margin: '5px 0 0', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px' }}>Official Grade Report</h2>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <div style={{ flex: 1, background: '#fff', padding: '15px', borderRadius: '8px', border: `1px solid ${c.borderColor}` }}>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Student Profile</div>
          <div style={{ fontSize: c.tableFontSize * 1.4, fontWeight: 'bold', color: c.primaryColor }}>{props.studentName}</div>
          <div style={{ fontSize: c.tableFontSize, color: '#475569', marginTop: '2px' }}>Roll: #{props.rollNumber}</div>
        </div>
        <div style={{ flex: 1, background: '#fff', padding: '15px', borderRadius: '8px', border: `1px solid ${c.borderColor}` }}>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Academic Info</div>
          <div style={{ fontSize: c.tableFontSize * 1.2, fontWeight: '600' }}>Class {props.className}</div>
          {activeFields.includes('attendance_stats') && <div style={{ fontSize: c.tableFontSize, color: '#475569', marginTop: '2px' }}>Attendance: {props.attendance}</div>}
        </div>
        {activeFields.includes('student_photo') && props.studentPhoto && (
          <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: `1px solid ${c.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={props.studentPhoto} alt="Student" style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '4px' }} />
          </div>
        )}
      </div>

      {/* Marks Table */}
      <div style={{ background: '#fff', borderRadius: '8px', border: `1px solid ${c.borderColor}`, overflow: 'hidden', marginBottom: '25px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.tableFontSize }}>
          <thead>
            <tr style={{ background: c.tableHeaderColor }}>
              <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: `1px solid ${c.borderColor}`, color: '#334155', fontWeight: 700 }}>Subject</th>
              <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: `1px solid ${c.borderColor}`, color: '#334155', fontWeight: 700 }}>Total</th>
              <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: `1px solid ${c.borderColor}`, color: '#334155', fontWeight: 700 }}>Marks</th>
              <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: `1px solid ${c.borderColor}`, color: '#334155', fontWeight: 700 }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub, i) => (
              <tr key={i} style={{ borderBottom: i === subjects.length -1 ? 'none' : `1px solid ${c.borderColor}` }}>
                <td style={{ padding: '10px 15px', fontWeight: 500 }}>{sub.name}</td>
                <td style={{ padding: '10px 15px', textAlign: 'center', color: '#64748b' }}>{sub.total}</td>
                <td style={{ padding: '10px 15px', textAlign: 'center', fontWeight: 'bold' }}>{sub.marks}</td>
                <td style={{ padding: '10px 15px', textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', background: `${c.primaryColor}15`, color: c.primaryColor, borderRadius: '4px', fontWeight: 'bold' }}>
                    {sub.grade}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: activeFields.includes('gpa_summary') && activeFields.includes('teacher_remarks') ? '1fr 1fr' : '1fr', gap: '20px' }}>
        
        {activeFields.includes('gpa_summary') && (
          <div style={{ background: c.primaryColor, color: '#fff', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, marginBottom: '5px' }}>Final Result</div>
            <div style={{ fontSize: c.tableFontSize * 2.5, fontWeight: '900', lineHeight: 1 }}>{props.grade}</div>
            <div style={{ marginTop: '10px', opacity: 0.9, fontSize: c.tableFontSize }}>{props.percentage}% OVERALL SCORE</div>
          </div>
        )}

        {activeFields.includes('teacher_remarks') && (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: `1px solid ${c.borderColor}` }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }}>Director / Teacher Remarks</div>
            <p style={{ margin: 0, fontSize: c.remarksFontSize, fontStyle: 'italic', color: '#334155', lineHeight: 1.5 }}>
              "An outstanding term demonstrating strong grasp of concepts. We are proud of your progress and consistency."
            </p>
          </div>
        )}

      </div>

      {(() => {
        const activeSigs = (c.signatures || []).filter(s => s.active);
        if (activeSigs.length === 0) return null;
        return (
          <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
            {activeSigs.map((sig, idx) => (
              <div key={idx} style={{ flex: 1, maxWidth: '250px', borderTop: `2px solid ${c.borderColor}`, paddingTop: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: c.tableFontSize, fontWeight: 'bold', color: '#334155' }}>{sig.label}</div>
                <div style={{ fontSize: c.tableFontSize * 0.8, color: '#94a3b8' }}>Authorized Signature</div>
              </div>
            ))}
          </div>
        );
      })()}

    </div>
  );
}

export function MinimalReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#fff', padding: '15mm', fontFamily: 'monospace', color: '#000' }}>
      {/* Minimal Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid #000`, paddingBottom: '15px', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: c.headerFontSize, margin: 0, textTransform: 'uppercase' }}>{props.schoolName}</h1>
          <h2 style={{ fontSize: c.headerFontSize * 0.7, margin: '5px 0 0', fontWeight: 'normal' }}>ACADEMIC TRANSCRIPT</h2>
        </div>
        {activeFields.includes('school_logo') && props.schoolLogo && (
          <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, objectFit: 'contain', filter: 'grayscale(100%)' }} />
        )}
      </div>

      {/* Info */}
      <div style={{ display: 'flex', gap: '40px', marginBottom: '30px', fontSize: c.tableFontSize }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Name</div>
          <div style={{ fontWeight: 'bold', fontSize: c.tableFontSize * 1.2 }}>{props.studentName}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Roll No</div>
          <div style={{ fontWeight: 'bold', fontSize: c.tableFontSize * 1.2 }}>{props.rollNumber}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase' }}>Grade/Class</div>
          <div style={{ fontWeight: 'bold', fontSize: c.tableFontSize * 1.2 }}>{props.className}</div>
        </div>
        {activeFields.includes('student_photo') && props.studentPhoto && (
          <div style={{ marginLeft: 'auto', border: '2px solid #000', padding: '2px' }}>
             <img src={props.studentPhoto} alt="Student" style={{ width: '80px', height: '80px', objectFit: 'cover', display: 'block', filter: 'grayscale(100%)' }} />
          </div>
        )}
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: c.tableFontSize }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
            <th style={{ padding: '10px 0', textAlign: 'left', fontWeight: 'normal' }}>SUBJECT</th>
            <th style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'normal' }}>TOTAL</th>
            <th style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'normal' }}>SCORE</th>
            <th style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'normal' }}>GRADE</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((sub, i) => (
            <tr key={i} style={{ borderBottom: '1px dotted #ccc' }}>
              <td style={{ padding: '8px 0' }}>{sub.name}</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>{sub.total}</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>{sub.marks}</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>{sub.grade}</td>
            </tr>
          ))}
          <tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000', fontWeight: 'bold' }}>
            <td style={{ padding: '10px 0' }}>OVERALL</td>
            <td style={{ padding: '10px 0', textAlign: 'right' }}>{props.totalMarks}</td>
            <td style={{ padding: '10px 0', textAlign: 'right' }}>{props.obtainedMarks}</td>
            <td style={{ padding: '10px 0', textAlign: 'right' }}>{props.grade}</td>
          </tr>
        </tbody>
      </table>

      {activeFields.includes('attendance_stats') && (
        <div style={{ marginBottom: '20px', fontSize: c.tableFontSize }}>
          ATTENDANCE RECORD: {props.attendance}
        </div>
      )}

      {activeFields.includes('teacher_remarks') && (
        <div style={{ marginBottom: '40px', fontSize: c.remarksFontSize }}>
          <div style={{ textTransform: 'uppercase', marginBottom: '5px' }}>Remarks:</div>
          <div>Passed with Distinction.</div>
        </div>
      )}

      {(() => {
        const activeSigs = (c.signatures || []).filter(s => s.active);
        if (activeSigs.length === 0) return null;
        return (
          <div style={{ marginTop: '80px', display: 'flex', justifyContent: 'space-between' }}>
            {activeSigs.map((sig, idx) => (
              <div key={idx} style={{ borderTop: '1px dashed #000', width: '200px', textAlign: 'center', paddingTop: '10px', fontSize: c.tableFontSize, textTransform: 'uppercase' }}>
                {sig.label}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export function ElegantReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#fafafa', padding: '15mm', fontFamily: 'serif', color: '#111827' }}>
      
      {/* Decorative Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: c.borderColor, zIndex: 1 }}></div>
        <h1 style={{ fontSize: c.headerFontSize * 1.1, margin: 0, color: c.primaryColor, textTransform: 'uppercase', letterSpacing: '3px', background: '#fafafa', display: 'inline-block', padding: '0 20px', position: 'relative', zIndex: 2 }}>
          {props.schoolName}
        </h1>
        <div style={{ marginTop: '10px', fontSize: c.headerFontSize * 0.6, letterSpacing: '5px', color: '#6b7280', textTransform: 'uppercase' }}>Student Progress Report</div>
      </div>

      <div style={{ display: 'flex', gap: '30px', marginBottom: '30px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: c.tableFontSize * 1.6, fontWeight: 'bold', color: '#111827', marginBottom: '5px' }}>{props.studentName}</div>
          <div style={{ display: 'flex', gap: '20px', fontSize: c.tableFontSize * 1.1, color: '#4b5563' }}>
            <span><strong>Roll No:</strong> {props.rollNumber}</span>
            <span><strong>Class:</strong> {props.className}</span>
          </div>
          {activeFields.includes('attendance_stats') && (
            <div style={{ marginTop: '5px', fontSize: c.tableFontSize * 1.1, color: '#4b5563' }}><strong>Attendance:</strong> {props.attendance}</div>
          )}
        </div>
        {activeFields.includes('school_logo') && props.schoolLogo && (
          <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, objectFit: 'contain' }} />
        )}
        {activeFields.includes('student_photo') && props.studentPhoto && (
          <img src={props.studentPhoto} alt="Student" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '50%', border: `4px solid ${c.tableHeaderColor}`, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
        )}
      </div>

      {/* Styled Table */}
      <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${c.borderColor}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.tableFontSize }}>
          <thead>
            <tr style={{ background: c.tableHeaderColor, color: c.primaryColor }}>
              <th style={{ padding: '15px 20px', textAlign: 'left' }}>Subject</th>
              <th style={{ padding: '15px 20px', textAlign: 'center' }}>Max Marks</th>
              <th style={{ padding: '15px 20px', textAlign: 'center' }}>Obtained</th>
              <th style={{ padding: '15px 20px', textAlign: 'center' }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${c.borderColor}` }}>
                <td style={{ padding: '12px 20px' }}>{sub.name}</td>
                <td style={{ padding: '12px 20px', textAlign: 'center', color: '#6b7280' }}>{sub.total}</td>
                <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold' }}>{sub.marks}</td>
                <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', color: c.primaryColor }}>{sub.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Box */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        {activeFields.includes('gpa_summary') && (
          <div style={{ flex: '0 0 auto', background: c.tableHeaderColor, border: `1px solid ${c.borderColor}`, borderRadius: '12px', padding: '20px', textAlign: 'center', minWidth: '200px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '1px', marginBottom: '5px' }}>Overall Result</div>
            <div style={{ fontSize: c.tableFontSize * 2.5, fontWeight: 'bold', color: c.primaryColor, lineHeight: '1' }}>{props.grade}</div>
            <div style={{ marginTop: '10px', fontSize: c.tableFontSize * 1.2, fontWeight: 'bold', color: '#111827' }}>{props.percentage}%</div>
          </div>
        )}
        {activeFields.includes('teacher_remarks') && (
          <div style={{ flex: 1, border: `1px solid ${c.borderColor}`, borderRadius: '12px', padding: '20px', background: '#fff' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '1px', marginBottom: '10px' }}>Instructor Remarks</div>
            <div style={{ fontSize: c.remarksFontSize, fontStyle: 'italic', color: '#374151', lineHeight: '1.6' }}>
              "An exemplary term with consistent participation and solid academic results. Outstanding achievement."
            </div>
          </div>
        )}
      </div>

      {(() => {
        const activeSigs = (c.signatures || []).filter(s => s.active);
        if (activeSigs.length === 0) return null;
        return (
          <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
            {activeSigs.map((sig, idx) => (
              <div key={idx} style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderBottom: `1px solid ${c.borderColor}`, height: '40px', marginBottom: '10px' }}></div>
                <div style={{ fontSize: c.tableFontSize * 1.1, fontWeight: 'bold' }}>{sig.label}</div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export function CompactReport(props: ReportCardProps) {
  const c = getCustom(props);
  const { activeFields, subjects } = props;

  return (
    <div style={{ width: '210mm', minHeight: '297mm', background: '#fff', padding: '10mm', fontFamily: 'sans-serif', color: '#1e293b' }}>
      
      {/* Dense Header */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `3px solid ${c.primaryColor}`, paddingBottom: '10px', marginBottom: '15px' }}>
        {activeFields.includes('school_logo') && props.schoolLogo && (
          <img src={props.schoolLogo} alt="" style={{ width: c.logoSize * 0.8, height: c.logoSize * 0.8, objectFit: 'contain', marginRight: '15px' }} />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: c.headerFontSize * 0.9, margin: 0, fontWeight: '900', textTransform: 'uppercase', color: '#0f172a' }}>{props.schoolName}</h1>
          <h2 style={{ fontSize: c.headerFontSize * 0.5, margin: 0, color: '#64748b', textTransform: 'uppercase' }}>Academic Report</h2>
        </div>
        {activeFields.includes('student_photo') && props.studentPhoto && (
          <img src={props.studentPhoto} alt="Student" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: `1px solid ${c.borderColor}` }} />
        )}
      </div>

      {/* Dense Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: c.tableHeaderColor, padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: c.tableFontSize }}>
        <div><strong style={{ color: c.primaryColor }}>Name:</strong> {props.studentName}</div>
        <div><strong style={{ color: c.primaryColor }}>Roll:</strong> {props.rollNumber}</div>
        <div><strong style={{ color: c.primaryColor }}>Class:</strong> {props.className}</div>
        {activeFields.includes('attendance_stats') ? <div><strong style={{ color: c.primaryColor }}>Att:</strong> {props.attendance}</div> : <div />}
      </div>

      {/* Grid of Subjects (2 columns if many, 1 for simple) */}
      <div style={{ border: `1px solid ${c.borderColor}`, borderRadius: '6px', overflow: 'hidden', marginBottom: '15px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.tableFontSize * 0.9 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: `2px solid ${c.borderColor}` }}>
              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Subject</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', width: '15%' }}>Tot</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', width: '15%' }}>Obt</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', width: '15%' }}>Grd</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${c.borderColor}` }}>
                <td style={{ padding: '6px 10px', fontWeight: '500' }}>{sub.name}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center' }}>{sub.total}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold' }}>{sub.marks}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', color: c.primaryColor }}>{sub.grade}</td>
              </tr>
            ))}
          </tbody>
          {activeFields.includes('gpa_summary') && (
            <tfoot style={{ background: c.tableHeaderColor, fontWeight: 'bold' }}>
              <tr>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>OVERALL</td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>{props.totalMarks}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>{props.obtainedMarks} ({props.percentage}%)</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: c.primaryColor }}>{props.grade}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div style={{ display: 'flex', gap: '15px' }}>
        {activeFields.includes('teacher_remarks') && (
          <div style={{ flex: 1, padding: '10px', border: `1px solid ${c.borderColor}`, borderRadius: '6px' }}>
            <strong style={{ fontSize: c.tableFontSize * 0.9, color: '#64748b', display: 'block', marginBottom: '4px' }}>Remarks:</strong>
            <span style={{ fontSize: c.remarksFontSize * 0.9, fontStyle: 'italic' }}>Passed with distinction. Good progress.</span>
          </div>
        )}
        {(() => {
          const activeSigs = (c.signatures || []).filter(s => s.active);
          if (activeSigs.length === 0) return null;
          return (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '20px' }}>
              {activeSigs.map((sig, idx) => (
                <div key={idx} style={{ width: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '5px' }}>
                  <div style={{ borderTop: `1px solid ${c.borderColor}`, paddingTop: '5px', textAlign: 'center', fontSize: c.tableFontSize * 0.9, fontWeight: 'bold' }}>{sig.label}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

    </div>
  );
}

export function ReportCardLayoutRenderer(props: ReportCardProps & { template: ReportTemplateId }) {
  const { template, ...rest } = props;
  switch (template) {
    case 'modern':  return <ModernReport {...rest} />;
    case 'minimal': return <MinimalReport {...rest} />;
    case 'elegant': return <ElegantReport {...rest} />;
    case 'compact': return <CompactReport {...rest} />;
    default:        return <ClassicReport {...rest} />;
  }
}
