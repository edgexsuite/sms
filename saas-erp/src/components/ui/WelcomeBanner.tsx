import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface WelcomeBannerProps {
  userName: string;
  schoolName: string;
  avatarUrl?: string;
  autoMinimize?: boolean;
}

export function WelcomeBanner({ userName, schoolName, avatarUrl, autoMinimize = true }: WelcomeBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  useEffect(() => {
    // Only show if not shown in this session
    const hasShown = sessionStorage.getItem('welcome_banner_shown');
    if (!hasShown) {
      setIsVisible(true);
      sessionStorage.setItem('welcome_banner_shown', 'true');
      
      if (autoMinimize) {
        const timer = setTimeout(() => setIsVisible(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [autoMinimize]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -40, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -20, height: 0, marginBottom: 0, filter: 'blur(10px)', transition: { duration: 0.5, ease: 'circIn' } }}
          whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
          className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-orange-500/20 mb-6 cursor-pointer group"
        >
          {/* Animated Decorative Elements */}
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" 
          />
          <motion.div 
            animate={{ 
              x: [0, 50, 0],
              y: [0, 30, 0],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-400/20 rounded-full blur-3xl pointer-events-none" 
          />

          <div className="relative flex items-center gap-6">
            <motion.div 
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="shrink-0"
            >
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={userName} 
                  className="w-20 h-20 rounded-full border-4 border-white/30 shadow-2xl object-cover" 
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl border-4 border-white/20 flex items-center justify-center text-3xl font-black shadow-2xl text-white">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
            </motion.div>
            
            <div className="flex-1 min-w-0">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-1 drop-shadow-md">
                  Good {greeting}, {userName} 👋
                </h2>
                <p className="text-orange-50 font-bold text-base md:text-lg tracking-tight opacity-90 drop-shadow-sm">
                  Welcome to <span className="text-white underline decoration-white/30 underline-offset-4">{schoolName}</span> — Let's build excellence today.
                </p>
              </motion.div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsVisible(false)}
              className="hidden md:flex w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md items-center justify-center border border-white/20 transition-all text-white hover:bg-white/20"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
