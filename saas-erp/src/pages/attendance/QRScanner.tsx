import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Scan, CheckCircle, AlertTriangle, Clock, UserCheck, UserX,
  Maximize2, Minimize2, Camera, Keyboard, Wifi, GraduationCap, Briefcase, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface ScanLog {
  id: string;
  name: string;
  role: string;
  time: string;
  action: 'in' | 'out';
  photo?: string | null;
  isStudent: boolean;
}

interface PersonResult {
  name: string;
  role: string;
  photo: string | null;
  action: string;
  actionType: 'in' | 'out';
  className?: string;
  rollNumber?: number | null;
  department?: string | null;
  status: 'success' | 'error';
  errorMsg?: string;
}

/* ─── Live Clock ─────────────────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right hidden sm:block">
      <div className="font-mono text-xl font-black text-white tracking-tighter leading-none">
        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">
        {time.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function QRScanner() {
  const { userRole } = useAuth();

  const [personResult, setPersonResult] = useState<PersonResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanLog[]>([]);
  const [gapMinutes, setGapMinutes] = useState(60);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [cameraError, setCameraError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [scannerKey, setScannerKey] = useState(0); // increment to remount scanner

  const kioskRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const isProcessingRef = useRef(false);
  const gapRef = useRef(gapMinutes);
  const schoolIdRef = useRef(userRole?.school_id);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { gapRef.current = gapMinutes; }, [gapMinutes]);
  useEffect(() => { schoolIdRef.current = userRole?.school_id; }, [userRole]);

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
  const playBeep = useCallback((type: 'success' | 'error') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(); osc.stop(ctx.currentTime + 0.6);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      }
    } catch { /* audio not critical */ }
  }, []);

  /* ── Show result overlay ──────────────────────────────────────────────── */
  const showResult = useCallback((result: PersonResult) => {
    setPersonResult(result);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => {
      setPersonResult(null);
      isProcessingRef.current = false;
    }, 5000);
  }, []);

  /* ── Process a decoded QR string ─────────────────────────────────────── */
  const processQR = useCallback(async (raw: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const sid = schoolIdRef.current;

    try {
      let payload: any;
      try { payload = JSON.parse(raw.trim()); }
      catch { throw new Error('Invalid QR format — use system-generated codes'); }

      const isStaff = payload.type === 'staff_attendance';
      const isStudent = payload.type === 'student_attendance';
      if (!isStaff && !isStudent) throw new Error(`Unknown QR type: "${payload.type || 'missing'}"`);

      const personId = isStaff ? payload.staff_id : payload.student_id;
      if (!personId) throw new Error('QR code missing person ID');

      const queryCol = isStaff ? 'staff_id' : 'student_id';
      let name = 'Unknown', roleDisplay = '', photo: string | null = null;
      let className = '', rollNumber = null, dept = null;

      if (isStaff) {
        const { data, error } = await supabase
          .from('staff').select('id,full_name,role,department,photograph_url,school_id,is_active')
          .eq('id', personId).single();
        if (error || !data) throw new Error('Staff ID not found');
        if (data.school_id !== sid) throw new Error('ID belongs to a different school');
        if (data.is_active === false) throw new Error('Staff account is deactivated');
        name = data.full_name; roleDisplay = data.role; dept = data.department; photo = data.photograph_url;
      } else {
        const { data, error } = await supabase
          .from('students').select('id,full_name,roll_number,photograph_url,school_id,status,classes(name,section)')
          .eq('id', personId).single();
        if (error || !data) throw new Error('Student ID not found');
        if (data.school_id !== sid) throw new Error('Student belongs to a different school');
        if (data.status !== 'active') throw new Error(`Student status: ${data.status}`);
        name = data.full_name; rollNumber = data.roll_number; photo = data.photograph_url;
        roleDisplay = 'Student';
        const cls = data.classes as any;
        className = cls ? `${cls.name} ${cls.section || ''}`.trim() : '';
      }

      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toTimeString().split(' ')[0];

      const { data: existing, error: chkErr } = await supabase
        .from('attendance').select('id,arrival_time,departure_time')
        .eq('school_id', sid).eq('date', today).eq(queryCol, personId).maybeSingle();

      if (chkErr) throw new Error('DB error: ' + chkErr.message);

      let actionTaken = '', actionType: 'in' | 'out' = 'in';

      if (!existing) {
        const { error: insErr } = await supabase.from('attendance').insert([{
          school_id: sid, [queryCol]: personId, date: today,
          arrival_time: nowTime, status: 'present',
        }]);
        if (insErr) throw new Error('Failed to record arrival: ' + insErr.message);
        actionTaken = 'Check-In Recorded'; actionType = 'in';
      } else {
        if (existing.departure_time) throw new Error('Already checked out today at ' + existing.departure_time);
        const [ah, am] = existing.arrival_time.split(':').map(Number);
        const [nh, nm] = nowTime.split(':').map(Number);
        const diff = (nh * 60 + nm) - (ah * 60 + am);
        if (diff < gapRef.current) throw new Error(`Too soon — wait ${gapRef.current - diff} more minute(s)`);
        const { error: updErr } = await supabase.from('attendance').update({ departure_time: nowTime }).eq('id', existing.id);
        if (updErr) throw new Error('Failed to record departure: ' + updErr.message);
        actionTaken = 'Check-Out Recorded'; actionType = 'out';
      }

      playBeep('success');
      setRecentScans(prev => [{
        id: personId, name, role: isStaff ? roleDisplay : (className || 'Student'),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        action: actionType, photo, isStudent: !isStaff,
      }, ...prev].slice(0, 30));
      showResult({ name, role: roleDisplay, photo, action: actionTaken, actionType, className, rollNumber, department: dept, status: 'success' });

    } catch (err: any) {
      playBeep('error');
      showResult({ name: '', role: '', photo: null, action: err.message || 'Scan failed', actionType: 'in', status: 'error', errorMsg: err.message });
    }
  }, [playBeep, showResult]);

  /* ── Camera initialisation ───────────────────────────────────────────── */
  // Each scannerKey gets its OWN element id — avoids "already under transition"
  // because we never reuse the same DOM node for a new Html5Qrcode instance.
  const elementId = `qr-reader-${scannerKey}`;

  useEffect(() => {
    let cancelled = false;
    let instance: any = null;

    const startCamera = async () => {
      setCameraStatus('starting');
      setCameraError('');

      // Wait for React to paint the new element before the library touches it
      await new Promise(r => setTimeout(r, 400));
      if (cancelled) return;

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        instance = new Html5Qrcode(elementId, { verbose: false });
        scannerRef.current = instance;

        // Enumerate first — then start ONCE. Never call start() twice on the same instance.
        const cams = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!cams || !cams.length) throw new Error('No camera found on this device');

        // Prefer labelled back/rear camera; fall back to last in list (rear on most phones)
        const cam = cams.find((c: any) => /back|rear|environment/i.test(c.label))
          ?? cams[cams.length - 1];

        await instance.start(
          cam.id,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text: string) => processQR(text),
          () => {}   // per-frame decode misses — normal, ignore
        );

        if (!cancelled) setCameraStatus('active');
      } catch (err: any) {
        if (cancelled) return;
        const msg = String(err?.message || err);
        setCameraError(
          /permission|denied/i.test(msg)
            ? 'Camera permission denied — allow access in browser settings.'
            : /no camera|not found/i.test(msg)
            ? 'No camera detected on this device.'
            : `Camera error: ${msg}`
        );
        setCameraStatus('error');
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      const s = instance;
      instance = null;
      scannerRef.current = null;
      if (s) {
        // Stop asynchronously — don't block the next render
        Promise.resolve()
          .then(() => s.isScanning ? s.stop() : null)
          .catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerKey]); // intentionally omit processQR — stable via useCallback

  /* ── Manual entry ────────────────────────────────────────────────────── */
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) { processQR(manualInput.trim()); setManualInput(''); }
  };

  /* ── Derived counts ──────────────────────────────────────────────────── */
  const checkIns  = recentScans.filter(s => s.action === 'in').length;
  const checkOuts = recentScans.filter(s => s.action === 'out').length;
  const students  = recentScans.filter(s => s.isStudent).length;
  const staff     = recentScans.filter(s => !s.isStudent).length;

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div
      ref={kioskRef}
      className={`bg-slate-950 text-white ${isFullscreen ? 'fixed inset-0 z-[200]' : 'rounded-2xl'} overflow-hidden`}
    >
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <Scan className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-black text-xs uppercase tracking-widest leading-none">Smart Attendance Kiosk</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                cameraStatus === 'active' ? 'bg-emerald-400 animate-pulse' :
                cameraStatus === 'error'  ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
              }`} />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider truncate">
                {cameraStatus === 'active'   ? 'Camera Active — Scanning' :
                 cameraStatus === 'starting' ? 'Initializing camera…' :
                 cameraStatus === 'error'    ? 'Camera Error' : 'Ready'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LiveClock />
          <button
            onClick={() => setShowManual(p => !p)}
            title="Manual Entry"
            className={`p-2 rounded-lg transition ${showManual ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'}`}
          >
            <Keyboard className="w-4 h-4" />
          </button>
          {cameraStatus === 'error' && (
            <button
              onClick={() => setScannerKey(k => k + 1)}
              title="Retry Camera"
              className="p-2 rounded-lg bg-red-900/50 hover:bg-red-800 text-red-400 hover:text-white transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row">

        {/* ── LEFT: Stats + Camera + Manual ─────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 p-3 min-w-0">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Check-Ins',  value: checkIns,  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', Icon: UserCheck },
              { label: 'Check-Outs', value: checkOuts, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',   Icon: UserX },
              { label: 'Students',   value: students,  color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20', Icon: GraduationCap },
              { label: 'Staff',      value: staff,     color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20', Icon: Briefcase },
            ].map(({ label, value, color, bg, Icon }) => (
              <div key={label} className={`border rounded-xl p-2 sm:p-3 ${bg}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest">{label}</span>
                  <Icon className={`w-3 h-3 ${color} hidden sm:block`} />
                </div>
                <p className={`text-xl sm:text-2xl font-black ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Camera area ── */}
          <div className="relative rounded-2xl overflow-hidden bg-black" style={{ minHeight: '420px' }}>

            {/* THE scanning div — fresh id per attempt, no stale state conflicts */}
            <div id={elementId} style={{ width: '100%' }} />

            {/* Initialising overlay */}
            {cameraStatus === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-slate-400 text-sm font-medium">Starting camera…</p>
                <p className="text-slate-600 text-xs mt-1">Allow camera access when prompted</p>
              </div>
            )}

            {/* Idle overlay (before first mount) */}
            {cameraStatus === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                <div className="w-8 h-8 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            )}

            {/* Error overlay */}
            {cameraStatus === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 text-center p-8">
                <div className="w-16 h-16 rounded-full bg-red-900/30 border border-red-800 flex items-center justify-center mb-4">
                  <Camera className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 font-bold text-sm mb-2">Camera Unavailable</p>
                <p className="text-slate-500 text-xs max-w-xs mb-4">{cameraError}</p>
                <button
                  onClick={() => setScannerKey(k => k + 1)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition"
                >
                  <RefreshCw className="w-4 h-4" /> Retry Camera
                </button>
              </div>
            )}

            {/* Scan result overlay */}
            <AnimatePresence>
              {personResult && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-20
                    ${personResult.status === 'success'
                      ? personResult.actionType === 'in' ? 'bg-emerald-950/96' : 'bg-amber-950/96'
                      : 'bg-red-950/96'}`}
                >
                  {personResult.status === 'success' ? (
                    <>
                      {personResult.photo
                        ? <img src={personResult.photo} alt={personResult.name}
                            className={`w-24 h-24 rounded-full object-cover mb-4 border-4 shadow-2xl
                              ${personResult.actionType === 'in' ? 'border-emerald-400' : 'border-amber-400'}`} />
                        : <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black mb-4 border-4 shadow-2xl
                            ${personResult.actionType === 'in' ? 'bg-emerald-900 border-emerald-400 text-emerald-300' : 'bg-amber-900 border-amber-400 text-amber-300'}`}>
                            {personResult.name.charAt(0).toUpperCase()}
                          </div>
                      }
                      <CheckCircle className={`w-7 h-7 mb-2 ${personResult.actionType === 'in' ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <h2 className="text-white font-black text-2xl mb-1">{personResult.name}</h2>
                      <p className="text-slate-300 text-sm mb-3">
                        {personResult.className || personResult.role}
                        {personResult.rollNumber ? ` · Roll #${personResult.rollNumber}` : ''}
                        {personResult.department ? ` · ${personResult.department}` : ''}
                      </p>
                      <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full font-black text-sm uppercase tracking-widest
                        ${personResult.actionType === 'in' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                        {personResult.actionType === 'in' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                        {personResult.action}
                      </div>
                      <div className="mt-5 h-1 w-40 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${personResult.actionType === 'in' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                          initial={{ width: '100%' }}
                          animate={{ width: '0%' }}
                          transition={{ duration: 5, ease: 'linear' }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-14 h-14 text-red-400 mb-4" />
                      <h2 className="text-red-300 font-black text-xl mb-2">Scan Failed</h2>
                      <p className="text-slate-400 text-sm max-w-xs">{personResult.errorMsg || personResult.action}</p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Manual entry */}
          <AnimatePresence>
            {showManual && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Manual QR Code Entry</p>
                  <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <input
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      placeholder='{"type":"student_attendance","student_id":"uuid-here"}'
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition shrink-0">
                      Process
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cameraStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <p className="text-[11px] text-slate-500 truncate">
              {cameraStatus === 'active'
                ? 'Hold QR code steady inside the box — attendance marks automatically.'
                : cameraStatus === 'error' ? cameraError : 'Waiting for camera…'}
            </p>
          </div>
        </div>

        {/* ── RIGHT: Gap + Activity ──────────────────────────────────── */}
        <div className="lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col bg-slate-900 shrink-0">

          {/* Gap slider */}
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Clock className="w-3 h-3" /> Min Gap Before Checkout
            </h3>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="480" value={gapMinutes}
                onChange={e => setGapMinutes(Number(e.target.value))}
                className="flex-1 accent-indigo-500 cursor-pointer" />
              <span className="text-xs font-black text-indigo-400 w-12 text-right">{gapMinutes}m</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-700 mt-1"><span>1 min</span><span>8 hrs</span></div>
          </div>

          {/* Activity feed */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Wifi className="w-3 h-3" /> Live Activity
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-600/20 text-indigo-400 rounded-full border border-indigo-500/20">
                {recentScans.length}
              </span>
            </div>

            {/* Desktop: vertical list */}
            <div className="hidden lg:block flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {recentScans.length === 0
                ? <div className="flex flex-col items-center justify-center h-32 text-slate-700">
                    <Scan className="w-7 h-7 mb-2 opacity-30" />
                    <p className="text-xs">No scans yet</p>
                  </div>
                : recentScans.map((log, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition">
                      {log.photo
                        ? <img src={log.photo} alt={log.name} className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-700" />
                        : <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 border
                            ${log.action === 'in' ? 'bg-emerald-900/50 text-emerald-400 border-emerald-800' : 'bg-amber-900/50 text-amber-400 border-amber-800'}`}>
                            {log.name.charAt(0).toUpperCase()}
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{log.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{log.role}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full
                          ${log.action === 'in' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {log.action === 'in' ? 'IN' : 'OUT'}
                        </span>
                        <p className="text-[10px] text-slate-600 mt-0.5">{log.time}</p>
                      </div>
                    </div>
                  ))
              }
            </div>

            {/* Mobile: horizontal chips */}
            <div className="lg:hidden flex gap-2 overflow-x-auto p-3 flex-nowrap">
              {recentScans.length === 0
                ? <p className="text-[11px] text-slate-600 py-2">No scans yet</p>
                : recentScans.map((log, i) => (
                    <div key={i} className={`shrink-0 flex flex-col items-center gap-1 rounded-xl p-2 w-14 border
                      ${log.action === 'in' ? 'bg-emerald-950/60 border-emerald-900' : 'bg-amber-950/60 border-amber-900'}`}>
                      {log.photo
                        ? <img src={log.photo} alt={log.name} className="w-8 h-8 rounded-full object-cover" />
                        : <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black
                            ${log.action === 'in' ? 'bg-emerald-900 text-emerald-400' : 'bg-amber-900 text-amber-400'}`}>
                            {log.name.charAt(0).toUpperCase()}
                          </div>
                      }
                      <p className="text-[9px] text-white font-bold truncate w-full text-center">{log.name.split(' ')[0]}</p>
                      <span className={`text-[8px] font-black ${log.action === 'in' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {log.action === 'in' ? 'IN' : 'OUT'}
                      </span>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* CSS: cosmetic only — never constrain geometry the library controls */}
      <style>{`
        [id^="qr-reader-"] { border: none !important; background: #000 !important; }
        [id^="qr-reader-"] video {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          min-height: 280px !important;
          border-radius: 0 !important;
          object-fit: cover !important;
        }
        [id^="qr-reader-"] canvas { display: none !important; }
        [id^="qr-reader-"] img { display: none !important; }
        [id$="__dashboard"] { display: none !important; }
        [id$="__status_span"] { display: none !important; }
        [id$="__header_message"] { display: none !important; }
        [id$="__header_message"] + div { display: none !important; }
      `}</style>
    </div>
  );
}
