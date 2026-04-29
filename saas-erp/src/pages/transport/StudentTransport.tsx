import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Plus, Trash2, Save, Search, X, Bus } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';

interface Enrollment {
  id: string;
  student_id: string;
  route_id: string;
  stop_id: string | null;
  vehicle_id: string | null;
  transport_type: string;
  is_active: boolean;
  students: { full_name: string; roll_number: string; classes?: { name: string; section: string } };
  transport_routes: { route_name: string };
  transport_stops?: { stop_name: string } | null;
  vehicles?: { vehicle_name: string } | null;
}

const TYPE_LABELS: Record<string, string> = { pickup: 'Pickup only', dropoff: 'Drop-off only', both: 'Both ways' };

export default function StudentTransport() {
  const { userRole } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('');

  const [form, setForm] = useState({
    student_id: '', route_id: '', stop_id: '', vehicle_id: '', transport_type: 'both',
  });

  useEffect(() => {
    if (userRole?.school_id) {
      fetchEnrollments();
      fetchDropdowns();
    }
  }, [userRole]);

  useEffect(() => {
    if (form.route_id) fetchStopsForRoute(form.route_id);
    else setStops([]);
  }, [form.route_id]);

  const fetchEnrollments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('student_transport')
      .select(`
        *,
        students(full_name, roll_number, classes(name, section)),
        transport_routes(route_name),
        transport_stops(stop_name),
        vehicles(vehicle_name)
      `)
      .eq('school_id', userRole!.school_id)
      .order('created_at', { ascending: false });
    setEnrollments(data || []);
    setLoading(false);
  };

  const fetchDropdowns = async () => {
    const sid = userRole!.school_id;
    const [{ data: stds }, { data: rts }, { data: vehs }] = await Promise.all([
      supabase.from('students').select('id, full_name, roll_number').eq('school_id', sid).eq('status', 'active').eq('is_deleted', false).order('full_name'),
      supabase.from('transport_routes').select('id, route_name').eq('school_id', sid).eq('is_active', true).order('route_name'),
      supabase.from('vehicles').select('id, vehicle_name').eq('school_id', sid).eq('is_active', true).order('vehicle_name'),
    ]);
    setStudents(stds || []);
    setRoutes(rts || []);
    setVehicles(vehs || []);
  };

  const fetchStopsForRoute = async (routeId: string) => {
    const { data } = await supabase
      .from('transport_stops')
      .select('id, stop_name, sequence_order')
      .eq('route_id', routeId)
      .order('sequence_order');
    setStops(data || []);
  };

  const handleSave = async () => {
    if (!form.student_id || !form.route_id) return alert('Student and Route are required.');
    setSaving(true);
    const { error } = await supabase.from('student_transport').upsert({
      school_id: userRole!.school_id,
      student_id: form.student_id,
      route_id: form.route_id,
      stop_id: form.stop_id || null,
      vehicle_id: form.vehicle_id || null,
      transport_type: form.transport_type,
      is_active: true,
    }, { onConflict: 'school_id,student_id' });

    if (error) { alert('Error: ' + error.message); setSaving(false); return; }
    setForm({ student_id: '', route_id: '', stop_id: '', vehicle_id: '', transport_type: 'both' });
    setShowForm(false);
    setSaving(false);
    fetchEnrollments();
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('Remove this student from transport?')) return;
    await supabase.from('student_transport').delete().eq('id', id);
    setEnrollments(prev => prev.filter(e => e.id !== id));
  };

  const handleExport = () => {
    const rows = filtered.map(e => ({
      Roll: e.students?.roll_number,
      Student: e.students?.full_name,
      Class: e.students?.classes ? `${e.students.classes.name} ${e.students.classes.section}` : '',
      Route: e.transport_routes?.route_name,
      Stop: e.transport_stops?.stop_name || '',
      Vehicle: e.vehicles?.vehicle_name || '',
      Type: TYPE_LABELS[e.transport_type] || e.transport_type,
      Status: e.is_active ? 'Active' : 'Inactive',
    }));
    exportToCSV('student-transport', rows, Object.keys(rows[0] || {}).map(k => ({ header: k, key: k })));
  };

  const filtered = enrollments.filter(e => {
    const q = search.toLowerCase();
    const nameMatch = e.students?.full_name?.toLowerCase().includes(q) || e.students?.roll_number?.toLowerCase().includes(q);
    const routeMatch = !routeFilter || e.route_id === routeFilter;
    return nameMatch && routeMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
            <Users className="w-7 h-7 text-indigo-600" /> Student Transport
          </h1>
          <p className="text-slate-500 text-sm mt-1">Assign students to routes and stops.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow active:scale-95">
          <Plus className="w-4 h-4" /> Assign Student
        </button>
      </div>

      {/* Assignment form */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
          <h3 className="font-black text-slate-900 text-sm mb-4 uppercase tracking-wide">Assign Student to Transport</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Student *</label>
              <select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none">
                <option value="">— Select Student —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.roll_number} — {s.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Route *</label>
              <select value={form.route_id} onChange={e => setForm(f => ({ ...f, route_id: e.target.value, stop_id: '' }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none">
                <option value="">— Select Route —</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Stop</label>
              <select value={form.stop_id} onChange={e => setForm(f => ({ ...f, stop_id: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none"
                disabled={!form.route_id}>
                <option value="">— Select Stop —</option>
                {stops.map(s => <option key={s.id} value={s.id}>{s.stop_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Vehicle</label>
              <select value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none">
                <option value="">— Unassigned —</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Type</label>
              <select value={form.transport_type} onChange={e => setForm(f => ({ ...f, transport_type: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none">
                <option value="both">Both ways</option>
                <option value="pickup">Pickup only</option>
                <option value="dropoff">Drop-off only</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> Save
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
            className="flex-1 text-sm font-medium outline-none bg-transparent placeholder:text-slate-400" />
          {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-slate-400" /></button>}
        </div>
        <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none">
          <option value="">All Routes</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
        </select>
        {filtered.length > 0 && (
          <button onClick={handleExport} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
            ↓ Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Bus className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-bold">{enrollments.length === 0 ? 'No students assigned yet' : 'No results found'}</p>
          <p className="text-sm mt-1">{enrollments.length === 0 ? 'Use the button above to assign students to routes.' : 'Try adjusting your search.'}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
          <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{filtered.length} students</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Roll', 'Student', 'Class', 'Route', 'Stop', 'Vehicle', 'Type'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                ))}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.students?.roll_number}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{e.students?.full_name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {e.students?.classes ? `${e.students.classes.name} ${e.students.classes.section}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                      {e.transport_routes?.route_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.transport_stops?.stop_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.vehicles?.vehicle_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      e.transport_type === 'both' ? 'bg-emerald-50 text-emerald-700' :
                      e.transport_type === 'pickup' ? 'bg-blue-50 text-blue-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {TYPE_LABELS[e.transport_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleRemove(e.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
