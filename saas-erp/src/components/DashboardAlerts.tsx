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
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const sid = userRole?.school_id;
    const role = userRole?.role;
    if (sid && (role === 'admin' || role === 'staff')) {
      fetchAlerts(sid);
      fetchAnnouncements(sid);
    }
  }, [userRole?.school_id, userRole?.role]); // use primitives, not the object — avoids spurious re-fetches

  const fetchAnnouncements = async (sid: string) => {
    try {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, message, type')
        .or(`is_global.eq.true,school_id.eq.${sid}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setAnnouncements(data);
      }
    } catch {
      // announcements table may not exist yet — silently ignore
    }
  };

  const fetchAlerts = async (sid: string) => {
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
  const hasAnnouncements = announcements.length > 0;

  // Don't render if nothing to show or user dismissed
  if ((totalVisible === 0 && !hasAnnouncements) || dismissed) return null;

  return (
    <div className="mx-2 sm:mx-6 mt-1 mb-1 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      {/* Announcement banner (if any) */}
      {announcements.map((ann, idx) => {
        const doc = new DOMParser().parseFromString(ann.message, 'text/html');
        const decodedMessage = doc.documentElement.textContent || ann.message;
        return (
          <div key={idx} className="flex items-start gap-3 bg-indigo-600 px-4 py-2.5">
            <div className="shrink-0 mt-0.5">
              <span className="text-[9px] font-black text-indigo-200 uppercase tracking-widest bg-indigo-700/60 px-2 py-0.5 rounded-full">Broadcast</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white leading-tight">{ann.title}</p>
              <p className="text-[11px] text-indigo-200 mt-0.5 line-clamp-2 leading-snug">{decodedMessage}</p>
            </div>
          </div>
        );
      })}

      {/* Alert pills row */}
      {totalVisible > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest shrink-0">Alerts</span>

          {counts.overdueFees > 0 && location.pathname.startsWith('/fees') && (
            <button
              onClick={() => navigate('/fees/student-detail')}
              className="flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-full transition-colors"
            >
              <AlertCircle className="w-3 h-3 shrink-0" />
              {counts.overdueFees} Overdue
            </button>
          )}
          {counts.pendingLeaves > 0 && (
            <button
              onClick={() => navigate('/leave/staff')}
              className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-full transition-colors"
            >
              <Clock className="w-3 h-3 shrink-0" />
              {counts.pendingLeaves} Leaves
            </button>
          )}
          {counts.unreadComplaints > 0 && (
            <button
              onClick={() => navigate('/complaints')}
              className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-full transition-colors"
            >
              <MessageSquare className="w-3 h-3 shrink-0" />
              {counts.unreadComplaints} Complaints
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="ml-auto text-amber-400 hover:text-amber-600 transition-colors p-1 rounded-lg hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Dismiss for announcement-only state */}
      {totalVisible === 0 && hasAnnouncements && (
        <div className="flex justify-end px-3 py-1">
          <button
            onClick={() => setDismissed(true)}
            className="text-indigo-300 hover:text-white transition-colors p-1"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
