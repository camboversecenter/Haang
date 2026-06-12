
import React from 'react';

export const Logo = ({ className = "w-8 h-8", textClassName = "text-xl text-slate-800" }: { className?: string, textClassName?: string }) => {
  const isWhiteText = textClassName.includes('text-white');

  return (
    <div className="flex items-center gap-2 select-none">
      <img 
        src="/icon.svg" 
        className={`object-contain rounded-xl ${className}`} 
        alt="Logo" 
        referrerPolicy="no-referrer" 
      />
      <div className="flex flex-col justify-center">
          <span className={`font-black tracking-tight ${textClassName} leading-none`}>LITTLE TONY</span>
          <span className={`text-[6px] font-bold tracking-[0.15em] uppercase leading-tight ${isWhiteText ? 'text-brand-100' : 'text-brand-600'}`}>
            APP
          </span>
      </div>
    </div>
  );
};
