import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Globe, GraduationCap, Users, BookOpen, LayoutDashboard, CreditCard, CalendarCheck, FileText, Settings as SettingsIcon, Star, MessageSquare, Calendar, CalendarOff, Package, AlertTriangle, Bot, Briefcase, ClipboardList, ChevronDown, ChevronRight, UserPlus, Upload, ShieldCheck, Award, LineChart, Menu, X, Wallet, Key, PiggyBank, BarChart3, Banknote, TrendingUp, UserX, ClipboardCheck, BarChart2, Wifi, Ticket, Search, DollarSign, Scale, Library, Home, Bell, Palette, School, Shield, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import CommandPalette from '../components/CommandPalette';
import DashboardAlerts from '../components/DashboardAlerts';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { supabase } from '../lib/supabase';

export default function DashboardLayout() {
  const { t, i18n } = useTranslation();
  const { signOut, userRole } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  // Initialize dropdowns based on current route
  useEffect(() => {
    const newDropdowns: Record<string, boolean> = {};
    if (location.pathname.startsWith('/students')) newDropdowns['Students Module'] = true;
    if (location.pathname.startsWith('/classes')) newDropdowns['Classes Module'] = true;
    if (location.pathname.startsWith('/result')) newDropdowns['Result Module'] = true;
    if (location.pathname.startsWith('/fees')) newDropdowns['Fee Management'] = true;
    if (location.pathname.startsWith('/expenses')) newDropdowns['Expense Module'] = true;
    if (location.pathname.startsWith('/payroll')) newDropdowns['Payroll'] = true;
    if (location.pathname.startsWith('/accounting')) newDropdowns['Accounting'] = true;
    if (location.pathname.startsWith('/library')) newDropdowns['Library'] = true;
    if (location.pathname.startsWith('/frontdesk')) newDropdowns['Front Desk'] = true;
    setOpenDropdowns(prev => ({ ...prev, ...newDropdowns }));
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

  const navSections = [
    {
      title: 'Core Operations',
      id: 'students',
      roles: ['admin', 'teacher', 'staff', 'parent'],
      items: [
        { name: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'staff', 'parent'] },
        { 
          name: 'Students Module', 
          path: '/students', 
          icon: GraduationCap, 
          roles: ['admin', 'teacher', 'staff', 'parent'],
          subItems: [
            { name: 'Student List', path: '/students', exact: true, icon: Users },
            { name: 'Register New Student', path: '/students/register', icon: UserPlus },
            { name: 'Admission Form', path: '/students/admission-form', icon: FileText },
            { name: 'Bulk Enrollment', path: '/students/bulk-enrollment', icon: Upload },
            { name: 'Promote Students', path: '/students/promote', icon: ShieldCheck },
            { name: 'Digital ID Cards', path: '/students/id-cards', icon: CreditCard },
            { name: 'Leaving Certificate', path: '/students/leaving-certificate', icon: Award },
            { name: 'Birth Certificate', path: '/students/birth-certificate', icon: Award },
            { name: 'Character Certificate', path: '/students/character-certificate', icon: Award },
            { name: 'Progress Report', path: '/students/progress-report', icon: LineChart },
            { name: 'Printable Reports', path: '/students/reports', icon: FileText },
            { name: 'Customize Form', path: '/students/customize-form', icon: SettingsIcon },
            { name: 'Parent SMS History', path: '/students/parent-sms-history', icon: MessageSquare }
          ]
        },
        { name: 'Parents', path: '/parents', icon: Users, roles: ['admin', 'staff', 'parent'] },
        { name: 'Staff Management', path: '/staff', icon: Briefcase, roles: ['admin'] },
        { 
          name: 'Classes & Subjects', 
          path: '/classes', 
          icon: BookOpen, 
          roles: ['admin', 'teacher', 'staff'],
          subItems: [
            { name: 'Class & Section Management', path: '/classes/manage', exact: true, icon: BookOpen },
            { name: 'Subject Management', path: '/classes/subjects', icon: FileText }
          ]
        },
      ]
    },
    {
      title: 'Academic Suite',
      id: 'academic',
      roles: ['admin', 'teacher', 'staff', 'parent'],
      items: [
        { 
          name: 'Attendance Module', 
          path: '/attendance', 
          icon: CalendarCheck, 
          roles: ['admin', 'teacher', 'staff', 'parent'],
          subItems: [
            { name: 'Fast-Action Roll Call', path: '/attendance', exact: true, icon: CalendarCheck },
            { name: 'Staff Attendance', path: '/attendance/staff', icon: Briefcase },
            { name: 'Daily Report', path: '/attendance/daily-report', icon: ClipboardCheck },
            { name: 'Absent Student List', path: '/attendance/absent-list', icon: UserX },
            { name: 'Master Registers', path: '/attendance/monthly-report', icon: LineChart },
            { name: 'Sessional Report', path: '/attendance/sessional-report', icon: BarChart2 },
            { name: 'SMS / WhatsApp History', path: '/attendance/sms-history', icon: MessageSquare },
            { name: 'Smart Kiosk (Web QR)', path: '/attendance/scanner', icon: Wifi },
          ]
        },
        { 
          name: 'Result Module', 
          path: '/result', 
          icon: FileText, 
          roles: ['admin', 'teacher', 'staff', 'parent'],
          subItems: [
            { name: 'Step 1: Exam Types', path: '/result/exam-types', icon: SettingsIcon },
            { name: 'Step 2: Schedule Papers', path: '/result/schedule', icon: Calendar },
            { name: 'Step 3: Enter Results', path: '/result/add-result', exact: true, icon: Star },
            { name: 'Consolidated Sheet', path: '/result/consolidated', icon: LayoutDashboard },
            { name: 'Individual Report Cards', path: '/result/reporting', icon: LineChart },
            { name: 'Grading Settings', path: '/result/settings', icon: SettingsIcon },
            { name: 'Roll Number Slips', path: '/result/roll-slips', icon: Ticket },
          ]
        },
        { name: 'Timetable', path: '/timetable', icon: Calendar, roles: ['admin', 'teacher', 'staff', 'parent'] },
        { name: 'Teacher Diary', path: '/diary', icon: ClipboardList, roles: ['admin', 'teacher', 'staff'] },
        {
          name: 'Leave Management',
          path: '/leave',
          icon: CalendarOff,
          roles: ['admin', 'teacher', 'staff'],
          subItems: [
            { name: 'Student Leave', path: '/leave/student', icon: GraduationCap },
            { name: 'Staff Leave & Balance', path: '/leave/staff', icon: Briefcase },
          ]
        },
        { name: 'Evaluation', path: '/evaluation', icon: Star, roles: ['admin', 'teacher', 'parent'] },
      ]
    },
    {
      title: 'Financial Module',
      id: 'finance',
      roles: ['admin', 'staff', 'parent'],
      items: [
        { 
          name: 'Fee Management',
          path: '/fees',
          icon: CreditCard,
          roles: ['admin', 'staff', 'parent'],
          subItems: [
            { name: 'Fee Packages & Matrix', path: '/fees/criteria', icon: SettingsIcon },
            { name: 'Invoicing & Generator', path: '/fees/invoices', icon: FileText },
            { name: 'Student Ledgers & Payments', path: '/fees/student-detail', icon: Users },
            { name: 'Challan Form Settings', path: '/fees/challan-settings', icon: ClipboardList },
            { name: 'Fine Policy', path: '/fees/fine-policy', icon: AlertTriangle },
            { name: 'Discounts & Scholarships', path: '/fees/discounts', icon: Award },
            { name: 'Advance Fee', path: '/fees/advance-fee', icon: TrendingUp },
            { name: 'Average Fee Report', path: '/fees/average-fee', icon: BarChart2 },
            { name: 'Fee Templates', path: '/fees/fee-templates', icon: Ticket },
            { name: 'Student Fee History', path: '/fees/fee-history', icon: BookOpen },
            { name: 'Easy Fee Entry', path: '/fees/easy-fee', icon: Wallet },
          ]
        },
        { 
          name: 'Expense Module', 
          path: '/expenses', 
          icon: Wallet, 
          roles: ['admin', 'staff'],
          subItems: [
            { name: 'Add Daily Expenses', path: '/expenses/add-daily', exact: true, icon: Wallet },
            { name: 'Expense Heads Config', path: '/expenses/heads', icon: SettingsIcon },
            { name: 'Unified Day Book / Ledger', path: '/expenses/ledger', icon: LineChart },
            { name: 'Budget Planner', path: '/expenses/budget', icon: PiggyBank },
            { name: 'Payment Sources', path: '/expenses/payment-sources', icon: Banknote },
            { name: 'Expense Reports', path: '/expenses/reports', icon: BarChart3 },
            { name: 'Profit & Loss', path: '/expenses/p-and-l', icon: TrendingUp },
          ]
        },
        {
          name: 'Payroll',
          path: '/payroll',
          icon: DollarSign,
          roles: ['admin'],
          subItems: [
            { name: 'Process Payroll', path: '/payroll', exact: true, icon: DollarSign },
            { name: 'Salary Slips', path: '/payroll/slips', icon: FileText },
            { name: 'Salary Components', path: '/payroll/allowances', icon: SettingsIcon },
            { name: 'Payroll Reports', path: '/payroll/reports', icon: BarChart2 },
          ]
        },
        {
          name: 'Accounting',
          path: '/accounting',
          icon: Scale,
          roles: ['admin'],
          subItems: [
            { name: 'Chart of Accounts', path: '/accounting/chart-of-accounts', icon: BookOpen },
            { name: 'Journal Entries', path: '/accounting/journal', icon: FileText },
            { name: 'Trial Balance', path: '/accounting/trial-balance', icon: Scale },
            { name: 'Balance Sheet', path: '/accounting/balance-sheet', icon: BarChart2 },
          ]
        },
      ]
    },
    {
      title: 'School Services',
      id: 'services',
      roles: ['admin', 'staff'],
      items: [
        {
          name: 'Library',
          path: '/library',
          icon: Library,
          roles: ['admin', 'staff'],
          subItems: [
            { name: 'Book Catalog', path: '/library/catalog', icon: BookOpen },
            { name: 'Issue / Return', path: '/library/issues', icon: BarChart2 },
            { name: 'Members', path: '/library/members', icon: Users },
          ]
        },
        {
          name: 'Front Desk',
          path: '/frontdesk',
          icon: Home,
          roles: ['admin', 'staff'],
          subItems: [
            { name: 'Admission Inquiries', path: '/frontdesk/inquiries', icon: UserPlus },
            { name: 'Visitor Book', path: '/frontdesk/visitors', icon: Users },
            { name: 'Notice Board', path: '/frontdesk/notices', icon: Bell },
          ]
        },
        { name: 'Family Groups', path: '/family', icon: Users, roles: ['admin', 'staff'] },
      ]
    },
    {
      title: 'Reporting Suite',
      id: 'reports',
      roles: ['admin', 'staff'],
      items: [
        { 
          name: 'Executive Reports', 
          path: '/reports', 
          icon: BarChart3, 
          roles: ['admin', 'staff'],
          subItems: [
            { name: 'Master Summary', path: '/reports/master-summary', icon: FileText },
          ]
        },
      ]
    },
    {
      title: 'Support & Admin',
      id: 'support',
      roles: ['admin', 'teacher', 'staff', 'parent'],
      items: [
        { name: 'Communication', path: '/communication', icon: MessageSquare, roles: ['admin', 'teacher', 'staff'] },
        { name: 'Inventory', path: '/inventory', icon: Package, roles: ['admin', 'staff'] },
        { name: 'Complaints', path: '/complaints', icon: AlertTriangle, roles: ['admin', 'teacher', 'staff', 'parent'] },
      ]
    },
    {
      title: 'System Settings',
      id: 'settings',
      roles: ['admin', 'teacher'],
      items: [
        { name: 'AI Assistant', path: '/ai-assistant', icon: Bot, roles: ['admin', 'teacher'] },
        { name: 'Credential Manager', path: '/credentials', icon: Key, roles: ['admin'] },
        { name: 'Settings', path: '/settings', icon: SettingsIcon, roles: ['admin'] },
      ]
    },
    {
      title: 'Director Control',
      roles: ['admin'],
      items: [
        { name: 'Permission Manager', path: '/settings/permissions', icon: Shield, roles: ['admin'] },
        { name: 'Manage Trashbin', path: '/settings/trashbin', icon: Trash2, roles: ['admin'] },
      ]
    }
  ];

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

      {/* Sidebar */}
      <aside className={cn(
        "theme-sidebar fixed md:sticky md:top-0 inset-y-0 left-0 z-50 w-64 h-screen border-r flex flex-col transform transition-transform duration-300 ease-in-out shrink-0 no-print",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b theme-border bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {schoolLogo ? (
              <img src={schoolLogo} alt={`${schoolName} logo`} className="w-10 h-10 rounded-xl object-cover border theme-border theme-surface-muted p-1 shadow-sm shrink-0" />
            ) : (
              <div className="w-10 h-10 theme-brand rounded-xl flex items-center justify-center shadow-sm shrink-0">
                <School className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-black theme-text-primary uppercase tracking-[0.1em] leading-tight">{schoolName}</h1>
              <p className="text-[10px] theme-text-muted font-bold uppercase tracking-wider">ERP Suite</p>
            </div>
          </div>
          <button 
            className="md:hidden theme-icon-button"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-6 custom-scrollbar">
          {navSections.filter(section => {
             if (!userRole?.role) return false;
             if (!section.roles.includes(userRole.role)) return false;
             
             // For staff, check granular permissions if they exist
             if (userRole.role === 'staff' && (section as any).id) {
                const sectionId = (section as any).id;
                const permissions = (userRole as any).permissions?.modules;
                if (permissions && permissions[sectionId] === false) return false;
             }
             
             return true;
          }).map((section) => {
            const visibleItems = section.items.filter(item => userRole?.role && item.roles.includes(userRole.role));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-2 pt-2 first:pt-0">
                <h3 className="px-4 text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] mb-1.5 opacity-80">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const hasSubItems = item.subItems && item.subItems.length > 0;
                    const isActive = hasSubItems 
                      ? location.pathname.startsWith(item.path)
                      : location.pathname === item.path;
                    
                    const isOpen = !!openDropdowns[item.name];
                    const Icon = item.icon;

                    return (
                      <div key={item.name}>
                        {hasSubItems ? (
                          <button
                            onClick={() => setOpenDropdowns(prev => ({ ...prev, [item.name]: !isOpen }))}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-lg font-bold text-sm transition-all mb-0.5",
                              isOpen || isActive
                                ? "theme-nav-active" 
                                : "theme-nav-item"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={cn("w-4 h-4", (isOpen || isActive) ? "theme-icon-active" : "theme-icon-muted")} />
                              {item.name}
                            </div>
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <Link
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg font-bold text-sm transition-all mb-0.5 group",
                              isActive 
                                ? "theme-nav-active shadow-sm" 
                                : "theme-nav-item"
                            )}
                          >
                            <Icon className={cn("w-4 h-4", isActive ? "theme-icon-active" : "theme-icon-muted")} />
                            {item.name}
                          </Link>
                        )}

                        {/* Render SubMenu */}
                        {hasSubItems && isOpen && (
                          <div className="ml-4 pl-3 border-l theme-border-soft space-y-1 mt-1 mb-2">
                            {item.subItems.map((sub) => {
                              const SubIcon = sub.icon;
                              const isSubActive = sub.exact 
                                ? location.pathname === sub.path 
                                : location.pathname.startsWith(sub.path);
                              
                              return (
                                <Link
                                  key={sub.name}
                                  to={sub.path}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-bold transition-all",
                                    isSubActive 
                                      ? "theme-subnav-active" 
                                      : "theme-subnav-item"
                                  )}
                                >
                                  <SubIcon className="w-3.5 h-3.5" />
                                  {sub.name}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="p-4 border-t theme-border bg-white/30">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100/50 shadow-sm transition-all hover:border-blue-100 hover:bg-white group cursor-default">
            <div className="w-9 h-9 theme-brand rounded-lg flex items-center justify-center text-white font-black text-xs shadow-md shrink-0">
              {userRole?.role?.[0].toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-black theme-text-primary uppercase tracking-wider">{userRole?.role || 'User'}</p>
              <p className="text-[10px] theme-text-muted font-bold truncate">Online</p>
            </div>
            <SettingsIcon className="w-3.5 h-3.5 theme-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto print:block">
        {/* Topbar */}
        <header className="theme-topbar h-16 border-b theme-border flex items-center justify-between px-4 sm:px-6 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 rounded-md theme-icon-button"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="md:hidden font-bold text-sm flex items-center gap-2 min-w-0">
              {schoolLogo ? (
                <img src={schoolLogo} alt={`${schoolName} logo`} className="w-8 h-8 rounded-lg object-cover border theme-border theme-surface-muted p-1" />
              ) : (
                <div className="w-8 h-8 theme-brand rounded-lg flex items-center justify-center">
                  <School className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="truncate theme-text-primary uppercase tracking-[0.08em]">{schoolName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k', bubbles: true }))}
              className="hidden sm:flex items-center gap-2 text-sm theme-text-muted theme-surface-muted px-3 py-1.5 rounded-lg transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-xs">Search</span>
              <kbd className="text-[10px] px-1.5 py-0.5 theme-surface border theme-border rounded font-mono theme-text-muted">Ctrl K</kbd>
            </button>
            <div className="relative">
              <button 
                onClick={handleOpenNotifications}
                className="relative p-2 rounded-full transition-colors theme-icon-button"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              
              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 theme-surface rounded-xl shadow-xl border theme-border z-50 overflow-hidden print:hidden">
                  <div className="px-4 py-3 border-b theme-border-soft theme-surface-muted flex justify-between items-center">
                    <h3 className="font-bold theme-text-primary">Notifications</h3>
                    <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{notifications.length} recent</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center theme-text-muted text-sm">
                        No notifications to display.
                      </div>
                    ) : (
                      <div className="divide-y theme-divide">
                        {notifications.map((notif, idx) => (
                          <div key={idx} className="p-4 transition-colors theme-notification-item">
                            <h4 className="text-sm font-bold theme-text-primary mb-1">{notif.title}</h4>
                            <p className="text-xs theme-text-secondary line-clamp-3 leading-relaxed mb-2">{notif.message}</p>
                            <span className="text-[10px] theme-text-muted">{new Date(notif.created_at).toLocaleString()}</span>
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
              className="flex items-center gap-2 text-sm font-medium px-2 sm:px-3 py-2 rounded-md transition-colors hidden sm:flex theme-action-button"
            >
              <Globe className="w-4 h-4" />
              {i18n.language === 'en' ? 'اردو' : 'English'}
            </button>
            <button
              onClick={cycleTheme}
              title={`Current theme: ${theme}`}
              className="flex items-center gap-2 text-sm font-medium px-2 sm:px-3 py-2 rounded-md transition-colors theme-action-button"
            >
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline capitalize">{theme}</span>
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 px-3 py-2 rounded-md hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
          </div>
        </header>

        {/* Dashboard Alerts bar */}
        <div className="print:hidden">
          <DashboardAlerts />
        </div>

        {/* Page Content */}
        <main className="theme-shell flex-1 p-6 print:p-0 overflow-auto print:overflow-visible print:block">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>

      {/* Global Command Palette */}
      <CommandPalette />
    </>
  );
}
