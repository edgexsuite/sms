import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Scan, CheckCircle, AlertTriangle, Clock, UserCheck, UserX,
  Maximize2, Minimize2, Camera, Keyboard, Wifi, GraduationCap,
  Briefcase, RefreshCw, Settings, Shield, Timer, QrCode,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDate } from '../../lib/utils';
import { Card, Btn, Badge, Select, Input } from '../../components/ui';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface ScanLog {
  id: string;
  name: string;
  role: string;
  time: string;
  action: 'in' | 'out';
  attendanceStatus: 'present' | 'late';
  photo?: string | null;
  isStudent: boolean;
}

interface PersonResult {
  name: string;
  role: string;
  photo: string | null;
  action: string;
  actionType: 'in' | 'out';
  attendanceStatus: 'present' | 'late';
  status: 'success' | 'error';
  className?: string;
  rollNumber?: number | null;
  department?: string | null;
  errorMsg?: string;
}

interface DayStats {
  checkIns: number;
  checkOuts: number;
  students: number;
  staff: number;
  lateCount: number;
}

/* ─── Live Clock ─────────────────────────────────────────────────────────── */
function LiveClock() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right hidden sm:block">
      <div className="font-mono text-xl font-black text-white tracking-tighter leading-none tabular-nums">
        {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-[10px] text-indigo-400 mt-0.5 uppercase tracking-widest font-bold">
        {formatDate(now)}
      </div>
    </div>
  );
}

