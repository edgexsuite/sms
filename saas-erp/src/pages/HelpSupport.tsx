import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  LifeBuoy, 
  Send, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  History,
  PlusCircle,
  HelpCircle,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/utils';

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'closed';
  category: string;
  admin_reply: string | null;
  created_at: string;
};

export default function HelpSupport() {
  const { userRole } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  
  // Form State
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('technical');
  const [message, setMessage] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchTickets();
  }, [userRole]);

  const fetchTickets = async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('school_id', userRole.school_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSubmitting(true);
    setStatusMsg({ text: 'Sending your request...', type: 'loading' });

    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          school_id: userRole?.school_id,
          subject,
          category,
          message,
          status: 'open'
        });

      if (error) throw error;

      setStatusMsg({ text: 'Ticket submitted successfully! We will get back to you soon.', type: 'success' });
      setSubject('');
      setMessage('');
      fetchTickets();
      
      // Auto switch to history after a short delay
      setTimeout(() => {
        setActiveTab('history');
        setStatusMsg({ text: '', type: '' });
      }, 2000);

    } catch (err: any) {
      console.error('Submission error:', err);
      setStatusMsg({ text: 'Failed to submit ticket: ' + err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors = {
    open: 'bg-red-50 text-red-600 border-red-100',
    in_progress: 'bg-blue-50 text-blue-600 border-blue-100',
    closed: 'bg-emerald-50 text-emerald-600 border-emerald-100'
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <LifeBuoy className="text-indigo-600 w-8 h-8" />
            Help & Support Desk
          </h1>
          <p className="text-slate-500 font-medium mt-1">Need assistance? Our team is here to help you succeed.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'new' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <PlusCircle size={16} /> New Ticket
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <History size={16} /> My History
            {tickets.filter(t => t.status !== 'closed').length > 0 && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mx-1" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'new' ? (
          <motion.div
            key="new-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Form Section */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Monthly Fee Generation Issue"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                    >
                      <option value="technical">Technical Issue</option>
                      <option value="billing">Billing & Subscription</option>
                      <option value="feature">Feature Request</option>
                      <option value="other">General Inquiry</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Describe your issue in detail</label>
                  <textarea
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide as much detail as possible to help us resolve the issue faster..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 resize-none"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-2 px-1 italic">
                    Our typical response time is within 4-6 business hours.
                  </p>
                </div>

                {statusMsg.text && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${
                    statusMsg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' :
                    statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}>
                    {statusMsg.type === 'loading' ? (
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : statusMsg.type === 'error' ? (
                      <AlertCircle size={20} />
                    ) : (
                      <CheckCircle2 size={20} />
                    )}
                    {statusMsg.text}
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full md:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 text-sm uppercase tracking-widest"
                  >
                    <Send size={18} />
                    {submitting ? 'Dispatching...' : 'Submit Support Ticket'}
                  </button>
                </div>
              </form>
            </div>

            {/* Side Column */}
            <div className="space-y-6">
              <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <HelpCircle size={120} />
                </div>
                <h3 className="text-xl font-black mb-2 relative z-10 uppercase tracking-tight">Need Urgent Help?</h3>
                <p className="text-indigo-100 text-sm font-medium relative z-10 leading-relaxed mb-6">
                  Check out our common guides or contact your account manager directly.
                </p>
                <button className="bg-white/10 hover:bg-white/20 transition-all p-4 rounded-2xl border border-white/20 flex items-center gap-3 w-full group">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 font-bold group-hover:scale-110 transition-transform">
                    📖
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black uppercase tracking-widest">Portal Guides</p>
                    <p className="text-[10px] font-bold text-indigo-200">View Documentation</p>
                  </div>
                </button>
              </div>

              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 border-dashed">
                <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs mb-4">Common Topics</h3>
                <ul className="space-y-4">
                  {['Fee Management', 'Student Enrollment', 'Result Generation', 'Staff Payroll'].map(topic => (
                    <li key={topic} className="flex items-center gap-3 text-slate-500 font-bold text-sm cursor-pointer hover:text-indigo-600 transition-colors">
                      <HelpCircle size={16} className="text-slate-300" />
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history-list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
          >
            {loading ? (
              <div className="p-20 text-center">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading history...</p>
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-20 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                  <MessageSquare size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">Your desk is clear!</h3>
                  <p className="text-slate-500 font-medium">You haven't submitted any support tickets yet.</p>
                </div>
                <button 
                  onClick={() => setActiveTab('new')}
                  className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition"
                >
                  Create your first ticket
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket ID</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject & Categorization</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Latest Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tickets.map(ticket => (
                      <tr key={ticket.id} className="hover:bg-slate-50/50 transition duration-150">
                        <td className="px-8 py-6 font-mono font-bold text-slate-400 text-[10px]">
                          #{ticket.id.substring(0, 8).toUpperCase()}
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-black text-slate-800 text-sm mb-1">{ticket.subject}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter bg-slate-100 px-2 py-0.5 rounded-md">
                              {ticket.category}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                              <Calendar size={12} /> {formatDate(ticket.created_at)}
                            </span>
                          </div>
                          {ticket.admin_reply && (
                            <div className="mt-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <MessageSquare size={12} /> SuperAdmin Response
                              </p>
                              <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                                {ticket.admin_reply}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusColors[ticket.status]}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                            <Clock size={14} className="text-slate-300" />
                            {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">
                            {ticket.status === 'open' ? 'Waiting for review' : 
                             ticket.status === 'in_progress' ? 'Engineer assigned' : 'Issue resolved'}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
