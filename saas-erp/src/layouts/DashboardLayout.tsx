import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { LogOut, GraduationCap, Users, BookOpen, LayoutDashboard, CreditCard, CalendarCheck, FileText, Settings as SettingsIcon, Star, MessageSquare, Calendar, CalendarOff, Package, AlertTriangle, Bot, Briefcase, ClipboardList, ChevronRight, ChevronLeft, UserPlus, Upload, ShieldCheck, Award, LineChart, Menu, X, Wallet, Key, PiggyBank, BarChart3, Banknote, TrendingUp, UserX, ClipboardCheck, BarChart2, Wifi, Ticket, Search, DollarSign, Scale, Library, Home, Bell, Palette, School, Shield, Trash2, Clock, Box } from 'lucide-react';
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

  const { signOut, userRole } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [densityCompact, setDensityCompact] = useState<boolean>(() => localStorage.getItem('density') === 'compact');

  const toggleDensity = () => {
    const next = !densityCompact;
    setDensityCompact(next);
    localStorage.setItem('density', next ? 'compact' : 'comfortable');
  };

  // Initialize dropdown based on current route
  useEffect(() => {
    if (location.pathname.startsWith('/students')) setOpenDropdown('Students');
    else if (location.pathname.startsWith('/classes')) setOpenDropdown('Classes & Subjects');
    else if (location.pathname.startsWith('/result')) setOpenDropdown('Exam and Results');
    else if (location.pathname.startsWith('/fees')) setOpenDropdown('Fee Management');
    else if (location.pathname.startsWith('/expenses')) setOpenDropdown('Expenses');
    else if (location.pathname.startsWith('/payroll')) setOpenDropdown('Payroll');
    else if (location.pathname.startsWith('/accounting')) setOpenDropdown('Accounting');
    else if (location.pathname.startsWith('/library')) setOpenDropdown('Library');
    else if (location.pathname.startsWith('/frontdesk')) setOpenDropdown('Front Desk');
    else if (location.pathname.startsWith('/transport')) setOpenDropdown('Transport');
  }, [location.pathname]);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [schoolBrand, setSchoolBrand] = useState<{ name: string; logo_url: string | null } | null>(null);

  useEffect(() => {
    if (userRole?.school_id) {
       fetchNotifications();
       fetchSchoolBrand();
    }
  }, [userRole]);

  const fetchSchoolBrand = async () => {
    if (!userRole?.school_id) return;
    const { data, error } = await supabase
      .from('schools')
      .select('name, logo_url')
      .eq('id', userRole.school_id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching school branding:', error);
      return;
    }

    if (data) {
      setSchoolBrand({
        name: data.name || 'School Dashboard',
        logo_url: data.logo_url || null,
      });
    }
  };

  const fetchNotifications = async () => {
    if (!userRole) return;
    let query = supabase.from('notifications').select('*').eq('school_id', userRole.school_id).order('created_at', { ascending: false }).limit(10);
    
    if (userRole.role === 'teacher' || userRole.role === 'staff') {
       query = query.in('target_audience', ['all', 'teachers']);
    } else if (userRole.role === 'parent') {
       const { data: parentData } = await supabase.from('parents').select('id').eq('user_id', userRole.user_id).single();
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

  const ALL_ADMIN = ['admin', 'principal', 'director'];
  const ALL_STAFF = ['admin', 'principal', 'director', 'staff'];
  const ALL_ACADEMIC = ['admin', 'principal', 'director', 'teacher', 'staff'];
  const ALL_FINANCE = ['admin', 'staff', 'accountant', 'principal', 'director'];
  const ALL_REPORTS = ['admin', 'staff', 'accountant', 'principal', 'director'];

  const navSections = NAV_SECTIONS;

  const schoolName = schoolBrand?.name || 'School Dashboard';
  const schoolLogo = schoolBrand?.logo_url || null;
  return (
    <>
      <div className="theme-shell h-screen print:h-auto print:bg-white flex overflow-hidden print:overflow-visible print:block">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden no-print"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={cn(
        `fixed md:sticky md:top-0 inset-y-0 left-0 z-50 h-screen flex flex-col shrink-0 no-print transition-all duration-300 ${isSidebarCollapsed ? 'w-[64px]' : 'w-[220px]'}`,
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
        <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3 px-2.5">
          {navSections.filter(section => {
            if (!userRole?.role) return false;
            if (!section.roles.includes(userRole.role)) return false;
            // Apply module permissions for all non-admin roles
            if (userRole.role !== 'admin' && (section as any).id) {
              const permissions = userRole.permissions?.modules;
              if (permissions && permissions[(section as any).id] === false) return false;
            }
            return true;
          }).map((section, sectionIdx) => {
            const visibleItems = section.items.filter(item => userRole?.role && item.roles.includes(userRole.role));
            if (visibleItems.length === 0) return null;

            return (
              <div
                key={section.title}
                className={cn("mb-1", sectionIdx > 0 && "mt-3 pt-3 border-t border-white/[0.05]")}
              >
                {/* Section label */}
                {!isSidebarCollapsed && <p className="px-3 mb-1 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] select-none opacity-60">{section.title}</p>}

                <div className="space-y-px">
                  {visibleItems.map((item) => {
                    const hasSubItems = !!(item.subItems && item.subItems.length > 0);
                    const isActive = hasSubItems
                      ? location.pathname.startsWith(item.path)
                      : location.pathname === item.path;
                    const Icon = item.icon;
                    const isOpen = openDropdown === item.name;
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
                              className={cn(
                                "flex items-center gap-3 py-2 rounded-xl transition-all duration-200 group relative w-full text-left",
                                "text-slate-400 hover:text-white hover:bg-white/[0.05] border-l-[3px] border-transparent pl-[9px] pr-3"
                              )}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-white/[0.03] group-hover:bg-white/[0.08]"
                              )}>
                                <Icon className="w-[14px] h-[14px]" />
                              </div>
                              {!isSidebarCollapsed && <span className="truncate text-[13px] font-bold tracking-tight">{item.name}</span>}
                            </button>
                          ) : (
                            <Link
                              to={item.path}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-3 py-2 rounded-xl transition-all duration-200 group relative",
                                isActive 
                                  ? "bg-indigo-500/20 border-l-[3px] border-indigo-400 text-indigo-100 pl-[9px] pr-3" 
                                  : "text-slate-400 hover:text-white hover:bg-white/[0.05] border-l-[3px] border-transparent pl-[9px] pr-3"
                              )}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                isActive ? "bg-white/20" : "bg-white/[0.03] group-hover:bg-white/[0.08]"
                              )}>
                                <Icon className="w-[14px] h-[14px]" />
                              </div>
                              {!isSidebarCollapsed && <span className="truncate text-[13px] font-bold tracking-tight">{item.name}</span>}
                            </Link>
                          )
                        ) : (
                          <button
                            onClick={() => setOpenDropdown(isOpen ? null : item.name)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2 rounded-xl transition-all duration-200 group relative",
                              isActive ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                isActive ? "bg-indigo-600 text-white" : "bg-white/[0.03] group-hover:bg-white/[0.08]"
                              )}>
                                <Icon className="w-[14px] h-[14px]" />
                              </div>
                              {!isSidebarCollapsed && <span className="truncate text-[13px] font-bold tracking-tight">{item.name}</span>}
                            </div>
                            {!isSidebarCollapsed && <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-200 opacity-40", isOpen && "rotate-90 opacity-100")} />}
                          </button>
                        )}

                        {/* Animated sub-menu */}
                        <AnimatePresence initial={false}>
                          {hasSubItems && openDropdown === item.name && !isSidebarCollapsed && (
                            <motion.div
                              key="submenu"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="mt-0.5 mb-1 ml-[38px] pl-3 border-l border-white/[0.07] space-y-px">
                                {item.subItems!.filter(sub => !(sub as any).roles || (userRole?.role && (sub as any).roles.includes(userRole.role))).map((sub) => {
                                  const isSubActive = sub.exact
                                    ? location.pathname === sub.path
                                    : location.pathname.startsWith(sub.path);
                                  return (
                                    <Link
                                      key={sub.name}
                                      to={sub.path}
                                      onClick={() => setIsMobileMenuOpen(false)}
                                      className={cn(
                                        "flex items-center gap-2 px-2 py-[5px] rounded-md text-[11.5px] transition-all duration-150 group",
                                        isSubActive
                                          ? "text-indigo-400 bg-indigo-500/10 font-semibold"
                                          : "text-slate-300 hover:text-white hover:bg-white/[0.06] font-medium"
                                      )}
                                    >
                                      <span className="w-1 h-1 rounded-full shrink-0 transition-all" />
                                      <span className="truncate">{sub.name}</span>
                                    </Link>
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
              </div>
            );
          })}
        </nav>

        {/* ── User card / footer ── */}
        <div className="shrink-0 px-2 pt-2 pb-3 border-t border-white/[0.06]">
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
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex items-center justify-around px-2 py-1 safe-area-pb no-print">
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
      <AiAssistant />
    </>
  );
}
