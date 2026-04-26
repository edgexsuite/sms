import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Plus, Trash2, ChevronDown, ChevronRight, Save, X, Clock, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Route {
  id: string;
  route_name: string;
  description: string;
  is_active: boolean;
}

interface Stop {
  id: string;
  route_id: string;
  stop_name: string;
  pickup_time: string;
  dropoff_time: string;
  sequence_order: number;
}

const EMPTY_ROUTE = { route_name: '', description: '' };
const EMPTY_STOP = { stop_name: '', pickup_time: '', dropoff_time: '', sequence_order: 1 };

export default function Routes() {
  const { userRole } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Record<string, Stop[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [routeForm, setRouteForm] = useState(EMPTY_ROUTE);
  const [editRouteId, setEditRouteId] = useState<string | null>(null);
  const [stopForm, setStopForm] = useState<Record<string, typeof EMPTY_STOP>>({});
  const [showStopForm, setShowStopForm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchRoutes();
  }, [userRole]);

  const fetchRoutes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transport_routes')
      .select('*')
      .eq('school_id', userRole!.school_id)
      .order('route_name');
    setRoutes(data || []);
    setLoading(false);
  };

  const fetchStops = async (routeId: string) => {
    const { data } = await supabase
      .from('transport_stops')
      .select('*')
      .eq('route_id', routeId)
      .order('sequence_order');
    setStops(prev => ({ ...prev, [routeId]: data || [] }));
  };

  const toggleExpand = (routeId: string) => {
    if (expanded === routeId) {
      setExpanded(null);
    } else {
      setExpanded(routeId);
      if (!stops[routeId]) fetchStops(routeId);
    }
  };

  const handleSaveRoute = async () => {
    if (!routeForm.route_name.trim()) return;
    setSaving(true);
    if (editRouteId) {
      await supabase.from('transport_routes').update({ route_name: routeForm.route_name, description: routeForm.description }).eq('id', editRouteId);
    } else {
      await supabase.from('transport_routes').insert({ ...routeForm, school_id: userRole!.school_id });
    }
    setRouteForm(EMPTY_ROUTE);
    setShowRouteForm(false);
    setEditRouteId(null);
    setSaving(false);
    fetchRoutes();
  };

  const handleToggleActive = async (route: Route) => {
    await supabase.from('transport_routes').update({ is_active: !route.is_active }).eq('id', route.id);
    setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, is_active: !r.is_active } : r));
  };

  const handleDeleteRoute = async (id: string) => {
    if (!window.confirm('Delete this route? All stops and student assignments will also be removed.')) return;
    await supabase.from('transport_routes').delete().eq('id', id);
    fetchRoutes();
  };

  const handleSaveStop = async (routeId: string) => {
    const f = stopForm[routeId] || EMPTY_STOP;
    if (!f.stop_name.trim()) return;
    setSaving(true);
    await supabase.from('transport_stops').insert({
      route_id: routeId,
      school_id: userRole!.school_id,
      stop_name: f.stop_name,
      pickup_time: f.pickup_time,
      dropoff_time: f.dropoff_time,
      sequence_order: f.sequence_order,
    });
    setStopForm(prev => ({ ...prev, [routeId]: EMPTY_STOP }));
    setShowStopForm(null);
    setSaving(false);
    fetchStops(routeId);
  };

  const handleDeleteStop = async (routeId: string, stopId: string) => {
    await supabase.from('transport_stops').delete().eq('id', stopId);
    setStops(prev => ({ ...prev, [routeId]: (prev[routeId] || []).filter(s => s.id !== stopId) }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
            <MapPin className="w-7 h-7 text-indigo-600" /> Routes & Stops
          </h1>
          <p className="text-slate-500 text-sm mt-1">Define transport routes and their pickup/drop stops.</p>
        </div>
        <button onClick={() => { setShowRouteForm(true); setEditRouteId(null); setRouteForm(EMPTY_ROUTE); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow active:scale-95">
          <Plus className="w-4 h-4" /> Add Route
        </button>
      </div>

      {/* Route form */}
      {showRouteForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
          <h3 className="font-black text-slate-900 text-sm mb-4 uppercase tracking-wide">{editRouteId ? 'Edit Route' : 'New Route'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Route Name *</label>
              <input value={routeForm.route_name} onChange={e => setRouteForm(f => ({ ...f, route_name: e.target.value }))}
                placeholder="e.g. North City Route" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Description</label>
              <input value={routeForm.description} onChange={e => setRouteForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSaveRoute} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> Save
            </button>
            <button onClick={() => setShowRouteForm(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : routes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-bold">No routes yet</p>
          <p className="text-sm">Create your first transport route above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map(route => (
            <div key={route.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* Route header */}
              <div className="flex items-center gap-3 px-5 py-4">
                <button onClick={() => toggleExpand(route.id)} className="flex items-center gap-3 flex-1 text-left group">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900">{route.route_name}</p>
                    {route.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{route.description}</p>}
                  </div>
                  {expanded === route.id
                    ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                  }
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${route.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {route.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => handleToggleActive(route)} title="Toggle active" className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                    {route.is_active ? <ToggleRight className="w-5 h-5 text-indigo-500" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => { setEditRouteId(route.id); setRouteForm({ route_name: route.route_name, description: route.description || '' }); setShowRouteForm(true); }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteRoute(route.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stops */}
              {expanded === route.id && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stops</p>
                    <button onClick={() => setShowStopForm(showStopForm === route.id ? null : route.id)}
                      className="flex items-center gap-1 text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors">
                      <Plus className="w-3 h-3" /> Add Stop
                    </button>
                  </div>

                  {showStopForm === route.id && (
                    <div className="bg-white border border-indigo-100 rounded-xl p-4 mb-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Stop Name *</label>
                          <input value={stopForm[route.id]?.stop_name || ''} onChange={e => setStopForm(f => ({ ...f, [route.id]: { ...(f[route.id] || EMPTY_STOP), stop_name: e.target.value } }))}
                            placeholder="e.g. Main Bazaar" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Pickup Time</label>
                          <input value={stopForm[route.id]?.pickup_time || ''} onChange={e => setStopForm(f => ({ ...f, [route.id]: { ...(f[route.id] || EMPTY_STOP), pickup_time: e.target.value } }))}
                            placeholder="07:30 AM" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Drop Time</label>
                          <input value={stopForm[route.id]?.dropoff_time || ''} onChange={e => setStopForm(f => ({ ...f, [route.id]: { ...(f[route.id] || EMPTY_STOP), dropoff_time: e.target.value } }))}
                            placeholder="02:30 PM" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handleSaveStop(route.id)} disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-black text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50">
                          <Save className="w-3 h-3" /> Save Stop
                        </button>
                        <button onClick={() => setShowStopForm(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-slate-200">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {(stops[route.id] || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No stops yet. Add your first stop above.</p>
                  ) : (
                    <div className="space-y-1">
                      {(stops[route.id] || []).map((stop, idx) => (
                        <div key={stop.id} className="flex items-center gap-3 bg-white border border-slate-100 rounded-lg px-4 py-2.5">
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</div>
                          <p className="text-sm font-bold text-slate-800 flex-1">{stop.stop_name}</p>
                          {stop.pickup_time && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" /> ↑ {stop.pickup_time}
                            </span>
                          )}
                          {stop.dropoff_time && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" /> ↓ {stop.dropoff_time}
                            </span>
                          )}
                          <button onClick={() => handleDeleteStop(route.id, stop.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
