import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Globe, GraduationCap, Users, BookOpen, LayoutDashboard, CreditCard, CalendarCheck, FileText, Settings as SettingsIcon, Star, MessageSquare, Calendar, CalendarOff, Package, AlertTriangle, Bot, Briefcase, ClipboardList, ChevronRight, UserPlus, Upload, ShieldCheck, Award, LineChart, Menu, X, Wallet, Key, PiggyBank, BarChart3, Banknote, TrendingUp, UserX, ClipboardCheck, BarChart2, Wifi, Ticket, Search, DollarSign, Scale, Library, Home, Bell, Palette, School, Shield, Trash2, Clock, Box } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import CommandPalette from '../components/CommandPalette';
import DashboardAlerts from '../components/DashboardAlerts';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { NAV_SECTIONS } from '../constants/navigation';

export default function DashboardLayout() {
  const { t, i18n } = useTranslation();
  const { signOut, userRole } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Initialize dropdown based on current route
  useEffect(() => {
    if (location.pathname.startsWith('/students')) setOpenDropdown('Students');
    else if (location.pathname.startsWith('/classes')) setOpenDropdown('Classes & Subjects');
    else if (location.pathname.startsWith('/result')) setOpenDropdown('Result Module');
    else if (location.pathname.startsWith('/fees')) setOpenDropdown('Fee Management');
    else if (location.pathname.startsWith('/expenses')) setOpenDropdown('Expenses');
    else if (location.pathname.startsWith('/payroll')) setOpenDropdown('Payroll');
    else if (location.pathname.startsWith('/accounting')) setOpenDropdown('Accounting');
    else if (location.pathname.startsWith('/library')) setOpenDropdown('Library');
    else if (location.pathname.startsWith('/frontdesk')) setOpenDropdown('Front Desk');
  }, []);

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

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ur' : 'en';
    i18n.changeLanguage(newLang);
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
        "fixed md:sticky md:top-0 inset-y-0 left-0 z-50 w-[252px] h-screen flex flex-col shrink-0 no-print",
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
            <div className="min-w-0">
              <p className="text-[11px] font-black text-white/90 uppercase tracking-[0.14em] truncate leading-tight font-display">
                {schoolName}
              </p>
              <p className="text-[9px] font-semibold text-indigo-400/80 uppercase tracking-[0.22em] mt-0.5">
                ERP Platform
              </p>
            </div>
          </div>
          <button
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-4 h-4" />
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
                <p className="px-3 mb-1 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] select-none opacity-60">
                  {section.title}
                </p>

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
                          <Link
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group relative",
                              isActive 
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                                : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                              isActive ? "bg-white/20" : "bg-white/[0.03] group-hover:bg-white/[0.08]"
                            )}>
                              <Icon className="w-[14px] h-[14px]" />
                            </div>
                            <span className="truncate text-[13px] font-bold tracking-tight">{item.name}</span>
                          </Link>
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
                              <span className="truncate text-[13px] font-bold tracking-tight">{item.name}</span>
                            </div>
                            <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-200 opacity-40", isOpen && "rotate-90 opacity-100")} />
                          </button>
                        )}

                        {/* Animated sub-menu */}
                        <AnimatePresence initial={false}>
                          {hasSubItems && openDropdown === item.name && (
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
        <div className="shrink-0 px-2.5 pt-2 pb-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] transition-colors group">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-[11px] uppercase shadow-md shadow-indigo-900/40 shrink-0">
              {(userRole?.role?.[0] ?? 'U').toUpperCase()}
            </div>
            {/* Role + status */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">
                {userRole?.role || 'User'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)] shrink-0" />
                <span className="text-[9.5px] text-slate-600 font-medium">Active session</span>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={cycleTheme}
                title="Switch theme"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/10 transition-colors"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto print:block">
        {/* Topbar - Slim Enterprise Style */}
        <header className="aura-glass sticky top-0 h-16 border-b border-slate-200/50 flex items-center justify-between px-6 z-40 shrink-0 print:hidden mx-6 mt-3 rounded-xl shadow-lg shadow-slate-200/20">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2.5 bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-all active:scale-90"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="md:hidden font-black text-sm flex items-center gap-3 min-w-0 font-display">
              {schoolLogo ? (
                <img src={schoolLogo} alt={`${schoolName} logo`} className="w-9 h-9 rounded-xl object-cover border border-slate-200 p-1 shadow-sm" />
              ) : (
                <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <School className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="truncate text-slate-900 uppercase tracking-widest leading-none">{schoolName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k', bubbles: true }))}
              className="hidden sm:flex items-center gap-3 text-sm text-slate-500 bg-slate-100/80 hover:bg-slate-200/80 px-4 py-2.5 rounded-xl border border-slate-200/50 transition-all font-bold group shadow-inner"
            >
              <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <span className="text-xs">Quick Search</span>
              <kbd className="text-[10px] px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-400 font-black shadow-sm tracking-tighter">CTRL K</kbd>
            </button>
            
            <div className="relative">
              <button 
                onClick={handleOpenNotifications}
                className="relative p-2.5 bg-slate-50 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200 active:scale-90"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white ring-4 ring-red-500/10"></span>
                )}
              </button>
              
              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-4 w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden print:hidden aura-card animate-aura-in">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Notifications</h3>
                    <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase shadow-lg shadow-indigo-100">{notifications.length} NEW</span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center text-slate-400">
                        <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-xs font-bold uppercase tracking-widest">Inbox is clear</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.map((notif, idx) => (
                          <div key={idx} className="p-6 hover:bg-slate-50 transition-colors group cursor-pointer">
                            <h4 className="text-sm font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{notif.title}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">{notif.message}</p>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {new Date(notif.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-[11px] font-black text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-4 py-2.5 rounded-xl border border-slate-200 transition-all uppercase tracking-[0.1em] hidden sm:flex"
            >
              <Globe className="w-4 h-4" />
              {i18n.language === 'en' ? 'اردو' : 'English'}
            </button>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-[11px] font-black text-red-500 hover:text-white hover:bg-red-600 border border-red-100 px-4 py-2.5 rounded-xl transition-all uppercase tracking-[0.1em] shadow-sm shadow-red-50"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Terminate</span>
            </button>
          </div>
        </header>

        {/* Dashboard Alerts bar */}
        <div className="print:hidden">
          <DashboardAlerts />
        </div>

        {/* Page Content */}
        <main className="theme-shell flex-1 relative p-6 print:p-0 overflow-auto print:overflow-visible print:block">
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
              className="h-full"
            >
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>

      {/* Global Command Palette */}
      <CommandPalette />
    </>
  );
}
