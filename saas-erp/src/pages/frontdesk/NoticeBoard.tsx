import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, Plus, X, Trash2, AlertCircle } from 'lucide-react';
import { formatDate } from '../../lib/utils';

const AUDIENCES = ['all', 'students', 'staff', 'parents'] as const;
type Audience = typeof AUDIENCES[number];

interface Notice {
  id: string;
  title: string;
  content: string;
  audience: Audience;
  priority: string;
  posted_by: string;
  expires_at: string | null;
  created_at: string;
}

export default function NoticeBoard() {
  const { userRole } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<Audience | 'all'>('all');
  const [form, setForm] = useState({ title: '', content: '', audience: 'all' as Audience, priority: 'normal', posted_by: '', expires_at: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchNotices();
  }, [userRole]);

  const fetchNotices = async () => {
    setLoading(true);
    const { data } = await supabase.from('notices').select('*').eq('school_id', userRole!.school_id).order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    await supabase.from('notices').insert({
      ...form, school_id: userRole!.school_id,
      expires_at: form.expires_at || null,
    });
    setSaving(false); setShowModal(false); fetchNotices();
    setForm({ title: '', content: '', audience: 'all', priority: 'normal', posted_by: '', expires_at: '' });
  };

  const remove = async (id: string) => {
    await supabase.from('notices').delete().eq('id', id);
    setNotices(prev => prev.filter(n => n.id !== id));
  };

  const filtered = filter === 'all' ? notices : notices.filter(n => n.audience === filter || n.audience === 'all');
  const activeNotices = notices.filter(n => !n.expires_at || new Date(n.expires_at) >= new Date());
  const urgentCount = activeNotices.filter(n => n.priority === 'urgent').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-cyan-600" /> Notice Board
          </h1>
          <p className="text-gray-500 text-sm mt-1">Post announcements for students, staff, and parents.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700">
          <Plus className="w-4 h-4" /> Post Notice
        </button>
      </div>

      {urgentCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 font-medium">{urgentCount} urgent notice{urgentCount > 1 ? 's' : ''} active</p>
        </div>
      )}

      {/* Audience filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', ...AUDIENCES] as const).map(a => (
          <button key={a} onClick={() => setFilter(a)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${filter === a ? 'bg-cyan-100 text-cyan-800' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {a}
          </button>
        ))}
      </div>

      {loading ? <div className="p-12 text-center text-gray-400">Loading...</div>
        : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p>No notices yet. Post your first announcement.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(n => {
              const isExpired = n.expires_at && new Date(n.expires_at) < new Date();
              return (
                <div key={n.id} className={`bg-white rounded-xl shadow-sm border p-5 ${n.priority === 'urgent' ? 'border-red-300 bg-red-50/30' : 'border-gray-200'} ${isExpired ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {n.priority === 'urgent' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        <h3 className="font-semibold text-gray-900">{n.title}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${n.audience === 'all' ? 'bg-gray-100 text-gray-600' : n.audience === 'students' ? 'bg-blue-100 text-blue-700' : n.audience === 'staff' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                          {n.audience}
                        </span>
                        {isExpired && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Expired</span>}
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.content}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                        <span>Posted: {formatDate(n.created_at)}</span>
                        {n.posted_by && <span>By: {n.posted_by}</span>}
                        {n.expires_at && <span>Expires: {formatDate(n.expires_at)}</span>}
                      </div>
                    </div>
                    <button onClick={() => remove(n.id)} className="text-red-400 hover:text-red-600 p-1 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Post Notice</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Content *</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Audience</label>
                  <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value as Audience })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500">
                    {AUDIENCES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500">
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Posted By</label>
                  <input value={form.posted_by} onChange={e => setForm({ ...form, posted_by: e.target.value })} placeholder="Your name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Expires On (optional)</label>
                  <input type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving || !form.title.trim() || !form.content.trim()}
                className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-50">
                {saving ? 'Posting...' : 'Post Notice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
