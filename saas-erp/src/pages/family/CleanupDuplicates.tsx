import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldAlert, Trash2, Users, CheckCircle, X, RefreshCw, AlertCircle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Btn } from '../../components/ui/Btn';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';

interface DuplicateGroup {
  key: string; // phone_cnic
  parents: any[];
  totalStudents: number;
}

export default function CleanupDuplicates() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const scanForDuplicates = async () => {
    if (!userRole?.school_id) return;
    setScanning(true);
    setResults(null);
    try {
      // 1. Fetch all parents
      const { data: allParents, error: pErr } = await supabase
        .from('parents')
        .select(`
          *,
          family_groups (id, family_name),
          students (id, full_name, roll_number)
        `)
        .eq('school_id', userRole.school_id);

      if (pErr) throw pErr;

      // 2. Group by phone + cnic
      const groups: Record<string, any[]> = {};
      allParents?.forEach(p => {
        const key = `${p.whatsapp_number || ''}_${p.father_cnic || ''}`;
        if (key === '_') return; // Skip empty
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });

      // 3. Filter only groups with > 1 parent
      const dupGroups: DuplicateGroup[] = Object.entries(groups)
        .filter(([_, parents]) => parents.length > 1)
        .map(([key, parents]) => ({
          key,
          parents,
          totalStudents: parents.reduce((sum, p) => sum + (p.students?.length || 0), 0)
        }));

      setDuplicates(dupGroups);
    } catch (err: any) {
      alert('Scan failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const mergeGroup = async (group: DuplicateGroup) => {
    if (!window.confirm(`Are you sure you want to merge these ${group.parents.length} records? This will move all ${group.totalStudents} students to one master family account.`)) return;

    setLoading(true);
    let success = 0;
    let failed = 0;

    try {
      // Sort by created_at to pick the oldest as master
      const sorted = [...group.parents].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const master = sorted[0];
      const redundancies = sorted.slice(1);

      for (const red of redundancies) {
        try {
          // 1. Move students to master parent and family group
          if (red.students && red.students.length > 0) {
            const { error: sErr } = await supabase
              .from('students')
              .update({
                parent_id: master.id,
                family_group_id: master.family_group_id
              })
              .eq('parent_id', red.id);
            
            if (sErr) throw sErr;
          }

          // 2. Delete redundant parent
          const { error: pDelErr } = await supabase
            .from('parents')
            .delete()
            .eq('id', red.id);
          
          if (pDelErr) throw pDelErr;

          // 3. Delete redundant family group if it's different and now empty
          if (red.family_group_id && red.family_group_id !== master.family_group_id) {
            // Check if any other parents still use this family group
            const { data: others } = await supabase
              .from('parents')
              .select('id')
              .eq('family_group_id', red.family_group_id)
              .limit(1);
            
            if (!others || others.length === 0) {
              await supabase.from('family_groups').delete().eq('id', red.family_group_id);
            }
          }

          success++;
        } catch (err) {
          console.error('Merge error for parent', red.id, err);
          failed++;
        }
      }

      alert(`Merged successfully! ${success} redundant records removed.`);
      scanForDuplicates(); // Refresh
    } catch (err: any) {
      alert('Merge process failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-aura-in">
      <PageHeader
        title="Duplicate Cleanup"
        subtitle="Merge duplicate family and parent records to maintain clean data."
        actions={
          <Btn onClick={scanForDuplicates} disabled={scanning}>
            <RefreshCw className={cn("w-4 h-4", scanning && "animate-spin")} />
            {scanning ? 'Scanning...' : 'Scan for Duplicates'}
          </Btn>
        }
      />

      {duplicates.length === 0 && !scanning && (
        <Card className="p-12 text-center text-slate-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-100" />
          <p className="font-medium text-slate-600">No duplicate families found.</p>
          <p className="text-sm">Great job! Your database looks clean.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {duplicates.map(group => (
          <Card key={group.key} className="p-6 border-amber-100 bg-amber-50/20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="indigo">{group.parents[0].whatsapp_number || 'No Phone'}</Badge>
                  {group.parents[0].father_cnic && <Badge variant="secondary">{group.parents[0].father_cnic}</Badge>}
                  <span className="text-sm font-black text-rose-600 ml-2 uppercase tracking-tighter">
                    {group.parents.length} Duplicates Found
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.parents.map((p, idx) => (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs">
                      <p className="font-bold text-slate-800">{p.father_name || p.full_name}</p>
                      <p className="text-[10px] text-slate-400">
                        Joined: {new Date(p.created_at).toLocaleDateString()} · {p.students?.length || 0} Students
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <Btn variant="primary" onClick={() => mergeGroup(group)} disabled={loading} className="bg-rose-600 hover:bg-rose-700">
                <Users className="w-4 h-4" /> Merge into One
              </Btn>
            </div>
          </Card>
        ))}
      </div>

      {duplicates.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-blue-500 shrink-0" />
          <div>
            <h4 className="font-bold text-blue-900 mb-1">How Merging Works</h4>
            <p className="text-sm text-blue-800 leading-relaxed">
              Merging will pick the oldest record as the "Master" and move all students from other duplicate records to it. 
              The redundant parent and empty family group records will be permanently deleted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
