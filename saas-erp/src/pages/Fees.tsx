import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, CreditCard, AlertCircle, CheckCircle, DollarSign, Download } from 'lucide-react';
import { exportToCSV } from '../lib/exportUtils';

interface FeeRecord {
  id: string;
  month_year: string;
  total_amount: number;
  paid_amount: number;
  status: 'pending' | 'partial' | 'paid';
  student: {
    full_name: string;
    roll_number: number;
    class: { name: string } | null;
  } | null;
}

export default function Fees() {
  const { userRole } = useAuth();
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'defaulters' | 'structure' | 'cashflow'>('all');
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [structureForm, setStructureForm] = useState({ class_id: '', amount: '' });

  // Modals state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FeeRecord | null>(null);

  // Form states
  const [generateForm, setGenerateForm] = useState({ class_id: '', month: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', fine: '0', discount: '0' });
  const [school, setSchool] = useState<{ name: string; address: string; contact_phone: string } | null>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchRecords();
      fetchClasses();
      fetchFeeStructures();
      supabase.from('schools').select('name, address, contact_phone').eq('id', userRole.school_id).maybeSingle()
        .then(({ data }) => { if (data) setSchool(data); });
    }
  }, [userRole]);

  const fetchFeeStructures = async () => {
    try {
      const { data, error } = await supabase
        .from('fee_structures')
        .select(`
          id,
          amount,
          classes (name, section)
        `);
      if (error) throw error;
      setFeeStructures(data || []);
    } catch (error) {
      console.error('Error fetching fee structures:', error);
    }
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;
    try {
      // Check if structure exists for class
      const existing = feeStructures.find(fs => fs.classes?.id === structureForm.class_id);
      
      if (existing) {
        const { error } = await supabase
          .from('fee_structures')
          .update({ amount: parseFloat(structureForm.amount) })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('fee_structures')
          .insert([{ 
            school_id: userRole.school_id, 
            class_id: structureForm.class_id, 
            amount: parseFloat(structureForm.amount) 
          }]);
        if (error) throw error;
      }
      
      setIsStructureModalOpen(false);
      setStructureForm({ class_id: '', amount: '' });
      fetchFeeStructures();
      alert('Fee structure saved successfully.');
    } catch (error: any) {
      alert(error.message || 'Error saving fee structure');
    }
  };

  const fetchRecords = async () => {
    try {
      let query = supabase
        .from('fee_records')
        .select(`
          *,
          student:student_id(
            full_name, 
            roll_number, 
            class:class_id(name)
          )
        `)
        .order('month_year', { ascending: false });

      if (userRole?.role === 'parent') {
        const { data: parentData } = await supabase
          .from('parents')
          .select('id')
          .eq('user_id', userRole.user_id)
          .single();

        if (parentData) {
          const { data: students } = await supabase
            .from('students')
            .select('id')
            .eq('parent_id', parentData.id);

          if (students && students.length > 0) {
            const studentIds = students.map(s => s.id);
            query = query.in('student_id', studentIds);
          } else {
            setRecords([]);
            setLoading(false);
            return;
          }
        } else {
          setRecords([]);
          setLoading(false);
          return;
        }
      } else {
        query = query.eq('school_id', userRole?.school_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching fee records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, section')
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const handleGenerateFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;

    try {
      // 1. Get all students in the selected class
      const { data: students, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', generateForm.class_id)
        .eq('status', 'active');

      if (studentError) throw studentError;
      if (!students || students.length === 0) {
        alert('No active students found in this class.');
        return;
      }

      // 1.5 Get fee structure for the class
      const { data: feeStructure, error: feeStructureError } = await supabase
        .from('fee_structures')
        .select('amount')
        .eq('class_id', generateForm.class_id)
        .single();

      if (feeStructureError && feeStructureError.code !== 'PGRST116') {
        throw feeStructureError;
      }

      const amount = feeStructure?.amount || 0;

      if (amount === 0) {
        alert('No fee structure found for this class. Please set it up in Settings first.');
        return;
      }

      // 2. Create fee records for each student
      const feeRecords = students.map(student => ({
        school_id: userRole.school_id,
        student_id: student.id,
        month_year: `${generateForm.month}-01`, // Store as YYYY-MM-01 date
        total_amount: amount,
        status: 'pending'
      }));

      const { error: insertError } = await supabase.from('fee_records').insert(feeRecords);
      if (insertError) throw insertError;

      alert(`Successfully generated fees for ${students.length} students.`);
      setIsGenerateModalOpen(false);
      setGenerateForm({ class_id: '', month: '' });
      fetchRecords();
    } catch (error: any) {
      alert(error.message || 'Error generating fees');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    const fineAmount = parseFloat(paymentForm.fine) || 0;
    const discountAmount = parseFloat(paymentForm.discount) || 0;
    const paymentAmount = parseFloat(paymentForm.amount) || 0;

    const newTotalAmount = selectedRecord.total_amount + fineAmount - discountAmount;
    const newPaidAmount = selectedRecord.paid_amount + paymentAmount;
    const newStatus = newPaidAmount >= newTotalAmount ? 'paid' : 'partial';

    try {
      const { error } = await supabase
        .from('fee_records')
        .update({ 
          total_amount: newTotalAmount,
          paid_amount: newPaidAmount,
          status: newStatus,
          paid_at: newStatus === 'paid' ? new Date().toISOString() : null
        })
        .eq('id', selectedRecord.id);

      if (error) throw error;

      setIsPaymentModalOpen(false);
      setPaymentForm({ amount: '', fine: '0', discount: '0' });
      setSelectedRecord(null);
      fetchRecords();
    } catch (error: any) {
      alert(error.message || 'Error recording payment');
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.student?.full_name.toLowerCase().includes(search.toLowerCase()) || 
                          r.student?.roll_number.toString().includes(search);
    const matchesTab = activeTab === 'all' || (activeTab === 'defaulters' && r.status !== 'paid');
    return matchesSearch && matchesTab;
  });

  const handleExport = () => {
    exportToCSV(`fee_records_${activeTab}`, filteredRecords, [
      { header: 'Roll No', key: (row) => row.student?.roll_number },
      { header: 'Student Name', key: (row) => row.student?.full_name },
      { header: 'Class', key: (row) => row.student?.class?.name || '-' },
      { header: 'Month', key: (row) => new Date(row.month_year).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
      { header: 'Total Amount', key: 'total_amount' },
      { header: 'Paid Amount', key: 'paid_amount' },
      { header: 'Pending Amount', key: (row) => row.total_amount - row.paid_amount },
      { header: 'Status', key: 'status' }
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search student or roll no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {userRole?.role === 'admin' && (
            <button 
              onClick={() => setIsGenerateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Generate Fees</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All Records
        </button>
        <button
          onClick={() => setActiveTab('defaulters')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'defaulters' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Defaulters (Pending)
        </button>
        {userRole?.role === 'admin' && (
          <>
            <button
              onClick={() => setActiveTab('structure')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'structure' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Fee Structure
            </button>
            <button
              onClick={() => setActiveTab('cashflow')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'cashflow' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Cash Flow
            </button>
          </>
        )}
      </div>

      {/* Data Table */}
      {(activeTab === 'all' || activeTab === 'defaulters') && (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 font-medium text-sm text-gray-600">Student</th>
                  <th className="p-4 font-medium text-sm text-gray-600">Class</th>
                  <th className="p-4 font-medium text-sm text-gray-600">Month</th>
                  <th className="p-4 font-medium text-sm text-gray-600">Total Amount</th>
                  <th className="p-4 font-medium text-sm text-gray-600">Paid</th>
                  <th className="p-4 font-medium text-sm text-gray-600">Status</th>
                  {userRole?.role === 'admin' && (
                    <th className="p-4 font-medium text-sm text-gray-600 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">Loading records...</td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">No fee records found.</td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{record.student?.full_name}</div>
                        <div className="text-xs text-gray-500">Roll: {record.student?.roll_number}</div>
                      </td>
                      <td className="p-4 text-sm text-gray-500">{record.student?.class?.name || '-'}</td>
                      <td className="p-4 text-sm text-gray-900">
                        {new Date(record.month_year).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-900">Rs. {record.total_amount}</td>
                      <td className="p-4 text-sm text-gray-500">Rs. {record.paid_amount}</td>
                      <td className="p-4 text-sm">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          record.status === 'paid' ? 'bg-green-100 text-green-800' : 
                          record.status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </span>
                      </td>
                      {userRole?.role === 'admin' && (
                        <td className="p-4 text-sm text-right">
                          <div className="flex justify-end gap-2">
                            {record.status !== 'pending' && (
                              <button 
                                onClick={() => {
                                  setSelectedRecord(record);
                                  setIsReceiptModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium transition-colors"
                              >
                                Receipt
                              </button>
                            )}
                            {record.status !== 'paid' && (
                              <button 
                                onClick={() => {
                                  setSelectedRecord(record);
                                  setPaymentForm({ amount: (record.total_amount - record.paid_amount).toString(), fine: '0', discount: '0' });
                                  setIsPaymentModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md font-medium transition-colors"
                              >
                                <DollarSign className="w-4 h-4" />
                                Pay
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'structure' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">Fee Structures by Class</h2>
            <button 
              onClick={() => setIsStructureModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Set Fee Structure
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {feeStructures.map(fs => (
              <div key={fs.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">{fs.classes?.name}</h3>
                <p className="text-sm text-gray-500 mb-4">Section {fs.classes?.section}</p>
                <div className="text-2xl font-bold text-blue-600">Rs. {fs.amount}</div>
                <p className="text-xs text-gray-500 mt-1">per month</p>
              </div>
            ))}
            {feeStructures.length === 0 && (
              <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
                No fee structures set up yet.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expected</h3>
              <div className="text-3xl font-bold text-gray-900">
                Rs. {records.reduce((acc, curr) => acc + curr.total_amount, 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Collected</h3>
              <div className="text-3xl font-bold text-green-600">
                Rs. {records.reduce((acc, curr) => acc + curr.paid_amount, 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Pending</h3>
              <div className="text-3xl font-bold text-red-600">
                Rs. {records.reduce((acc, curr) => acc + (curr.total_amount - curr.paid_amount), 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fee Structure Modal */}
      {isStructureModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Set Fee Structure</h3>
              <button onClick={() => setIsStructureModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSaveStructure} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Class *</label>
                <select
                  required
                  value={structureForm.class_id}
                  onChange={(e) => setStructureForm({...structureForm, class_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Select a class --</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name} {cls.section ? `(Sec ${cls.section})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Amount (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={structureForm.amount}
                  onChange={(e) => setStructureForm({...structureForm, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsStructureModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Save Structure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Fees Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Generate Class Fees</h3>
              <button onClick={() => setIsGenerateModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleGenerateFees} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Class *</label>
                <select
                  required
                  value={generateForm.class_id}
                  onChange={(e) => setGenerateForm({...generateForm, class_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Select a class --</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name} {cls.section ? `(Sec ${cls.section})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fee Month *</label>
                <input
                  type="month"
                  required
                  value={generateForm.month}
                  onChange={(e) => setGenerateForm({...generateForm, month: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-600">Student: <span className="font-medium text-gray-900">{selectedRecord.student?.full_name}</span></p>
                <p className="text-sm text-gray-600">Total Due: <span className="font-medium text-gray-900">Rs. {selectedRecord.total_amount - selectedRecord.paid_amount}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Fine (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={paymentForm.fine}
                    onChange={(e) => setPaymentForm({...paymentForm, fine: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={paymentForm.discount}
                    onChange={(e) => setPaymentForm({...paymentForm, discount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Receipt Modal */}
      {isReceiptModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Fee Receipt</h3>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 bg-gray-50">
              <div id="receipt-print-area" className="bg-white p-8 border border-gray-200 shadow-sm mx-auto max-w-lg">
                <div className="text-center border-b border-gray-200 pb-6 mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-wider">{school?.name || 'School'}</h2>
                  {school?.address && <p className="text-gray-500 text-sm mt-1">{school.address}</p>}
                  {school?.contact_phone && <p className="text-gray-500 text-sm">Phone: {school.contact_phone}</p>}
                  <div className="mt-4 inline-block px-4 py-1 bg-gray-100 border border-gray-300 rounded-full text-sm font-semibold text-gray-700">
                    FEE RECEIPT
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Receipt No:</span>
                    <span className="font-medium text-gray-900">RCPT-{selectedRecord.id.substring(0, 8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Date:</span>
                    <span className="font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Student Name:</span>
                    <span className="font-medium text-gray-900">{selectedRecord.student?.full_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Roll Number:</span>
                    <span className="font-medium text-gray-900">{selectedRecord.student?.roll_number}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Class:</span>
                    <span className="font-medium text-gray-900">{selectedRecord.student?.class?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Fee Month:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(selectedRecord.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <table className="w-full mb-8 text-sm">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-2 font-semibold text-gray-700">Description</th>
                      <th className="text-right py-2 font-semibold text-gray-700">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="py-3 text-gray-600">Tuition Fee</td>
                      <td className="py-3 text-right font-medium text-gray-900">Rs. {selectedRecord.total_amount}</td>
                    </tr>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <td className="py-3 text-gray-600 font-medium">Total Paid</td>
                      <td className="py-3 text-right font-bold text-green-600">Rs. {selectedRecord.paid_amount}</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-gray-600 font-medium">Balance Due</td>
                      <td className="py-3 text-right font-bold text-red-600">Rs. {selectedRecord.total_amount - selectedRecord.paid_amount}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-12 flex justify-between items-end">
                  <div className="text-xs text-gray-500">
                    <p>This is a computer generated receipt.</p>
                    <p>No signature required.</p>
                  </div>
                  <div className="text-center">
                    <div className="w-32 border-b border-gray-400 mb-2"></div>
                    <p className="text-xs text-gray-500">Authorized Signatory</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-white">
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const printContent = document.getElementById('receipt-print-area');
                  const windowPrint = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
                  if (windowPrint && printContent) {
                    windowPrint.document.write(`
                      <html>
                        <head>
                          <title>Print Receipt</title>
                          <script src="https://cdn.tailwindcss.com"></script>
                        </head>
                        <body class="p-8" onload="window.print(); window.close();">
                          ${printContent.innerHTML}
                        </body>
                      </html>
                    `);
                    windowPrint.document.close();
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