/* ─── Animated Scan Frame ────────────────────────────────────────────────── */
function ScanFrame({ active }: { active: boolean }) {
  const corner = 'w-8 h-8 border-[3px] border-indigo-400';
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Corner brackets */}
      <div className={cn(corner, 'absolute top-5 left-5 border-r-0 border-b-0 rounded-tl-lg')} />
      <div className={cn(corner, 'absolute top-5 right-5 border-l-0 border-b-0 rounded-tr-lg')} />
      <div className={cn(corner, 'absolute bottom-5 left-5 border-r-0 border-t-0 rounded-bl-lg')} />
      <div className={cn(corner, 'absolute bottom-5 right-5 border-l-0 border-t-0 rounded-br-lg')} />
      {/* Centre target box */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-52 h-52 border border-white/10 rounded-xl" />
      </div>
      {/* Animated scan line */}
      {active && (
        <div
          className="absolute left-8 right-8 h-[2px] rounded-full"
          style={{
            background: 'linear-gradient(90deg,transparent,#818cf8,transparent)',
            animation: 'qrScanLine 2.5s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────────────── */
function StatCard({ label, value, Icon, color, bg }: {
  label: string; value: number;
  Icon: React.ComponentType<{ className?: string }>;
  color: string; bg: string;
}) {
  return (
    <Card className={cn('p-3 border-none bg-gradient-to-br', bg)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">{label}</span>
        <Icon className={cn('w-3.5 h-3.5', color)} />
      </div>
      <p className={cn('text-2xl sm:text-3xl font-black tabular-nums', color)}>{value}</p>
    </Card>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function QRScanner() {
  const { userRole } = useAuth();

  /* ── State ── */
  const [personResult, setPersonResult] = useState<PersonResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanLog[]>([]);
  const [dayStats, setDayStats] = useState<DayStats>({
    checkIns: 0, checkOuts: 0, students: 0, staff: 0, lateCount: 0,
  });

  const [gapMinutes, setGapMinutes] = useState(60);
  const [lateAfter, setLateAfter] = useState('08:30');
  const [sessionName, setSessionName] = useState('Morning Session');
  const [showSettings, setShowSettings] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [cameraError, setCameraError] = useState('');
  const [scannerKey, setScannerKey] = useState(0);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(''); // '' = auto

  /* ── Refs ── */
  const kioskRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);
  const gapRef = useRef(gapMinutes);
  const lateAfterRef = useRef(lateAfter);
  const schoolIdRef = useRef<string | undefined>(userRole?.school_id);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedCameraIdRef = useRef<string>('');

  useEffect(() => { gapRef.current = gapMinutes; }, [gapMinutes]);
  useEffect(() => { lateAfterRef.current = lateAfter; }, [lateAfter]);
  useEffect(() => { schoolIdRef.current = userRole?.school_id; }, [userRole]);
  useEffect(() => { selectedCameraIdRef.current = selectedCameraId; }, [selectedCameraId]);

  /* ── Fetch today's DB stats ──────────────────────────────────────────── */
  const fetchDayStats = useCallback(async () => {
    const sid = userRole?.school_id;
    if (!sid) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance')
      .select('student_id,staff_id,arrival_time,departure_time,status')
      .eq('school_id', sid)
      .eq('date', today);
    if (!data) return;
    setDayStats({
      checkIns:  data.filter(r => r.arrival_time).length,
      checkOuts: data.filter(r => r.departure_time).length,
      students:  data.filter(r => r.student_id).length,
      staff:     data.filter(r => r.staff_id).length,
      lateCount: data.filter(r => r.status === 'late').length,
    });
  }, [userRole?.school_id]);

  useEffect(() => { fetchDayStats(); }, [fetchDayStats]);

  /* ── Fullscreen ──────────────────────────────────────────────────────── */
  const toggleFullscreen = () => {
    if (!isFullscreen) kioskRef.current?.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  /* ── Beep ────────────────────────────────────────────────────────────── */
  const playBeep = useCallback((type: 'success' | 'error' | 'late') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(); osc.stop(ctx.currentTime + 0.6);
      } else if (type === 'late') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      }
    } catch { /* audio not critical */ }
  }, []);

  /* ── Show result overlay ─────────────────────────────────────────────── */
  const showResult = useCallback((result: PersonResult) => {
    setPersonResult(result);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => {
      setPersonResult(null);
      isProcessingRef.current = false;
    }, 5000);
  }, []);

  /* ── Is late helper ──────────────────────────────────────────────────── */
  const checkIsLate = (timeStr: string): boolean => {
    const [lh, lm] = lateAfterRef.current.split(':').map(Number);
    const [th, tm] = timeStr.split(':').map(Number);
    return (th * 60 + tm) > (lh * 60 + lm);
  };

  /* ── Core QR processor ───────────────────────────────────────────────── */
  const processQR = useCallback(async (raw: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const sid = schoolIdRef.current;
    if (!sid) {
      showResult({
        name: '', role: '', photo: null, action: 'School not initialised. Please reload.',
        actionType: 'in', attendanceStatus: 'present', status: 'error',
        errorMsg: 'No school ID loaded',
      });
      return;
    }

    try {
      /* Parse JSON payload */
      let payload: any;
      try { payload = JSON.parse(raw.trim()); }
      catch { throw new Error('Invalid QR code — only system-generated attendance cards are accepted'); }

      const isStaff   = payload.type === 'staff_attendance';
      const isStudent = payload.type === 'student_attendance';
      if (!isStaff && !isStudent)
        throw new Error(`Unknown QR type: "${payload.type || '(missing)'}"`);

      const personId = isStaff ? payload.staff_id : payload.student_id;
      if (!personId) throw new Error('QR code is missing the person ID');

      const queryCol = isStaff ? 'staff_id' : 'student_id';
      let name = '', roleDisplay = '', photo: string | null = null;
      let className = '', rollNumber: number | null = null, dept: string | null = null;

      /* Fetch person record */
      if (isStaff) {
        const { data, error } = await supabase
          .from('staff')
          .select('id,full_name,role,department,photograph_url,school_id,is_active')
          .eq('id', personId)
          .single();
        if (error || !data) throw new Error('Staff member not found');
        if (data.school_id !== sid) throw new Error('ID card belongs to a different school');
        if (data.is_active === false) throw new Error(`${data.full_name}'s account is deactivated`);
        name = data.full_name;
        roleDisplay = data.role;
        dept = data.department;
        photo = data.photograph_url;
      } else {
        const { data, error } = await supabase
          .from('students')
          .select('id,full_name,roll_number,photograph_url,school_id,status,classes(name,section)')
          .eq('id', personId)
          .eq('is_deleted', false)
          .single();
        if (error || !data) throw new Error('Student not found');
        if (data.school_id !== sid) throw new Error('ID card belongs to a different school');
        if (data.status !== 'active') throw new Error(`Student is ${data.status} — attendance blocked`);
        name = data.full_name;
        rollNumber = data.roll_number;
        photo = data.photograph_url;
        roleDisplay = 'Student';
        const cls = data.classes as any;
        className = cls ? `${cls.name}${cls.section ? ` (${cls.section})` : ''}` : '';
      }

      /* Check existing record for today */
      const today   = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS

      const { data: existing, error: chkErr } = await supabase
        .from('attendance')
        .select('id,arrival_time,departure_time,status')
        .eq('school_id', sid)
        .eq('date', today)
        .eq(queryCol, personId)
        .maybeSingle();

      if (chkErr) throw new Error('Database error: ' + chkErr.message);

      let actionTaken = '';
      let actionType: 'in' | 'out' = 'in';
      let attendanceStatus: 'present' | 'late' = 'present';

      if (!existing) {
        /* ── FIRST SCAN → Check-In ── */
        attendanceStatus = checkIsLate(nowTime) ? 'late' : 'present';
        const { error: insErr } = await supabase.from('attendance').insert([{
          school_id: sid,
          [queryCol]: personId,
          date: today,
          arrival_time: nowTime,
          status: attendanceStatus,
        }]);
        if (insErr) throw new Error('Failed to record check-in: ' + insErr.message);
        actionTaken = attendanceStatus === 'late' ? 'Late Arrival' : 'Check-In Recorded';
        actionType  = 'in';
      } else {
        /* ── SECOND SCAN → Check-Out ── */
        if (existing.departure_time)
          throw new Error(`Already checked out at ${existing.departure_time.slice(0, 5)}`);

        const [ah, am] = (existing.arrival_time ?? '00:00:00').split(':').map(Number);
        const [nh, nm] = nowTime.split(':').map(Number);
        const diffMins = (nh * 60 + nm) - (ah * 60 + am);
        if (diffMins < gapRef.current) {
          const wait = gapRef.current - diffMins;
          throw new Error(`Too soon — wait ${wait} more minute${wait !== 1 ? 's' : ''} before checking out`);
        }
        const { error: updErr } = await supabase
          .from('attendance')
          .update({ departure_time: nowTime })
          .eq('id', existing.id);
        if (updErr) throw new Error('Failed to record check-out: ' + updErr.message);
        actionTaken = 'Check-Out Recorded';
        actionType  = 'out';
        attendanceStatus = (existing.status as any) ?? 'present';
      }

      /* Update local session stats */
      setDayStats(prev => ({
        ...prev,
        checkIns:  actionType === 'in'  ? prev.checkIns  + 1 : prev.checkIns,
        checkOuts: actionType === 'out' ? prev.checkOuts + 1 : prev.checkOuts,
        students:  isStudent && actionType === 'in' ? prev.students + 1 : prev.students,
        staff:     isStaff   && actionType === 'in' ? prev.staff    + 1 : prev.staff,
        lateCount: attendanceStatus === 'late' ? prev.lateCount + 1 : prev.lateCount,
      }));

      playBeep(attendanceStatus === 'late' ? 'late' : 'success');

      setRecentScans(prev => [{
        id: personId, name,
        role: isStaff ? roleDisplay : (className || 'Student'),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        action: actionType,
        attendanceStatus,
        photo,
        isStudent: !isStaff,
      }, ...prev].slice(0, 50));

      showResult({
        name, role: roleDisplay, photo,
        action: actionTaken, actionType,
        attendanceStatus,
        className, rollNumber, department: dept,
        status: 'success',
      });

    } catch (err: any) {
      playBeep('error');
      showResult({
        name: '', role: '', photo: null,
        action: err.message || 'Scan failed',
        actionType: 'in',
        attendanceStatus: 'present',
        status: 'error',
        errorMsg: err.message,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playBeep, showResult]);

  /* ── Camera bootstrap ────────────────────────────────────────────────── */
  const elementId = `qr-reader-${scannerKey}`;

  useEffect(() => {
    let cancelled = false;
    let instance: any = null;

    const startCamera = async () => {
      setCameraStatus('starting');
      setCameraError('');
      /* Small delay so React can paint the fresh element before the library touches it */
      await new Promise(r => setTimeout(r, 350));
      if (cancelled) return;

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        instance = new Html5Qrcode(elementId, { verbose: false });

        const cams = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!cams?.length) throw new Error('No camera found on this device');

        /* Populate camera list for the settings picker */
        if (!cancelled) setAvailableCameras(cams.map((c: any) => ({ id: c.id, label: c.label || c.id })));

        /* Camera selection priority:
           1. User-picked camera (selectedCameraId) → pass its ID directly
           2. No selection → use { facingMode: 'environment' } (back camera) so the
              browser picks the correct lens without needing an explicit camera ID.
              This avoids the "cameraIdOrConfig is required" error on Android where
              getCameras() can return objects with undefined ids. */
        const currentSelected = selectedCameraIdRef.current;
        const cameraConfig: string | { facingMode: { ideal: string } } = currentSelected
          ? currentSelected
          : { facingMode: { ideal: 'environment' } };

        await instance.start(
          cameraConfig,
          { fps: 12, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
          (text: string) => processQR(text),
          () => { /* per-frame misses – normal */ },
        );

        if (!cancelled) setCameraStatus('active');
      } catch (err: any) {
        if (cancelled) return;
        const msg = String(err?.message ?? err);
        setCameraError(
          /permission|denied/i.test(msg)
            ? 'Camera access denied — enable it in your browser settings and retry.'
            : /no camera|not found/i.test(msg)
            ? 'No camera detected on this device.'
            : `Camera error: ${msg}`,
        );
        setCameraStatus('error');
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      const s = instance;
      instance = null;
      if (s) Promise.resolve().then(() => s.isScanning ? s.stop() : null).catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerKey]); /* processQR is stable via useCallback — intentionally omitted */

  /* ── Manual entry ────────────────────────────────────────────────────── */
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) { processQR(manualInput.trim()); setManualInput(''); }
  };

  /* ─── Result overlay colours ─── */
  const resultBg = personResult?.status === 'error' ? 'bg-red-950/97'
    : personResult?.attendanceStatus === 'late'     ? 'bg-orange-950/97'
    : personResult?.actionType === 'out'            ? 'bg-amber-950/97'
    :                                                 'bg-emerald-950/97';

  const accentColour = personResult?.status === 'error' ? 'border-red-400 shadow-red-900'
    : personResult?.attendanceStatus === 'late'          ? 'border-orange-400 shadow-orange-900'
    : personResult?.actionType === 'out'                 ? 'border-amber-400 shadow-amber-900'
    :                                                      'border-emerald-400 shadow-emerald-900';

  const pillColour = personResult?.status === 'error' ? 'bg-red-500'
    : personResult?.attendanceStatus === 'late'        ? 'bg-orange-500'
    : personResult?.actionType === 'out'               ? 'bg-amber-500'
    :                                                    'bg-emerald-500';

  const barColour = personResult?.status === 'error' ? 'bg-red-500'
    : personResult?.attendanceStatus === 'late'       ? 'bg-orange-400'
    : personResult?.actionType === 'out'              ? 'bg-amber-400'
    :                                                   'bg-emerald-400';

  /* ─── JSX ─── */
  return (
    <div
      ref={kioskRef}
      className={cn(
        'bg-slate-950 text-white overflow-hidden select-none flex flex-col',
        isFullscreen ? 'fixed inset-0 z-[200]' : 'rounded-2xl min-h-[88vh]',
      )}
    >
      {/* ─── Global CSS ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes qrScanLine {
          0%   { top: 12%; opacity: 1; }
          46%  { top: 84%; opacity: 1; }
          50%  { top: 84%; opacity: 0; }
          52%  { top: 12%; opacity: 0; }
          56%  { top: 12%; opacity: 1; }
          100% { top: 12%; opacity: 1; }
        }
        [id^="qr-reader-"] {
          border: none !important;
          background: transparent !important;
          height: 100% !important;
          width: 100% !important;
          position: absolute !important;
          inset: 0 !important;
        }
        [id^="qr-reader-"] > div:first-child { display: none !important; }
        [id^="qr-reader-"] video {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          border-radius: 0 !important;
          object-fit: cover !important;
          position: absolute !important;
          inset: 0 !important;
        }
        [id^="qr-reader-"] canvas { display: none !important; }
        [id^="qr-reader-"] img    { display: none !important; }
        [id$="__scan_region"] > img { display: none !important; }
        [id$="__scan_region"] { height: 100% !important; }
        [id$="__dashboard"]              { display: none !important; }
        [id$="__status_span"]            { display: none !important; }
        [id$="__header_message"]         { display: none !important; }
        [id$="__header_message"] + div   { display: none !important; }
        [id$="__header_message"] ~ div   { display: none !important; }
        button[id$="__camera_selection_change_btn"] { display: none !important; }
        select[id$="__camera_selection"]            { display: none !important; }
        /* Hide the qr box overlay drawn by html5-qrcode */
        [id$="__scan_region"] > div { display: none !important; }
      `}</style>

      {/* ─── TOP BAR ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border-b border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50 shrink-0">
            <Scan className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-black text-sm uppercase tracking-[0.15em] leading-none">
              Smart Attendance Kiosk
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 transition-colors', {
                'bg-emerald-400 animate-pulse': cameraStatus === 'active',
                'bg-red-500':                   cameraStatus === 'error',
                'bg-amber-400 animate-pulse':   cameraStatus === 'starting' || cameraStatus === 'idle',
              })} />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider truncate font-bold">
                {cameraStatus === 'active'   ? `${sessionName} · Scanning…` :
                 cameraStatus === 'starting' ? 'Initialising camera…'       :
                 cameraStatus === 'error'    ? 'Camera Error'               : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <LiveClock />
          <Btn
            variant={showManual ? 'primary' : 'secondary'}
            onClick={() => setShowManual(p => !p)}
            icon={Keyboard}
            size="sm"
            className="!p-2"
          />
          <Btn
            variant={showSettings ? 'primary' : 'secondary'}
            onClick={() => setShowSettings(p => !p)}
            icon={Settings}
            size="sm"
            className="!p-2"
          />
          {cameraStatus === 'error' && (
            <Btn
              variant="danger"
              onClick={() => setScannerKey(k => k + 1)}
              icon={RefreshCw}
              size="sm"
              className="!p-2"
            />
          )}
          <Btn
            variant="secondary"
            onClick={toggleFullscreen}
            icon={isFullscreen ? Minimize2 : Maximize2}
            size="sm"
            className="!p-2"
          />
        </div>
      </div>

      {/* ─── BODY ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">

        {/* ─── LEFT: Stats + Camera + Manual ──────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 p-4 min-w-0 min-h-0">

          {/* Today's Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Check-Ins"  value={dayStats.checkIns}  Icon={UserCheck}     color="text-emerald-400" bg="from-emerald-500/15 to-emerald-600/5 border-emerald-500/25" />
            <StatCard label="Check-Outs" value={dayStats.checkOuts} Icon={UserX}         color="text-amber-400"   bg="from-amber-500/15 to-amber-600/5 border-amber-500/25" />
            <StatCard label="Students"   value={dayStats.students}  Icon={GraduationCap} color="text-indigo-400"  bg="from-indigo-500/15 to-indigo-600/5 border-indigo-500/25" />
            <StatCard label="Late"       value={dayStats.lateCount} Icon={Timer}         color="text-rose-400"    bg="from-rose-500/15 to-rose-600/5 border-rose-500/25" />
          </div>

          {/* Camera Area */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex-1 min-h-0" style={{ minHeight: 320 }}>
            {/* html5-qrcode mounts here — fresh DOM id per retry */}
            <div id={elementId} style={{ width: '100%' }} />

            {/* Corner bracket overlay + scan line */}
            {cameraStatus === 'active' && <ScanFrame active />}

            {/* Initialising */}
            {cameraStatus === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div className="absolute -inset-1 border-2 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent rounded-2xl animate-spin" />
                </div>
                <p className="text-slate-200 font-black text-sm uppercase tracking-widest">Initialising Camera</p>
                <p className="text-slate-600 text-xs mt-1.5">Allow access when prompted by your browser</p>
              </div>
            )}

            {/* Idle */}
            {cameraStatus === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-20">
                <div className="w-8 h-8 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            )}

            {/* Error */}
            {cameraStatus === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20 text-center p-8">
                <div className="w-20 h-20 rounded-2xl bg-red-900/30 border border-red-800/60 flex items-center justify-center mb-5">
                  <Camera className="w-10 h-10 text-red-400" />
                </div>
                <p className="text-red-400 font-black text-sm mb-2 uppercase tracking-widest">Camera Unavailable</p>
                <p className="text-slate-500 text-xs max-w-xs mb-6 leading-relaxed">{cameraError}</p>
                <Btn
                  variant="primary"
                  onClick={() => setScannerKey(k => k + 1)}
                  icon={RefreshCw}
                  className="px-8 py-4 text-sm"
                >
                  Retry Camera
                </Btn>
              </div>
            )}

            {/* Scan Result Overlay */}
            <AnimatePresence>
              {personResult && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.18 }}
                  className={cn('absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-30', resultBg)}
                >
                  {personResult.status === 'success' ? (
                    <>
                      {/* Photo / Avatar */}
                      {personResult.photo ? (
                        <img
                          src={personResult.photo}
                          alt={personResult.name}
                          className={cn(
                            'w-28 h-28 rounded-2xl object-cover mb-3 border-4 shadow-2xl',
                            accentColour,
                          )}
                        />
                      ) : (
                        <div className={cn(
                          'w-28 h-28 rounded-2xl flex items-center justify-center text-5xl font-black mb-3 border-4 shadow-2xl',
                          personResult.attendanceStatus === 'late'
                            ? 'bg-orange-900 border-orange-400 text-orange-200'
                            : personResult.actionType === 'in'
                            ? 'bg-emerald-900 border-emerald-400 text-emerald-200'
                            : 'bg-amber-900 border-amber-400 text-amber-200',
                        )}>
                          {personResult.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Status icon */}
                      {personResult.attendanceStatus === 'late' ? (
                        <AlertTriangle className="w-8 h-8 text-orange-400 mb-2" />
                      ) : personResult.actionType === 'in' ? (
                        <CheckCircle className="w-8 h-8 text-emerald-400 mb-2" />
                      ) : (
                        <UserX className="w-8 h-8 text-amber-400 mb-2" />
                      )}

                      <h2 className="text-white font-black text-3xl mb-1 tracking-tight">{personResult.name}</h2>
                      <p className="text-slate-300 text-sm mb-4 font-medium">
                        {personResult.className || personResult.role}
                        {personResult.rollNumber ? ` · Roll #${personResult.rollNumber}` : ''}
                        {personResult.department  ? ` · ${personResult.department}`       : ''}
                      </p>

                      <div className={cn(
                        'inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-sm uppercase tracking-[0.12em] text-white shadow-lg',
                        pillColour,
                      )}>
                        {personResult.attendanceStatus === 'late'
                          ? <AlertTriangle className="w-4 h-4" />
                          : personResult.actionType === 'in'
                          ? <UserCheck className="w-4 h-4" />
                          : <UserX className="w-4 h-4" />}
                        {personResult.action}
                      </div>

                      {/* Countdown bar */}
                      <div className="mt-6 h-1 w-48 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', barColour)}
                          initial={{ width: '100%' }}
                          animate={{ width: '0%' }}
                          transition={{ duration: 5, ease: 'linear' }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 rounded-2xl bg-red-900/50 border border-red-700 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-10 h-10 text-red-400" />
                      </div>
                      <h2 className="text-red-300 font-black text-2xl mb-3 uppercase tracking-wide">Scan Failed</h2>
                      <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                        {personResult.errorMsg || personResult.action}
                      </p>
                      <div className="mt-6 h-1 w-48 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-red-500 rounded-full"
                          initial={{ width: '100%' }}
                          animate={{ width: '0%' }}
                          transition={{ duration: 5, ease: 'linear' }}
                        />
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Manual Entry */}
          <AnimatePresence>
            {showManual && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Keyboard className="w-3 h-3" /> Manual QR Payload Entry
                  </p>
                  <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <Input
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      placeholder='{"type":"student_attendance","student_id":"..."}'
                      className="flex-1 !bg-slate-800 !border-slate-700 !text-white font-mono"
                    />
                    <Btn
                      type="submit"
                      variant="primary"
                    >
                      Process
                    </Btn>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint bar */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <span className={cn('w-2 h-2 rounded-full shrink-0',
              cameraStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')} />
            <p className="text-[11px] text-slate-500 font-medium truncate">
              {cameraStatus === 'active'
                ? 'Hold QR code steady in the scanning area — attendance marks automatically.'
                : cameraStatus === 'error'
                ? cameraError
                : 'Waiting for camera…'}
            </p>
          </div>

          {/* Quick-link to existing ID card pages */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Print ID Cards:</span>
            <a
              href="/students/digital-id"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[11px] font-bold transition-all border border-slate-700"
            >
              <GraduationCap className="w-3 h-3" /> Students
            </a>
            <a
              href="/staff/digital-id"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[11px] font-bold transition-all border border-slate-700"
            >
              <Briefcase className="w-3 h-3" /> Staff
            </a>
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR ───────────────────────────────────────────── */}
        <div className="lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-slate-800/60 flex flex-col bg-slate-900 shrink-0">

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-slate-800"
              >
                <div className="p-4 space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Settings className="w-3 h-3" /> Kiosk Settings
                  </h3>

                  {/* Camera Selector */}
                  <div>
                    <Select
                      label="Camera"
                      value={selectedCameraId}
                      onChange={e => { setSelectedCameraId(e.target.value); setScannerKey(k => k + 1); }}
                      className="!bg-slate-800 !border-slate-700 !text-white"
                    >
                      <option value="">Default (back / environment camera)</option>
                      {availableCameras.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </Select>
                    <p className="text-[9px] text-slate-600 mt-1">Changing camera restarts the scanner</p>
                  </div>

                  {/* Session Name */}
                  <div>
                    <Input
                      label="Session Name"
                      value={sessionName}
                      onChange={e => setSessionName(e.target.value)}
                      className="!bg-slate-800 !border-slate-700 !text-white"
                    />
                  </div>

                  {/* Late After */}
                  <div>
                    <Input
                      label="Late Threshold"
                      type="time"
                      value={lateAfter}
                      onChange={e => setLateAfter(e.target.value)}
                      className="!bg-slate-800 !border-slate-700 !text-white"
                    />
                    <p className="text-[9px] text-slate-600 mt-1">
                      Arrivals after this time are marked Late
                    </p>
                  </div>

                  {/* Min Gap */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-400" /> Min Gap Before Check-Out
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min="1" max="480" value={gapMinutes}
                        onChange={e => setGapMinutes(Number(e.target.value))}
                        className="flex-1 accent-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-black text-indigo-400 w-12 text-right tabular-nums">
                        {gapMinutes}m
                      </span>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-700 mt-1">
                      <span>1 min</span><span>8 hrs</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live Activity Feed */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between shrink-0">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Wifi className="w-3 h-3 text-indigo-400" /> Live Activity
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-600/20 text-indigo-400 rounded-full border border-indigo-500/20">
                {recentScans.length}
              </span>
            </div>

            {/* Desktop vertical list */}
            <div className="hidden lg:block flex-1 overflow-y-auto">
              {recentScans.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-700">
                  <QrCode className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs font-bold">No scans yet</p>
                  <p className="text-[10px] opacity-50 mt-0.5">Waiting for first QR scan…</p>
                </div>
              ) : (
                recentScans.map((log, i) => (
                  <motion.div
                    key={`${log.id}-${i}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition border-b border-slate-800/40"
                  >
                    {log.photo ? (
                      <img src={log.photo} alt={log.name}
                        className="w-9 h-9 rounded-xl object-cover shrink-0 border border-slate-700" />
                    ) : (
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0',
                        log.attendanceStatus === 'late'
                          ? 'bg-orange-900/50 text-orange-400 border border-orange-800'
                          : log.action === 'in'
                          ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-900/50 text-amber-400 border border-amber-800',
                      )}>
                        {log.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white truncate">{log.name}</p>
                      <p className="text-[10px] text-slate-500 truncate font-medium">{log.role}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant={log.attendanceStatus === 'late' ? 'danger' : log.action === 'in' ? 'success' : 'warning'}
                        className="text-[9px]"
                      >
                        {log.attendanceStatus === 'late' ? 'LATE' : log.action === 'in' ? 'IN' : 'OUT'}
                      </Badge>
                      <p className="text-[10px] text-slate-600 mt-0.5">{log.time}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Mobile horizontal chips */}
            <div className="lg:hidden flex gap-2 overflow-x-auto p-3 flex-nowrap">
              {recentScans.length === 0 ? (
                <p className="text-[11px] text-slate-600 py-2">No scans yet</p>
              ) : (
                recentScans.map((log, i) => (
                  <div
                    key={`m-${log.id}-${i}`}
                    className={cn(
                      'shrink-0 flex flex-col items-center gap-1 rounded-xl p-2 w-14 border',
                      log.attendanceStatus === 'late'
                        ? 'bg-orange-950/60 border-orange-900'
                        : log.action === 'in'
                        ? 'bg-emerald-950/60 border-emerald-900'
                        : 'bg-amber-950/60 border-amber-900',
                    )}
                  >
                    {log.photo ? (
                      <img src={log.photo} alt={log.name} className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black',
                        log.attendanceStatus === 'late'
                          ? 'bg-orange-900 text-orange-400'
                          : log.action === 'in'
                          ? 'bg-emerald-900 text-emerald-400'
                          : 'bg-amber-900 text-amber-400',
                      )}>
                        {log.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <p className="text-[9px] text-white font-bold truncate w-full text-center">
                      {log.name.split(' ')[0]}
                    </p>
                    <span className={cn('text-[8px] font-black', {
                      'text-orange-400':  log.attendanceStatus === 'late',
                      'text-emerald-400': log.action === 'in' && log.attendanceStatus !== 'late',
                      'text-amber-400':   log.action === 'out',
                    })}>
                      {log.attendanceStatus === 'late' ? 'LATE' : log.action === 'in' ? 'IN' : 'OUT'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom shield */}
          <div className="px-4 py-3 border-t border-slate-800/60 flex items-center gap-2 shrink-0">
            <Shield className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest truncate">
              Secured · Multi-Tenant · School ERP
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
