import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, Smartphone, Eye, EyeOff, Printer, Key, RefreshCw, Wand2,
  Copy, CheckCheck, Download, Filter, Users, GraduationCap, AlertCircle,
  CheckCircle2, ChevronDown
} from 'lucide-react';
import * as templatesLib from '../../lib/whatsappTemplates';

/* ── helpers ────────────────────────────────────────────────────────────── */
function generatePassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < length; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function generateStudentUID(name: string, rollNumber: number | string): string {
  const firstName = (name || 'STU').trim().split(' ')[0].replace(/[^a-zA-Z]/g, '');
  return `${firstName}${rollNumber || Math.floor(1000 + Math.random() * 9000)}`;
}

/* ── types ──────────────────────────────────────────────────────────────── */
interface StudentRow {
  id: string;
  full_name: string;
  roll_number: number;
  student_unique_id: string | null;
  auth_password: string | null;
  class_id: string | null;
  status: string;
  classes: { id: string; name: string } | null;
}

interface FamilyRow {
  id: string;
  family_number: string | null;
  auth_password: string | null;
  full_name: string;
  father_name: string | null;
  whatsapp_number: string | null;
  email: string | null;
  students: StudentRow[];
}

interface ClassOption {
  id: string;
  name: string;
}

/* ── component ──────────────────────────────────────────────────────────── */
export default function CredentialDispatch() {
  const { userRole } = useAuth();
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [showPasswords, setShowPasswords] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchCredentials();
      fetchClasses();
    }
  }, [userRole]);

  /* ── data fetching ── */
  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', userRole?.school_id || '')
      .order('name');
    setClasses(data || []);
  };

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('parents')
        .select(`
          id, family_number, auth_password, full_name, father_name,
          whatsapp_number, email,
          students (
            id, full_name, roll_number, student_unique_id,
            auth_password, class_id, status,
            classes ( id, name )
          )
        `)
        .eq('school_id', userRole?.school_id || '');
      if (error) throw error;
      setFamilies((data as any[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ── filtering ── */
  const filteredFamilies = useMemo(() => {
    let list = families;

    // Class filter — keep families that have at least one active student in the selected class
    if (selectedClass !== 'all') {
      list = list
        .map(f => ({
          ...f,
          students: f.students?.filter(
            (s: StudentRow) => s.class_id === selectedClass && s.status === 'active'
          ) || [],
        }))
        .filter(f => f.students.length > 0);
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f =>
        f.full_name?.toLowerCase().includes(q) ||
        f.family_number?.toLowerCase().includes(q) ||
        f.students?.some((s: StudentRow) => s.full_name?.toLowerCase().includes(q))
      );
    }

    return list;
  }, [families, selectedClass, search]);

  /* ── stats ── */
  const stats = useMemo(() => {
    const total = filteredFamilies.length;
    const missingParent = filteredFamilies.filter(f => !f.auth_password || !f.family_number).length;
    const allStudents = filteredFamilies.flatMap(f => f.students || []);
    const missingStudent = allStudents.filter(s => !s.auth_password || !s.student_unique_id).length;
    return { total, missingParent, missingStudent, totalStudents: allStudents.length };
  }, [filteredFamilies]);

  const missingCount = families.reduce((n, f) => {
    if (!f.auth_password) n++;
    (f.students || []).forEach((s: StudentRow) => { if (!s.auth_password || !s.student_unique_id) n++; });
    return n;
  }, 0);

  /* ── credential formatting ── */
  const formatCredentials = (family: FamilyRow) => {
    let msg = `*SCHOOL LOGIN CREDENTIALS*\n\n`;
    msg += `Dear ${family.full_name},\n\n`;
    msg += `*PARENT PORTAL*\n`;
    msg += `ID: ${family.family_number}\n`;
    msg += `Pass: ${family.auth_password}\n`;
    msg += `Link: https://portal.theedgeschool.com/parent-portal\n\n`;
    if (family.students?.length > 0) {
      msg += `*STUDENT HUB*\n`;
      family.students.forEach((stu: StudentRow) => {
        msg += `- ${stu.full_name}: ${stu.student_unique_id} (Pass: ${stu.auth_password})\n`;
      });
      msg += `Link: https://portal.theedgeschool.com/student-portal\n\n`;
    }
    msg += `Regards,\nThe Edge School`;
    return msg;
  };

  /* ── actions ── */
  const handleWhatsApp = (family: FamilyRow) => {
    templatesLib.openWhatsApp(family.whatsapp_number || '', formatCredentials(family));
  };

  const handleCopy = async (family: FamilyRow) => {
    await navigator.clipboard.writeText(formatCredentials(family));
    setCopiedId(family.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = async () => {
    const className = selectedClass === 'all' ? 'All Classes' : classes.find(c => c.id === selectedClass)?.name || 'Class';
    let bulk = `*📋 PORTAL CREDENTIALS — ${className}*\n`;
    bulk += `${'─'.repeat(36)}\n\n`;
    filteredFamilies.forEach((f, i) => {
      bulk += `*${i + 1}. ${f.full_name}*\n`;
      bulk += `   Parent ID: ${f.family_number || '—'}  |  Pass: ${f.auth_password || '—'}\n`;
      (f.students || []).forEach((s: StudentRow) => {
        bulk += `   👤 ${s.full_name} — ID: ${s.student_unique_id || '—'}  |  Pass: ${s.auth_password || '—'}\n`;
      });
      bulk += `\n`;
    });
    bulk += `Portal: https://portal.theedgeschool.com/parent-portal\nStudent Hub: https://portal.theedgeschool.com/student-portal`;
    await navigator.clipboard.writeText(bulk);
    setCopiedId('bulk');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleRegenerateParent = async (family: FamilyRow) => {
    setRegenerating(`parent-${family.id}`);
    const newPass = generatePassword();
    await supabase.from('parents').update({ auth_password: newPass }).eq('id', family.id);
    setFamilies(prev => prev.map(f => f.id === family.id ? { ...f, auth_password: newPass } : f));
    setRegenerating(null);
  };

  const handleRegenerateStudent = async (familyId: string, student: StudentRow) => {
    setRegenerating(`student-${student.id}`);
    const newPass = generatePassword();
    await supabase.from('students').update({ auth_password: newPass }).eq('id', student.id);
    setFamilies(prev => prev.map(f => {
      if (f.id !== familyId) return f;
      return { ...f, students: f.students.map((s: StudentRow) => s.id === student.id ? { ...s, auth_password: newPass } : s) };
    }));
    setRegenerating(null);
  };

  const handleRegenerateStudentUID = async (familyId: string, student: StudentRow) => {
    setRegenerating(`uid-${student.id}`);
    const newUID = generateStudentUID(student.full_name, student.roll_number);
    await supabase.from('students').update({ student_unique_id: newUID }).eq('id', student.id);
    setFamilies(prev => prev.map(f => {
      if (f.id !== familyId) return f;
      return { ...f, students: f.students.map((s: StudentRow) => s.id === student.id ? { ...s, student_unique_id: newUID } : s) };
    }));
    setRegenerating(null);
  };

  const handleBulkGenerate = async () => {
    const target = selectedClass === 'all' ? families : filteredFamilies;
    const missing = target.filter(f => !f.auth_password || f.students?.some((s: StudentRow) => !s.auth_password || !s.student_unique_id));
    if (missing.length === 0) {
      alert('All families already have credentials.');
      return;
    }
    if (!window.confirm(`Generate missing credentials for ${missing.length} families? Existing passwords will NOT be changed.`)) return;
    setBulkGenerating(true);
    try {
      for (const f of missing) {
        if (!f.auth_password) {
          await supabase.from('parents').update({ auth_password: generatePassword() }).eq('id', f.id);
        }
        for (const s of (f.students || [])) {
          const updates: any = {};
          if (!s.student_unique_id) updates.student_unique_id = generateStudentUID(s.full_name, s.roll_number);
          if (!s.auth_password) updates.auth_password = generatePassword();
          if (Object.keys(updates).length) {
            await supabase.from('students').update(updates).eq('id', s.id);
          }
        }
      }
      await fetchCredentials();
      alert('Missing credentials generated successfully.');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleStandardizeIDs = async () => {
    if (!window.confirm('This will update ALL existing Parent and Student Login IDs to a memorable [Name+ID] format. Old IDs will no longer work. Proceed?')) return;
    setLoading(true);
    try {
      await Promise.all(families.map(async f => {
        const suffix = f.family_number?.match(/\d+/)?.[0] || Math.floor(1000 + Math.random() * 9000).toString();
        const pFirst = (f.father_name || f.full_name || 'User').trim().split(' ')[0];
        await supabase.from('parents').update({ family_number: `${pFirst}${suffix}` }).eq('id', f.id);
        for (const s of (f.students || [])) {
          const sFirst = (s.full_name || 'Student').trim().split(' ')[0];
          await supabase.from('students').update({ student_unique_id: `${sFirst}${suffix}` }).eq('id', s.id);
        }
      }));
      alert('All IDs standardized successfully.');
      fetchCredentials();
    } catch (err: any) {
      alert('Migration failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── print class-wise ── */
  const handlePrintClassWise = () => {
    const className = selectedClass === 'all' ? 'All Classes' : classes.find(c => c.id === selectedClass)?.name || 'Credentials';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rows = filteredFamilies.map((f, i) => {
      const stuRows = (f.students || []).map((s: StudentRow) =>
        `<tr style="background:#f0f7ff">
          <td style="padding:6px 10px;border:1px solid #ddd"></td>
          <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px">↳ ${s.full_name}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;font-size:12px">${s.student_unique_id || '—'}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;font-size:12px">${s.auth_password || '—'}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px">${(s as any).classes?.name || '—'}</td>
        </tr>`
      ).join('');
      return `<tr>
        <td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;text-align:center">${i + 1}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold">${f.full_name}${f.whatsapp_number ? `<br><span style="font-size:11px;color:#666">${f.whatsapp_number}</span>` : ''}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;font-size:12px">${f.family_number || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;font-size:12px">${f.auth_password || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px">Parent</td>
      </tr>${stuRows}`;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Credentials — ${className}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;font-size:13px}
        h1{font-size:18px;margin-bottom:4px}
        h2{font-size:13px;color:#555;margin-bottom:16px;font-weight:normal}
        table{width:100%;border-collapse:collapse}
        th{background:#1e293b;color:white;padding:8px 10px;text-align:left;font-size:12px}
        @media print{body{padding:10px}h1{font-size:16px}}
      </style>
    </head><body>
      <h1>📋 Portal Credentials — ${className}</h1>
      <h2>Generated: ${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })} · Total Families: ${filteredFamilies.length}</h2>
      <table>
        <thead><tr>
          <th>#</th><th>Family / Student</th><th>Login ID</th><th>Password</th><th>Type</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px;font-size:11px;color:#888">Parent Portal: https://portal.theedgeschool.com/parent-portal · Student Hub: https://portal.theedgeschool.com/student-portal</p>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  /* ── download CSV ── */
  const handleDownloadCSV = () => {
    const className = selectedClass === 'all' ? 'All_Classes' : (classes.find(c => c.id === selectedClass)?.name || 'Class').replace(/\s+/g, '_');
    const header = 'Sr#,Parent Name,WhatsApp,Parent Login ID,Parent Password,Student Name,Student Login ID,Student Password,Class\n';
    let csv = header;
    let sr = 1;
    filteredFamilies.forEach(f => {
      if (!f.students || f.students.length === 0) {
        csv += `${sr++},"${f.full_name}","${f.whatsapp_number || ''}","${f.family_number || ''}","${f.auth_password || ''}","","","",""\n`;
      } else {
        f.students.forEach((s: StudentRow, si: number) => {
          csv += `${si === 0 ? sr++ : ''},"${si === 0 ? f.full_name : ''}","${si === 0 ? (f.whatsapp_number || '') : ''}","${si === 0 ? (f.family_number || '') : ''}","${si === 0 ? (f.auth_password || '') : ''}","${s.full_name}","${s.student_unique_id || ''}","${s.auth_password || ''}","${(s as any).classes?.name || ''}"\n`;
        });
      }
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Portal_Credentials_${className}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── render ───────────────────────────────────────────────────────────── */
  const selectedClassName = selectedClass === 'all' ? 'All Classes' : classes.find(c => c.id === selectedClass)?.name || '';

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Key className="w-6 h-6 text-blue-600" /> Portal Credentials
        </h1>
        <p className="text-gray-500 text-sm mt-1">Manage, print, and dispatch parent & student login credentials class-wise.</p>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold mb-1"><Users className="w-3.5 h-3.5" /> Families</div>
          <div className="text-2xl font-black text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold mb-1"><GraduationCap className="w-3.5 h-3.5" /> Students</div>
          <div className="text-2xl font-black text-gray-900">{stats.totalStudents}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-red-500 text-xs font-bold mb-1"><AlertCircle className="w-3.5 h-3.5" /> Missing (Parent)</div>
          <div className="text-2xl font-black text-red-600">{stats.missingParent}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-red-500 text-xs font-bold mb-1"><AlertCircle className="w-3.5 h-3.5" /> Missing (Student)</div>
          <div className="text-2xl font-black text-red-600">{stats.missingStudent}</div>
        </div>
      </div>

      {/* ── Controls Bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
          {/* Class Filter */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2 text-sm font-bold bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[180px]"
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by name, ID..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Toggle Passwords */}
          <button onClick={() => setShowPasswords(v => !v)}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 whitespace-nowrap">
            {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPasswords ? 'Hide' : 'Show'}
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2">
          {missingCount > 0 && (
            <button onClick={handleBulkGenerate} disabled={bulkGenerating}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">
              <Wand2 className="w-3.5 h-3.5" />
              {bulkGenerating ? 'Generating...' : `Generate Missing (${missingCount})`}
            </button>
          )}

          <button onClick={handleStandardizeIDs}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100">
            <Key className="w-3.5 h-3.5" /> Standardize IDs
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100">
              {copiedId === 'bulk' ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId === 'bulk' ? 'Copied All!' : `Copy All (${selectedClassName})`}
            </button>

            <button onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100">
              <Download className="w-3.5 h-3.5" /> Download CSV
            </button>

            <button onClick={handlePrintClassWise}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900">
              <Printer className="w-3.5 h-3.5" /> Print {selectedClassName}
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div ref={printRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-3 font-bold text-gray-600 text-xs w-10">#</th>
              <th className="p-3 font-bold text-gray-600 text-xs">Family / Parent</th>
              <th className="p-3 font-bold text-gray-600 text-xs">Parent Login</th>
              <th className="p-3 font-bold text-gray-600 text-xs">Student Logins</th>
              <th className="p-3 font-bold text-gray-600 text-xs text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center text-gray-400">Loading credentials...</td></tr>
            ) : filteredFamilies.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-gray-400">
                {selectedClass !== 'all' ? 'No families found for this class.' : 'No families found.'}
              </td></tr>
            ) : filteredFamilies.map((family, idx) => (
              <tr key={family.id} className="hover:bg-blue-50/30 align-top">
                {/* # */}
                <td className="p-3 text-gray-400 font-bold text-xs">{idx + 1}</td>

                {/* Family Info */}
                <td className="p-3">
                  <div className="font-bold text-gray-900 text-sm">{family.full_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{family.whatsapp_number || 'No phone'}</div>
                </td>

                {/* Parent Login */}
                <td className="p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 w-6 shrink-0">ID:</span>
                      <span className="font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{family.family_number || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 w-6 shrink-0">PW:</span>
                      <span className="font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">
                        {family.auth_password ? (showPasswords ? family.auth_password : '••••••••') : <span className="text-red-400 italic text-[10px]">missing</span>}
                      </span>
                      <button onClick={() => handleRegenerateParent(family)} disabled={regenerating === `parent-${family.id}`}
                        title="Regenerate parent password"
                        className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40">
                        <RefreshCw className={`w-3 h-3 ${regenerating === `parent-${family.id}` ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                </td>

                {/* Student Logins */}
                <td className="p-3">
                  <div className="space-y-1.5">
                    {family.students?.length > 0 ? family.students.map((stu: StudentRow) => (
                      <div key={stu.id} className="bg-blue-50/70 border border-blue-100 rounded-lg p-2 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-900 text-xs">{stu.full_name}</span>
                          {(stu as any).classes?.name && (
                            <span className="text-[9px] bg-blue-200/60 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{(stu as any).classes.name}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">ID:</span>
                            <span className="font-mono text-xs text-gray-800">{stu.student_unique_id || <span className="text-red-400 italic text-[10px]">missing</span>}</span>
                            <button onClick={() => handleRegenerateStudentUID(family.id, stu)} disabled={!!regenerating}
                              title="Regenerate student ID" className="p-0.5 text-gray-400 hover:text-blue-600 rounded disabled:opacity-40">
                              <RefreshCw className={`w-3 h-3 ${regenerating === `uid-${stu.id}` ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">PW:</span>
                            <span className="font-mono text-xs text-gray-800">
                              {stu.auth_password ? (showPasswords ? stu.auth_password : '••••••') : <span className="text-red-400 italic text-[10px]">missing</span>}
                            </span>
                            <button onClick={() => handleRegenerateStudent(family.id, stu)} disabled={!!regenerating}
                              title="Regenerate student password" className="p-0.5 text-gray-400 hover:text-blue-600 rounded disabled:opacity-40">
                              <RefreshCw className={`w-3 h-3 ${regenerating === `student-${stu.id}` ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )) : <span className="text-xs text-gray-400">No children linked</span>}
                  </div>
                </td>

                {/* Actions */}
                <td className="p-3 text-right">
                  <div className="flex flex-col sm:flex-row justify-end gap-1.5">
                    <button onClick={() => handleWhatsApp(family)}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 hover:bg-emerald-100 whitespace-nowrap">
                      <Smartphone className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    <button onClick={() => handleCopy(family)}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 whitespace-nowrap">
                      {copiedId === family.id ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === family.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
