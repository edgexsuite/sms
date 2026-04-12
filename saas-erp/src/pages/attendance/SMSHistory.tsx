import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MessageSquare, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';

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

  const statusColors: Record<string, string> = {
    sent: 'bg-green-100 text-green-800',
    delivered: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    logged: 'bg-gray-100 text-gray-700',
    ready: 'bg-yellow-100 text-yellow-800',
  };

  const channelIcons: Record<string, string> = { whatsapp: '💬', sms: '📱', email: '✉️' };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-green-600" /> Communication History
          </h1>
          <p className="text-gray-500 text-sm mt-1">WhatsApp, SMS, and email messages sent to parents and staff.</p>
        </div>
        <button onClick={() => exportToCSV('communication-history', logs, [
          { header: 'Date', key: 'sent_at' }, { header: 'Channel', key: 'channel' },
          { header: 'Recipient', key: 'recipient_number' }, { header: 'Parent', key: 'parent_name' },
          { header: 'Message', key: 'message_content' }, { header: 'Status', key: 'status' },
        ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Channel</label>
          <select value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500">
            <option value="all">All Channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500">
            <option value="all">All Status</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="logged">Logged</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading messages...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p>No messages found for the selected filters.</p>
            <p className="text-xs mt-1">Messages are logged when sent from the Communication module.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Date & Time</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Channel</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Recipient</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Parent</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 max-w-xs">Message</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(log.sent_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 text-gray-700">
                        <span>{channelIcons[log.channel] || '📨'}</span>
                        <span className="capitalize text-xs">{log.channel}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">{log.recipient_number || '—'}</td>
                    <td className="px-6 py-4 text-gray-700">{log.parent_name}</td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs">
                      <p className="truncate">{log.message_content}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${statusColors[log.status] || 'bg-gray-100 text-gray-700'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center p-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">Showing page {page + 1} · {PAGE_SIZE} records per page</p>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">← Previous</button>
                <button disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">Next →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
