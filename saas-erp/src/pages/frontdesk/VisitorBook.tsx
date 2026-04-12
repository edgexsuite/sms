import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Plus, X, LogOut, Download } from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';

interface Visitor {
  id: string;
  visitor_name: string;
  phone: string;
  purpose: string;
  whom_to_meet: string;
  check_in: string;
  check_out: string | null;
}

export default function VisitorBook() {
  const { userRole } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ visitor_name: '', phone: '', purpose: '', whom_to_meet: '' });
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (userRole?.school_id) fetchVisitors();
  }, [userRole, date]);

  const fetchVisitors = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('visitors')
      .select('*')
      .eq('school_id', userRole!.school_id)
      .gte('check_in', `${date}T00:00:00`)
      .lte('check_in', `${date}T23:59:59`)
      .order('check_in', { ascending: false });
    setVisitors(data || []);
    setLoading(false);
  };

  const checkIn = async () => {
    if (!form.visitor_name.trim()) return;
    setSaving(true);
    await supabase.from('visitors').insert({ ...form, school_id: userRole!.school_id, check_in: new Date().toISOString() });
    setSaving(false); setShowModal(false);
    setForm({ visitor_name: '', phone: '', purpose: '', whom_to_meet: '' });
    fetchVisitors();
  };

  const checkOut = async (id: string) => {
    await supabase.from('visitors').update({ check_out: new Date().toISOString() }).eq('id', id);
    setVisitors(prev => prev.map(v => v.id === id ? { ...v, check_out: new Date().toISOString() } : v));
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const stillInside = visitors.filter(v => !v.check_out).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-600" /> Visitor Book
          </h1>
          <p className="text-gray-500 text-sm mt-1">Log school visitors and track check-in/out.</p>
        </div>
        <div className="flex gap-2">
          {visitors.length > 0 && (
            <button onClick={() => exportToExcel(`visitors-${date}`, visitors, [
              { header: 'Name', key: 'visitor_name' }, { header: 'Phone', key: 'phone' },
              { header: 'Purpose', key: 'purpose' }, { header: 'Whom to Meet', key: 'whom_to_meet' },
              { header: 'Check In', key: 'check_in' }, { header: 'Check Out', key: (r: any) => r.check_out || 'Still Inside' },
            ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700">
            <Plus className="w-4 h-4" /> Check In Visitor
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
        </div>
        {stillInside > 0 && (
          <div className="ml-4 px-4 py-2 bg-cyan-50 border border-cyan-200 rounded-lg">
            <p className="text-xs text-cyan-600 font-medium">{stillInside} visitor{stillInside > 1 ? 's' : ''} still inside</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400">Loading...</div>
          : visitors.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>No visitors logged for this date.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Visitor</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Purpose</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500">Whom to Meet</th>
                  <th className="px-5 py-3 text-center font-medium text-gray-500">Check In</th>
                  <th className="px-5 py-3 text-center font-medium text-gray-500">Check Out</th>
                  <th className="px-5 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visitors.map(v => (
                  <tr key={v.id} className={`hover:bg-gray-50 ${!v.check_out ? 'bg-cyan-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{v.visitor_name}</p>
                      <p className="text-xs text-gray-400">{v.phone}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{v.purpose || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{v.whom_to_meet || '—'}</td>
                    <td className="px-5 py-3 text-center font-mono text-xs text-gray-600">{formatTime(v.check_in)}</td>
                    <td className="px-5 py-3 text-center font-mono text-xs">
                      {v.check_out ? (
                        <span className="text-gray-500">{formatTime(v.check_out)}</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded-full text-xs font-medium">Inside</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {!v.check_out && (
                        <button onClick={() => checkOut(v.id)} title="Check Out"
                          className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded">
                          <LogOut className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Visitor Check-In</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[['visitor_name', 'Visitor Name *'], ['phone', 'Phone Number'], ['purpose', 'Purpose of Visit'], ['whom_to_meet', 'Whom to Meet']].map(([k, l]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{l}</label>
                  <input value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={checkIn} disabled={saving || !form.visitor_name.trim()}
                className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-50">
                {saving ? 'Checking In...' : 'Check In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
