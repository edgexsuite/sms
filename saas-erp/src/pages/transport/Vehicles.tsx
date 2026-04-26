import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, Plus, Trash2, Save, Edit2, Phone, Users, ToggleLeft, ToggleRight } from 'lucide-react';

interface Vehicle {
  id: string;
  vehicle_name: string;
  registration_number: string;
  capacity: number;
  driver_name: string;
  driver_phone: string;
  route_id: string | null;
  is_active: boolean;
  transport_routes?: { route_name: string };
}

const EMPTY = { vehicle_name: '', registration_number: '', capacity: 40, driver_name: '', driver_phone: '', route_id: '' };

export default function Vehicles() {
  const { userRole } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<{ id: string; route_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) { fetchVehicles(); fetchRoutes(); }
  }, [userRole]);

  const fetchVehicles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vehicles')
      .select('*, transport_routes(route_name)')
      .eq('school_id', userRole!.school_id)
      .order('vehicle_name');
    setVehicles(data || []);
    setLoading(false);
  };

  const fetchRoutes = async () => {
    const { data } = await supabase
      .from('transport_routes')
      .select('id, route_name')
      .eq('school_id', userRole!.school_id)
      .eq('is_active', true)
      .order('route_name');
    setRoutes(data || []);
  };

  const handleSave = async () => {
    if (!form.vehicle_name.trim()) return;
    setSaving(true);
    const payload = {
      vehicle_name: form.vehicle_name,
      registration_number: form.registration_number,
      capacity: Number(form.capacity) || 40,
      driver_name: form.driver_name,
      driver_phone: form.driver_phone,
      route_id: form.route_id || null,
      school_id: userRole!.school_id,
    };
    if (editId) {
      await supabase.from('vehicles').update(payload).eq('id', editId);
    } else {
      await supabase.from('vehicles').insert(payload);
    }
    setForm(EMPTY);
    setShowForm(false);
    setEditId(null);
    setSaving(false);
    fetchVehicles();
  };

  const handleEdit = (v: Vehicle) => {
    setForm({
      vehicle_name: v.vehicle_name,
      registration_number: v.registration_number || '',
      capacity: v.capacity || 40,
      driver_name: v.driver_name || '',
      driver_phone: v.driver_phone || '',
      route_id: v.route_id || '',
    });
    setEditId(v.id);
    setShowForm(true);
  };

  const handleToggleActive = async (v: Vehicle) => {
    await supabase.from('vehicles').update({ is_active: !v.is_active }).eq('id', v.id);
    setVehicles(prev => prev.map(x => x.id === v.id ? { ...x, is_active: !v.is_active } : x));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this vehicle?')) return;
    await supabase.from('vehicles').delete().eq('id', id);
    fetchVehicles();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
            <Truck className="w-7 h-7 text-indigo-600" /> Vehicles
          </h1>
          <p className="text-slate-500 text-sm mt-1">Register and manage your school transport fleet.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow active:scale-95">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
          <h3 className="font-black text-slate-900 text-sm mb-4 uppercase tracking-wide">{editId ? 'Edit Vehicle' : 'New Vehicle'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Vehicle Name *', key: 'vehicle_name', placeholder: 'e.g. School Bus 1' },
              { label: 'Registration No.', key: 'registration_number', placeholder: 'e.g. ABC-1234' },
              { label: 'Capacity (seats)', key: 'capacity', placeholder: '40', type: 'number' },
              { label: 'Driver Name', key: 'driver_name', placeholder: 'Full name' },
              { label: 'Driver Phone', key: 'driver_phone', placeholder: '+92 300 0000000' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>
            ))}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Assigned Route</label>
              <select value={form.route_id} onChange={e => setForm(prev => ({ ...prev, route_id: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none">
                <option value="">— Unassigned —</option>
                {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
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

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-bold">No vehicles yet</p>
          <p className="text-sm">Register your first vehicle above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map(v => (
            <div key={v.id} className={`bg-white border rounded-2xl p-5 transition-all ${v.is_active ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleToggleActive(v)} title="Toggle active" className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                    {v.is_active ? <ToggleRight className="w-5 h-5 text-indigo-500" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => handleEdit(v)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(v.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-black text-slate-900">{v.vehicle_name}</h3>
              {v.registration_number && <p className="text-xs text-slate-400 font-mono mt-0.5">{v.registration_number}</p>}

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold">{v.capacity} seats</span>
                </div>
                {v.driver_name && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-3.5 h-3.5 shrink-0 text-center text-slate-400">👤</span>
                    <span>{v.driver_name}</span>
                  </div>
                )}
                {v.driver_phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{v.driver_phone}</span>
                  </div>
                )}
                {v.transport_routes?.route_name && (
                  <div className="mt-2">
                    <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                      📍 {v.transport_routes.route_name}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${v.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {v.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
