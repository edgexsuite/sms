import React from 'react';

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Toggle({ enabled, onChange, disabled = false, size = 'md' }: ToggleProps) {
  const trackW = size === 'sm' ? 'w-8'  : 'w-11';
  const trackH = size === 'sm' ? 'h-4'  : 'h-6';
  const thumbS = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const translateX = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      className={[
        'relative inline-flex flex-shrink-0 rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
        trackW, trackH,
        enabled  ? 'bg-indigo-600' : 'bg-slate-200',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block rounded-full bg-white shadow ring-0',
          'transition duration-200 ease-in-out',
          thumbS,
          enabled ? translateX : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}
