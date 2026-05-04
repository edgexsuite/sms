import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { cn, formatDate, toYYYYMMDD } from '../../lib/utils';

interface SmartDateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  className?: string;
}

/**
 * A custom date input that forces DD-MM-YYYY display format 
 * while maintaining YYYY-MM-DD for the database/logic.
 */
export function SmartDateInput({ value, onChange, className }: SmartDateInputProps) {
  const [displayText, setDisplayText] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      setDisplayText(formatDate(value));
    } else {
      setDisplayText('');
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayText(val);
    
    // If it's a complete DD-MM-YYYY, update the real value
    if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
      const converted = toYYYYMMDD(val);
      if (converted) onChange(converted);
    }
  };

  const handleBlur = () => {
    // Revert to valid value on blur
    setDisplayText(formatDate(value));
  };

  return (
    <div 
      className="relative group w-full cursor-pointer"
      onClick={() => dateInputRef.current?.showPicker()}
    >
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none z-10">
        <Calendar className="w-3.5 h-3.5" />
      </div>
      
      {/* Display text input (DD-MM-YYYY) */}
      <input
        type="text"
        placeholder="DD-MM-YYYY"
        value={displayText}
        readOnly
        className={cn(
          "bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-[11px] text-slate-900 font-bold outline-none w-full transition-all duration-200 group-hover:border-indigo-500 group-hover:ring-2 group-hover:ring-indigo-50/50 cursor-pointer h-9 placeholder:text-slate-300 placeholder:font-normal",
          className
        )}
      />

      {/* Hidden native date input for calendar picker */}
      <input 
        ref={dateInputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
      />
    </div>
  );
}
