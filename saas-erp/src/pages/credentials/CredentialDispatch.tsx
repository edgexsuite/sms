import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Mail, Smartphone, Eye, Printer, Key } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';

export default function CredentialDispatch() {
  const { userRole } = useAuth();
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (userRole?.school_id) {
      fetchCredentials();
    }
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
            first_name:full_name,
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
    msg += `👨 *PARENT PORTAL*\n`;
    msg += `ID: ${family.family_number}\n`;
    msg += `Pass: ${family.auth_password}\n\n`;
    
    if (family.students && family.students.length > 0) {
      msg += `🎓 *STUDENT HUB*\n`;
      family.students.forEach((stu: any) => {
        msg += `- ${stu.first_name}: ${stu.student_unique_id} (Pass: ${stu.auth_password})\n`;
      });
      msg += `\n`;
    }
    
    msg += `Login here: ${window.location.origin}/login`;
    return msg;
  };

  const handleWhatsAppAll = (family: any) => {
    const text = formatCredentials(family);
    const phone = family.whatsapp_number?.replace(/[^0-9]/g, '');
    if (!phone) return alert('No WhatsApp number found for this family.');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyAll = (family: any) => {
    const text = formatCredentials(family);
    navigator.clipboard.writeText(text);
    alert('All credentials copied to clipboard!');
  };

  const handleMigrateIDs = async () => {
    if (!window.confirm('This will update ALL existing Parent and Student Login IDs to the new [Name+ID] format. Old IDs will no longer work. Proceed?')) return;
    setLoading(true);
    try {
      const updates = families.map(async (f) => {
        const suffix = f.family_number?.match(/\d+/)?.[0] || Math.floor(1000 + Math.random() * 9000).toString();
        const pFirstName = (f.father_name || f.full_name || 'User').trim().split(' ')[0];
        const newPID = `${pFirstName}${suffix}`;

        // Update Parent
        await supabase.from('parents').update({ family_number: newPID }).eq('id', f.id);

        // Update Students
        if (f.students) {
          f.students.forEach(async (s: any) => {
            const sFirstName = (s.first_name || 'Student').trim().split(' ')[0];
            const newSID = `${sFirstName}${suffix}`;
            await supabase.from('students').update({ student_unique_id: newSID }).eq('id', s.id);
          });
        }
      });

      await Promise.all(updates);
      alert('All credentials successfully migrated to the new memorable format!');
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
    f.students?.some((s: any) => s.first_name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Key className="w-6 h-6 text-blue-600" /> Credential Manager
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage and dispatch system login credentials to families.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Family ID or Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 text-sm"
            />
          </div>
          <button onClick={handleMigrateIDs} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-sm font-bold hover:bg-amber-100 transition shadow-sm">
            <Key className="w-4 h-4" /> Standardize All IDs
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition">
            <Printer className="w-4 h-4" /> Print All
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-4 font-medium text-sm text-gray-600">Family Number / Parent</th>
              <th className="p-4 font-medium text-sm text-gray-600">Parent Password</th>
              <th className="p-4 font-medium text-sm text-gray-600">Children Logins</th>
              <th className="p-4 font-medium text-sm text-gray-600 text-right">Dispatch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading credentials...</td></tr>
            ) : filteredFamilies.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">No families found.</td></tr>
            ) : (
              filteredFamilies.map((family) => (
                <tr key={family.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-gray-900">{family.family_number || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{family.full_name}</div>
                    <div className="text-xs text-gray-400 mt-1">{family.whatsapp_number || 'No Phone'}</div>
                  </td>
                  <td className="p-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded text-sm font-mono tracking-wide text-gray-800">
                      {family.auth_password || '******'}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-2">
                       {family.students && family.students.length > 0 ? (
                         family.students.map((stu: any) => (
                           <div key={stu.id} className="text-sm bg-blue-50/50 p-2 rounded border border-blue-50 flex items-center justify-between">
                             <span className="font-medium text-blue-900">{stu.first_name}</span>
                             <div className="flex gap-4">
                               <span className="text-gray-600">ID: <span className="font-mono text-gray-900">{stu.student_unique_id || 'N/A'}</span></span>
                               <span className="text-gray-600">Pass: <span className="font-mono text-gray-900">{stu.auth_password || '******'}</span></span>
                             </div>
                           </div>
                         ))
                       ) : (
                         <span className="text-sm text-gray-400">No children linked</span>
                       )}
                    </div>
                  </td>
                  <td className="p-4 text-right align-top">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleWhatsAppAll(family)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition" title="WhatsApp All Credentials">
                        <Smartphone className="w-4 h-4" /> WhatsApp
                      </button>
                      <button onClick={() => handleCopyAll(family)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-slate-700 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition" title="Copy All to Clipboard">
                        <Key className="w-4 h-4" /> Copy
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
