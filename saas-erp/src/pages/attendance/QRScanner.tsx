import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Scan, CheckCircle, UserX, AlertTriangle, UserCheck, Clock, User } from 'lucide-react';

export default function QRScanner() {
  const { userRole } = useAuth();
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [gapMinutes, setGapMinutes] = useState(60); // Default 1 hour gap
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Sound effects
  const playBeep = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      console.error("Audio block", e);
    }
  };

  useEffect(() => {
    // Initialize Scanner on mount
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 }, formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ] },
      false
    );
    scannerRef.current = scanner;

    let isProcessing = false;

    scanner.render((decodedText) => {
      if (isProcessing) return; // Prevent rapid-fire multi-scans
      isProcessing = true;
      handleScan(decodedText).finally(() => {
        setTimeout(() => { isProcessing = false; }, 2000); // 2 second block between scans
      });
    }, (error) => {
      // Ignore background parsing errors
    });

    return () => {
      scanner.clear().catch(e => console.error(e));
    };
  }, [userRole]);

  const handleScan = async (decodedText: string) => {
    try {
      const payload = JSON.parse(decodedText);
      const isStaff = payload.type === 'staff_attendance';
      const isStudent = payload.type === 'student_attendance';
      
      if (!isStaff && !isStudent) {
        throw new Error("Invalid QR Code Profile");
      }

      const queryColumn = isStaff ? 'staff_id' : 'student_id';
      const personId = isStaff ? payload.staff_id : payload.student_id;
      
      if (!personId) throw new Error("ID Payload Corrupt");

      // Fetch Profile Data for UX
      let personName = 'Unknown';
      let roleDisplay = isStaff ? 'Staff' : 'Student';
      if (isStaff) {
        const { data: staffData } = await supabase.from('staff').select('full_name, role').eq('id', personId).single();
        if (staffData) { personName = staffData.full_name; roleDisplay = staffData.role; }
      } else {
         const { data: studentData } = await supabase.from('students').select('full_name, roll_number').eq('id', personId).single();
         if (studentData) { personName = studentData.full_name; roleDisplay = `Roll: ${studentData.roll_number}`; }
      }

      setScanResult({ name: personName, role: roleDisplay, id: personId });

      // Check today's attendance
      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toTimeString().split(' ')[0]; // "HH:MM:SS"

      const { data: existingRecord, error: checkErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .eq('date', today)
        .eq(queryColumn, personId)
        .maybeSingle();

      if (checkErr) throw checkErr;

      let actionTaken = '';

      if (!existingRecord) {
        // First log -> Arrival
        const { error: insertErr } = await supabase.from('attendance').insert([{
           school_id: userRole?.school_id,
           [queryColumn]: personId,
           date: today,
           arrival_time: nowTime,
           status: 'present'
        }]);
        if (insertErr) throw insertErr;
        actionTaken = 'Arrival Marked';
      } else {
        // Second log -> Departure
        if (existingRecord.departure_time) {
          // Already logged out, prevent overwrite
          throw new Error("Already checked out for today.");
        }
        
        // Time gap verification
        const arrivalDate = new Date(`1970-01-01T${existingRecord.arrival_time}Z`);
        const nowDate = new Date(`1970-01-01T${nowTime}Z`);
        const diffMinutesCalc = Math.floor((nowDate.getTime() - arrivalDate.getTime()) / 60000);
        
        if (diffMinutesCalc < gapMinutes) {
          throw new Error(`Duplicate Scan Ignored: Minimum gap of ${gapMinutes} minutes required between Arrival and Departure.`);
        }
        
        const { error: updateErr } = await supabase.from('attendance').update({
           departure_time: nowTime
        }).eq('id', existingRecord.id);
        if (updateErr) throw updateErr;
        actionTaken = 'Departure Marked';
      }

      playBeep('success');
      setScanStatus('success');
      setStatusMessage(`${personName} - ${actionTaken}`);
      
      // Push to recent
      setRecentScans(prev => [{ name: personName, role: roleDisplay, time: new Date().toLocaleTimeString(), action: actionTaken }, ...prev].slice(0, 10));

    } catch (err: any) {
      console.error(err);
      playBeep('error');
      setScanStatus('error');
      setStatusMessage(err.message || 'Verification Failed');
    }

    // Reset status block
    setTimeout(() => {
      setScanStatus('idle');
      setScanResult(null);
      setStatusMessage('');
    }, 4000);
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Scanner Target */}
      <div className="md:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
           <div className="bg-indigo-600 p-4 shrink-0 flex items-center justify-between text-white">
             <div className="flex items-center gap-2">
               <Scan className="w-5 h-5" />
               <h2 className="font-bold">Smart Attendance Kiosk</h2>
             </div>
             <div className="text-xs font-bold px-2 py-1 bg-white/20 rounded uppercase">Live Mode</div>
           </div>
           
           <div className="p-6">
              {/* HTML5 QR Container */}
              <div 
                id="qr-reader" 
                className="w-full max-w-lg mx-auto rounded-xl overflow-hidden border-2 border-indigo-100/50 shadow-inner"
              ></div>

              {/* Status Alert Overlay */}
              <div className="mt-6 h-24 flex items-center justify-center">
                 {scanStatus === 'idle' && (
                    <div className="text-center text-gray-400 animate-pulse">
                      <Scan className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">Waiting for QR Code scan...</p>
                    </div>
                 )}
                 {scanStatus === 'success' && (
                    <div className="text-center text-green-600 animate-in zoom-in duration-300">
                      <CheckCircle className="w-10 h-10 mx-auto mb-1" />
                      <p className="font-bold text-lg">{statusMessage}</p>
                    </div>
                 )}
                 {scanStatus === 'error' && (
                    <div className="text-center text-red-600 animate-in zoom-in duration-300">
                      <AlertTriangle className="w-10 h-10 mx-auto mb-1" />
                      <p className="font-bold text-lg">{statusMessage}</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 flex items-start gap-3">
          <Clock className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
          <p>
            <strong>Hardware Keyboard Scanners:</strong> If using a physical USB QR gun, simply ensure the computer is focused on this page. HTML5-QRCode auto-captures keyboard wedge inputs safely. Let the student approach and scan organically!
          </p>
        </div>
      </div>

      {/* Side Panel: Recent Logs & Manual Input */}
      <div className="space-y-6">
        
        {/* Settings Module */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-gray-500" /> Kiosk Settings</h3>
          <div>
             <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Scan Gap Threshold (Minutes)</label>
             <div className="flex items-center gap-3">
               <input 
                 type="range" min="1" max="120" 
                 value={gapMinutes} onChange={e => setGapMinutes(Number(e.target.value))}
                 className="flex-1 accent-indigo-600"
               />
               <span className="text-sm font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded w-16 text-center">{gapMinutes}m</span>
             </div>
             <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">Prevents identical QR codes from marking "Departure" accidentally if scanned twice within the selected threshold.</p>
          </div>
        </div>

        {/* Real-time log list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[400px]">
           <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
             <h3 className="font-bold text-gray-800 flex items-center gap-2"><Clock className="w-4 h-4 text-gray-500" /> Recent Scans</h3>
             <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-bold">Today</span>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2">
             {recentScans.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-gray-400">
                 <UserX className="w-8 h-8 mb-2 opacity-50" />
                 <p className="text-sm">No activity logged yet.</p>
               </div>
             ) : (
               <div className="space-y-2">
                 {recentScans.map((log, i) => (
                   <div key={i} className="flex gap-3 items-center bg-gray-50 hover:bg-gray-100 border border-gray-100 p-3 rounded-xl transition">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${log.action.includes('Arrival') ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                       <UserCheck className="w-5 h-5" />
                     </div>
                     <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm text-gray-900 truncate">{log.name}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{log.role}</p>
                     </div>
                     <div className="text-right shrink-0">
                        <p className={`text-xs font-bold ${log.action.includes('Arrival') ? 'text-green-600' : 'text-orange-600'}`}>{log.action.split(' ')[0]}</p>
                        <p className="text-[10px] text-gray-400">{log.time}</p>
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
