import React, { useState, useEffect } from 'react';
import { 
  Package, Search, Plus, Filter, ArrowDownRight, ArrowUpRight, 
  AlertTriangle, Users, BookOpen, Save, X, Trash2, History,
  CheckCircle, RefreshCw, Box, ClipboardList, ChevronRight, 
  Layout, Book, ShieldAlert, Send, Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface StationaryTemplate {
  id: string;
  class_name: string;
  items: { name: string; quantity: number }[];
}

interface StudentStationary {
  id: string;
  item_name: string;
  required_qty: number;
  received_qty: number;
  consumed_qty: number;
  updated_at: string;
}

export default function StationaryManagement() {
  const { userRole } = useAuth();
  
  // Normalize class names for fuzzy matching (e.g., "Grade-3" matches "Class 3")
  const normalizeClassName = (name: string) => {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/grade|class/g, '');
  };

  const [activeTab, setActiveTab] = useState<'inventory' | 'templates' | 'portfolio'>('inventory');
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [templates, setTemplates] = useState<StationaryTemplate[]>([]);
  const [studentStationary, setStudentStationary] = useState<StudentStationary[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (userRole?.school_id) {
      fetchInitialData();
    }
  }, [userRole]);

  const fetchInitialData = async () => {
    setLoading(true);
    const sid = userRole?.school_id;
    if (!sid) return;

    try {
      const { data: classesData } = await supabase.from('classes').select('*').eq('school_id', sid).order('name');
      const { data: templatesData } = await supabase.from('stationary_templates').select('*').eq('school_id', sid);

      if (classesData) setClasses(classesData);
      if (templatesData) setTemplates(templatesData);
    } catch (err) {
      console.error('Initial data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const seedDefaultTemplates = async () => {
    const sid = userRole?.school_id;
    if (!sid) return;

    if (!confirm('This will seed the default Edge School templates for all classes (EF-1 to Grade-8). Continue?')) return;

    setLoading(true);
    const defaults = [
      {
        class_name: 'EF-1',
        items: [
          { name: 'Glaze Sheet', quantity: 3 }, { name: 'Glitter Sheet', quantity: 2 }, { name: 'Colour Page A4', quantity: 15 },
          { name: 'UHU Glue', quantity: 1 }, { name: 'Colour Pencils', quantity: 2 }, { name: 'Crayons', quantity: 2 },
          { name: 'Charts', quantity: 3 }, { name: 'Glue Stick', quantity: 2 }, { name: 'Scotch Tape (Big)', quantity: 1 },
          { name: 'Clip File', quantity: 1 }, { name: 'Clear Bag', quantity: 2 }, { name: 'Crape Paper', quantity: 2 },
          { name: 'Fomic Sheet', quantity: 2 }, { name: 'Tissue Box', quantity: 1 }, { name: 'Pencils', quantity: 24 },
          { name: 'Erasers', quantity: 6 }, { name: 'Sharpeners', quantity: 6 }, { name: 'Scissors', quantity: 1 },
          { name: 'A4 Pack', quantity: 1 }, { name: 'Poster Colours', quantity: 3 }, { name: 'Paint Brush', quantity: 2 },
          { name: 'Diary', quantity: 1 }
        ]
      },
      {
        class_name: 'Grade-1',
        items: [
          { name: 'Glaze Sheet', quantity: 3 }, { name: 'Glitter Sheet', quantity: 2 }, { name: 'Colour Page A4', quantity: 15 },
          { name: 'UHU Glue', quantity: 1 }, { name: 'Loose Sheets', quantity: 2 }, { name: 'Charts', quantity: 3 },
          { name: 'Glue Stick', quantity: 2 }, { name: 'Scotch Tape (Big)', quantity: 1 }, { name: 'Clip File', quantity: 1 },
          { name: 'Clear Bag', quantity: 2 }, { name: 'Crape Paper', quantity: 2 }, { name: 'Fomic Sheet', quantity: 2 },
          { name: 'Tissue Box', quantity: 1 }, { name: 'Colour Pencils', quantity: 1 }, { name: 'Pencils', quantity: 6 },
          { name: 'Erasers', quantity: 2 }, { name: 'Sharpeners', quantity: 2 }, { name: 'Scissors', quantity: 1 },
          { name: 'A4 Pack', quantity: 1 }, { name: 'Diary', quantity: 1 }
        ]
      }
      // Simplified for brevity in code, but I'll add logic to duplicate Grade-1 to others
    ];

    // Build the rest (EF-2/3 same as EF-1, Grade-2 same as Grade-1, Grade-3-8 similar)
    const allTemplates = [...defaults];
    ['EF-2', 'EF-3'].forEach(name => allTemplates.push({ ...defaults[0], class_name: name }));
    ['Grade-2'].forEach(name => allTemplates.push({ ...defaults[1], class_name: name }));
    ['Grade-3', 'Grade-4', 'Grade-5', 'Grade-6', 'Grade-7', 'Grade-8'].forEach(name => {
      allTemplates.push({
        class_name: name,
        items: [
          { name: 'Glaze Sheet', quantity: 3 }, { name: 'Glitter Sheet', quantity: 3 }, { name: 'Colour Page A4', quantity: 15 },
          { name: 'UHU Glue', quantity: 1 }, { name: 'Loose Sheets', quantity: 2 }, { name: 'Charts', quantity: 3 },
          { name: 'Glue Stick', quantity: 2 }, { name: 'Scotch Tape (Big)', quantity: 1 }, { name: 'Clip File', quantity: 1 },
          { name: 'Clear Bag', quantity: 2 }, { name: 'Crape Paper', quantity: 3 }, { name: 'Fomic Sheet', quantity: 3 },
          { name: 'Colour Pencils', quantity: 1 }, { name: 'Scissors', quantity: 1 }, { name: 'A4 Pack', quantity: 1 },
          { name: 'Diary', quantity: 1 }
        ]
      });
    });

    try {
      const records = allTemplates.map(t => ({ school_id: sid, class_name: t.class_name, items: t.items }));
      const { error } = await supabase.from('stationary_templates').upsert(records, { onConflict: 'school_id, class_name' });
      if (error) throw error;
      alert('Default templates seeded successfully!');
      fetchInitialData();
    } catch (err: any) {
      alert('Error seeding: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassStudents = async (cid: string) => {
    setLoading(true);
    const { data } = await supabase.from('students').select('*').eq('class_id', cid).eq('status', 'active').eq('is_deleted', false);
    if (data) {
      // Fetch ledger flags for each student to show alerts in the list
      const studentIds = data.map(s => s.id);
      const { data: ledgerData } = await supabase.from('student_stationary_ledger').select('student_id, required_qty, received_qty, consumed_qty').in('student_id', studentIds);
      
      const studentsWithFlags = data.map(s => {
        const items = ledgerData?.filter(l => l.student_id === s.id) || [];
        const hasLowStock = items.some(i => (i.received_qty - i.consumed_qty) <= 1);
        const hasPending = items.some(i => i.required_qty > i.received_qty);
        return { ...s, hasLowStock, hasPending };
      });
      setStudents(studentsWithFlags);
    }
    setLoading(false);
  };

  const fetchStudentStationary = async (sid: string) => {
    const { data } = await supabase.from('student_stationary_ledger').select('*').eq('student_id', sid).order('item_name');
    if (data) setStudentStationary(data);
  };

  const handleApplyTemplate = async () => {
    if (!selectedClassId || !students.length) return alert('Select a class with students first.');
    const className = classes.find(c => c.id === selectedClassId)?.name;
    const normalizedName = normalizeClassName(className || '');
    const template = templates.find(t => normalizeClassName(t.class_name) === normalizedName);
    
    if (!template) return alert(`No stationary template found for ${className}. Please define one in the Templates tab.`);

    if (!confirm(`Apply ${template.items.length} items from the "${template.class_name}" template to all ${students.length} students? This will set their Required Quantity.`)) return;

    setLoading(true);
    try {
      const records = [];
      for (const student of students) {
        for (const item of template.items) {
          records.push({
            school_id: userRole?.school_id,
            student_id: student.id,
            item_name: item.name,
            required_qty: item.quantity,
            received_qty: 0,
            consumed_qty: 0
          });
        }
      }
      const { error } = await supabase.from('student_stationary_ledger').upsert(records, { onConflict: 'student_id, item_name' });
      if (error) throw error;
      alert('Template applied successfully with items set as Pending.');
      fetchClassStudents(selectedClassId);
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const updateStudentItem = async (studentId: string, itemName: string, field: 'received_qty' | 'consumed_qty' | 'required_qty', value: number) => {
    try {
      const { error } = await supabase.from('student_stationary_ledger').update({ [field]: value, updated_at: new Date().toISOString() }).eq('student_id', studentId).eq('item_name', itemName);
      if (error) throw error;
      fetchStudentStationary(studentId);
    } catch (err: any) { alert(err.message); }
  };

  const filteredStudents = students.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.toString().includes(search));
  
  // Calculate Class Shortage Alert
  const flaggedCount = students.filter(s => s.hasLowStock || s.hasPending).length;
  const shortagePercentage = students.length > 0 ? (flaggedCount / students.length) * 100 : 0;
  const isClassShortage = shortagePercentage >= 30;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 md:px-0">
      
      {/* Header - Aura Premium */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
      >
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter font-display uppercase italic">Stationary Console</h1>
          <p className="text-slate-500 text-sm font-bold mt-1 opacity-70 uppercase tracking-[0.2em]">{userRole?.school_name || 'Edge School'} Portfolio Tracking</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveTab('templates')} 
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition shadow-sm active:scale-95",
                activeTab === 'templates' 
                  ? "bg-slate-900 text-white shadow-xl shadow-slate-200" 
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
              )}
            >
                <ClipboardList className="w-4 h-4" /> Config Templates
            </button>
            <button 
              onClick={() => setActiveTab('inventory')} 
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition active:scale-95",
                activeTab === 'inventory' 
                  ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100" 
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
              )}
            >
                <Box className="w-4 h-4" /> Master Inventory
            </button>
        </div>
      </motion.div>

      {/* Conditional Toolbar (Class Selector & Search) */}
      {activeTab === 'inventory' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="aura-card p-6 space-y-6 shadow-2xl shadow-slate-200/50"
        >
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="w-full md:w-1/3">
              <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Select Managing Class</label>
              <select 
                value={selectedClassId} 
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  if (e.target.value) fetchClassStudents(e.target.value);
                }}
                className="w-full bg-slate-50 border-none p-4 rounded-2xl font-black text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all border border-transparent focus:border-indigo-100"
              >
                <option value="">-- Choose Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
              </select>
            </div>
            
            <div className="flex-1 w-full relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Search student by name or roll number..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none border border-transparent focus:border-indigo-100 shadow-inner"
              />
            </div>

            {selectedClassId && (
              <button 
                onClick={handleApplyTemplate}
                className="w-full md:w-auto bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Apply Template
              </button>
            )}
          </div>

          {/* Template Preview Section */}
          <AnimatePresence>
            {selectedClassId && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-6 border-t border-slate-100 overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Requirement Preview</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const cName = classes.find(c => c.id === selectedClassId)?.name;
                    const normalizedCName = normalizeClassName(cName || '');
                    const tpl = templates.find(t => normalizeClassName(t.class_name) === normalizedCName);
                    
                    return tpl ? tpl.items.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-700 uppercase">{item.name}</span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">x{item.quantity}</span>
                      </div>
                    )) : (
                      <div className="text-[10px] font-black text-rose-500 uppercase italic">No Template Configured matching "{cName}"</div>
                    );
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Alerts & Insights */}
      {activeTab === 'inventory' && isClassShortage && (
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-rose-600 rounded-3xl p-6 flex items-center justify-between text-white shadow-2xl shadow-rose-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-tighter italic">Class Stationary Shortage Warning</p>
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-0.5">{flaggedCount} students ({shortagePercentage.toFixed(0)}%) have low stock or pending items.</p>
              </div>
            </div>
            <button 
              onClick={() => alert("AI Recommendation: Batch issue common pending items like Glaze Sheets and Pencils to resolve class-wide shortage.")}
              className="bg-white text-rose-600 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all shadow-xl"
            >
              Get AI Strategy
            </button>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Main Content Area */}
      <div className="space-y-8">
        
        {/* Templates Configuration Tab */}
        {activeTab === 'templates' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex justify-between items-center bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-3">
                  <ClipboardList className="w-6 h-6 text-indigo-600" /> Stationary Templates
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure required items for each class group.</p>
              </div>
              <button 
                onClick={seedDefaultTemplates}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Seed Edge Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {templates.length > 0 ? (
                templates.map((tpl) => (
                  <div key={tpl.id} className="aura-card p-6 border-none shadow-xl hover:shadow-2xl transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs italic">
                        {tpl.class_name}
                      </div>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{tpl.items.length} Items</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {tpl.items.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-[10px] font-bold text-slate-600 border-b border-slate-50 pb-1">
                          <span>{item.name}</span>
                          <span className="text-indigo-600">x{item.quantity}</span>
                        </div>
                      ))}
                      {tpl.items.length > 5 && <p className="text-[9px] text-slate-400 italic">+{tpl.items.length - 5} more...</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full p-20 text-center opacity-40 text-slate-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-black text-[10px] uppercase tracking-widest">No templates defined. Use 'Seed Edge Defaults' to start.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Master Inventory & Student Portfolio Grid */}
        {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Student Directory */}
            <div className={cn("aura-card p-0 overflow-hidden border-none shadow-2xl shadow-slate-200/50", selectedStudent ? 'lg:col-span-1' : 'lg:col-span-3')}>
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Users className="w-4 h-4" /> Student Roll Call</h3>
                <span className="text-[10px] font-black text-slate-300 italic">{filteredStudents.length} Found</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar bg-slate-50/30">
                {filteredStudents.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {filteredStudents.map((student) => (
                      <button 
                        key={student.id}
                        onClick={() => {
                          setSelectedStudent(student);
                          fetchStudentStationary(student.id);
                        }}
                        className={cn(
                          "w-full p-6 flex items-center justify-between hover:bg-white transition-all text-left",
                          selectedStudent?.id === student.id ? 'bg-white border-l-4 border-l-indigo-600' : ''
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 font-black text-xs uppercase italic">
                            {student.roll_number}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{student.full_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {student.hasPending && (
                                <span className="flex items-center gap-1 text-[8px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded shadow-sm border border-rose-100 uppercase">
                                  <Box className="w-2.5 h-2.5" /> Pending
                                </span>
                              )}
                              {student.hasLowStock && (
                                <span className="flex items-center gap-1 text-[8px] font-black bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded shadow-sm border border-orange-100 uppercase">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Low
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className={cn("w-5 h-5 text-slate-300 transition-transform", selectedStudent?.id === student.id && "rotate-90 text-indigo-600")} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-20 text-center opacity-30 select-none">
                    <Layout className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Students Targeted</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Ledger / Portfolio View */}
            <AnimatePresence>
              {selectedStudent ? (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="lg:col-span-2 space-y-6"
                >
                  <div className="aura-card border-none shadow-2xl shadow-indigo-200/20 overflow-hidden">
                    <div className="bg-indigo-600 p-8 text-white relative">
                      <div className="flex justify-between items-start">
                        <div>
                          <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">{selectedStudent.full_name}</h2>
                          <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Stationary Portfolio • Roll #{selectedStudent.roll_number}</p>
                        </div>
                        <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X className="w-6 h-6" /></button>
                      </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-100 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                            <th className="p-6">Item Specification</th>
                            <th className="p-6 text-center">Req.</th>
                            <th className="p-6 text-center">Rcvd.</th>
                            <th className="p-6 text-center">Cons.</th>
                            <th className="p-6 text-center">Remain.</th>
                            <th className="p-6 text-center">Pending</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                          {studentStationary.length > 0 ? (
                            studentStationary.map((row) => {
                              const remaining = row.received_qty - row.consumed_qty;
                              const pending = row.required_qty - row.received_qty;
                              const isLow = remaining <= 1;
                              const isPending = pending > 0;

                              return (
                                <tr key={row.id} className="hover:bg-slate-50/50 transition-all group">
                                  <td className="p-6">
                                    <div className="flex items-center gap-3">
                                      <div className={cn("w-2 h-2 rounded-full", isLow ? "bg-orange-500" : isPending ? "bg-rose-500" : "bg-emerald-500")} />
                                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{row.item_name}</p>
                                    </div>
                                  </td>
                                  <td className="p-6 text-center font-bold text-slate-400">
                                    <input 
                                       type="number"
                                       className="w-12 bg-transparent text-center outline-none focus:ring-2 focus:ring-indigo-100 rounded"
                                       defaultValue={row.required_qty}
                                       onFocus={(e) => e.target.select()}
                                       onBlur={(e) => updateStudentItem(selectedStudent.id, row.item_name, 'required_qty', parseInt(e.target.value) || 0)}
                                    />
                                  </td>
                                  <td className="p-6 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button 
                                        onClick={() => updateStudentItem(selectedStudent.id, row.item_name, 'received_qty', Math.max(0, row.received_qty - 1))}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-900 transition-colors"
                                      >-</button>
                                      <input 
                                        type="number"
                                        className="text-sm font-black text-slate-900 w-12 bg-transparent text-center outline-none focus:ring-2 focus:ring-indigo-100 rounded"
                                        value={row.received_qty}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => updateStudentItem(selectedStudent.id, row.item_name, 'received_qty', parseInt(e.target.value) || 0)}
                                      />
                                      <button 
                                        onClick={() => updateStudentItem(selectedStudent.id, row.item_name, 'received_qty', row.received_qty + 1)}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-900 transition-colors"
                                      >+</button>
                                    </div>
                                  </td>
                                  <td className="p-6 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button 
                                        onClick={() => updateStudentItem(selectedStudent.id, row.item_name, 'consumed_qty', Math.max(0, row.consumed_qty - 1))}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-900 transition-colors"
                                      >-</button>
                                      <input 
                                        type="number"
                                        className="text-sm font-black text-indigo-600 w-12 bg-transparent text-center outline-none focus:ring-2 focus:ring-indigo-100 rounded"
                                        value={row.consumed_qty}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => updateStudentItem(selectedStudent.id, row.item_name, 'consumed_qty', parseInt(e.target.value) || 0)}
                                      />
                                      <button 
                                        onClick={() => updateStudentItem(selectedStudent.id, row.item_name, 'consumed_qty', Math.min(row.received_qty, row.consumed_qty + 1))}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-900 transition-colors"
                                      >+</button>
                                    </div>
                                  </td>
                                  <td className="p-6 text-center">
                                    <span className={cn(
                                      "inline-block px-3 py-1 rounded-lg font-black text-[10px] shadow-sm",
                                      isLow ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-700"
                                    )}>
                                      {remaining}
                                    </span>
                                  </td>
                                  <td className="p-6 text-center">
                                    <span className={cn(
                                      "inline-block px-3 py-1 rounded-lg font-black text-[10px] shadow-sm",
                                      isPending ? "bg-rose-100 text-rose-600 underline decoration-rose-200" : "bg-emerald-100 text-emerald-600"
                                    )}>
                                      {pending}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr><td colSpan={6} className="p-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">Initialization Required via Template Sync</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" /> Download Report
                    </button>
                    <button className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2">
                      <Send className="w-4 h-4" /> Message Parent
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="lg:col-span-2 p-20 text-center aura-card border-none shadow-2xl opacity-60">
                  <Box className="w-16 h-16 mx-auto mb-6 text-slate-300" />
                  <h2 className="text-2xl font-black text-slate-400 tracking-tighter uppercase italic">Institutional Stock View</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2">Select a student from the roll call to view their personal portfolio and track usage.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}
