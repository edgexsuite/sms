import { useEffect, useState } from 'react';
import { Users, GraduationCap, BookOpen, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Stats {
  students: number;
  teachers: number;
  classes: number;
  presentToday: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ students: 0, teachers: 0, classes: 0, presentToday: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const today = new Date().toISOString().split('T')[0];
      const [{ count: students }, { count: teachers }, { count: classes }, { count: presentToday }] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'present'),
      ]);
      setStats({ students: students ?? 0, teachers: teachers ?? 0, classes: classes ?? 0, presentToday: presentToday ?? 0 });
      setLoading(false);
    }
    loadStats();
  }, []);

  const cards = [
    { label: 'Total Students', value: stats.students, icon: Users, color: 'bg-blue-500' },
    { label: 'Total Teachers', value: stats.teachers, icon: GraduationCap, color: 'bg-green-500' },
    { label: 'Active Classes', value: stats.classes, icon: BookOpen, color: 'bg-purple-500' },
    { label: 'Present Today', value: stats.presentToday, icon: ClipboardList, color: 'bg-orange-500' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">
          Welcome back, {profile?.first_name}!
        </h2>
        <p className="text-gray-500 text-sm mt-1">Here is what is happening at your school today.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl p-6 shadow-sm flex items-center gap-4">
              <div className={`${color} rounded-xl p-3`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Add Student', href: '/students' },
            { label: 'Add Teacher', href: '/teachers' },
            { label: 'Create Class', href: '/classes' },
            { label: 'Mark Attendance', href: '/attendance' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="block text-center px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg text-sm transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
