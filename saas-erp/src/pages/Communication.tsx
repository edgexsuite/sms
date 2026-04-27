import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Send, Users, Search, Smartphone, Mail, 
  AlertCircle, History, CheckCircle, Clock, Trash2,
  Copy, ExternalLink, Filter, BookOpen, BellRing
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as templatesLib from '../lib/whatsappTemplates';

export default function Communication() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  
   // Compose State
   const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email' | 'in-app'>('in-app');
   const [recipientScope, setRecipientScope] = useState<'all' | 'parents' | 'teachers' | 'class' | 'fee_due' | 'individual'>('all');
   const [selectedClassId, setSelectedClassId] = useState('');
   const [title, setTitle] = useState('');
   const [message, setMessage] = useState('');
   const [templates, setTemplates] = useState<any[]>([]);
   const [sending, setSending] = useState(false);
   const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  // Stats
  const [recipientCount, setRecipientCount] = useState(0);
  const [recipients, setRecipients] = useState<any[]>([]);

  // Individual Search State
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState<any[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isSearchingParents, setIsSearchingParents] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchInitialData();
    }
  }, [userRole]);

  useEffect(() => {
    updateRecipientCount();
  }, [recipientScope, selectedClassId, selectedParentId]);

  // Live Parent Search
  useEffect(() => {
    const searchParents = async () => {
      if (!parentSearchQuery.trim() || parentSearchQuery.length < 2) {
        setParentSearchResults([]);
        return;
      }
      setIsSearchingParents(true);
      const { data } = await supabase
        .from('parents')
        .select('id, full_name, father_name, whatsapp_number, family_number')
        .eq('school_id', userRole?.school_id)
        .or(`full_name.ilike.%${parentSearchQuery}%,father_name.ilike.%${parentSearchQuery}%,family_number.ilike.%${parentSearchQuery}%`)
        .limit(5);

      setParentSearchResults(data || []);
      setIsSearchingParents(false);
    };

    const timer = setTimeout(searchParents, 400);
    return () => clearTimeout(timer);
  }, [parentSearchQuery, userRole?.school_id]);

   const fetchInitialData = async () => {
     setLoading(true);
     const sid = userRole?.school_id;
     
     try {
       // We'll perform these individually to handle cases where some tables (like the new templates) might not exist yet
       const { data: cls, error: clsErr } = await supabase.from('classes').select('id, name, section').eq('school_id', sid).order('name');
       if (clsErr) console.error('Classes error:', clsErr);
       if (cls) setClasses(cls);

       const { data: logs, error: logsErr } = await supabase.from('communication_logs').select('*, parent:parents(father_name, mother_name)').eq('school_id', sid).order('sent_at', { ascending: false }).limit(20);
       if (logsErr) console.error('Logs error:', logsErr);
       if (logs) setHistory(logs);

       const { data: tmpl, error: tmplErr } = await supabase.from('communication_templates').select('*').eq('school_id', sid).order('created_at', { ascending: false });
       if (tmplErr) {
          if (tmplErr.code === '42P01') {
            console.warn('Communication templates table not found. Please run the SQL migration.');
            setTemplates([]);
          } else {
            console.error('Templates error:', tmplErr);
          }
       } else if (tmpl) {
         setTemplates(tmpl);
       }
     } catch (err) {
       console.error('Data fetch crash:', err);
     } finally {
       setLoading(false);
     }
   };

   const updateRecipientCount = async () => {
     if (!userRole?.school_id) return;
     const sid = userRole?.school_id;
     let list: any[] = [];
 
     if (recipientScope === 'parents' || recipientScope === 'all') {
       const { data } = await supabase.from('parents').select('id, father_name, whatsapp_number').eq('school_id', sid);
       list = data || [];
     } else if (recipientScope === 'teachers') {
       const { data } = await supabase.from('staff').select('id, full_name, whatsapp_number, email').eq('school_id', sid).eq('is_active', true);
       list = data || [];
     } else if (recipientScope === 'class') {
       if (!selectedClassId) { setRecipientCount(0); return; }
       const { data } = await supabase
         .from('students')
         .select('parent:parents(id, father_name, whatsapp_number)')
         .eq('class_id', selectedClassId)
         .eq('status', 'active');
       list = Array.from(new Map((data || []).map(s => {
         const p = Array.isArray(s.parent) ? s.parent[0] : s.parent;
         return p ? [p.id, p] as [any, any] : null;
       }).filter(Boolean).map(e => e as [any, any])).values());
     } else if (recipientScope === 'fee_due') {
        const { data } = await supabase
          .from('fee_records')
          .select('student:students(parent:parents(id, father_name, whatsapp_number))')
          .eq('school_id', sid)
          .in('status', ['pending', 'overdue']);
        
        const parentMap = new Map();
        (data || []).forEach((record: any) => {
          if (record.student?.parent) {
            parentMap.set(record.student.parent.id, record.student.parent);
          }
        });
        list = Array.from(parentMap.values());
     } else if (recipientScope === 'individual') {
        if (!selectedParentId) { setRecipientCount(0); return; }
        const { data } = await supabase.from('parents').select('id, father_name, whatsapp_number').eq('id', selectedParentId).single();
        if (data) list = [data];
      }
 
     setRecipients(list);
     setRecipientCount(list.length);
   };
 
   const handleSaveAsTemplate = async () => {
     if (!message.trim()) return;
     const label = prompt('Enter a name for this template:');
     if (!label) return;
 
     const { data, error } = await supabase.from('communication_templates').insert([{
       school_id: userRole?.school_id,
       title: label,
       content: message
     }]).select();
 
     if (error) alert(error.message);
     else {
       setTemplates([data[0], ...templates]);
       alert('Template saved!');
     }
   };
 
   const handleDeleteTemplate = async (id: string) => {
     if (!confirm('Are you sure you want to delete this template?')) return;
     const { error } = await supabase.from('communication_templates').delete().eq('id', id);
     if (error) alert(error.message);
     else setTemplates(templates.filter(t => t.id !== id));
   };

   const handleSystemTemplateSelect = (templateId: string) => {
    const vars: templatesLib.TemplateVars = {
      studentName: '{{student_name}}',
      parentName: '{{parent_name}}',
      schoolName: userRole?.school_id ? 'Our School' : '{{school_name}}',
      className: '{{class}}',
      balance: '{{balance}}',
      dueDate: '{{due_date}}',
      month: '{{month}}',
      attendanceDate: '{{date}}',
      arrivalTime: '{{arrival_time}}',
      symptoms: '{{symptoms}}',
      admissionDate: '{{admission_date}}'
    };

    let content = '';
    switch (templateId) {
      case 'fee': content = templatesLib.feeDueTemplate(vars); break;
      case 'absent': content = templatesLib.absenceAlertTemplate(vars); break;
      case 'late': content = templatesLib.lateArrivalTemplate(vars); break;
      case 'health': content = templatesLib.healthIssueTemplate(vars); break;
      case 'admission': content = templatesLib.admissionConfirmationTemplate(vars); break;
      default: return;
    }
    setMessage(content);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || recipientCount === 0) return;
    
    setSending(true);
    const sid = userRole?.school_id;

    try {
      // Handle In-App Broadcast first (bypasses standard logs)
      if (channel === 'in-app') {
        if (!title.trim()) { alert('Title is required for in-app notifications.'); setSending(false); return; }
        
        const { error: notificationError } = await supabase.from('notifications').insert([{
           school_id: sid,
           target_audience: recipientScope,
           class_id: recipientScope === 'class' ? selectedClassId : null,
           title: title,
           message: message
        }]);
        
        if (notificationError) throw notificationError;
        alert('App notification successfully broadcasted to dashboard!');
        setSendResult({ sent: recipients.length, failed: 0 }); // Artificial success indicator since broadcast hits all immediately
        setTitle('');
        setMessage('');
        setSending(false);
        return;
      }

      // 1. Prepare log entries
      const logs = recipients.map(r => ({
        school_id: sid,
        parent_id: recipientScope === 'teachers' ? null : r.id,
        channel: channel,
        recipient_number: r.whatsapp_number || '',
        message_content: message,
        status: channel === 'whatsapp' ? 'ready' : 'logged' // 'ready' means we need external trigger
      }));

      // 2. Insert into DB
      const { error } = await supabase.from('communication_logs').insert(logs);
      if (error) throw error;

      // 3. Channel-specific sending
      if (channel === 'whatsapp') {
        if (recipientCount === 1) {
           const num = recipients[0].whatsapp_number || '';
           if (num) templatesLib.openWhatsApp(num, message);
        } else {
           alert(`Logged ${recipientCount} WhatsApp messages. Use the 'Send Now' buttons in the history table to open WhatsApp for each recipient.`);
        }
      } else if (channel === 'sms' || channel === 'email') {
        // Call Supabase Edge Function for real sending
        const edgeRecipients = recipients.map(r => ({
          number: r.whatsapp_number || '',
          email: r.email || '',
          name: r.father_name || r.full_name || '',
        }));
        try {
          const { data: result, error: fnError } = await supabase.functions.invoke('send-message', {
            body: { channel, recipients: edgeRecipients, message, school_id: sid },
          });
          if (fnError) throw fnError;
          setSendResult({ sent: result?.sent ?? 0, failed: result?.failed ?? 0 });
        } catch (fnErr: any) {
          // Non-fatal: logs are already inserted; show error but don't block
          setSendResult({ sent: 0, failed: recipientCount });
          console.error('Edge function error:', fnErr.message);
        }
      }

      setMessage('');
      fetchInitialData();
    } catch (err: any) {
      alert(err.message);
    }
    setSending(false);
  };

  // Initial templates handled by state and DB now

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-indigo-600" /> Communication Hub
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Broadcast messages and track delivery history across WhatsApp, SMS, and Email.</p>
        </div>
      </div>

      {/* Send Result Banner */}
      {sendResult && (
        <div className={`flex items-center justify-between px-5 py-3 rounded-xl border text-sm font-medium ${sendResult.failed === 0 ? 'bg-green-50 border-green-200 text-green-800' : sendResult.sent === 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
          <span>{sendResult.sent > 0 ? `✓ ${sendResult.sent} message(s) sent successfully.` : ''}{sendResult.failed > 0 ? ` ${sendResult.failed} failed.` : ''}</span>
          <button onClick={() => setSendResult(null)} className="text-current opacity-60 hover:opacity-100 ml-4">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Composer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
               <h2 className="font-black tracking-tight flex items-center gap-2 uppercase text-xs">
                 <Send className="w-3.5 h-3.5" /> Compose Broadcast
               </h2>
               <div className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold">
                 STEP 1: CHOOSE TARGET
               </div>
            </div>

            <form onSubmit={handleSendMessage} className="p-6 space-y-6 bg-gray-50/50">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Channels */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Communication Channel</label>
                  <div className="flex gap-2 p-1 bg-white border border-gray-200 rounded-xl">
                    <button type="button" onClick={() => setChannel('whatsapp')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${channel === 'whatsapp' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    <button type="button" onClick={() => setChannel('sms')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${channel === 'sms' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
                      <Smartphone className="w-3.5 h-3.5" /> SMS
                    </button>
                    <button 
                      type="button" onClick={() => setChannel('email')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${channel === 'email' ? 'bg-indigo-600 text-white shadow-md border-indigo-600' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}
                    >
                      <Mail className="w-3.5 h-3.5" /> Email
                    </button>
                    <button 
                      type="button" onClick={() => setChannel('in-app')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${channel === 'in-app' ? 'bg-indigo-600 text-white shadow-md border-indigo-600' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}
                    >
                      <BellRing className="w-3.5 h-3.5" /> In-App Alert
                    </button>
                  </div>
                </div>

                {/* Recipient Scope */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Target Audience</label>
                  <select 
                    value={recipientScope} onChange={e => setRecipientScope(e.target.value as any)}
                    className="w-full bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                  >
                    <option value="all">All School Parents</option>
                    <option value="individual">Individual Parent / Search</option>
                    <option value="fee_due">Fee Due Parents (Defaulters)</option>
                    <option value="class">Specific Class</option>
                    <option value="teachers">All Staff/Teachers</option>
                    <option value="parents">Full Directory</option>
                  </select>
                </div>
              </div>

              {recipientScope === 'individual' && (
                <div className="bg-white p-4 rounded-xl border border-gray-200 animate-in slide-in-from-top-2 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      value={parentSearchQuery}
                      onChange={e => {
                        setParentSearchQuery(e.target.value);
                        if (selectedParentId) setSelectedParentId(null);
                      }}
                      placeholder="Search parent by name or family number..."
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                    {isSearchingParents && <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />}
                  </div>

                  {parentSearchResults.length > 0 && !selectedParentId && (
                    <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                      {parentSearchResults.map(p => (
                        <button
                          key={p.id} type="button"
                          onClick={() => {
                            setSelectedParentId(p.id);
                            setParentSearchQuery(`${p.father_name || p.full_name} (${p.family_number})`);
                            setParentSearchResults([]);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div>
                            <p className="text-xs font-bold text-gray-900">{p.father_name || p.full_name}</p>
                            <p className="text-[10px] text-gray-400">Ref: {p.family_number || 'N/A'}</p>
                          </div>
                          <span className="text-[10px] text-indigo-600 font-bold uppercase">Select</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedParentId && (
                    <div className="flex items-center justify-between bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-bold text-indigo-900">Target Selected: {parentSearchQuery}</span>
                      </div>
                      <button 
                        type="button" onClick={() => { setSelectedParentId(null); setParentSearchQuery(''); }}
                        className="text-[10px] font-black text-indigo-600 uppercase hover:text-indigo-800"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* System Templates Dropdown */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Quick System Templates</label>
                  <select 
                    onChange={e => handleSystemTemplateSelect(e.target.value)}
                    className="w-full bg-white border border-indigo-100 px-4 py-2.5 rounded-xl text-sm font-bold text-indigo-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Select a Standard Template --</option>
                    <option value="fee">💰 Fee Reminder</option>
                    <option value="absent">🚫 Absentee Alert</option>
                    <option value="late">⏰ Continuously Late Arrival</option>
                    <option value="health">🏥 Health Issue</option>
                    <option value="admission">✅ Admission Confirmation</option>
                  </select>
                </div>
                
                <div className="flex items-center pt-6">
                   <p className="text-[10px] text-gray-400 font-medium">
                     <AlertCircle className="w-3 h-3 inline mr-1 text-indigo-400" />
                     Placeholders like <span className="text-indigo-600 font-bold">{"{{student_name}}"}</span> will be updated automatically for personal messages.
                   </p>
                </div>
              </div>

              {recipientScope === 'class' && (
                <div className="bg-white p-4 rounded-xl border border-gray-200 animate-in slide-in-from-top-2">
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Select Academic Class</label>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                     {classes.map(c => (
                       <button 
                         key={c.id} type="button" 
                         onClick={() => setSelectedClassId(c.id)}
                         className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${selectedClassId === c.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-indigo-200'}`}
                       >
                         {c.name} {c.section}
                       </button>
                     ))}
                   </div>
                </div>
              )}

              <div className="space-y-3">
                 <div className="flex justify-between items-end">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Final Message Body</label>
                   <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black border border-indigo-100 uppercase">
                     {recipientCount} Potential Recipients Detected
                   </div>
                 </div>
                 {channel === 'in-app' && (
                   <input
                     required
                     type="text"
                     value={title} onChange={e => setTitle(e.target.value)}
                     placeholder="Notification Title (e.g., Upcoming Exams)"
                     className="w-full bg-white border border-gray-200 p-4 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-sm mb-3"
                   />
                 )}
                 <textarea 
                    required
                    value={message} onChange={e => setMessage(e.target.value)}
                    rows={6}
                    placeholder="Type your message here... Note: You can use Templates on the right to auto-fill common messages."
                    className="w-full bg-white border border-gray-200 p-4 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none resize-none shadow-sm"
                 />
                 <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 px-2">
                    <span>{message.length} Characters</span>
                    {channel === 'sms' && <span>{Math.ceil(message.length / 160)} SMS Part(s)</span>}
                 </div>
              </div>

               <div className="pt-2 flex flex-col md:flex-row gap-3">
                  <button 
                    disabled={sending || recipientCount === 0 || !message.trim()}
                    className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                  >
                    <Send className="w-5 h-5" /> 
                    {sending ? 'Processing Broadcast...' : `Send Broadcast to ${recipientCount} recipients`}
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveAsTemplate}
                    disabled={!message.trim()}
                    className="flex-1 bg-white border-2 border-indigo-200 text-indigo-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <BookOpen className="w-4 h-4" /> Save Template
                  </button>
               </div>
            </form>
          </div>
        </div>

        {/* Sidebar: Templates & Recent */}
        <div className="space-y-6">
          
          {/* Templates */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" /> Templates
                </h3>
             </div>
              <div className="p-4 space-y-3">
                 {templates.length === 0 && (
                   <p className="text-[10px] text-gray-400 text-center py-4 italic">No templates saved yet.</p>
                 )}
                 {templates.map(t => (
                   <div key={t.id} className="group relative">
                    <button 
                      onClick={() => setMessage(t.content)}
                      className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                    >
                      <p className="text-xs font-black text-gray-900 mb-1 group-hover:text-indigo-600 uppercase tracking-tight">{t.title}</p>
                      <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{t.content}</p>
                    </button>
                    <button 
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                   </div>
                 ))}
              </div>
          </div>

          {/* Recent History Mini */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" /> Recent Activity
                </h3>
             </div>
             <div className="divide-y divide-gray-50">
                {history.slice(0, 5).map(log => (
                  <div key={log.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                     <div className="flex justify-between items-center mb-1">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                          log.channel === 'whatsapp' ? 'bg-green-50 text-green-700 border-green-100' : 
                          'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {log.channel}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">
                          {new Date(log.sent_at).toLocaleDateString()}
                        </span>
                     </div>
                     <p className="text-xs font-bold text-gray-900 mb-0.5 truncate">
                       {log.parent?.father_name || 'Staff Member'}
                     </p>
                     <p className="text-[10px] text-gray-500 line-clamp-1">{log.message_content}</p>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Detailed Logs Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" /> Full Communication Logs
            </h3>
            <button className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase">View Extended Archive</button>
         </div>
         <div className="overflow-x-auto">
           <table className="w-full text-left">
             <thead>
                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Recipient</th>
                  <th className="px-6 py-4">Phone / Link</th>
                  <th className="px-6 py-4">Message Summary</th>
                  <th className="px-6 py-4">Sent At</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-50">
               {history.map(log => (
                 <tr key={log.id} className="group hover:bg-gray-50/50 transition-colors">
                   <td className="px-6 py-4">
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-green-500" />
                       <span className="text-[10px] font-black uppercase text-gray-600">{log.status}</span>
                     </div>
                   </td>
                   <td className="px-6 py-4">
                      <p className="text-xs font-black text-gray-900">{log.parent?.father_name || 'Staff'}</p>
                   </td>
                   <td className="px-6 py-4">
                      <span className="text-[10px] font-mono text-gray-500">{log.recipient_number}</span>
                   </td>
                   <td className="px-6 py-4 max-w-xs">
                      <p className="text-xs text-gray-500 truncate" title={log.message_content}>{log.message_content}</p>
                   </td>
                   <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(log.sent_at).toLocaleString()}
                   </td>
                   <td className="px-6 py-4 text-right">
                      {log.channel === 'whatsapp' && (
                        <button 
                          onClick={() => templatesLib.openWhatsApp(log.recipient_number, log.message_content)}
                          className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}
