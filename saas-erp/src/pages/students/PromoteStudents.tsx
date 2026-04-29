import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Search, CheckSquare, Square } from 'lucide-react';

export default function PromoteStudents() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [sourceClass, setSourceClass] = useState('');
  const [destClass, setDestClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (userRole?.school_id) fetchClasses();
  }, [userRole]);

  useEffect(() => {
    if (sourceClass) fetchStudents();
    else setStudents([]);
  }, [sourceClass]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
  };

  const fetchStudents = async () => {
    setLoading(true);
    const { data } = await supabase.from('students').select('id, full_name, roll_number, status').eq('class_id', sourceClass).eq('status', 'active').eq('is_deleted', false).order('roll_number');
    if (data) {
      setStudents(data);
      // Automatically select all active students by default
      setSelectedStudents(new Set(data.map(s => s.id)));
    }
    setLoading(false);
  };

  const toggleStudent = (id: string) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudents(newSet);
  };

  const toggleAll = () => {
    if (selectedStudents.size === students.length) setSelectedStudents(new Set());
    else setSelectedStudents(new Set(students.map(s => s.id)));
  };

  const handlePromote = async () => {
    if (!destClass) return alert('Please select a Destination Class.');
    if (selectedStudents.size === 0) return alert('No students selected for promotion.');
    if (sourceClass === destClass) return alert('Source and Destination cannot be the same.');
    
    if (!confirm(`Are you sure you want to promote ${selectedStudents.size} students?`)) return;

    setProcessing(true);
    try {
      // Execute bulk update
      const { error } = await supabase
        .from('students')
        .update({ class_id: destClass })
        .in('id', Array.from(selectedStudents));

      if (error) throw error;
      
      alert(`Success! Promoted ${selectedStudents.size} students.`);
      setSourceClass('');
      setDestClass('');
      setStudents([]);
    } catch (err: any) {
      alert('Error promoting students: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Promote Students</h1>
        <p className="text-gray-500 text-sm mt-1">Batch migrate students from a passing class into the next academic year class.</p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Source Class (From)</label>
            <select value={sourceClass} onChange={(e) => setSourceClass(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-gray-50">
              <option value="">Select Passing Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
            </select>
          </div>
          
          <div className="flex items-center justify-center pt-6 px-4">
            <ArrowUpRight className="w-8 h-8 text-blue-400" />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination Class (To)</label>
            <select value={destClass} onChange={(e) => setDestClass(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-green-50/30">
              <option value="">Select Next Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
            </select>
          </div>
        </div>

        {sourceClass && (
          <div className="p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No active students found in this class.</div>
            ) : (
              <div>
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <button onClick={toggleAll} className="text-gray-500 hover:text-blue-600">
                      {selectedStudents.size === students.length ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    <span className="text-sm font-medium text-gray-700">Select All ({selectedStudents.size} / {students.length})</span>
                  </div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-gray-200">
                      {students.map(stu => (
                        <tr key={stu.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleStudent(stu.id)}>
                          <td className="p-4 w-12">
                             {selectedStudents.has(stu.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                          </td>
                          <td className="p-4 font-medium text-gray-900">{stu.roll_number}</td>
                          <td className="p-4">{stu.full_name}</td>
                          <td className="p-4 text-right">
                             <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium capitalize">{stu.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
                  <button 
                    onClick={handlePromote} 
                    disabled={processing || selectedStudents.size === 0 || !destClass}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {processing ? 'Processing...' : `Promote ${selectedStudents.size} Students`} 
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
