import React from 'react';
import QRCode from 'react-qr-code';

export type TemplateId = 'classic' | 'elite' | 'aurora' | 'horizon' | 'mint';

export interface CardCustomization {
  nameFontSize: number;
  fieldFontSize: number;
  schoolFontSize: number;
  photoSize: number;
  qrSize: number;
  primaryColor: string;
  accentColor: string;
  textColor: string;
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

export interface StudentCardProps {
  mode: 'student';
  name: string;
  photo: string | null;
  className: string;
  rollNumber: number | null;
  schoolName: string;
  schoolLogo: string | null;
  qrValue: string;
  activeFields: string[];
  bloodGroup?: string | null;
  dob?: string | null;
  phone?: string | null;
  address?: string | null;
  customization?: CardCustomization;
}

export interface StaffCardProps {
  mode: 'staff';
  name: string;
  photo: string | null;
  role: string;
  designation: string | null;
  department: string | null;
  joiningDate: string | null;
  refId: string;
  phone?: string | null;
  schoolName: string;
  schoolLogo: string | null;
  qrValue: string;
  activeFields: string[];
  customization?: CardCustomization;
}

export type CardProps = StudentCardProps | StaffCardProps;

export const TEMPLATES: { id: TemplateId; name: string; orientation: 'vertical' | 'horizontal'; description: string; preview: string }[] = [
  { id: 'classic',  name: 'Classic Blue',    orientation: 'vertical',   description: 'Curved blue header, clean white body', preview: '#2563eb' },
  { id: 'elite',    name: 'Dark Elite',      orientation: 'vertical',   description: 'Dark slate with gold accents',         preview: '#0f172a' },
  { id: 'aurora',   name: 'Aurora',          orientation: 'vertical',   description: 'Vibrant gradient, modern style',       preview: '#7c3aed' },
  { id: 'horizon',  name: 'Horizon',         orientation: 'horizontal', description: 'Landscape layout with side photo',     preview: '#0891b2' },
  { id: 'mint',     name: 'Mint Clean',      orientation: 'horizontal', description: 'Minimal horizontal, fresh tones',      preview: '#059669' },
];

function getCustom(props: CardProps): CardCustomization {
  return { ...DEFAULT_CUSTOM, ...(props as any).customization };
}

export function ClassicCard(props: CardProps) {
  const isStudent = props.mode === 'student';
  const c = getCustom(props);
  const qrVal = props.qrValue;
  const roleBadge = isStudent
    ? (props as StudentCardProps).className || 'Student'
    : (props as StaffCardProps).role;
  const subtitle = isStudent ? 'STUDENT IDENTITY CARD' : 'FACULTY IDENTITY CARD';
  const p = props as any;

  return (
    <div style={{ width: '54mm', height: '86mm', background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', position: 'relative', border: '1px solid #e2e8f0' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,${c.primaryColor},${c.accentColor})`, padding: `6px 8px ${c.photoSize / 2 + 2}px`, textAlign: 'center', position: 'relative' }}>
        {props.schoolLogo && <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, borderRadius: '50%', objectFit: 'contain', margin: '0 auto 2px', display: 'block' }} />}
        <div style={{ color: '#fff', fontSize: c.schoolFontSize, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.2 }}>{props.schoolName}</div>
        <div style={{ color: '#bfdbfe', fontSize: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 1 }}>{subtitle}</div>
      </div>

      {/* Photo overlapping header */}
      <div style={{ marginTop: -(c.photoSize / 2), display: 'flex', justifyContent: 'center', zIndex: 10, position: 'relative' }}>
        <div style={{ width: c.photoSize, height: c.photoSize, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {props.photo
            ? <img src={props.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: c.photoSize * 0.44, fontWeight: 900, color: '#94a3b8' }}>{props.name.charAt(0)}</span>}
        </div>
      </div>

      {/* Name + badge */}
      <div style={{ textAlign: 'center', padding: '3px 6px 0' }}>
        <div style={{ fontSize: c.nameFontSize, fontWeight: 900, color: c.textColor, textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.2 }}>{props.name}</div>
        <div style={{ display: 'inline-block', background: c.roleBgColor, color: c.roleColor, fontSize: c.roleFontSize, fontWeight: 700, padding: '1px 5px', borderRadius: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{roleBadge}</div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, padding: '6px 8px', borderTop: '1px solid #f1f5f9', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', justifyContent: 'center', fontSize: c.fieldFontSize, position: 'relative', zIndex: 10 }}>
        {isStudent && p.activeFields?.includes('roll_number') && p.rollNumber && <div style={{ fontWeight: 700, color: '#475569' }}>Roll # {p.rollNumber}</div>}
        {isStudent && p.activeFields?.includes('blood_group') && p.bloodGroup && <div style={{ fontWeight: 700, color: '#dc2626' }}>Blood: {p.bloodGroup}</div>}
        {isStudent && p.activeFields?.includes('emergency_contact') && p.phone && <div style={{ color: '#64748b' }}>{p.phone}</div>}
        {isStudent && p.activeFields?.includes('dob') && p.dob && <div style={{ color: '#64748b' }}>DOB: {p.dob}</div>}
        {!isStudent && p.activeFields?.includes('designation') && p.designation && p.designation.toLowerCase() !== p.role?.toLowerCase() && <div style={{ fontWeight: 700, color: '#334155', textTransform: 'uppercase', fontSize: c.fieldFontSize }}>{p.designation}</div>}
        {!isStudent && p.activeFields?.includes('department') && <div style={{ color: '#64748b', textTransform: 'uppercase', fontSize: c.fieldFontSize }}>{p.department}</div>}
        {!isStudent && p.activeFields?.includes('joining_date') && p.joiningDate?.trim() && <div style={{ color: '#94a3b8', fontSize: c.fieldFontSize * 0.9 }}>Since {p.joiningDate}</div>}
        {!isStudent && p.activeFields?.includes('ref_id') && <div style={{ fontFamily: 'monospace', color: '#cbd5e1', fontSize: c.fieldFontSize * 0.9, letterSpacing: 1 }}>{p.refId}</div>}
      </div>

      {/* Background Bottom Waves */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', zIndex: 1, pointerEvents: 'none' }}>
        <svg viewBox="0 0 200 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <path d="M0,60 Q50,30 100,60 T200,60 L200,100 L0,100 Z" fill={`${c.primaryColor}10`} />
          <path d="M0,80 Q50,50 100,80 T200,80 L200,100 L0,100 Z" fill={`${c.primaryColor}20`} />
        </svg>
      </div>

      {/* QR */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3px 0 6px', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#fff', padding: 4, borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <QRCode value={qrVal} size={c.qrSize} level="M" />
        </div>
      </div>
    </div>
  );
}

export function EliteCard(props: CardProps) {
  const isStudent = props.mode === 'student';
  const c = getCustom(props);
  const p = props as any;
  const roleBadge = isStudent ? (p.className || 'Student') : p.role;

  // Elite uses gold accents by default, but respects custom colors
  const gold = c.accentColor === DEFAULT_CUSTOM.accentColor ? '#f59e0b' : c.accentColor;
  const darkBg = c.primaryColor === DEFAULT_CUSTOM.primaryColor ? '#0f172a' : c.primaryColor;

  return (
    <div style={{ width: '54mm', height: '86mm', background: darkBg, borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', border: '1px solid #1e293b' }}>
      {/* Gold top bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg,${gold},${gold}aa,${gold})` }} />

      {/* School header */}
      <div style={{ textAlign: 'center', padding: '5px 6px 4px' }}>
        {props.schoolLogo && <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, borderRadius: '50%', objectFit: 'contain', margin: '0 auto 2px', display: 'block', border: `1px solid ${gold}` }} />}
        <div style={{ color: gold, fontSize: c.schoolFontSize, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>{props.schoolName}</div>
        <div style={{ color: '#475569', fontSize: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 1 }}>{isStudent ? 'STUDENT' : 'FACULTY'} CARD</div>
      </div>

      {/* Photo */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '3px 0' }}>
        <div style={{ width: c.photoSize, height: c.photoSize, borderRadius: 6, border: `2px solid ${gold}`, overflow: 'hidden', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {props.photo
            ? <img src={props.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: c.photoSize * 0.44, fontWeight: 900, color: '#475569' }}>{props.name.charAt(0)}</span>}
        </div>
      </div>

      {/* Name + role */}
      <div style={{ textAlign: 'center', padding: '2px 6px' }}>
        <div style={{ fontSize: c.nameFontSize, fontWeight: 900, color: c.textColor === DEFAULT_CUSTOM.textColor ? '#f8fafc' : c.textColor, textTransform: 'uppercase', letterSpacing: 0.3 }}>{props.name}</div>
        <div style={{ display: 'inline-block', background: c.roleBgColor, color: c.roleColor, fontSize: c.roleFontSize, fontWeight: 900, padding: '1px 6px', borderRadius: 10, marginTop: 2, textTransform: 'uppercase' }}>{roleBadge}</div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#1e293b', margin: '4px 12px' }} />

      {/* Fields */}
      <div style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2.5, alignItems: 'center', fontSize: c.fieldFontSize }}>
        {isStudent && p.activeFields?.includes('roll_number') && p.rollNumber && <div style={{ color: '#94a3b8', fontWeight: 700 }}>Roll # {p.rollNumber}</div>}
        {isStudent && p.activeFields?.includes('blood_group') && p.bloodGroup && <div style={{ color: '#f87171', fontWeight: 700 }}>Blood: {p.bloodGroup}</div>}
        {isStudent && p.activeFields?.includes('emergency_contact') && p.phone && <div style={{ color: '#64748b' }}>{p.phone}</div>}
        {isStudent && p.activeFields?.includes('dob') && p.dob && <div style={{ color: '#64748b' }}>DOB: {p.dob}</div>}
        {!isStudent && p.activeFields?.includes('designation') && p.designation && p.designation.toLowerCase() !== p.role?.toLowerCase() && <div style={{ color: '#e2e8f0', fontWeight: 700, textTransform: 'uppercase' }}>{p.designation}</div>}
        {!isStudent && p.activeFields?.includes('department') && <div style={{ color: '#64748b', textTransform: 'uppercase' }}>{p.department}</div>}
        {!isStudent && p.activeFields?.includes('joining_date') && p.joiningDate?.trim() && <div style={{ color: '#475569', fontSize: c.fieldFontSize * 0.9 }}>Since {p.joiningDate}</div>}
        {!isStudent && p.activeFields?.includes('ref_id') && <div style={{ fontFamily: 'monospace', color: '#334155', fontSize: c.fieldFontSize * 0.9, letterSpacing: 1 }}>{p.refId}</div>}
      </div>

      {/* QR */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3px 0 5px' }}>
        <div style={{ background: darkBg, padding: 3, borderRadius: 4, border: `1px solid ${gold}` }}>
          <QRCode value={props.qrValue} size={c.qrSize} level="M" fgColor="#f8fafc" bgColor={darkBg} />
        </div>
      </div>

      {/* Gold bottom bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg,${gold},${gold}aa,${gold})` }} />
    </div>
  );
}

export function AuroraCard(props: CardProps) {
  const isStudent = props.mode === 'student';
  const c = getCustom(props);
  const p = props as any;
  const roleBadge = isStudent ? (p.className || 'Student') : p.role;

  const aurora1 = c.primaryColor === DEFAULT_CUSTOM.primaryColor ? '#7c3aed' : c.primaryColor;
  const aurora2 = c.accentColor === DEFAULT_CUSTOM.accentColor ? '#a855f7' : c.accentColor;

  return (
    <div style={{ width: '54mm', height: '86mm', background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', border: '1px solid #e2e8f0', position: 'relative' }}>
      {/* Gradient header block */}
      <div style={{ background: `linear-gradient(135deg,${aurora1},${aurora2},#6366f1)`, height: '30mm', position: 'relative', flexShrink: 0 }}>
        {/* School info */}
        <div style={{ textAlign: 'center', padding: '6px 8px 0', position: 'relative', zIndex: 2 }}>
          {props.schoolLogo && <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, borderRadius: '50%', objectFit: 'contain', margin: '0 auto 2px', display: 'block' }} />}
          <div style={{ color: '#fff', fontSize: c.schoolFontSize, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.3 }}>{props.schoolName}</div>
          <div style={{ color: '#ddd6fe', fontSize: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 1 }}>{isStudent ? 'STUDENT' : 'FACULTY'} ID</div>
        </div>
        {/* Wave SVG */}
        <svg viewBox="0 0 204 30" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', height: 18 }}>
          <path d="M0,20 Q51,0 102,15 T204,10 L204,30 L0,30 Z" fill="#fff" />
        </svg>
      </div>

      {/* Photo overlapping wave */}
      <div style={{ marginTop: -20, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        <div style={{ width: c.photoSize, height: c.photoSize, borderRadius: '50%', border: `3px solid ${aurora1}`, boxShadow: `0 4px 12px ${aurora1}4d`, overflow: 'hidden', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {props.photo
            ? <img src={props.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: c.photoSize * 0.44, fontWeight: 900, color: aurora1 }}>{props.name.charAt(0)}</span>}
        </div>
      </div>

      {/* Name + role */}
      <div style={{ textAlign: 'center', padding: '3px 6px 0' }}>
        <div style={{ fontSize: c.nameFontSize, fontWeight: 900, color: c.textColor === DEFAULT_CUSTOM.textColor ? '#1e1b4b' : c.textColor, textTransform: 'uppercase', letterSpacing: 0.3 }}>{props.name}</div>
        <div style={{ display: 'inline-block', background: c.roleBgColor, color: c.roleColor, fontSize: c.roleFontSize, fontWeight: 700, padding: '1px 7px', borderRadius: 10, marginTop: 2, textTransform: 'uppercase' }}>{roleBadge}</div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, padding: '4px 8px 2px', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', fontSize: c.fieldFontSize }}>
        {isStudent && p.activeFields?.includes('roll_number') && p.rollNumber && <div style={{ fontWeight: 700, color: '#4c1d95' }}>Roll # {p.rollNumber}</div>}
        {isStudent && p.activeFields?.includes('blood_group') && p.bloodGroup && <div style={{ fontWeight: 700, color: '#dc2626' }}>Blood: {p.bloodGroup}</div>}
        {isStudent && p.activeFields?.includes('emergency_contact') && p.phone && <div style={{ color: '#6b7280' }}>{p.phone}</div>}
        {isStudent && p.activeFields?.includes('dob') && p.dob && <div style={{ color: '#6b7280' }}>DOB: {p.dob}</div>}
        {!isStudent && p.activeFields?.includes('designation') && p.designation && p.designation.toLowerCase() !== p.role?.toLowerCase() && <div style={{ color: '#4c1d95', fontWeight: 700, textTransform: 'uppercase' }}>{p.designation}</div>}
        {!isStudent && p.activeFields?.includes('department') && <div style={{ color: '#6b7280', textTransform: 'uppercase' }}>{p.department}</div>}
        {!isStudent && p.activeFields?.includes('joining_date') && p.joiningDate?.trim() && <div style={{ color: '#9ca3af', fontSize: c.fieldFontSize * 0.9 }}>Since {p.joiningDate}</div>}
        {!isStudent && p.activeFields?.includes('ref_id') && <div style={{ fontFamily: 'monospace', color: '#c4b5fd', fontSize: c.fieldFontSize * 0.9 }}>{p.refId}</div>}
      </div>

      {/* QR */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0 5px' }}>
        <div style={{ background: '#fff', padding: 3, borderRadius: 4, border: '#ede9fe', boxShadow: `0 1px 4px ${aurora1}26` }}>
          <QRCode value={props.qrValue} size={c.qrSize} level="M" fgColor="#4c1d95" />
        </div>
      </div>
    </div>
  );
}

export function HorizonCard(props: CardProps) {
  const isStudent = props.mode === 'student';
  const c = getCustom(props);
  const p = props as any;
  const roleBadge = isStudent ? (p.className || 'Student') : p.role;

  const hColor = c.primaryColor === DEFAULT_CUSTOM.primaryColor ? '#0891b2' : c.primaryColor;
  const hDark = c.accentColor === DEFAULT_CUSTOM.accentColor ? '#0e7490' : c.accentColor;

  return (
    <div style={{ width: '86mm', height: '54mm', background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'row', fontFamily: 'sans-serif', border: '1px solid #e2e8f0' }}>
      {/* Left panel */}
      <div style={{ width: '22mm', background: `linear-gradient(180deg,${hColor},${hDark})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', flexShrink: 0 }}>
        {/* Rotated label */}
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: '#cffafe', fontSize: 5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2 }}>
          {isStudent ? 'STUDENT' : 'FACULTY'}
        </div>
        {/* Photo */}
        <div style={{ width: c.photoSize * 0.9, height: c.photoSize * 0.9, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.7)', overflow: 'hidden', background: '#164e63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {props.photo
            ? <img src={props.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: c.photoSize * 0.38, fontWeight: 900, color: '#7dd3fc' }}>{props.name.charAt(0)}</span>}
        </div>
        {/* Roll or ref */}
        <div style={{ color: '#a5f3fc', fontSize: 5.5, fontWeight: 700 }}>
          {isStudent && p.rollNumber ? `#${p.rollNumber}` : (p.refId?.substring(0, 6) || '')}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '5px 6px', minWidth: 0 }}>
        {/* School */}
        <div style={{ borderBottom: '1px solid #f0f9ff', paddingBottom: 3, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
          {props.schoolLogo && <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, borderRadius: '50%', objectFit: 'contain' }} />}
          <div>
            <div style={{ fontSize: c.schoolFontSize * 0.93, fontWeight: 900, color: hColor, textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.2 }}>{props.schoolName}</div>
            <div style={{ fontSize: 5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Identity Card</div>
          </div>
        </div>

        {/* Name */}
        <div style={{ fontSize: c.nameFontSize * 1.1, fontWeight: 900, color: c.textColor, textTransform: 'uppercase', letterSpacing: 0.2, lineHeight: 1.1 }}>{props.name}</div>
        <div style={{ display: 'inline-block', background: c.roleBgColor, color: c.roleColor, fontSize: c.roleFontSize, fontWeight: 700, padding: '1px 5px', borderRadius: 8, margin: '2px 0', textTransform: 'uppercase' }}>{roleBadge}</div>

        {/* Fields micro grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 4px', alignContent: 'start', fontSize: c.fieldFontSize * 0.92, marginTop: 2 }}>
          {isStudent && p.activeFields?.includes('blood_group') && p.bloodGroup && <div style={{ color: '#dc2626', fontWeight: 700 }}>Blood: {p.bloodGroup}</div>}
          {isStudent && p.activeFields?.includes('dob') && p.dob && <div style={{ color: '#64748b' }}>DOB: {p.dob}</div>}
          {isStudent && p.activeFields?.includes('emergency_contact') && p.phone && <div style={{ color: '#64748b' }}>{p.phone}</div>}
          {!isStudent && p.activeFields?.includes('designation') && p.designation && p.designation.toLowerCase() !== p.role?.toLowerCase() && <div style={{ color: hColor, fontWeight: 700 }}>{p.designation}</div>}
          {!isStudent && p.activeFields?.includes('department') && <div style={{ color: '#64748b' }}>{p.department}</div>}
          {!isStudent && p.activeFields?.includes('joining_date') && p.joiningDate?.trim() && <div style={{ color: '#94a3b8' }}>Since {p.joiningDate}</div>}
        </div>

        {/* QR bottom right */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
          <div style={{ background: '#fff', padding: 2, border: '1px solid #e0f2fe', borderRadius: 3 }}>
            <QRCode value={props.qrValue} size={c.qrSize * 0.75} level="M" fgColor={hDark} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MintCard(props: CardProps) {
  const isStudent = props.mode === 'student';
  const c = getCustom(props);
  const p = props as any;
  const roleBadge = isStudent ? (p.className || 'Student') : p.role;

  const mint = c.primaryColor === DEFAULT_CUSTOM.primaryColor ? '#059669' : c.primaryColor;
  const mintLight = c.accentColor === DEFAULT_CUSTOM.accentColor ? '#34d399' : c.accentColor;

  return (
    <div style={{ width: '86mm', height: '54mm', background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', border: `1px solid ${mintLight}40` }}>
      {/* Top stripe */}
      <div style={{ height: 4, background: `linear-gradient(90deg,${mint},${mintLight})`, flexShrink: 0 }} />

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '4px 6px', gap: 6, minHeight: 0 }}>
        {/* Left: photo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '24mm', flexShrink: 0, gap: 3 }}>
          {props.schoolLogo && <img src={props.schoolLogo} alt="" style={{ width: c.logoSize, height: c.logoSize, borderRadius: '50%', objectFit: 'contain', border: `1px solid ${mintLight}` }} />}
          <div style={{ width: c.photoSize * 0.95, height: c.photoSize * 0.95, borderRadius: '50%', border: `2px solid ${mint}`, overflow: 'hidden', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {props.photo
              ? <img src={props.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: c.photoSize * 0.38, fontWeight: 900, color: mint }}>{props.name.charAt(0)}</span>}
          </div>
          {isStudent && p.rollNumber && <div style={{ fontSize: c.fieldFontSize, fontWeight: 900, color: mint }}>#{p.rollNumber}</div>}
        </div>

        {/* Right: info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ fontSize: c.schoolFontSize * 0.86, fontWeight: 900, color: mint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{props.schoolName}</div>
          <div style={{ fontSize: 4.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{isStudent ? 'Student Identity Card' : 'Faculty Identity Card'}</div>
          <div style={{ fontSize: c.nameFontSize * 1.1, fontWeight: 900, color: c.textColor === DEFAULT_CUSTOM.textColor ? '#064e3b' : c.textColor, textTransform: 'uppercase', letterSpacing: 0.2, lineHeight: 1.1 }}>{props.name}</div>
          <div style={{ display: 'inline-block', background: c.roleBgColor, color: c.roleColor, fontSize: c.roleFontSize, fontWeight: 700, padding: '1px 5px', borderRadius: 8, margin: '2px 0', textTransform: 'uppercase', alignSelf: 'flex-start' }}>{roleBadge}</div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, fontSize: c.fieldFontSize * 0.92, justifyContent: 'center' }}>
            {isStudent && p.activeFields?.includes('blood_group') && p.bloodGroup && <div style={{ color: '#dc2626', fontWeight: 700 }}>Blood: {p.bloodGroup}</div>}
            {isStudent && p.activeFields?.includes('dob') && p.dob && <div style={{ color: '#64748b' }}>DOB: {p.dob}</div>}
            {isStudent && p.activeFields?.includes('emergency_contact') && p.phone && <div style={{ color: '#64748b' }}>{p.phone}</div>}
            {!isStudent && p.activeFields?.includes('designation') && p.designation && p.designation.toLowerCase() !== p.role?.toLowerCase() && <div style={{ color: '#065f46', fontWeight: 700 }}>{p.designation}</div>}
            {!isStudent && p.activeFields?.includes('department') && <div style={{ color: '#64748b' }}>{p.department}</div>}
            {!isStudent && p.activeFields?.includes('joining_date') && p.joiningDate?.trim() && <div style={{ color: '#94a3b8' }}>Since {p.joiningDate}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ background: '#fff', padding: 2, border: `1px solid ${mintLight}60`, borderRadius: 3 }}>
              <QRCode value={props.qrValue} size={c.qrSize * 0.7} level="M" fgColor={mint} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom stripe */}
      <div style={{ height: 2, background: `linear-gradient(90deg,${mint},${mintLight})`, flexShrink: 0 }} />
    </div>
  );
}

export function CardTemplate(props: CardProps & { template: TemplateId }) {
  const { template, ...rest } = props;
  switch (template) {
    case 'elite':   return <EliteCard   {...rest as CardProps} />;
    case 'aurora':  return <AuroraCard  {...rest as CardProps} />;
    case 'horizon': return <HorizonCard {...rest as CardProps} />;
    case 'mint':    return <MintCard    {...rest as CardProps} />;
    default:        return <ClassicCard {...rest as CardProps} />;
  }
}
