import React from 'react';
import { motion } from 'motion/react';
import { School } from 'lucide-react';

export default function LoadingIndicator() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50/80 backdrop-blur-md">
      <div className="relative">
        {/* Animated background glow */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -inset-10 bg-indigo-500/20 blur-3xl rounded-full"
        />
        
        <div className="relative flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 rounded-2xl bg-white shadow-2xl flex items-center justify-center border border-slate-100 mb-6"
          >
            <motion.div
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute inset-2 border-t-2 border-r-2 border-indigo-600 rounded-full"
            />
            <School className="w-10 h-10 text-indigo-600 relative z-10" />
          </motion.div>
          
          <div className="space-y-2 text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-sm font-black text-slate-900 uppercase tracking-[0.3em] font-display italic"
            >
              Initializing
            </motion.p>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 120 }}
              className="h-1 bg-gradient-to-r from-transparent via-indigo-600 to-transparent mx-auto rounded-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
