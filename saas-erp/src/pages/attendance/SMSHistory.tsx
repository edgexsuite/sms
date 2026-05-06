import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MessageSquare, Download, MessageCircle, Filter, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { openWhatsApp } from '../../lib/whatsappTemplates';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';
import { PageHeader, Card, Btn, Badge, Select, EmptyState } from '../../components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface LogEntry {
  id: string;
  channel: string;
  recipient_number: string;
  message_content: string;
  status: string;
  sent_at: string;
  parent_name: string;
}

export default function SMSHistory() {
  const { userRole } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (userRole?.school_id) fetchLogs();
  }, [userRole, channelFilter, statusFilter, page]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('communication_logs')
      .select('id, channel, recipient_number, message_content, status, sent_at, parent:parent_id(father_name, mother_name)')
      .eq('school_id', userRole!.school_id)
      .order('sent_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (channelFilter !== 'all') query = query.eq('channel', channelFilter);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data } = await query;
    setLogs((data || []).map((l: any) => ({
      ...l,
      parent_name: l.parent ? (l.parent.father_name || l.parent.mother_name || 'Unknown') : 'N/A',
    })));
    setLoading(false);
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent':
      case 'delivered': return 'success';
      case 'failed': return 'danger';
      case 'logged': return 'neutral';
      case 'ready': return 'warning';
      default: return 'neutral';
    }
  };

  const channelIcons: Record<string, string> = { 
    whatsapp: '💬', 
    sms: '📱', 
    email: '✉️' 
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        title="Communication History"
        subtitle="Audit logs for WhatsApp, SMS, and email messages sent to stakeholders."
        actions={
          <Btn 
            variant="outline" 
            onClick={() => exportToCSV('communication-history', logs, [
              { header: 'Date', key: 'sent_at' }, { header: 'Channel', key: 'channel' },
              { header: 'Recipient', key: 'recipient_number' }, { header: 'Parent', key: 'parent_name' },
              { header: 'Message', key: 'message_content' }, { header: 'Status', key: 'status' },
            ])}
            icon={Download}
          >
            Export CSV
          </Btn>
        }
      />

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <Select
            label="Channel"
            value={channelFilter}
            onChange={e => { setChannelFilter(e.target.value); setPage(0); }}
            icon={Filter}
          >
            <option value="all">All Channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </Select>
          <Select
            label="Status"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            icon={Filter}
          >
            <option value="all">All Status</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="logged">Logged</option>
          </Select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden border-none shadow-xl">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 text-center">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Fetching logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No Logs Found"
              description="No communication logs match the selected filters."
            />
          ) : (
            <>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Time</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Channel</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Recipient</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Parent/Staff</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Message Content</th>
                    <th className="p-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                    <th className="p-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log, i) => (
                    <motion.tr 
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.01 }}
                      className="hover:bg-slate-50 transition-all group"
                    >
                      <td className="p-6 text-xs text-slate-400 font-bold tabular-nums">
                        {formatDate(log.sent_at)}
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{channelIcons[log.channel] || '📨'}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{log.channel}</span>
                        </div>
                      </td>
                      <td className="p-6 text-xs font-mono text-slate-500">{log.recipient_number || '—'}</td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-300" />
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate max-w-[120px]">{log.parent_name}</p>
                        </div>
                      </td>
                      <td className="p-6">
                        <p className="text-xs text-slate-500 max-w-xs truncate group-hover:whitespace-normal group-hover:line-clamp-2 transition-all">
                          {log.message_content}
                        </p>
                      </td>
                      <td className="p-6 text-center">
                        <Badge variant={getStatusVariant(log.status)}>
                          {log.status}
                        </Badge>
                      </td>
                      <td className="p-6 text-right">
                        <Btn 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openWhatsApp(log.recipient_number, log.message_content)}
                          className="text-[10px] tracking-widest px-4 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          icon={MessageCircle}
                        >
                          Resend
                        </Btn>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Showing page {page + 1} · {PAGE_SIZE} records per page
                </p>
                <div className="flex gap-2">
                  <Btn 
                    variant="outline" 
                    size="sm" 
                    disabled={page === 0} 
                    onClick={() => setPage(p => p - 1)}
                    icon={ChevronLeft}
                  >
                    Prev
                  </Btn>
                  <Btn 
                    variant="outline" 
                    size="sm" 
                    disabled={logs.length < PAGE_SIZE} 
                    onClick={() => setPage(p => p + 1)}
                    className="flex-row-reverse"
                    icon={ChevronRight}
                  >
                    Next
                  </Btn>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
