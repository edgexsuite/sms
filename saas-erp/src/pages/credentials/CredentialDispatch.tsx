import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Smartphone, Eye, EyeOff, Printer, Key, RefreshCw, Wand2, Copy, CheckCheck } from 'lucide-react';

function generatePassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // no ambiguous chars
  let pw = '';
  for (let i = 0; i < length; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function generateStudentUID(name: string, rollNumber: number | string): string {
  const firstName = (name || 'STU').trim().split(' ')[0].replace(/[^a-zA-Z]/g, '');
  return `${firstName}${rollNumber || Math.floor(1000 + Math.random() * 9000)}`;
}

export default function CredentialDispatch() {
  const { userRole } = useAuth();
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchCredentials();
  }, [userRole]);

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('parents')
        .select(`
          id,
          family_number,
          auth_password,
          full_name,
          father_name,
          whatsapp_number,
          email,
          students (
            id,
            full_name,
            roll_number,
            student_unique_id,
            auth_password
          )
        `)
        .eq('school_id', userRole?.school_id || '');

      if (error) throw error;
      setFamilies(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCredentials = (family: any) => {
    let msg = `*SCHOOL LOGIN CREDENTIALS*\n\n`;
    msg += `Dear ${family.full_name},\n\n`;
    msg += `*PARENT PORTAL*\n`;
    msg += `ID: ${family.family_number}\n`;
    msg += `Pass: ${family.auth_password}\n\n`;
    if (family.students?.length > 0) {
      msg += `*STUDENT HUB*\n`;
      family.students.forEach((stu: any) => {
        msg += `- ${stu.full_name}: ${stu.student_unique_id} (Pass: ${stu.auth_password})\n`;
      });
      msg += `\n`;
    }
    msg += `Login at: ${window.location.origin}/parent-portal`;
    return msg;
  };

  const handleWhatsApp = (family: any) => {
    const text = formatCredentials(family);
    const phone = family.whatsapp_number?.replace(/\D/g, '');
    if (!phone) return alert('No WhatsApp number for this family.');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopy = async (family: any) => {
    await navigator.clipboard.writeText(formatCredentials(family));
    setCopiedId(family.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerateParent = async (family: any) => {
    setRegenerating(`parent-${family.id}`);
    const newPass = generatePassword();
    await supabase.from('parents').update({ auth_password: newPass }).eq('id', family.id);
    setFamilies(prev => prev.map(f => f.id === family.id ? { ...f, auth_password: newPass } : f));
    setRegenerating(null);
  };

  const handleRegenerateStudent = async (familyId: string, student: any) => {
    setRegenerating(`student-${student.id}`);
    const newPass = generatePassword();
    await supabase.from('students').update({ auth_password: newPass }).eq('id', student.id);
    setFamilies(prev => prev.map(f => {
      if (f.id !== familyId) return f;
      return { ...f, students: f.students.map((s: any) => s.id === student.id ? { ...s, auth_password: newPass } : s) };
    }));
    setRegenerating(null);
  };

  const handleRegenerateStudentUID = async (familyId: string, student: any) => {
    setRegenerating(`uid-${student.id}`);
    const newUID = generateStudentUID(student.full_name, student.roll_number);
    await supabase.from('students').update({ student_unique_id: newUID }).eq('id', student.id);
    setFamilies(prev => prev.map(f => {
      if (f.id !== familyId) return f;
      return { ...f, students: f.students.map((s: any) => s.id === student.id ? { ...s, student_unique_id: newUID } : s) };
    }));
    setRegenerating(null);
  };

  /** Bulk generate: fill in missing passwords and student UIDs for all families */
  const handleBulkGenerate = async () => {
    const missing = families.filter(f => !f.auth_password || f.students?.some((s: any) => !s.auth_password || !s.student_unique_id));
    if (missing.length === 0) {
      alert('All families already have credentials. Use per-row Regenerate to reset individual passwords.');
      return;
    }
    if (!window.confirm(`Generate missing credentials for ${missing.length} families? Existing passwords will NOT be changed.`)) return;
    setBulkGenerating(true);

    try {
      for (const f of missing) {
        // Parent password
        if (!f.auth_password) {
          const pw = generatePassword();
          await supabase.from('parents').update({ auth_password: pw }).eq('id', f.id);
        }
        // Student credentials
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

  const filteredFamilies = families.filter(f =>
    f.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    f.family_number?.toLowerCase().includes(search.toLowerCase()) ||
    f.students?.some((s: any) => s.full_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const missingCount = families.reduce((n, f) => {
    if (!f.auth_password) n++;
    (f.students || []).forEach((s: any) => { if (!s.auth_password || !s.student_unique_id) n++; });
    return n;
  }, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Key className="w-6 h-6 text-blue-600" /> Credential Manager
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage and dispatch login credentials to families and students.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search families..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 text-sm" />
          </div>

          <button onClick={() => setShowPasswords(v => !v)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50">
            {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPasswords ? 'Hide' : 'Show'} Passwords
          </button>

          {missingCount > 0 && (
            <button onClick={handleBulkGenerate} disabled={bulkGenerating}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
              <Wand2 className="w-4 h-4" />
              {bulkGenerating ? 'Generating...' : `Generate Missing (${missingCount})`}
            </button>
          )}

          <button onClick={handleStandardizeIDs}
            className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-sm font-bold hover:bg-amber-100">
            <Key className="w-4 h-4" /> Standardize IDs
          </button>

          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50">
            <Printer className="w-4 h-4" /> Print All
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-4 font-medium text-gray-600">Family / Parent</th>
              <th className="p-4 font-medium text-gray-600">Parent Login</th>
              <th className="p-4 font-medium text-gray-600">Student Logins</th>
              <th className="p-4 font-medium text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading credentials...</td></tr>
            ) : filteredFamilies.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">No families found.</td></tr>
            ) : filteredFamilies.map(family => (
              <tr key={family.id} className="hover:bg-gray-50 align-top">
                <td className="p-4">
                  <div className="font-bold text-gray-900">{family.full_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{family.whatsapp_number || 'No phone'}</div>
                </td>

                <td className="p-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-7">ID:</span>
                      <span className="font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{family.family_number || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-7">PW:</span>
                      <span className="font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">
                        {family.auth_password ? (showPasswords ? family.auth_password : '••••••••') : <span className="text-red-400 italic">not set</span>}
                      </span>
                      <button onClick={() => handleRegenerateParent(family)} disabled={regenerating === `parent-${family.id}`}
                        title="Regenerate parent password"
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40">
                        <RefreshCw className={`w-3.5 h-3.5 ${regenerating === `parent-${family.id}` ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                </td>

                <td className="p-4">
                  <div className="space-y-2">
                    {family.students?.length > 0 ? family.students.map((stu: any) => (
                      <div key={stu.id} className="bg-blue-50/60 border border-blue-100 rounded p-2 space-y-1">
                        <div className="font-medium text-blue-900 text-xs">{stu.full_name}</div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">ID:</span>
                            <span className="font-mono text-xs text-gray-800">{stu.student_unique_id || <span className="text-red-400 italic">not set</span>}</span>
                            <button onClick={() => handleRegenerateStudentUID(family.id, stu)} disabled={!!regenerating}
                              title="Regenerate student ID" className="p-0.5 text-gray-400 hover:text-blue-600 rounded disabled:opacity-40">
                              <RefreshCw className={`w-3 h-3 ${regenerating === `uid-${stu.id}` ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">PW:</span>
                            <span className="font-mono text-xs text-gray-800">
                              {stu.auth_password ? (showPasswords ? stu.auth_password : '••••••') : <span className="text-red-400 italic">not set</span>}
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

                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleWhatsApp(family)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 hover:bg-emerald-100">
                      <Smartphone className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    <button onClick={() => handleCopy(family)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100">
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
