import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LogOut, GraduationCap, Users, BookOpen, LayoutDashboard, CreditCard, CalendarCheck, FileText, Settings as SettingsIcon, Star, MessageSquare, Calendar, CalendarOff, Package, AlertTriangle, Bot, Briefcase, ClipboardList, ChevronRight, ChevronLeft, ChevronDown, UserPlus, Upload, ShieldCheck, Award, LineChart, Menu, X, Wallet, Key, PiggyBank, BarChart3, Banknote, TrendingUp, UserX, ClipboardCheck, BarChart2, Wifi, Ticket, Search, DollarSign, Scale, Library, Home, Bell, Palette, School, Shield, Trash2, Clock, Box } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn, formatDate } from '../lib/utils';
import CommandPalette from '../components/CommandPalette';
import DashboardAlerts from '../components/DashboardAlerts';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { NAV_SECTIONS } from '../constants/navigation';
import AiAssistant from '../components/AiAssistant';

export default function DashboardLayout() {

  const { signOut, userRole, session, allRoles, switchRole, canAccess } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPortalMenu, setShowPortalMenu] = useState(false);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  // manualDropdown: set when the user explicitly clicks a parent nav item.
  // Cleared on every route change so the auto-computed value takes over.
  const [manualDropdown, setManualDropdown] = useState<string | null>(null);
  const prevPathRef = useRef(location.pathname);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [densityCompact, setDensityCompact] = useState<boolean>(() => localStorage.getItem('density') === 'compact');

  // ── Sidebar search filter ───────────────────────────────────────────────────
  const [sidebarFilter, setSidebarFilter] = useState('');

  // ── Pinned Favorites ────────────────────────────────────────────────────────
  const [pinnedPaths, setPinnedPaths] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pinned_sidebar_paths');
      return saved ? JSON.parse(saved) : ['/fees/easy-fee', '/attendance', '/result/teacher-marks'];
    } catch {
      return ['/fees/easy-fee', '/attendance', '/result/teacher-marks'];
    }
  });

  const togglePin = (path: string) => {
    setPinnedPaths(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path];
      localStorage.setItem('pinned_sidebar_paths', JSON.stringify(next));
      return next;
    });
  };

  // ── Section Collapsing ──────────────────────────────────────────────────────
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('collapsed_sidebar_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleSectionCollapse = (title: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [title]: !prev[title] };
      localStorage.setItem('collapsed_sidebar_sections', JSON.stringify(next));
      return next;
    });
  };

  // Flatten all items for quick favorites lookup
  const allNavItemsFlattened = useMemo(() => {
    const list: { name: string; path: string; icon: any; color: string }[] = [];
    NAV_SECTIONS.forEach(sec => {
      sec.items.forEach(item => {
        if (item.subItems) {
          item.subItems.forEach(sub => {
            list.push({ name: sub.name, path: sub.path, icon: (sub as any).icon || item.icon, color: sec.color || '#6366f1' });
          });
        } else {
          list.push({ name: item.name, path: item.path, icon: item.icon, color: sec.color || '#6366f1' });
        }
      });
    });
    return list;
  }, []);

  const pinnedItemList = useMemo(() => {
    return pinnedPaths
      .map(p => allNavItemsFlattened.find(i => i.path === p))
      .filter(Boolean) as { name: string; path: string; icon: any; color: string }[];
  }, [pinnedPaths, allNavItemsFlattened]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (portalMenuRef.current && !portalMenuRef.current.contains(e.target as Node)) {
        setShowPortalMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDensity = () => {
    const next = !densityCompact;
    setDensityCompact(next);
    localStorage.setItem('density', next ? 'compact' : 'comfortable');
    window.dispatchEvent(new Event('density-change'));
  };

  useEffect(() => {
    const syncDensity = () => {
      setDensityCompact(localStorage.getItem('density') === 'compact');
    };
    window.addEventListener('storage', syncDensity);
    window.addEventListener('density-change', syncDensity);
    return () => {
      window.removeEventListener('storage', syncDensity);
      window.removeEventListener('density-change', syncDensity);
    };
  }, []);

  // Clear manual override whenever the user navigates to a new path
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname;
      setManualDropdown(null);
    }
  }, [location.pathname]);

  // Derived — which section should auto-expand based on the current URL
  const autoDropdown = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith('/students'))   return 'Students';
    if (p.startsWith('/classes'))    return 'Classes & Subjects';
    if (p.startsWith('/timetable'))  return 'Timetable & Routine';
    if (p.startsWith('/planner'))    return 'Lesson Planner';
    if (p.startsWith('/attendance/staff') || p.startsWith('/leave')) return 'Staff & Leaves';
    if (p.startsWith('/attendance')) return 'Student Attendance';
    if (p.startsWith('/result'))     return 'Exam Management';
    if (
      p.startsWith('/fees/settings') ||
      p.startsWith('/fees/fee-templates') ||
      p.startsWith('/fees/discounts') ||
      p.startsWith('/fees/fine-policy') ||
      p.startsWith('/fees/challan-settings') ||
      p.startsWith('/fees/bulk-arrears') ||
      p.startsWith('/fees/bulk-discount') ||
      p.startsWith('/fees/bulk-fee-import')
    ) {
      return 'Fee Setup & Rules';
    }
    if (p.startsWith('/fees'))       return 'Fee Operations';
    if (p.startsWith('/expenses'))   return 'Expenses & Daybook';
    if (p.startsWith('/payroll'))    return 'Staff Payroll';
    if (p.startsWith('/accounting')) return 'School Accounts';
    if (p.startsWith('/staff'))      return 'Staff Directory';
    if (p.startsWith('/transport'))  return 'Transport Service';
    if (p.startsWith('/settings') || p.startsWith('/audit-log')) return 'System Settings';
    return null;
  }, [location.pathname]);

  // Effective open dropdown: manual choice wins, else auto
  const openDropdown   = manualDropdown ?? autoDropdown;
  const setOpenDropdown = (name: string | null) => setManualDropdown(name);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [schoolBrand, setSchoolBrand] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [demoExpiry, setDemoExpiry] = useState<{ expiresAt: Date; daysLeft: number } | null>(null);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) {
       fetchNotifications();
       fetchSchoolBrand();
       checkDemoExpiry();
    }
  }, [userRole]);

  const BRAND_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  const checkDemoExpiry = async () => {
    if (!userRole?.school_id || userRole?.role !== 'admin') return;
    try {
      const { data } = await supabase
        .from('schools')
        .select('status, demo_expires_at')
        .eq('id', userRole.school_id)
        .maybeSingle();

      if (!data || !data.demo_expires_at || data.status === 'suspended' || data.status === 'expired') return;

      const expiresAt = new Date(data.demo_expires_at);
      const now = new Date();
      const msLeft = expiresAt.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      // Auto-suspend if expired
      if (msLeft <= 0) {
        await supabase.from('schools').update({ status: 'suspended' }).eq('id', userRole.school_id);
        await signOut();
        alert('Your 2-month demo has expired. Please contact us to continue.');
        return;
      }

      // Show banner if 7 days or fewer remain
      if (daysLeft <= 7) {
        setDemoExpiry({ expiresAt, daysLeft });
      }
    } catch (err) {
      console.error('Demo expiry check failed:', err);
    }
  };

  const fetchSchoolBrand = async () => {
    if (!userRole?.school_id) return;

    // Serve from localStorage cache if fresh (avoids a round-trip on every mount)
    const cacheKey = `schoolBrand_${userRole.school_id}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { brand, ts } = JSON.parse(cached);
        if (Date.now() - ts < BRAND_CACHE_TTL) {
          setSchoolBrand(brand);
          return;
        }
      }
    } catch { /* corrupt cache — ignore, re-fetch */ }

    const { data, error } = await supabase
      .from('schools')
      .select('name, logo_url')
      .eq('id', userRole.school_id)
      .maybeSingle();

    if (error) { console.error('Error fetching school branding:', error); return; }

    if (data) {
      const brand = { name: data.name || 'School Dashboard', logo_url: data.logo_url || null };
      setSchoolBrand(brand);
      localStorage.setItem(cacheKey, JSON.stringify({ brand, ts: Date.now() }));
    }
  };

  const fetchNotifications = async () => {
    if (!userRole) return;
    let query = supabase.from('notifications').select('*').eq('school_id', userRole.school_id).order('created_at', { ascending: false }).limit(10);
    
    if (userRole.role === 'teacher' || userRole.role === 'staff') {
       query = query.in('target_audience', ['all', 'teachers']);
    } else if (userRole.role === 'parent') {
       const { data: parentData } = await supabase.from('parents').select('id').eq('user_id', userRole.user_id).maybeSingle();
       let classIds: string[] = [];
       if (parentData) {
          const { data: students } = await supabase.from('students').select('class_id').eq('parent_id', parentData.id);
          classIds = students?.map(s => s.class_id) || [];
       }
       if (classIds.length > 0) {
          query = supabase.from('notifications').select('*')
            .eq('school_id', userRole.school_id)
            .or(`target_audience.in.("all","parents"),and(target_audience.eq.class,class_id.in.(${classIds.join(',')}))`)
            .order('created_at', { ascending: false }).limit(10);
       } else {
          query = query.in('target_audience', ['all', 'parents']);
       }
    }
    
    const { data } = await query;
    if (data) {
       setNotifications(data);
       const lastRead = localStorage.getItem(`lastReadNotif_${userRole.user_id}`);
       if (!lastRead) {
          setUnreadCount(data.length);
       } else {
          const lastReadDate = new Date(lastRead);
          const unread = data.filter(n => new Date(n.created_at) > lastReadDate).length;
          setUnreadCount(unread);
       }
    }
  };

  const handleOpenNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
       setUnreadCount(0);
       localStorage.setItem(`lastReadNotif_${userRole?.user_id}`, new Date().toISOString());
    }
  };



  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // ── Session timeout warning ────────────────────────────────────────────────
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(0);

  useEffect(() => {
    if (!session?.expires_at) return;
    const WARNING_MS = 5 * 60 * 1000; // warn 5 min before expiry

    const tick = () => {
      const remaining = session.expires_at! * 1000 - Date.now();
      setSessionSecondsLeft(Math.max(0, Math.floor(remaining / 1000)));
      if (remaining <= 0) { signOut(); return; }
      setSessionWarning(remaining <= WARNING_MS);
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [session?.expires_at]);

  const navSections = useMemo(() =>
    NAV_SECTIONS.filter(section => {
      if (!userRole?.role) return false;
      if (!section.roles.includes(userRole.role)) return false;
      if (userRole.role !== 'admin' && (section as any).id) {
        if (!canAccess((section as any).id)) return false;
      }
      return true;
    }),
  [userRole, canAccess]);

  const schoolName = schoolBrand?.name || 'School Dashboard';
  const schoolLogo = schoolBrand?.logo_url || null;
  return (
    <>
      <div className="theme-shell h-screen print:h-auto print:bg-white flex overflow-hidden print:overflow-visible print:block">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[55] md:hidden no-print backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={cn(
        `fixed md:sticky md:top-0 inset-y-0 left-0 z-[60] h-screen flex flex-col shrink-0 no-print transition-all duration-300 ${isSidebarCollapsed ? 'w-[64px]' : 'w-[280px] md:w-[260px]'}`,
        "bg-[#0d1526]",
        "shadow-[4px_0_24px_rgba(0,0,0,0.35)]",
        "transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>

        {/* ── Brand header ── */}
        <div className="h-[64px] flex items-center justify-between px-4 shrink-0 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 min-w-0">
            {schoolLogo ? (
              <img
                src={schoolLogo}
                alt={schoolName}
                loading="lazy"
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-indigo-500/40 shadow-lg shadow-black/40 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50 shrink-0">
                <School className="w-5 h-5 text-white" />
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white/90 uppercase tracking-[0.14em] truncate leading-tight font-display">
                  {schoolName}
                </p>
                <p className="text-[9px] font-semibold text-indigo-400/80 uppercase tracking-[0.22em] mt-0.5">
                  ERP Platform
                </p>
              </div>
            )}
          </div>
          <button
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
          <button
            className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setIsSidebarCollapsed(v => !v)}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed
              ? <ChevronRight className="w-4 h-4" />
              : <ChevronLeft className="w-4 h-4" />
            }
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3 px-2.5 pb-24 md:pb-3 space-y-2">

          {/* ── Instant Sidebar Search Filter ── */}
          {!isSidebarCollapsed && (
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter menu..."
                value={sidebarFilter}
                onChange={e => setSidebarFilter(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.1] text-white text-[11.5px] rounded-xl border border-white/[0.08] focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-500 font-medium"
              />
              {sidebarFilter && (
                <button
                  onClick={() => setSidebarFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-md"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* ── Favorites / Pinned Quick Access ── */}
          {!isSidebarCollapsed && !sidebarFilter && pinnedItemList.length > 0 && (
            <div className="p-2 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 shadow-sm transition-all mb-3">
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                    Favorites
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-400/80 px-1.5 py-0.2 rounded-full bg-amber-400/10">
                  {pinnedItemList.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {pinnedItemList.map(fav => {
                  const Icon = fav.icon;
                  const isActive = location.pathname === fav.path;
                  return (
                    <div key={fav.path} className="group/fav flex items-center justify-between">
                      <Link
                        to={fav.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex-1 flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs transition-all min-w-0",
                          isActive
                            ? "bg-amber-400/20 text-white font-bold border border-amber-400/30"
                            : "text-slate-300 hover:text-white hover:bg-white/[0.06] font-medium"
                        )}
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-white shadow-xs"
                          style={{ backgroundColor: fav.color }}
                        >
                          <Icon className="w-3 h-3" />
                        </div>
                        <span className="leading-snug text-left text-[11.5px]">{fav.name}</span>
                      </Link>
                      <button
                        onClick={() => togglePin(fav.path)}
                        className="opacity-0 group-hover/fav:opacity-100 p-1 text-slate-500 hover:text-amber-400 transition-opacity"
                        title="Remove from favorites"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Main Nav Sections (Color-Coded Cards) ── */}
          {navSections.map((section) => {
            const filterLower = sidebarFilter.toLowerCase().trim();

            const visibleItems = section.items.filter(item => {
              if (!userRole?.role || !item.roles.includes(userRole.role)) return false;
              if (userRole.role !== 'admin') {
                if (item.path.startsWith('/fees') && !canAccess('fees')) return false;
                if (item.path.startsWith('/expenses') && !canAccess('expenses')) return false;
                if (item.path.startsWith('/payroll') && !canAccess('payroll')) return false;
                if (item.path.startsWith('/accounting') && !canAccess('accounting')) return false;
                if (item.path.startsWith('/diary') && !canAccess('diary')) return false;
                if (item.path.startsWith('/leave') && !canAccess('leave')) return false;
                if (item.path.startsWith('/inventory') && !canAccess('inventory')) return false;
              }
              if (!filterLower) return true;

              const itemMatch = item.name.toLowerCase().includes(filterLower);
              const subMatch = item.subItems?.some(s => s.name.toLowerCase().includes(filterLower));
              const secMatch = section.title.toLowerCase().includes(filterLower);
              return itemMatch || subMatch || secMatch;
            });

            if (visibleItems.length === 0) return null;

            const accent = (section as any).color || '#6366f1';
            const accentBg   = `${accent}22`;
            const accentBgSm = `${accent}18`;
            const accentIcon = `${accent}dd`;

            // Section is active if current path is inside it
            const isSectionActive = section.items.some(item =>
              item.subItems ? item.subItems.some(s => location.pathname.startsWith(s.path)) : location.pathname.startsWith(item.path)
            );

            const isCollapsed = !!collapsedSections[section.title] && !filterLower;

            return (
              <div
                key={section.title}
                className={cn(
                  "transition-all duration-300 relative group/secCard",
                  isSidebarCollapsed ? "bg-transparent p-0 mb-2" : "p-1.5 sm:p-2 rounded-2xl border mb-2.5"
                )}
                style={!isSidebarCollapsed ? {
                  backgroundColor: `${accent}0b`,
                  borderColor: isSectionActive ? `${accent}40` : `${accent}15`,
                  boxShadow: isSectionActive ? `0 0 16px ${accent}12` : 'none',
                } : {}}
              >
                {/* Section Header */}
                {!isSidebarCollapsed && (
                  <div
                    onClick={() => toggleSectionCollapse(section.title)}
                    className="flex items-center justify-between px-2.5 py-1.5 mb-1 cursor-pointer rounded-xl hover:bg-white/[0.06] transition-colors select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }}
                      />
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] leading-tight text-left flex-1" style={{ color: accent }}>
                        {section.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full text-slate-400 bg-white/[0.08]">
                        {visibleItems.length}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 text-slate-400 transition-transform duration-200",
                          isCollapsed && "-rotate-90"
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Section items */}
                {(!isCollapsed || isSidebarCollapsed) && (
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const hasSubItems = !!(item.subItems && item.subItems.length > 0);
                      const isActive = hasSubItems
                        ? location.pathname.startsWith(item.path)
                        : location.pathname === item.path;
                      const Icon = item.icon;
                      // Expand dropdown automatically if filter typed
                      const isOpen = filterLower ? true : openDropdown === item.name;
                      return (
                        <div key={item.name} className="relative group/item">
                          {!hasSubItems ? (
                            item.path === '/ai-assistant' ? (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  window.dispatchEvent(new CustomEvent('toggle-ai-assistant'));
                                  setIsMobileMenuOpen(false);
                                }}
                                className="flex items-center gap-3 py-2 rounded-xl transition-all duration-200 group relative w-full text-left text-slate-400 hover:text-white hover:bg-white/[0.05] border-l-[3px] border-transparent pl-[9px] pr-3"
                              >
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-white/[0.03] group-hover:bg-white/[0.08]">
                                  <Icon className="w-[14px] h-[14px]" />
                                </div>
                                {!isSidebarCollapsed && <span className="text-[13px] font-bold tracking-tight leading-snug text-left">{item.name}</span>}
                              </button>
                            ) : (
                              <div className="flex items-center justify-between group/single">
                                <Link
                                  to={item.path}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className={cn(
                                    "flex-1 flex items-center gap-3 py-2 rounded-xl transition-all duration-200 group relative border-l-[3px] pl-[9px] pr-3 min-w-0",
                                    isActive
                                      ? "text-white"
                                      : "text-slate-400 hover:text-white hover:bg-white/[0.05] border-transparent"
                                  )}
                                  style={isActive ? { backgroundColor: accentBg, borderColor: accent } : {}}
                                >
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
                                    style={isActive ? { backgroundColor: accentIcon } : { backgroundColor: 'rgba(255,255,255,0.03)' }}
                                  >
                                    <Icon className="w-[14px] h-[14px]" />
                                  </div>
                                  {!isSidebarCollapsed && <span className="text-[13px] font-bold tracking-tight leading-snug text-left">{item.name}</span>}
                                </Link>
                                {!isSidebarCollapsed && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); togglePin(item.path); }}
                                    className={cn(
                                      "p-1 rounded-md transition-all shrink-0 mr-1",
                                      pinnedPaths.includes(item.path)
                                        ? "text-amber-400 opacity-100"
                                        : "text-slate-500 opacity-0 group-hover/single:opacity-100 hover:text-amber-300"
                                    )}
                                    title={pinnedPaths.includes(item.path) ? "Unpin from favorites" : "Pin to favorites"}
                                  >
                                    <Star className={cn("w-3 h-3", pinnedPaths.includes(item.path) && "fill-current")} />
                                  </button>
                                )}
                              </div>
                            )
                          ) : (
                            <button
                              onClick={() => setOpenDropdown(isOpen && !filterLower ? null : item.name)}
                              className={cn(
                                "flex items-center justify-between w-full px-3 py-2 rounded-xl transition-all duration-200 group relative",
                                isActive ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                              )}
                              style={isActive ? { backgroundColor: accentBg } : {}}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
                                  style={isActive ? { backgroundColor: accent, color: '#fff' } : { backgroundColor: 'rgba(255,255,255,0.03)' }}
                                >
                                  <Icon className="w-[14px] h-[14px]" />
                                </div>
                                {!isSidebarCollapsed && <span className="text-[13px] font-bold tracking-tight leading-snug text-left">{item.name}</span>}
                              </div>
                              {!isSidebarCollapsed && <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-200 opacity-40 shrink-0 ml-1", isOpen && "rotate-90 opacity-100")} />}
                            </button>
                          )}

                          {/* Animated sub-menu */}
                          <AnimatePresence initial={false}>
                            {hasSubItems && isOpen && !isSidebarCollapsed && (
                              <motion.div
                                key="submenu"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden"
                              >
                                <div
                                  className="mt-0.5 mb-1 ml-[24px] pl-2 space-y-px border-l"
                                  style={{ borderColor: `${accent}30` }}
                                >
                                  {item.subItems!.filter(sub => {
                                    if ((sub as any).roles && userRole?.role && !(sub as any).roles.includes(userRole.role)) return false;
                                    if (!filterLower) return true;
                                    return sub.name.toLowerCase().includes(filterLower) || item.name.toLowerCase().includes(filterLower) || section.title.toLowerCase().includes(filterLower);
                                  }).map((sub) => {
                                    const isSubActive = sub.exact
                                      ? location.pathname === sub.path
                                      : location.pathname.startsWith(sub.path);
                                    const isPinned = pinnedPaths.includes(sub.path);
                                    return (
                                      <div key={sub.name} className="flex items-center justify-between group/sub">
                                        <Link
                                          to={sub.path}
                                          onClick={() => setIsMobileMenuOpen(false)}
                                          className={cn(
                                            "flex-1 flex items-start gap-2 px-2 py-[6px] rounded-lg text-[11.5px] transition-all duration-150 min-w-0",
                                            isSubActive ? "font-semibold text-white" : "text-slate-300 hover:text-white hover:bg-white/[0.06] font-medium"
                                          )}
                                          style={isSubActive ? { color: accent, backgroundColor: accentBgSm } : {}}
                                        >
                                          <span
                                            className="w-1.5 h-1.5 rounded-full shrink-0 transition-all mt-1 self-start"
                                            style={isSubActive ? { backgroundColor: accent } : { backgroundColor: 'rgba(255,255,255,0.25)' }}
                                          />
                                          <span className="leading-snug text-left">{sub.name}</span>
                                        </Link>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            togglePin(sub.path);
                                          }}
                                          className={cn(
                                            "p-1 rounded-md transition-all shrink-0 ml-1",
                                            isPinned
                                              ? "text-amber-400 opacity-100"
                                              : "text-slate-500 opacity-0 group-hover/sub:opacity-100 hover:text-amber-300"
                                          )}
                                          title={isPinned ? "Unpin from favorites" : "Pin to favorites"}
                                        >
                                          <Star className={cn("w-3 h-3", isPinned && "fill-current")} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── User card / footer ── */}
        <div className="shrink-0 px-2 pt-2 pb-6 md:pb-3 border-t border-white/[0.06] safe-area-pb">
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-[11px] uppercase shadow-md">
                {(userRole?.role?.[0] ?? 'U').toUpperCase()}
              </div>
              <button onClick={cycleTheme} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors">
                <Palette className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleLogout} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-[11px] uppercase shadow-md shadow-indigo-900/40 shrink-0">
                {(userRole?.role?.[0] ?? 'U').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">{userRole?.role || 'User'}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)] shrink-0" />
                  <span className="text-[9.5px] text-slate-600 font-medium">Active session</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={cycleTheme} title="Switch theme" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors">
                  <Palette className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleLogout} title="Logout" className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto print:block">
        {/* Topbar */}
        <header className="aura-glass sticky top-0 h-14 border-b border-slate-200/50 flex items-center justify-between px-3 sm:px-6 z-40 shrink-0 print:hidden mx-2 sm:mx-6 mt-2 sm:mt-3 rounded-xl shadow-lg shadow-slate-200/20">
          {/* Left: hamburger + school name (mobile) / Date (desktop) */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="md:hidden p-2 bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-all active:scale-90 shrink-0"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden flex items-center gap-2 min-w-0">
              {schoolLogo ? (
                <img src={schoolLogo} alt={schoolName} className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0" />
              ) : (
                <div className="w-7 h-7 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                  <School className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="truncate text-slate-900 font-black text-xs uppercase tracking-wider max-w-[120px]">{schoolName}</span>
            </div>
            <div className="hidden md:block">
              <div className="text-[13px] font-bold text-slate-900">
                {new Date().toLocaleDateString('en-PK', { weekday:'short', day:'numeric', month:'long', year:'numeric' })}
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {schoolName}
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Quick search — desktop only */}
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k', bubbles: true }))}
              className="hidden sm:flex items-center gap-3 text-sm text-slate-500 bg-slate-100/80 hover:bg-slate-200/80 px-4 py-2 rounded-xl border border-slate-200/50 transition-all font-bold group shadow-inner"
            >
              <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <span className="text-xs">Search</span>
              <kbd className="text-[10px] px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-400 font-black shadow-sm">CTRL K</kbd>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={handleOpenNotifications}
                className="relative p-2 bg-slate-50 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200 active:scale-90"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden print:hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase">{unreadCount} NEW</span>
                    )}
                  </div>
                  <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center text-slate-400">
                        <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-xs font-bold uppercase tracking-widest">Inbox is clear</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.map((notif, idx) => (
                          <div key={idx} className="p-5 hover:bg-slate-50 transition-colors cursor-pointer">
                            <h4 className="text-sm font-black text-slate-900 mb-1">{notif.title}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">{notif.message}</p>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {formatDate(notif.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Role & Portal View Switcher */}
            <div className="relative" ref={portalMenuRef}>
              <button
                type="button"
                onClick={() => setShowPortalMenu(!showPortalMenu)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
                title="Switch Portal Views"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="capitalize font-black text-[11px] text-slate-800">
                  {userRole?.role ? userRole.role.replace('_', ' ') : 'Role'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showPortalMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Role</p>
                    <p className="font-bold text-slate-800 capitalize">{userRole?.role?.replace('_', ' ')}</p>
                  </div>

                  <p className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Portal Views</p>
                  <Link
                    to="/dashboard"
                    onClick={() => setShowPortalMenu(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-bold transition"
                  >
                    <span>🏫 Admin Dashboard</span>
                    {location.pathname === '/dashboard' && <span className="text-[10px] text-indigo-600 font-black">Active</span>}
                  </Link>

                  <a
                    href="/parent-portal"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowPortalMenu(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-bold transition"
                  >
                    <span>👨‍👩‍👧 Parent Portal</span>
                    <span className="text-[10px] text-slate-400">Preview ↗</span>
                  </a>

                  <a
                    href="/student-portal"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowPortalMenu(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-bold transition"
                  >
                    <span>🎓 Student Portal</span>
                    <span className="text-[10px] text-slate-400">Preview ↗</span>
                  </a>

                  {allRoles.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Assigned Roles</p>
                      {allRoles.map((r, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            switchRole(r);
                            setShowPortalMenu(false);
                            if (r.role === 'teacher') navigate('/teacher-dashboard');
                            else navigate('/dashboard');
                          }}
                          className={`w-full text-left flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            userRole?.role === r.role ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <span className="capitalize">{r.role.replace('_', ' ')}</span>
                          {userRole?.role === r.role && <span className="text-[10px] font-black">Active</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Density toggle — desktop only */}
            <button
              onClick={toggleDensity}
              title={densityCompact ? 'Switch to Comfortable view' : 'Switch to Compact view'}
              className={cn(
                "hidden sm:flex items-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl border transition-all uppercase tracking-[0.1em]",
                densityCompact
                  ? "text-indigo-600 bg-indigo-50 border-indigo-200"
                  : "text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200"
              )}
            >
              <BarChart2 className="w-4 h-4" />
              {densityCompact ? 'Compact ✓' : 'Compact'}
            </button>



            {/* Logout — icon only on mobile, icon+text on desktop */}
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex items-center gap-2 text-[11px] font-black text-red-500 hover:text-white hover:bg-red-600 border border-red-200 px-2.5 sm:px-4 py-2 rounded-xl transition-all uppercase tracking-[0.1em]"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Demo expiry warning banner */}
        {demoExpiry && !demoBannerDismissed && (
          <div className="print:hidden mx-2 sm:mx-6 mt-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800 flex-1">
              ⏳ Your free demo expires in <strong className="text-amber-900">{demoExpiry.daysLeft} day{demoExpiry.daysLeft !== 1 ? 's' : ''}</strong>
              {' '}({demoExpiry.expiresAt.toLocaleDateString('en-PK')}).
              Contact us to continue using the system.
            </p>
            <button
              onClick={() => setDemoBannerDismissed(true)}
              className="text-amber-500 hover:text-amber-700 font-bold text-xs shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dashboard Alerts bar */}
        <div className="print:hidden">
          <DashboardAlerts />
        </div>

        {/* ── Global Print Header — hidden on screen, shown at top of every print ── */}
        {!location.pathname.startsWith('/result') && !location.pathname.startsWith('/diary') && (
          <div className="hidden print:flex flex-col items-center py-5 border-b-2 border-slate-300 mb-4 gap-1">
            {schoolLogo
              ? <img src={schoolLogo} alt={schoolName} className="w-14 h-14 object-contain mb-1" />
              : <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center mb-1">
                  <School className="w-8 h-8 text-white" />
                </div>
            }
            <h1 className="text-xl font-black uppercase tracking-widest text-slate-900">{schoolName}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {formatDate(new Date())}
            </p>
          </div>
        )}

        {/* Page Content */}
        <main className="theme-shell flex-1 relative px-6 pt-6 pb-24 md:pb-6 print:p-0 overflow-auto print:overflow-visible print:block" data-density={densityCompact ? 'compact' : 'comfortable'}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -15, filter: 'blur(8px)' }}
              transition={{
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1]
              }}
            >
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-center justify-around px-2 py-1 safe-area-pb no-print transition-all duration-200",
          isMobileMenuOpen ? "opacity-0 pointer-events-none translate-y-2" : "opacity-100 translate-y-0"
        )}>
          {(() => {
            const defaultItem = { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' };
            const allowedItems: any[] = [];
            
            if (userRole?.role) {
              navSections.forEach(section => {
                if (!section.roles.includes(userRole.role)) return;
                if (userRole.role !== 'admin' && (section as any).id) {
                  const permissions = userRole.permissions?.modules;
                  if (permissions && permissions[(section as any).id] === false) return;
                }
                section.items.forEach(item => {
                  if (item.roles.includes(userRole.role) && item.path !== '/dashboard') {
                    allowedItems.push({ icon: item.icon, label: item.name.length > 10 ? item.name.split(' ')[0] : item.name, path: item.path });
                  }
                });
              });
            }
            
            // Take up to 3 more items
            const navItems = [defaultItem, ...allowedItems.slice(0, 3), { icon: Menu, label: 'Menu', path: '#menu' }];
            
            return navItems.map(({ icon: Icon, label, path }) => {
              const isMenu = path === '#menu';
              const isActive = !isMenu && location.pathname.startsWith(path);
              
              if (isMenu) {
                return (
                  <button
                    key={path}
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all text-slate-400 hover:text-slate-600 active:scale-95"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
                  </button>
                );
              }

              if (path === '/ai-assistant') {
                return (
                  <button
                    key={path}
                    onClick={() => window.dispatchEvent(new CustomEvent('toggle-ai-assistant'))}
                    className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all text-slate-400 hover:text-indigo-600 active:scale-95"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[9px] font-black uppercase tracking-wider truncate max-w-[60px] text-center">{label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all active:scale-95 ${
                    isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-black uppercase tracking-wider truncate max-w-[60px] text-center">{label}</span>
                </Link>
              );
            });
          })()}
        </nav>
      </div>
    </div>

      {/* Global Command Palette */}
      <CommandPalette />

      {/* Global AI Assistant */}
      {/* <AiAssistant /> */}

      {/* ── Session expiry warning modal ── */}
      <AnimatePresence>
        {sessionWarning && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center"
            >
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Session Expiring Soon</h2>
              <p className="text-slate-500 text-sm mb-1">
                Your session will expire in{' '}
                <span className="font-bold text-amber-600">
                  {Math.floor(sessionSecondsLeft / 60)}m {sessionSecondsLeft % 60}s
                </span>
              </p>
              <p className="text-slate-400 text-xs mb-6">Any unsaved work will be lost.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => signOut()}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Log Out
                </button>
                <button
                  onClick={async () => {
                    await supabase.auth.refreshSession();
                    setSessionWarning(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
                >
                  Stay Logged In
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
