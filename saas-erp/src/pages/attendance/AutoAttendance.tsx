import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Cpu, Save, Wifi, WifiOff } from 'lucide-react';

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
    await supabase.from('form_settings').upsert(
      { school_id: userRole!.school_id, form_name: 'auto_attendance', sections_config: config },
      { onConflict: 'school_id,form_name' }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const webhookEndpoint = config.webhook_url || `https://your-project.supabase.co/functions/v1/auto-attendance`;

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Cpu className="w-6 h-6 text-purple-600" /> Auto Attendance
        </h1>
        <p className="text-gray-500 text-sm mt-1">Configure RFID, biometric, or QR-based automatic attendance marking.</p>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${config.device_name ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-gray-200'}`}>
        {config.device_name ? (
          <>
            <Wifi className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium text-purple-900">Device configured: {config.device_name}</p>
              <p className="text-xs text-purple-600">Save settings and point your device to the webhook URL below.</p>
            </div>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5 text-gray-400" />
            <p className="text-gray-500 text-sm">No device configured yet. Fill in the form below to connect a device.</p>
          </>
        )}
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {/* Device Info */}
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Device Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
              <input value={config.device_name} onChange={e => setConfig({ ...config, device_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. Main Gate RFID Reader" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
              <select value={config.device_type} onChange={e => setConfig({ ...config, device_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                <option value="rfid">RFID Card Reader</option>
                <option value="biometric">Biometric (Fingerprint)</option>
                <option value="qr">QR Code Scanner</option>
                <option value="face">Face Recognition</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key (for device authentication)</label>
            <input value={config.api_key} onChange={e => setConfig({ ...config, api_key: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-purple-500"
              placeholder="Generate a secure key and enter it in both here and your device" />
            <p className="text-xs text-gray-400 mt-1">Keep this secret. The device must send this in the Authorization header.</p>
          </div>
        </div>

        {/* Webhook */}
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Webhook Endpoint</h2>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 break-all">
            POST {webhookEndpoint}
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 space-y-2">
            <p className="font-semibold text-gray-700">Expected payload from device:</p>
            <pre className="font-mono text-xs text-gray-600">{JSON.stringify({ student_id: "uuid-here", timestamp: "2026-01-15T08:30:00Z", device_key: "your-api-key" }, null, 2)}</pre>
          </div>
        </div>

        {/* Behavior */}
        <div className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Behavior Settings</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={config.auto_mark_present} onChange={e => setConfig({ ...config, auto_mark_present: e.target.checked })} />
              <div className={`w-10 h-6 rounded-full transition-colors ${config.auto_mark_present ? 'bg-purple-600' : 'bg-gray-200'}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.auto_mark_present ? 'translate-x-4' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Auto-mark as Present on scan</p>
              <p className="text-xs text-gray-400">When a student scans in, automatically record their attendance as Present</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={config.notify_parents} onChange={e => setConfig({ ...config, notify_parents: e.target.checked })} />
              <div className={`w-10 h-6 rounded-full transition-colors ${config.notify_parents ? 'bg-purple-600' : 'bg-gray-200'}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.notify_parents ? 'translate-x-4' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Notify parents on scan</p>
              <p className="text-xs text-gray-400">Send WhatsApp/SMS to parent when student arrives (requires Communication integration)</p>
            </div>
          </label>
          {config.notify_parents && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notification delay (minutes after scan)</label>
              <input type="number" min="0" max="60" value={config.notify_delay_minutes}
                onChange={e => setConfig({ ...config, notify_delay_minutes: parseInt(e.target.value) || 0 })}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
            </div>
          )}
        </div>

        <div className="p-6 flex justify-end">
          <button type="submit" disabled={saving}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg text-white transition-colors ${saved ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'} disabled:opacity-50`}>
            <Save className="w-4 h-4" /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Note:</strong> This feature requires a Supabase Edge Function to be deployed to process device webhooks.
        Contact your system administrator or refer to the developer documentation to set up the <code className="bg-blue-100 px-1 rounded">auto-attendance</code> function.
      </div>
    </div>
  );
}
