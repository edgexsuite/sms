import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MessageCircle, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function ParentSMSHistory() {
  const { userRole } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userRole?.school_id) {
      fetchLogs();
    }
  }, [userRole]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // First, let's gracefully check if the communication_logs table exists.
      // If it doesn't, this will throw an error that we can catch, avoiding a white-screen crash.
      const { data, error } = await supabase
        .from('communication_logs')
        .select(`
          id, channel, recipient_number, message_content, status, sent_at,
          parents (father_name)
        `)
        .eq('school_id', userRole?.school_id)
        .order('sent_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
           // Table does not exist yet.
           setLogs([]);
           setError('Database needs to be patched: communication_logs table is missing.');
        } else {
           throw error;
        }
      } else {
        setLogs(data || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-700 flex items-center gap-2">
            <MessageCircle className="w-7 h-7" /> Parent WhatsApp History
          </h1>
          <p className="text-gray-500 text-sm mt-1">Review all automated and manual WhatsApp messages dispatched to parents.</p>
        </div>
      </div>

      {error ? (
         <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-md">
           <h3 className="text-yellow-800 font-bold mb-2">Notice</h3>
           <p className="text-yellow-700 text-sm">{error}</p>
           <p className="text-yellow-700 text-sm mt-2 font-mono bg-yellow-100 p-2 inline-block rounded">
             CREATE TABLE communication_logs ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), school_id UUID, parent_id UUID, channel TEXT DEFAULT 'whatsapp', recipient_number TEXT, message_content TEXT, status TEXT, sent_at TIMESTAMPTZ DEFAULT NOW());
           </p>
         </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 font-medium text-gray-700">Sent Date</th>
                <th className="p-4 font-medium text-gray-700">Recipient (Parent)</th>
                <th className="p-4 font-medium text-gray-700">WhatsApp No.</th>
                <th className="p-4 font-medium text-gray-700 w-1/2">Message Excerpt</th>
                <th className="p-4 font-medium text-gray-700 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                 <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading history...</td></tr>
              ) : logs.length === 0 ? (
                 <tr><td colSpan={5} className="p-12 text-center text-gray-500">
                   <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                   No WhatsApp logs found. Sent messages will appear here.
                 </td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-4 text-gray-500">{new Date(log.sent_at).toLocaleString()}</td>
                    <td className="p-4 font-medium text-gray-900">{log.parents?.father_name || 'Unknown'}</td>
                    <td className="p-4 font-mono text-gray-600 text-xs">{log.recipient_number}</td>
                    <td className="p-4 text-gray-600 truncate max-w-xs" title={log.message_content}>
                       {log.message_content}
                    </td>
                    <td className="p-4 text-right">
                       <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                         log.status === 'sent' || log.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                       }`}>
                         {log.status === 'sent' || log.status === 'delivered' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3"/>}
                         <span className="capitalize">{log.status}</span>
                       </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
