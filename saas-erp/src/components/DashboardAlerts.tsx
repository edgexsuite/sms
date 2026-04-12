import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Clock, MessageSquare, X } from 'lucide-react';

interface AlertCounts {
  overdueFees: number;
  pendingLeaves: number;
  unreadComplaints: number;
}

export default function DashboardAlerts() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState<AlertCounts>({ overdueFees: 0, pendingLeaves: 0, unreadComplaints: 0 });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (userRole?.school_id && (userRole.role === 'admin' || userRole.role === 'staff')) {
      fetchAlerts();
    }
  }, [userRole]);

  const fetchAlerts = async () => {
    const sid = userRole!.school_id;

    const [{ count: fees }, { count: leaves }, { count: complaints }] = await Promise.all([
      supabase.from('fee_records').select('id', { count: 'exact', head: true })
        .eq('school_id', sid).in('status', ['pending', 'overdue']),
      supabase.from('leave_applications').select('id', { count: 'exact', head: true })
        .eq('school_id', sid).eq('status', 'pending'),
      supabase.from('complaints').select('id', { count: 'exact', head: true })
        .eq('school_id', sid).eq('status', 'pending'),
    ]);

    const alerts = {
      overdueFees: fees || 0,
      pendingLeaves: leaves || 0,
      unreadComplaints: complaints || 0,
    };

    // Only show if there's something to alert about
    if (alerts.overdueFees > 0 || alerts.pendingLeaves > 0 || alerts.unreadComplaints > 0) {
      setCounts(alerts);
    }
  };

  const isInFeeModule = location.pathname.startsWith('/fees');
  const visibleOverdue = isInFeeModule ? counts.overdueFees : 0;
  
  const totalVisible = visibleOverdue + counts.pendingLeaves + counts.unreadComplaints;
  if (totalVisible === 0 || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-4 flex-wrap">
      <span className="text-xs font-bold text-amber-700 uppercase tracking-wide shrink-0">Alerts</span>

      <div className="flex items-center gap-3 flex-wrap flex-1">
        {counts.overdueFees > 0 && location.pathname.startsWith('/fees') && (
          <button
            onClick={() => navigate('/fees/student-detail')}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-full transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {counts.overdueFees} Overdue Fees
          </button>
        )}
        {counts.pendingLeaves > 0 && (
          <button
            onClick={() => navigate('/leave/staff')}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-full transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            {counts.pendingLeaves} Pending Leaves
          </button>
        )}
        {counts.unreadComplaints > 0 && (
          <button
            onClick={() => navigate('/complaints')}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-full transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {counts.unreadComplaints} Unread Complaints
          </button>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-600 transition-colors shrink-0"
        aria-label="Dismiss alerts"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
