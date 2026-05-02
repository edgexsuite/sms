import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Cpu, Save, Wifi, WifiOff, Settings as SettingsIcon, Bell, Shield, Clock } from 'lucide-react';
import { PageHeader, Card, Btn, Badge, Input, Select, Toggle } from '../../components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface DeviceConfig {
  device_name: string;
  device_type: string;
  webhook_url: string;
  api_key: string;
  auto_mark_present: boolean;
  notify_parents: boolean;
  notify_delay_minutes: number;
}

const DEFAULTS: DeviceConfig = {
  device_name: '',
  device_type: 'rfid',
  webhook_url: '',
  api_key: '',
  auto_mark_present: true,
  notify_parents: false,
  notify_delay_minutes: 15,
};

export default function AutoAttendance() {
  const { userRole } = useAuth();
  const [config, setConfig] = useState<DeviceConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) fetchConfig();
  }, [userRole]);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole!.school_id)
      .eq('form_name', 'auto_attendance')
      .maybeSingle();
    if (data?.sections_config) setConfig({ ...DEFAULTS, ...data.sections_config });
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('form_settings').upsert(
      { school_id: userRole!.school_id, form_name: 'auto_attendance', sections_config: config },
      { onConflict: 'school_id,form_name' }
    );
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const webhookEndpoint = config.webhook_url || `https://api.edgex.suite/v1/attendance/hook/${userRole?.school_id}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        title="IoT Auto Attendance"
        subtitle="Bridge the physical and digital world. Configure RFID, biometric, or QR hardware integrations."
        actions={
          <Badge variant={config.device_name ? 'success' : 'neutral'} className="px-4 py-2">
            {config.device_name ? (
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 animate-pulse" />
                <span className="text-[10px] uppercase font-black tracking-widest">Active Link</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 opacity-50">
                <WifiOff className="w-4 h-4" />
                <span className="text-[10px] uppercase font-black tracking-widest">Offline</span>
              </div>
            )}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <form onSubmit={handleSave} className="space-y-8">
            {/* Core Config */}
            <Card className="p-0 overflow-hidden shadow-xl border-none">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                  <SettingsIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-black text-slate-900 uppercase tracking-tight text-sm">Device Integration</h2>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Input
                    label="Device Alias"
                    value={config.device_name}
                    onChange={e => setConfig({ ...config, device_name: e.target.value })}
                    placeholder="e.g. Main Gate RFID"
                    className="font-bold"
                  />
                  <Select
                    label="Hardware Protocol"
                    value={config.device_type}
                    onChange={e => setConfig({ ...config, device_type: e.target.value })}
                  >
                    <option value="rfid">RFID Proximity Card</option>
                    <option value="biometric">Biometric Fingerprint</option>
                    <option value="qr">Fixed QR Scanner</option>
                    <option value="face">Face Recognition AI</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Authorization Key</label>
                  <div className="relative group">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="password"
                      value={config.api_key}
                      onChange={e => setConfig({ ...config, api_key: e.target.value })}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 pl-11 pr-4 text-sm font-mono focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner"
                      placeholder="Enter secure device token..."
                    />
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Your device must send this key in the 'X-Edge-Key' header.</p>
                </div>
              </div>
            </Card>

            {/* Automation Behavior */}
            <Card className="p-0 overflow-hidden shadow-xl border-none">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <div className="p-2 bg-emerald-500 rounded-lg shadow-lg shadow-emerald-200">
                  <Cpu className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-black text-slate-900 uppercase tracking-tight text-sm">Logic & Automation</h2>
              </div>
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <Clock className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Auto-Mark Arrival</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Record present status instantly on scan</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={config.auto_mark_present}
                    onChange={v => setConfig({ ...config, auto_mark_present: v })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <Bell className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Parent Alerts</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Trigger SMS/WhatsApp on arrival</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={config.notify_parents}
                    onChange={v => setConfig({ ...config, notify_parents: v })}
                  />
                </div>

                <AnimatePresence>
                  {config.notify_parents && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 border-t border-slate-100">
                        <Input
                          label="Notification Latency (Minutes)"
                          type="number"
                          min="0"
                          max="60"
                          value={config.notify_delay_minutes}
                          onChange={e => setConfig({ ...config, notify_delay_minutes: parseInt(e.target.value) || 0 })}
                          placeholder="Delay after scan..."
                          className="font-bold"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                <Btn
                  variant="primary"
                  type="submit"
                  disabled={saving}
                  icon={Save}
                  className={cn("px-10", saved && "bg-emerald-600 shadow-emerald-200")}
                >
                  {saved ? 'Settings Synced' : saving ? 'Synchronizing...' : 'Save Configuration'}
                </Btn>
              </div>
            </Card>
          </form>
        </div>

        {/* Webhook Guide */}
        <div className="space-y-6">
          <Card className="p-6 bg-slate-900 border-none shadow-2xl overflow-hidden relative group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700" />
            <h3 className="text-indigo-400 font-black uppercase text-[10px] tracking-widest mb-4">Cloud Endpoint</h3>
            <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-emerald-400 border border-white/5 break-all leading-relaxed mb-6">
              <span className="text-indigo-400 font-bold">POST</span> {webhookEndpoint}
            </div>
            
            <h3 className="text-indigo-400 font-black uppercase text-[10px] tracking-widest mb-4">Payload Spec</h3>
            <div className="bg-black/40 rounded-xl p-4 font-mono text-[10px] text-slate-400 border border-white/5">
              <pre className="whitespace-pre-wrap">{JSON.stringify({ 
                student_id: "...", 
                timestamp: new Date().toISOString(), 
                device_key: "..." 
              }, null, 2)}</pre>
            </div>
          </Card>

          <div className="p-6 rounded-[2rem] bg-indigo-50 border border-indigo-100">
            <h4 className="font-black text-indigo-900 text-xs uppercase tracking-tight mb-2">Integration Note</h4>
            <p className="text-[10px] text-indigo-700/80 leading-relaxed font-bold">
              This feature requires a deployed Edge Function to process device requests. 
              Ensure your hardware supports HTTPS POST requests with custom headers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
