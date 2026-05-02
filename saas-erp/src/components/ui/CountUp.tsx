import React, { useState, useEffect } from 'react';

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

export function CountUp({ end, duration = 1000, prefix = '', suffix = '' }: CountUpProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const startCount = 0;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      // Easing function (easeOutExpo)
      const easedValue = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
      
      setCount(Math.floor(startCount + (end - startCount) * easedValue));

      if (progress < duration) {
        window.requestAnimationFrame(animate);
      }
    };

    window.requestAnimationFrame(animate);
  }, [end, duration]);

  return (
    <span>{prefix}{count.toLocaleString()}{suffix}</span>
  );
}
