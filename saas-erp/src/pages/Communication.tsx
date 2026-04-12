import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Send, Users, Search, Smartphone, Mail, 
  AlertCircle, History, CheckCircle, Clock, Trash2,
  Copy, ExternalLink, Filter, BookOpen, BellRing
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Communication() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  
  // Compose State
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email' | 'in-app'>('in-app');
  const [recipientScope, setRecipientScope] = useState<'all' | 'parents' | 'teachers' | 'class'>('all');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  // Stats
  const [recipientCount, setRecipientCount] = useState(0);
  const [recipients, setRecipients] = useState<any[]>([]);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchInitialData();
    }
  }, [userRole]);

  useEffect(() => {
    updateRecipientCount();
  }, [recipientScope, selectedClassId]);

  const fetchInitialData = async () => {
    setLoading(true);
    const sid = userRole?.school_id;
    const [
      { data: cls },
      { data: logs }
    ] = await Promise.all([
      supabase.from('classes').select('id, name, section').eq('school_id', sid).order('name'),
      supabase.from('communication_logs').select('*, parent:parents(father_name, mother_name)').eq('school_id', sid).order('sent_at', { ascending: false }).limit(20)
    ]);
    if (cls) setClasses(cls);
    if (logs) setHistory(logs);
    setLoading(false);
  };

  const updateRecipientCount = async () => {
    if (!userRole?.school_id) return;
    const sid = userRole?.school_id;
    let query;

    if (recipientScope === 'parents' || recipientScope === 'all') {
      query = supabase.from('parents').select('id, father_name, whatsapp_number').eq('school_id', sid);
    } else if (recipientScope === 'teachers') {
      query = supabase.from('staff').select('id, full_name, whatsapp_number, email').eq('school_id', sid).eq('is_active', true);
    } else if (recipientScope === 'class') {
      if (!selectedClassId) { setRecipientCount(0); return; }
      // Get parents of students in this class
      query = supabase
        .from('students')
        .select('parent:parents(id, father_name, whatsapp_number)')
        .eq('class_id', selectedClassId)
        .eq('status', 'active');
    }

    const { data } = await query!;
    
    if (data) {
      // Deduplicate for class-based query where siblings might share a parent
      const list = recipientScope === 'class' 
        ? Array.from(new Map(data.filter(s => s.parent).map(s => [s.parent.id, s.parent])).values())
        : data;
      
      setRecipients(list);
      setRecipientCount(list.length);
    } else {
      setRecipientCount(0);
    }
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
           if (num) window.open(`https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
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

  const templates = [
    { title: 'Fee Reminder', body: 'Dear Parents, this is a reminder to please clear your child\'s pending dues by the 10th of this month to avoid late fines. Thank you.' },
    { title: 'Holiday Alert', body: 'Dear Parents, please note that the school will remain closed tomorrow due to weather conditions. Regular classes will resume from Day After Tomorrow.' },
    { title: 'PTM Invitation', body: 'Dear Parents, the Parent-Teacher Meeting is scheduled for this Saturday from 9 AM to 1 PM. Your presence is essential for your child\'s progress.' }
  ];

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
                    <option value="class">Specific Class</option>
                    <option value="teachers">All Staff/Teachers</option>
                    <option value="parents">Full Directory</option>
                  </select>
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

              <div className="pt-2">
                 <button 
                   disabled={sending || recipientCount === 0 || !message.trim()}
                   className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                 >
                   <Send className="w-5 h-5" /> 
                   {sending ? 'Processing Broadcast...' : `Send Broadcast to ${recipientCount} recipients`}
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
                {templates.map(t => (
                  <button 
                    key={t.title} 
                    onClick={() => setMessage(t.body)}
                    className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                  >
                    <p className="text-xs font-black text-gray-900 mb-1 group-hover:text-indigo-600 uppercase tracking-tight">{t.title}</p>
                    <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{t.body}</p>
                  </button>
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
                          onClick={() => window.open(`https://wa.me/${log.recipient_number.replace(/\D/g, '')}?text=${encodeURIComponent(log.message_content)}`, '_blank')}
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
