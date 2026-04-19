import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      // Redirect to dashboard after 3 seconds
      setTimeout(() => navigate('/dashboard', { replace: true }), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md z-10">
          <div className="bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/50 border border-white/10 p-10 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-500/20">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Password Updated!</h2>
            <p className="text-slate-400 text-sm">
              Your password has been successfully changed.<br />
              Redirecting you to the dashboard...
            </p>
            <div className="mt-6">
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-[grow_3s_ease-in-out_forwards]" 
                  style={{ animation: 'grow 3s ease-in-out forwards' }} />
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes grow {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-600/30 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-violet-600/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl shadow-lg border border-white/10 mb-5">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Set New Password</h1>
          <p className="text-slate-400 text-sm mt-2">Choose a strong password for your account</p>
        </div>

        {/* Form card */}
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/50 border border-white/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password */}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-12 pr-14 py-4 border border-white/10 rounded-xl text-base font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white/5 focus:bg-white/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full pl-12 pr-6 py-4 border border-white/10 rounded-xl text-base font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white/5 focus:bg-white/10"
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Passwords don't match
                </p>
              )}
              {confirmPassword && password === confirmPassword && password.length >= 6 && (
                <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white font-black text-lg py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Updating...
                </>
              ) : 'Update Password →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          This is a secure password reset. Your session is verified.
        </p>
      </div>
    </div>
  );
}
