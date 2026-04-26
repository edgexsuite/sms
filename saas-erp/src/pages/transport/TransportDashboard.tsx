import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Bus, MapPin, Users, Truck, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function TransportDashboard() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ routes: 0, vehicles: 0, students: 0, activeRoutes: 0 });
  const [routes, setRoutes] = useState<any[]>([]);

  useEffect(() => {
    if (userRole?.school_id) loadData();
  }, [userRole]);

  const loadData = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    const [{ data: rts }, { data: vehs }, { data: stds }] = await Promise.all([
      supabase.from('transport_routes').select('id, route_name, is_active').eq('school_id', sid),
      supabase.from('vehicles').select('id, is_active').eq('school_id', sid),
      supabase.from('student_transport').select('id, is_active').eq('school_id', sid),
    ]);

    setRoutes(rts || []);
    setStats({
      routes: rts?.length || 0,
      activeRoutes: rts?.filter(r => r.is_active).length || 0,
      vehicles: vehs?.length || 0,
      students: stds?.filter(s => s.is_active).length || 0,
    });
    setLoading(false);
  };

  const cards = [
    { label: 'Total Routes', value: stats.routes, sub: `${stats.activeRoutes} active`, icon: MapPin, color: 'indigo', link: '/transport/routes' },
    { label: 'Vehicles', value: stats.vehicles, sub: 'fleet registered', icon: Truck, color: 'emerald', link: '/transport/vehicles' },
    { label: 'Students on Transport', value: stats.students, sub: 'enrolled riders', icon: Users, color: 'amber', link: '/transport/students' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
          <Bus className="w-7 h-7 text-indigo-600" /> Transport
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage routes, vehicles, stops and student allocations.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cards.map(c => {
              const Icon = c.icon;
              return (
                <Link key={c.label} to={c.link}
                  className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50 transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-xl bg-${c.color}-50 flex items-center justify-center group-hover:bg-${c.color}-600 transition-colors`}>
                      <Icon className={`w-5 h-5 text-${c.color}-600 group-hover:text-white transition-colors`} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <p className="text-3xl font-black text-slate-900">{c.value}</p>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wide mt-1">{c.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
                </Link>
              );
            })}
          </div>

          {/* Route list */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">Routes Overview</h2>
              <Link to="/transport/routes" className="text-xs font-bold text-indigo-600 hover:underline">Manage →</Link>
            </div>

            {routes.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Bus className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-bold">No routes yet</p>
                <p className="text-sm mt-1">
                  <Link to="/transport/routes" className="text-indigo-600 hover:underline">Add your first route →</Link>
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {routes.map(r => (
                  <div key={r.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 flex-1">{r.route_name}</p>
                    {r.is_active
                      ? <span className="flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Active</span>
                      : <span className="flex items-center gap-1 text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /> Inactive</span>
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
