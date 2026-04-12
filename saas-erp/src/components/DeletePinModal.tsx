import React, { useState, useEffect } from 'react';
import { X, Lock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DeletePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  itemName?: string;
  schoolId: string;
}

export default function DeletePinModal({ isOpen, onClose, onConfirm, title, itemName, schoolId }: DeletePinModalProps) {
  const [pin, setPin] = useState('');
  const [correctPin, setCorrectPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSecuritySettings();
      setPin('');
      setError(false);
    }
  }, [isOpen]);

  const fetchSecuritySettings = async () => {
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', schoolId)
      .eq('form_name', 'security_settings')
      .maybeSingle();
    
    if (data && data.sections_config?.delete_pin) {
      setCorrectPin(data.sections_config.delete_pin);
    } else {
      // Fallback to default if not configured yet
      setCorrectPin('1122');
    }
  };

  const handleVerify = () => {
    setLoading(true);
    if (pin === correctPin) {
      onConfirm();
      onClose();
    } else {
      setError(true);
      setPin('');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-100 transform animate-in zoom-in-95 duration-200">
        <div className="bg-red-600 px-6 py-4 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> {title || 'Verify Deletion'}
          </h3>
          <button onClick={onClose} className="text-red-200 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          
          <h4 className="text-lg font-black text-gray-900 mb-1">Security PIN Required</h4>
          <p className="text-sm text-gray-500 mb-6 px-2">
            You are about to move <span className="font-bold text-gray-900">{itemName || 'this item'}</span> to the Trashbin. Please enter the security PIN to proceed.
          </p>

          <div className="space-y-4">
            <div className="relative">
              <input
                type="password"
                maxLength={4}
                value={pin}
                autoFocus
                onChange={(e) => {
                  setError(false);
                  setPin(e.target.value.replace(/[^0-9]/g, ''));
                }}
                onKeyDown={(e) => e.key === 'Enter' && pin.length === 4 && handleVerify()}
                placeholder="• • • •"
                className={`w-full text-center text-3xl tracking-[0.5em] font-black py-3 border-2 rounded-xl transition-all outline-none focus:ring-4 ${
                  error ? 'border-red-500 bg-red-50 focus:ring-red-100' : 'border-gray-200 focus:border-red-500 focus:ring-red-50'
                }`}
              />
              {error && (
                <p className="absolute -bottom-6 left-0 right-0 text-[10px] font-bold text-red-600 uppercase tracking-wider">
                  Invalid PIN. Access Denied.
                </p>
              )}
            </div>

            <div className="pt-4 grid grid-cols-2 gap-3">
              <button
                onClick={onClose}
                className="px-4 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={pin.length < 4 || loading}
                className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-200 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Verify
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 text-[10px] text-gray-400 font-medium text-center italic">
          Only authorized school directors can update this PIN.
        </div>
      </div>
    </div>
  );
}
