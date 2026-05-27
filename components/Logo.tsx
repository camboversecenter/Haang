
import React from 'react';

export const Logo = ({ className = "w-8 h-8", textClassName = "text-xl text-slate-800" }: { className?: string, textClassName?: string }) => {
  const isWhiteText = textClassName.includes('text-white');

  return (
    <div className="flex items-center gap-2 select-none">
      <div className={`relative flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl ${className} shadow-lg shadow-brand-500/40 ring-2 ring-white/20`}>
        <span className="text-white font-display font-bold text-lg drop-shadow-sm">ហ</span>
      </div>
      <div className="flex flex-col justify-center">
          <span className={`font-black tracking-tight ${textClassName} leading-none`}>HAANG</span>
          <span className={`text-[4px] font-bold tracking-[0.15em] uppercase leading-tight ${isWhiteText ? 'text-brand-100' : 'text-brand-600'}`}>
            SMART POS SYSTEM
          </span>
      </div>
    </div>
  );
};
