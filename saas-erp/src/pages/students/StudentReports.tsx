import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart3, Users, UserMinus, FileDigit, Calendar } from 'lucide-react';

export default function StudentReports() {
  const { userRole } = useAuth();
  const [stats, setStats] = useState({
    totalActive: 0,
    totalLeft: 0,
    genderSplit: { male: 0, female: 0 },
    newAdmissionsThisMonth: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole?.school_id) fetchMetrics();
  }, [userRole]);

  const fetchMetrics = async () => {
    setLoading(true);
    
    // Total Active
    const { count: activeCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', userRole?.school_id).eq('status', 'active');
    
    // Total Left/Graduated
    const { count: leftCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', userRole?.school_id).neq('status', 'active');

    // New this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { count: monthCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', userRole?.school_id).gte('admission_date', startOfMonth.toISOString());

    // Gross gender fetch
    const { data: genderData } = await supabase.from('students').select('gender').eq('school_id', userRole?.school_id).eq('status', 'active');
    
    let male = 0; let female = 0;
    genderData?.forEach(row => {
      if (row.gender === 'Male') male++;
      else if (row.gender === 'Female') female++;
    });

    setStats({
      totalActive: activeCount || 0,
      totalLeft: leftCount || 0,
      genderSplit: { male, female },
      newAdmissionsThisMonth: monthCount || 0
    });
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Analytics & Reports</h1>
        <p className="text-gray-500 text-sm mt-1">High level overview of your school's demographic strength.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
           <div className="flex items-start justify-between">
             <div className="bg-blue-100 p-3 rounded-lg"><Users className="w-6 h-6 text-blue-600" /></div>
             <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+Active</span>
           </div>
           <div className="mt-4">
             <h3 className="text-3xl font-black text-gray-900">{loading ? '...' : stats.totalActive}</h3>
             <p className="text-sm font-medium text-gray-500 mt-1">Total Active Students</p>
           </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
           <div className="flex items-start justify-between">
             <div className="bg-red-100 p-3 rounded-lg"><UserMinus className="w-6 h-6 text-red-600" /></div>
             <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">Inactive</span>
           </div>
           <div className="mt-4">
             <h3 className="text-3xl font-black text-gray-900">{loading ? '...' : stats.totalLeft}</h3>
             <p className="text-sm font-medium text-gray-500 mt-1">Total Left / Graduated</p>
           </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
           <div className="flex items-start justify-between">
             <div className="bg-purple-100 p-3 rounded-lg"><Calendar className="w-6 h-6 text-purple-600" /></div>
           </div>
           <div className="mt-4">
             <h3 className="text-3xl font-black text-gray-900">{loading ? '...' : stats.newAdmissionsThisMonth}</h3>
             <p className="text-sm font-medium text-gray-500 mt-1">New Admissions (This Month)</p>
           </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
           <div className="flex items-start justify-between">
             <div className="bg-orange-100 p-3 rounded-lg"><FileDigit className="w-6 h-6 text-orange-600" /></div>
           </div>
           <div className="mt-4 flex gap-4">
              <div>
                 <h3 className="text-xl font-black text-blue-600">{loading ? '...' : stats.genderSplit.male}</h3>
                 <p className="text-xs font-bold text-gray-400 uppercase mt-1">Male</p>
              </div>
              <div className="w-px bg-gray-200"></div>
              <div>
                 <h3 className="text-xl font-black text-pink-500">{loading ? '...' : stats.genderSplit.female}</h3>
                 <p className="text-xs font-bold text-gray-400 uppercase mt-1">Female</p>
              </div>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 my-8 flex items-center justify-center">
         <div className="text-center text-gray-400">
           <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
           <h3 className="text-lg font-medium text-gray-700">Detailed Visual Analytics Engine (Coming Soon)</h3>
           <p className="text-sm mt-1">Advanced class-by-class charts will unlock here once the examination module is completed.</p>
         </div>
      </div>
    </div>
  );
}
