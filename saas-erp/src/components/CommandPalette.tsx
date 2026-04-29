import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, GraduationCap, Briefcase, CreditCard, X, ArrowRight, Command, Layout } from 'lucide-react';
import { NAV_SECTIONS } from '../constants/navigation';
import { formatDate } from '../lib/utils';

interface SearchResult {
  id: string;
  type: 'student' | 'staff' | 'fee' | 'module';
  title: string;
  subtitle: string;
  path: string;
  icon?: any;
}

export default function CommandPalette() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => runSearch(query), 150);
    return () => clearTimeout(timer);
  }, [query, userRole]);

  const runSearch = async (q: string) => {
    setLoading(true);
    // 1. Search Sidebar Modules (Local)
    const moduleResults: SearchResult[] = [];
    NAV_SECTIONS.forEach(section => {
      if (userRole?.role && !section.roles.includes(userRole.role)) return;
      
      section.items.forEach(item => {
        if (userRole?.role && !item.roles.includes(userRole.role)) return;
        
        if (item.name.toLowerCase().includes(q.toLowerCase())) {
          moduleResults.push({
            id: `module-${item.path}`,
            type: 'module',
            title: item.name,
            subtitle: `Navigation · ${section.title}`,
            path: item.path,
            icon: item.icon
          });
        }
        
        if (item.subItems) {
          item.subItems.forEach(sub => {
            if ((sub as any).roles && userRole?.role && !(sub as any).roles.includes(userRole.role)) return;
            
            if (sub.name.toLowerCase().includes(q.toLowerCase())) {
              moduleResults.push({
                id: `sub-${sub.path}`,
                type: 'module',
                title: sub.name,
                subtitle: `Module · ${item.name}`,
                path: sub.path,
                icon: sub.icon || item.icon
              });
            }
          });
        }
      });
    });

    // 2. Search Database Records (Remote)
    let records: SearchResult[] = [];
    if (userRole?.school_id) {
      const sid = userRole.school_id;
      const term = `%${q}%`;
      const rollNum = parseInt(q) || 0;

      const [{ data: students }, { data: staffList }, { data: fees }] = await Promise.all([
        supabase.from('students').select('id, full_name, roll_number, class:class_id(name, section)')
          .eq('school_id', sid).or(`full_name.ilike.${term},roll_number.eq.${rollNum}`).limit(5),
        supabase.from('staff').select('id, full_name, role, whatsapp_number')
          .eq('school_id', sid).ilike('full_name', term).limit(5),
        supabase.from('fee_records').select('id, student:student_id(full_name), total_amount, paid_amount, month_year')
          .eq('school_id', sid).in('status', ['pending', 'overdue']).limit(5),
      ]);

      records = [
        ...(students || []).map((s: any) => ({
          id: s.id,
          type: 'student' as const,
          title: s.full_name,
          subtitle: `Roll #${s.roll_number} · ${s.class?.name || ''}-${s.class?.section || ''}`,
          path: '/students',
        })),
        ...(staffList || []).map((s: any) => ({
          id: s.id,
          type: 'staff' as const,
          title: s.full_name,
          subtitle: s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : 'Staff',
          path: '/staff',
        })),
        ...(fees || [])
          .filter((f: any) => f.student?.full_name?.toLowerCase().includes(q.toLowerCase()))
          .map((f: any) => ({
            id: f.id,
            type: 'fee' as const,
            title: f.student?.full_name || 'Unknown',
            subtitle: `Fee Due: Rs. ${Number((f.total_amount ?? 0) - (f.paid_amount ?? 0)).toLocaleString()} · ${f.month_year ? formatDate(f.month_year) : ''}`,
            path: '/fees/student-detail',
          })),
      ];
    }

    const allResults: SearchResult[] = [...moduleResults, ...records];

    setResults(allResults);
    setSelectedIndex(0);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      navigate(results[selectedIndex].path);
      setOpen(false);
    }
  };

  const typeIcon = (result: SearchResult) => {
    if (result.type === 'module' && result.icon) {
      const Icon = result.icon;
      return <Icon className="w-4 h-4 text-indigo-500" />;
    }
    if (result.type === 'student') return <GraduationCap className="w-4 h-4 text-blue-500" />;
    if (result.type === 'staff') return <Briefcase className="w-4 h-4 text-purple-500" />;
    return <CreditCard className="w-4 h-4 text-red-500" />;
  };

  const typeBadge = (type: string) => {
    const map: Record<string, string> = {
      module: 'bg-indigo-100 text-indigo-700',
      student: 'bg-blue-100 text-blue-700',
      staff: 'bg-purple-100 text-purple-700',
      fee: 'bg-red-100 text-red-700',
    };
    return map[type] || 'bg-gray-100 text-gray-700';
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-24 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search modules, students, staff, fees..."
            className="flex-1 text-base text-gray-900 placeholder:text-gray-400 border-none outline-none bg-transparent"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            {loading && (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            )}
            <kbd className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">Esc</kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.trim() === '' ? (
            <div className="px-5 py-10 text-center text-gray-400">
              <Command className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Start typing to find modules or search across records</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-5 py-10 text-center text-gray-400">
              <p className="text-sm font-medium">No results for "<span className="text-gray-600">{query}</span>"</p>
            </div>
          ) : (
            <ul className="py-2">
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    onMouseEnter={() => setSelectedIndex(i)}
                    onClick={() => { navigate(r.path); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                      i === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      {typeIcon(r)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{r.title}</p>
                      <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${typeBadge(r.type)}`}>
                        {r.type}
                      </span>
                      {i === selectedIndex && <ArrowRight className="w-4 h-4 text-blue-400" />}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 bg-gray-50">
          <span>↑↓ Navigate  ·  Enter to open  ·  Esc to close</span>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" /> K to open
          </span>
        </div>
      </div>
    </div>
  );
}
