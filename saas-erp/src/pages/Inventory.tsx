import React, { useState, useEffect } from 'react';
import { 
  Package, Search, Plus, Filter, ArrowDownRight, ArrowUpRight, 
  AlertTriangle, Users, BookOpen, Save, X, Trash2, History,
  Building2, Phone, Mail, MapPin, CheckCircle, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  const [activeTab, setActiveTab] = useState<'stock' | 'issue' | 'vendors' | 'history'>('stock');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // Modal State
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
    name: '',
    category_id: '',
    sku: '',
    unit: 'pcs',
    quantity: 0,
    min_stock: 5,
    is_asset: false
  });

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert([{ ...itemForm, school_id: userRole.school_id }])
        .select();

      if (error) throw error;
      
      // If initial quantity > 0, record a 'purchase' or 'adjustment' transaction
      if (itemForm.quantity > 0 && data?.[0]) {
        await supabase.from('inventory_transactions').insert([{
          school_id: userRole.school_id,
          item_id: data[0].id,
          type: 'adjustment',
          quantity: itemForm.quantity,
          remarks: 'Initial stock entry'
        }]);
      }

      setIsItemModalOpen(false);
      setItemForm({ name: '', category_id: '', sku: '', unit: 'pcs', quantity: 0, min_stock: 5, is_asset: false });
      fetchAllData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const [issueForm, setIssueForm] = useState({
    item_id: '',
    issued_to_type: 'staff' as 'staff' | 'student',
    staff_id: '',
    student_id: '',
    quantity: 1,
    remarks: ''
  });

  const handleIssueItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;

    const item = items.find(i => i.id === issueForm.item_id);
    if (!item || item.quantity < issueForm.quantity) {
      alert('Insufficient stock!');
      return;
    }

    try {
      // 1. Double transaction within RPC or 2 steps
      const { error: transError } = await supabase.from('inventory_transactions').insert([{
        school_id: userRole.school_id,
        item_id: issueForm.item_id,
        type: 'issue',
        quantity: issueForm.quantity,
        issued_to_type: issueForm.issued_to_type,
        staff_id: issueForm.issued_to_type === 'staff' ? issueForm.staff_id : null,
        student_id: issueForm.issued_to_type === 'student' ? issueForm.student_id : null,
        remarks: issueForm.remarks
      }]);

      if (transError) throw transError;

      // 2. Update item quantity
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ quantity: item.quantity - issueForm.quantity })
        .eq('id', issueForm.item_id);

      if (updateError) throw updateError;

      setIsIssueModalOpen(false);
      setIssueForm({ item_id: '', issued_to_type: 'staff', staff_id: '', student_id: '', quantity: 1, remarks: '' });
      fetchAllData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = items.filter(i => i.quantity <= i.min_stock).length;
  const totalAssetsValue = items.filter(i => i.is_asset).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
            <Package className="w-7 h-7 text-blue-600" /> 
            Inventory & Asset Management
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Track school equipment, stationery, and distribution history.</p>
        </div>
        
        <div className="flex gap-2">
           <button 
             onClick={() => { setIsIssueModalOpen(true); }}
             className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-orange-500 text-orange-600 rounded-lg text-sm font-bold hover:bg-orange-50 transition-all shadow-sm"
           >
              <ArrowUpRight className="w-4 h-4" /> Issue Item
           </button>
           <button 
             onClick={() => { setIsItemModalOpen(true); }}
             className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
           >
              <Plus className="w-4 h-4" /> Add Item
           </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Stocked Items', value: items.length, icon: Package, color: 'text-blue-600 bg-blue-50 border-blue-100' },
          { label: 'Low Stock Alerts', value: lowStockCount, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50 border-orange-100' },
          { label: 'Fixed Assets', value: totalAssetsValue, icon: Building2, color: 'text-purple-600 bg-purple-50 border-purple-100' },
          { label: 'Recent Transactions', value: transactions.length, icon: History, color: 'text-teal-600 bg-teal-50 border-teal-100' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 flex items-center gap-4 bg-white shadow-sm`}>
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'stock', label: 'Stock Levels', icon: Package },
          { id: 'history', label: 'Movement Logs', icon: History },
          { id: 'vendors', label: 'Vendors', icon: Building2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
        {loading ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
             <RefreshCw className="w-8 h-8 animate-spin" />
             <p className="font-bold">Loading Inventory...</p>
           </div>
        ) : (
          <>
            {activeTab === 'stock' && (
              <div className="p-0">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search by name or serial number..." 
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white font-medium focus:ring-blue-500">
                      <option>All Categories</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item Name & SKU</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Stock</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredItems.map((item) => {
                        const isLow = item.quantity <= item.min_stock;
                        const isCritical = item.quantity === 0;
                        
                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.is_asset ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                  {item.is_asset ? <Building2 className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                                </div>
                                <div>
                                  <p className="font-black text-gray-900 text-sm">{item.name}</p>
                                  <p className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1 rounded w-fit mt-0.5">#{item.sku || 'N/A'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                {categories.find(c => c.id === item.category_id)?.name || 'General'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex flex-col">
                                 <span className="text-sm font-black text-gray-900">{item.quantity} <span className="text-[10px] text-gray-400 font-normal">{item.unit}</span></span>
                                 <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                                   <div 
                                     className={`h-full transition-all ${isCritical ? 'w-0' : isLow ? 'bg-orange-500 w-1/3' : 'bg-green-500 w-full'}`}
                                   />
                                 </div>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${
                                isCritical ? 'bg-red-50 text-red-600 border-red-100' : 
                                isLow ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                                'bg-green-50 text-green-600 border-green-100'
                              }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-red-600' : isLow ? 'bg-orange-600' : 'bg-green-600'}`} />
                                {isCritical ? 'Out of Stock' : isLow ? 'Low Stock' : 'Good'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <div className="flex justify-end gap-2">
                                 <button title="Issue" onClick={() => { setIssueForm({...issueForm, item_id: item.id}); setIsIssueModalOpen(true); }} className="p-2 text-orange-600 hover:bg-orange-50 border border-transparent hover:border-orange-100 rounded-lg transition-all">
                                   <ArrowUpRight className="w-4 h-4" />
                                 </button>
                                 <button title="Edit" className="p-2 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-all">
                                   <Plus className="w-4 h-4" />
                                 </button>
                               </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date & Time</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Qty</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">From/To</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {transactions.map(t => (
                        <tr key={t.id} className="text-sm">
                          <td className="px-6 py-4 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                            {new Date(t.created_at).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                               t.type === 'issue' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                               t.type === 'purchase' ? 'bg-green-50 text-green-600 border-green-100' :
                               'bg-blue-50 text-blue-600 border-blue-100'
                             }`}>
                               {t.type}
                             </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-900">{t.item?.name}</td>
                          <td className="px-6 py-4 font-black">{t.quantity}</td>
                          <td className="px-6 py-4 text-xs font-medium text-gray-700">
                            {t.issued_to_type === 'staff' ? `${t.staff?.full_name} (Staff)` : t.issued_to_type === 'student' ? `${t.student?.full_name} (Student)` : '—'}
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-400 italic">{t.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'vendors' && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {vendors.map(v => (
                   <div key={v.id} className="border border-gray-100 rounded-2xl p-5 hover:shadow-lg transition-all group flex flex-col bg-gray-50/30">
                     <div className="flex justify-between items-start mb-4">
                       <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-blue-600">
                         <Building2 className="w-6 h-6" />
                       </div>
                       <button className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                     <h3 className="text-lg font-black text-gray-900 mb-1">{v.name}</h3>
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{v.contact_person || 'No Contact Person'}</p>
                     
                     <div className="space-y-2 mt-auto">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Phone className="w-3.5 h-3.5" /> {v.phone || '—'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Mail className="w-3.5 h-3.5" /> {v.email || '—'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <MapPin className="w-3.5 h-3.5" /> {v.address || '—'}
                        </div>
                     </div>
                   </div>
                ))}
                <button 
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all gap-2"
                >
                  <Plus className="w-8 h-8" />
                  <span className="font-bold text-sm">Add Vendor</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
             <div className="bg-blue-600 px-8 py-6 flex justify-between items-center text-white">
               <div>
                 <h3 className="text-xl font-black tracking-tight">Register New Item</h3>
                 <p className="text-blue-100 text-xs mt-1 uppercase font-bold tracking-widest leading-none">Add stock to inventory</p>
               </div>
               <button onClick={() => setIsItemModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
             </div>
             
             <form onSubmit={handleSaveItem} className="p-8 space-y-4 bg-gray-50 overflow-y-auto max-h-[70vh]">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="md:col-span-2">
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest pl-1">Item Name <span className="text-red-500">*</span></label>
                   <input 
                     required type="text" value={itemForm.name} 
                     onChange={e => setItemForm({...itemForm, name: e.target.value})}
                     className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
                     placeholder="e.g. Dell Projector Model X"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest pl-1">Category</label>
                   <select 
                     value={itemForm.category_id} onChange={e => setItemForm({...itemForm, category_id: e.target.value})}
                     className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                   >
                     <option value="">No Category</option>
                     {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest pl-1">SKU / Serial No.</label>
                   <input 
                     type="text" value={itemForm.sku} 
                     onChange={e => setItemForm({...itemForm, sku: e.target.value})}
                     className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 transition-all" 
                     placeholder="ID-001"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest pl-1">Current Qty</label>
                   <input 
                     type="number" value={itemForm.quantity} 
                     onChange={e => setItemForm({...itemForm, quantity: Number(e.target.value)})}
                     className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 transition-all" 
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest pl-1">Low Stock Warning</label>
                   <input 
                     type="number" value={itemForm.min_stock} 
                     onChange={e => setItemForm({...itemForm, min_stock: Number(e.target.value)})}
                     className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 transition-all" 
                   />
                 </div>
                 <div className="md:col-span-2 bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">Fixed Asset</p>
                      <p className="text-[10px] text-gray-500">Major school equipment that shouldn't be consumed.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={itemForm.is_asset} onChange={e => setItemForm({...itemForm, is_asset: e.target.checked})} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                 </div>
               </div>
             </form>
             
             <div className="p-8 bg-white border-t border-gray-100 flex gap-3">
               <button onClick={() => setIsItemModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all">Cancel</button>
               <button onClick={handleSaveItem} className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2">
                 <Save className="w-5 h-5" /> Register Item
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Issue Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
             <div className="bg-orange-500 px-8 py-6 flex justify-between items-center text-white">
               <div>
                 <h3 className="text-xl font-black tracking-tight">Issue / Assign Item</h3>
                 <p className="text-orange-100 text-xs mt-1 uppercase font-bold tracking-widest leading-none">Record distribution to staff or students</p>
               </div>
               <button onClick={() => setIsIssueModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
             </div>
             
             <form onSubmit={handleIssueItem} className="p-8 space-y-5 bg-gray-50">
               <div>
                 <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest pl-1">1. Select Item <span className="text-red-500">*</span></label>
                 <select 
                    value={issueForm.item_id} onChange={e => setIssueForm({...issueForm, item_id: e.target.value})}
                    className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all"
                 >
                   <option value="">-- Choose Item From Stock --</option>
                   {items.map(i => <option key={i.id} value={i.id} disabled={i.quantity <= 0}>
                     {i.name} ({i.quantity} {i.unit} available)
                   </option>)}
                 </select>
               </div>

               <div>
                 <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest pl-1">2. Assign To <span className="text-red-500">*</span></label>
                 <div className="flex gap-2 p-1 bg-white border border-gray-200 rounded-xl mb-3">
                    <button type="button" onClick={() => setIssueForm({...issueForm, issued_to_type: 'staff'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${issueForm.issued_to_type === 'staff' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-400'}`}>Staff Member</button>
                    <button type="button" onClick={() => setIssueForm({...issueForm, issued_to_type: 'student'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${issueForm.issued_to_type === 'student' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-400'}`}>Student</button>
                 </div>
                 
                 {issueForm.issued_to_type === 'staff' ? (
                   <select 
                      value={issueForm.staff_id} onChange={e => setIssueForm({...issueForm, staff_id: e.target.value})}
                      className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-500/10"
                   >
                     <option value="">-- Select Staff Member --</option>
                     {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
                   </select>
                 ) : (
                  <select 
                    value={issueForm.student_id} onChange={e => setIssueForm({...issueForm, student_id: e.target.value})}
                    className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-500/10"
                  >
                    <option value="">-- Select Student --</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.roll_number} - {s.full_name}</option>)}
                  </select>
                 )}
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest pl-1">Quantity</label>
                   <input 
                     type="number" value={issueForm.quantity} 
                     onChange={e => setIssueForm({...issueForm, quantity: Number(e.target.value)})}
                     className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-500/10" 
                   />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest pl-1">Remarks</label>
                    <input 
                      type="text" value={issueForm.remarks} 
                      onChange={e => setIssueForm({...issueForm, remarks: e.target.value})}
                      className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-orange-500/10" 
                      placeholder="e.g. For ICT Lab"
                    />
                 </div>
               </div>
             </form>

             <div className="p-8 bg-white border-t border-gray-100 flex gap-3">
               <button onClick={() => setIsIssueModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all">Cancel</button>
               <button onClick={handleIssueItem} className="flex-[2] py-3 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 shadow-xl shadow-orange-100 transition-all flex items-center justify-center gap-2">
                 <CheckCircle className="w-5 h-5" /> Confirm Issuance
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
