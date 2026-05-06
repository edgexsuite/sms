import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { UserX, Download, Calendar, Filter, Phone, Search } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import { formatDate } from '../../lib/utils';
import { PageHeader, Card, Btn, Select, Input, Badge, EmptyState } from '../../components/ui';
import { motion } from 'motion/react';

interface AbsentRecord {
  student_id: string;
  full_name: string;
  roll_number: number;
  class_name: string;
  class_id: string;
  parent_whatsapp: string;
}

export default function AbsentStudentList() {
  const { userRole } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [absentList, setAbsentList] = useState<AbsentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (userRole?.school_id) fetchClasses();
  }, [userRole]);

  useEffect(() => {
    if (userRole?.school_id && date) fetchAbsent();
  }, [date, classFilter, userRole]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole!.school_id).order('name');
    setClasses(data || []);
  };

  const fetchAbsent = async () => {
    setLoading(true);
    const sid = userRole!.school_id;

    let query = supabase
      .from('attendance')
      .select('student_id, student:student_id!inner(id, full_name, roll_number, is_deleted, class:class_id(id, name, section), parent:parent_id(whatsapp_number))')
      .eq('school_id', sid)
      .eq('date', date)
      .eq('status', 'absent')
      .eq('student.is_deleted', false);

    const { data: absentData } = await query;

    let result = (absentData || []).map((a: any) => ({
      student_id: a.student_id,
      full_name: a.student?.full_name || '',
      roll_number: a.student?.roll_number || 0,
      class_name: a.student?.class ? `${a.student.class.name}-${a.student.class.section}` : '-',
      class_id: a.student?.class?.id || '',
      parent_whatsapp: a.student?.parent?.whatsapp_number || '',
    }));

    if (classFilter) result = result.filter((r: any) => r.class_id === classFilter);
    result.sort((a: any, b: any) => a.roll_number - b.roll_number);
    setAbsentList(result);
    setLoading(false);
  };

  const filteredList = absentList.filter(r => 
    r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(r.roll_number).includes(searchQuery)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        title="Absent Student List"
        subtitle="Quickly track and contact students missing from school today."
        actions={
          <Btn 
            variant="outline" 
            onClick={() => exportToCSV(`absent-${date}`, absentList, [
              { header: 'Roll No', key: 'roll_number' }, { header: 'Name', key: 'full_name' },
              { header: 'Class', key: 'class_name' }, { header: 'Parent WhatsApp', key: 'parent_whatsapp' },
            ])}
            icon={Download}
          >
            Export CSV
          </Btn>
        }
      />

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <Input
            label="Selected Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            icon={Calendar}
          />
          <Select
            label="Class Filter"
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            icon={Filter}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}-{c.section}</option>)}
          </Select>
          <Input
            label="Quick Search"
            placeholder="Search by name or roll..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            icon={Search}
          />
        </div>
      </Card>

      <div className="bg-rose-50 border border-rose-100 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-6 text-rose-900">
          <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-lg text-rose-500">
            <UserX className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight">
              {loading ? 'Crunching data...' : `${absentList.length} Absent Today`}
            </h3>
            <p className="text-sm font-bold text-rose-700/60 uppercase tracking-widest mt-1">
              Records for {formatDate(date)}
            </p>
          </div>
        </div>
        <div className="hidden md:block">
          <Badge variant="danger" className="px-6 py-2 text-sm">Critical Attention Required</Badge>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-none shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 w-16">#</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Roll No</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Student Name</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Class</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Parent Contact</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="mt-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Loading Absentee List...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={UserX}
                      title="Perfect Attendance"
                      description="No absent students found for the selected criteria. Great job!"
                    />
                  </td>
                </tr>
              ) : (
                filteredList.map((r, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={r.student_id} 
                    className="hover:bg-rose-50/30 transition-all group"
                  >
                    <td className="p-6 text-[10px] font-black text-slate-300 group-hover:text-rose-400 transition-colors">{i + 1}</td>
                    <td className="p-6">
                      <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-black text-slate-600">{r.roll_number}</span>
                    </td>
                    <td className="p-6">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{r.full_name}</p>
                    </td>
                    <td className="p-6">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{r.class_name}</p>
                    </td>
                    <td className="p-6">
                      {r.parent_whatsapp ? (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-sm font-mono">{r.parent_whatsapp}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs italic">No contact found</span>
                      )}
                    </td>
                    <td className="p-6 text-center">
                      <Btn variant="danger" size="sm" className="px-4 py-1 text-[10px] font-black uppercase tracking-widest">
                        Mark Informed
                      </Btn>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
