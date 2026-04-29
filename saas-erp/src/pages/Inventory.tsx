import React, { useState, useEffect } from 'react';
import { 
  Package, Search, Plus, Filter, ArrowDownRight, ArrowUpRight, 
  AlertTriangle, Users, BookOpen, Save, X, Trash2, History,
  Building2, Phone, Mail, MapPin, CheckCircle, RefreshCw,
  Box, Truck, ClipboardList, Tag, ChevronRight, Layers
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDate } from '../lib/utils';

interface Category {
  id: string;
  name: string;
  description: string;
}

interface Item {
  id: string;
  name: string;
  sku: string;
  category_id: string;
  unit: string;
  quantity: number;
  min_stock: number;
  is_asset: boolean;
  category?: Category;
}

interface Vendor {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
}

export default function Inventory() {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'stock' | 'history' | 'vendors'>('stock');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchAllData();
    }
  }, [userRole]);

  const fetchAllData = async () => {
    setLoading(true);
    const sid = userRole?.school_id;
    
    const [
      { data: cats },
      { data: invItems },
      { data: vends },
      { data: trans },
      { data: staffData },
      { data: studentData }
    ] = await Promise.all([
      supabase.from('inventory_categories').select('*').eq('school_id', sid).order('name'),
      supabase.from('inventory_items').select('*, category:inventory_categories(name)').eq('school_id', sid).order('name'),
      supabase.from('vendors').select('*').eq('school_id', sid).order('name'),
      supabase.from('inventory_transactions').select('*, item:inventory_items(name), staff:staff(full_name), student:students(full_name)').eq('school_id', sid).order('created_at', { ascending: false }).limit(50),
      supabase.from('staff').select('id, full_name, role').eq('school_id', sid).eq('is_active', true).order('full_name'),
      supabase.from('students').select('id, full_name, roll_number').eq('school_id', sid).eq('status', 'active').order('full_name')
    ]);

    if (cats) setCategories(cats);
    if (invItems) setItems(invItems);
    if (vends) setVendors(vends);
    if (trans) setTransactions(trans);
    if (staffData) setStaff(staffData);
    if (studentData) setStudents(studentData);
    
    setLoading(false);
  };

  const [itemForm, setItemForm] = useState({
    name: '', category_id: '', sku: '', unit: 'pcs', quantity: 0, min_stock: 5, is_asset: false
  });

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;
    try {
      const { data, error } = await supabase.from('inventory_items').insert([{ ...itemForm, school_id: userRole.school_id }]).select();
      if (error) throw error;
      if (itemForm.quantity > 0 && data?.[0]) {
        await supabase.from('inventory_transactions').insert([{ school_id: userRole.school_id, item_id: data[0].id, type: 'adjustment', quantity: itemForm.quantity, remarks: 'Initial stock entry' }]);
      }
      setIsItemModalOpen(false);
      setItemForm({ name: '', category_id: '', sku: '', unit: 'pcs', quantity: 0, min_stock: 5, is_asset: false });
      fetchAllData();
    } catch (error: any) { alert(error.message); }
  };

  const [issueForm, setIssueForm] = useState({
    item_id: '', issued_to_type: 'staff' as 'staff' | 'student', staff_id: '', student_id: '', quantity: 1, remarks: ''
  });

  const handleIssueItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;
    const item = items.find(i => i.id === issueForm.item_id);
    if (!item || item.quantity < issueForm.quantity) return alert('Insufficient stock!');
    try {
      const { error: transError } = await supabase.from('inventory_transactions').insert([{ school_id: userRole.school_id, item_id: issueForm.item_id, type: 'issue', quantity: issueForm.quantity, issued_to_type: issueForm.issued_to_type, staff_id: issueForm.issued_to_type === 'staff' ? issueForm.staff_id : null, student_id: issueForm.issued_to_type === 'student' ? issueForm.student_id : null, remarks: issueForm.remarks }]);
      if (transError) throw transError;
      const { error: updateError } = await supabase.from('inventory_items').update({ quantity: item.quantity - issueForm.quantity }).eq('id', issueForm.item_id);
      if (updateError) throw updateError;
      setIsIssueModalOpen(false);
      setIssueForm({ item_id: '', issued_to_type: 'staff', staff_id: '', student_id: '', quantity: 1, remarks: '' });
      fetchAllData();
    } catch (error: any) { alert(error.message); }
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.sku?.toLowerCase().includes(search.toLowerCase()));
  const lowStockCount = items.filter(i => i.quantity <= i.min_stock).length;
  const totalAssetsValue = items.filter(i => i.is_asset).length;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      
      {/* Header - Aura Premium */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
      >
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter font-display uppercase italic">Inventory Console</h1>
          <p className="text-slate-500 text-sm font-bold mt-1 opacity-70 uppercase tracking-[0.2em]">Asset Lifecycle & Supply Chain Control</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <button onClick={() => setIsIssueModalOpen(true)} className="flex items-center gap-2 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-100 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition shadow-sm active:scale-95">
                <ArrowUpRight className="w-4 h-4" /> Issue Item
            </button>
            <button onClick={() => setIsItemModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition active:scale-95">
                <Plus className="w-4 h-4" /> Add Artifact
            </button>
        </div>
      </motion.div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Stocked Items', value: items.length, icon: Box, theme: 'bg-white text-slate-700 border-slate-100' },
          { label: 'Low Stock Alerts', value: lowStockCount, icon: AlertTriangle, theme: 'bg-rose-500 text-white shadow-rose-100' },
          { label: 'Fixed Assets', value: totalAssetsValue, icon: Layers, theme: 'bg-indigo-600 text-white shadow-indigo-100' },
          { label: 'Log Events', value: transactions.length, icon: ClipboardList, theme: 'bg-slate-900 text-white' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn("rounded-3xl border p-6 flex flex-col justify-between h-40 transition-all hover:scale-[1.02] cursor-default shadow-xl", stat.theme, !stat.theme.includes('bg-white') && 'border-none')}
          >
            <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <stat.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{stat.label}</span>
            </div>
            <div>
              <p className="text-3xl font-black font-display tracking-tight leading-none">{stat.value}</p>
              <div className="w-8 h-1 bg-current opacity-20 mt-3 rounded-full"></div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs Command Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row gap-6 items-center"
      >
        <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 w-full lg:w-auto">
          {[
            { id: 'stock', label: 'STOCK LEVELS', icon: Package },
            { id: 'history', label: 'MOVEMENT LOGS', icon: History },
            { id: 'vendors', label: 'SUPPLY VENDORS', icon: Truck },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={cn("flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all", activeTab === tab.id ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600')}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
        
        <div className="relative flex-1 group w-full">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
           <input type="text" placeholder="Scan inventory metadata..." value={search} onChange={e => setSearch(e.target.value)}
             className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-100/50 transition-all outline-none" />
        </div>
      </motion.div>

      {/* Data Environment */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="aura-card overflow-hidden border-none shadow-2xl shadow-slate-200/50 min-h-[400px]"
        >
           {loading ? (
             <div className="p-40 text-center"><div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mx-auto"></div></div>
           ) : (
             <>
               {activeTab === 'stock' && (
                 <div className="overflow-x-auto custom-scrollbar">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                         <th className="p-6">Artifact Spec</th>
                         <th className="p-6">Classification</th>
                         <th className="p-6">Current Inventory</th>
                         <th className="p-6">Vitality</th>
                         <th className="p-6 text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                       {filteredItems.map((item, i) => {
                         const isLow = item.quantity <= item.min_stock;
                         const isCritical = item.quantity === 0;
                         return (
                           <motion.tr key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="hover:bg-indigo-50/20 transition-all group">
                             <td className="p-6">
                               <div className="flex items-center gap-4">
                                  <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg", item.is_asset ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500')}>
                                    {item.is_asset ? <Layers className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">#{item.sku || 'N/A'}</p>
                                  </div>
                               </div>
                             </td>
                             <td className="p-6">
                               <span className="bg-slate-100 text-slate-500 font-black px-3 py-1.5 rounded-xl text-[9px] uppercase tracking-widest">{categories.find(c => c.id === item.category_id)?.name || 'GENERAL'}</span>
                             </td>
                             <td className="p-6">
                               <p className="text-sm font-black text-slate-900 tracking-tighter">{item.quantity} <span className="text-[10px] text-slate-400 font-bold uppercase">{item.unit}</span></p>
                               <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                                 <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((item.quantity / (item.min_stock || 1)) * 100, 100)}%` }} className={cn("h-full", isCritical ? 'bg-rose-500' : isLow ? 'bg-rose-400' : 'bg-emerald-500')} />
                               </div>
                             </td>
                             <td className="p-6">
                               <span className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm", isCritical ? 'bg-rose-600 text-white' : isLow ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white')}>
                                 {isCritical ? 'DEPLETED' : isLow ? 'LOW STOCK' : 'SECURE'}
                               </span>
                             </td>
                             <td className="p-6 text-right">
                               <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                 <button onClick={() => { setIssueForm({...issueForm, item_id: item.id}); setIsIssueModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90"><ArrowUpRight className="w-5 h-5" /></button>
                                 <button className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"><Plus className="w-5 h-5" /></button>
                               </div>
                             </td>
                           </motion.tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
               )}

               {activeTab === 'history' && (
                 <div className="overflow-x-auto custom-scrollbar">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                         <th className="p-6">Timestamp</th>
                         <th className="p-6">Event Type</th>
                         <th className="p-6">Artifact</th>
                         <th className="p-6">Quantity</th>
                         <th className="p-6">Entity Involved</th>
                         <th className="p-6">Metadata</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                       {transactions.map((t, i) => (
                         <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="hover:bg-slate-50/50 transition-all">
                           <td className="p-6 text-[10px] font-black text-slate-400 tracking-tighter italic">{formatDate(t.created_at)}</td>
                           <td className="p-6">
                              <span className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border", t.type === 'issue' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100')}>
                                {t.type}
                              </span>
                           </td>
                           <td className="p-6 font-black text-slate-900 text-sm">{t.item?.name}</td>
                           <td className="p-6 font-black text-indigo-600">{t.quantity}</td>
                           <td className="p-6 text-xs font-bold text-slate-500 uppercase tracking-tight">{t.issued_to_type === 'staff' ? t.staff?.full_name : t.issued_to_type === 'student' ? t.student?.full_name : '—'}</td>
                           <td className="p-6 text-xs text-slate-400 italic font-medium">{t.remarks || '—'}</td>
                         </motion.tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}

               {activeTab === 'vendors' && (
                 <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {vendors.map((v, i) => (
                      <motion.div key={v.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} className="aura-card p-6 hover:shadow-2xl transition-all group flex flex-col border-none bg-slate-50/50">
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                             <Truck className="w-7 h-7" />
                          </div>
                          <button className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{v.name}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 mb-6 italic">{v.contact_person || 'GENERAL REPRESENTATIVE'}</p>
                        <div className="space-y-3 mt-auto">
                           {[ { icon: Phone, text: v.phone }, { icon: Mail, text: v.email }, { icon: MapPin, text: v.address } ].map((item, idx) => (
                             <div key={idx} className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                               <item.icon className="w-3.5 h-3.5 text-indigo-400" /> {item.text || 'N/A'}
                             </div>
                           ))}
                        </div>
                      </motion.div>
                    ))}
                    <button className="border-4 border-dashed border-slate-100 rounded-[2rem] p-8 flex flex-col items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-500 transition-all gap-4 group">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-indigo-50 transition-colors"><Plus className="w-8 h-8" /></div>
                      <span className="font-black text-[10px] uppercase tracking-[0.3em]">Register Vendor</span>
                    </button>
                 </div>
               )}
             </>
           )}
        </motion.div>
      </AnimatePresence>

      {/* Item Modal - Aura Premium */}
      <AnimatePresence>
        {isItemModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                <div className="bg-slate-900 p-8 text-white relative">
                   <h3 className="text-2xl font-black italic uppercase tracking-tighter">Register Artifact</h3>
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Logistical Entry Sequence</p>
                   <button onClick={() => setIsItemModalOpen(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSaveItem} className="p-8 space-y-6 bg-white overflow-y-auto max-h-[70vh]">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="col-span-2">
                         <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Artifact Nomenclature</label>
                         <input required type="text" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl font-black text-slate-900 outline-none focus:bg-slate-100 transition-all" placeholder="e.g. Cisco Switch X-500" />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Classification</label>
                         <select value={itemForm.category_id} onChange={e => setItemForm({...itemForm, category_id: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl font-bold text-slate-700 outline-none">
                            <option value="">GENERAL</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">ID / SKU Artifact</label>
                         <input type="text" value={itemForm.sku} onChange={e => setItemForm({...itemForm, sku: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl font-bold text-slate-700 outline-none" placeholder="ID-001" />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Initial Liquidity</label>
                         <input type="number" value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border-none p-4 rounded-2xl font-black text-indigo-600 outline-none" />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Minimal Threshold</label>
                         <input type="number" value={itemForm.min_stock} onChange={e => setItemForm({...itemForm, min_stock: Number(e.target.value)})} className="w-full bg-slate-50 border-none p-4 rounded-2xl font-bold text-rose-500 outline-none" />
                      </div>
                      <div className="col-span-2 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                         <div>
                            <p className="text-xs font-black text-indigo-900 uppercase tracking-tight">System Fixed Asset</p>
                            <p className="text-[10px] text-indigo-600 font-bold opacity-70">Major Non-consumable Equipment</p>
                         </div>
                         <button type="button" onClick={() => setItemForm({...itemForm, is_asset: !itemForm.is_asset})} className={cn("w-14 h-8 rounded-full transition-all relative", itemForm.is_asset ? "bg-indigo-600" : "bg-slate-300")}>
                            <div className={cn("w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md", itemForm.is_asset ? "left-7" : "left-1")} />
                         </button>
                      </div>
                   </div>
                   <button type="submit" className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3">
                      <Save className="w-5 h-5" /> Commit to Inventory
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Issue Modal - Aura Premium */}
      <AnimatePresence>
        {isIssueModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                <div className="bg-rose-600 p-8 text-white relative">
                   <h3 className="text-2xl font-black italic uppercase tracking-tighter">Issuance Sequence</h3>
                   <p className="text-rose-100 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Logistical Distribution Logic</p>
                   <button onClick={() => setIsIssueModalOpen(false)} className="absolute top-8 right-8 text-rose-300 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleIssueItem} className="p-8 space-y-6">
                   <div className="space-y-4">
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest tracking-[0.1em]">1. Targeted Artifact</label>
                         <select value={issueForm.item_id} onChange={e => setIssueForm({...issueForm, item_id: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl font-black text-slate-900 outline-none">
                            <option value="">-- Choose Item From Stock --</option>
                            {items.map(i => <option key={i.id} value={i.id} disabled={i.quantity <= 0}>{i.name} ({i.quantity} {i.unit} available)</option>)}
                         </select>
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest tracking-[0.1em]">2. Entity Assignment</label>
                         <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl mb-3">
                            <button type="button" onClick={() => setIssueForm({...issueForm, issued_to_type: 'staff'})} className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", issueForm.issued_to_type === 'staff' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400')}>STAFF MEMBER</button>
                            <button type="button" onClick={() => setIssueForm({...issueForm, issued_to_type: 'student'})} className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", issueForm.issued_to_type === 'student' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400')}>STUDENT</button>
                         </div>
                         <select value={issueForm.issued_to_type === 'staff' ? issueForm.staff_id : issueForm.student_id} onChange={e => setIssueForm(issueForm.issued_to_type === 'staff' ? {...issueForm, staff_id: e.target.value} : {...issueForm, student_id: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl font-bold text-slate-700 outline-none">
                            <option value="">-- Select Recipient --</option>
                            {issueForm.issued_to_type === 'staff' ? staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>) : students.map(s => <option key={s.id} value={s.id}>{s.roll_number} - {s.full_name}</option>)}
                         </select>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Transfer Qty</label>
                            <input type="number" value={issueForm.quantity} onChange={e => setIssueForm({...issueForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border-none p-4 rounded-2xl font-black text-rose-600 outline-none" />
                         </div>
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Tracking Remarks</label>
                            <input type="text" value={issueForm.remarks} onChange={e => setIssueForm({...issueForm, remarks: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl font-bold text-slate-700 outline-none" placeholder="e.g. Science Lab" />
                         </div>
                      </div>
                   </div>
                   <button type="submit" className="w-full bg-rose-600 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-3">
                      <CheckCircle className="w-5 h-5" /> Execute Distribution
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
