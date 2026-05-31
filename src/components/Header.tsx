import React from 'react';
import { Rocket, Volume2, VolumeX, Globe } from 'lucide-react';

interface HeaderProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  successfulLaunchesCount: number;
}

export function Header({ soundEnabled, onToggleSound, successfulLaunchesCount }: HeaderProps) {
  return (
    <header className="relative w-full border-b border-[#1e293b] bg-[#030712] px-6 py-4 md:px-8 shadow-md z-10 overflow-hidden">
      {/* Background ambient lighting effects restricted to a subtle tech blueprint glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-120 h-24 bg-cyan-500/5 blur-3xl pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto flex flex-col items-center justify-between gap-4 md:flex-row">
        {/* Title & Brand */}
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="flex items-center gap-3.5">
            <div className="relative w-10 h-10 bg-gradient-to-br from-[#ff9933] via-white to-[#138808] rounded-sm flex items-center justify-center shadow-lg shadow-orange-950/20 shrink-0">
              <span className="text-black font-black text-xs font-display">ISG</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-[#e0e6ed] uppercase font-display">
                Indian Space Guide
              </h1>
              <p className="text-[10px] text-[#64748b] tracking-widest font-mono uppercase mt-0.5">
                Mission Control Interface v4.0
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Badge & Interactive Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 font-mono">
          {/* India #1 Tricolor Badge */}
          <div className="bg-[#138808]/10 border border-[#138808]/30 px-3 py-1.5 rounded-sm flex items-center gap-2">
            <span className="text-[#ff9933] font-bold text-xs">INDIA</span>
            <span className="text-[#e0e6ed] font-extrabold text-[#00f3ff] text-xs">NO. 1</span>
            <span className="text-[#138808] text-xs">🇮🇳</span>
          </div>

          {/* Simulated flight logs tracker */}
          {successfulLaunchesCount > 0 && (
            <div className="bg-[#050a14] border border-[#1e293b] px-3 py-1.5 rounded-sm text-xs font-mono text-[#00f3ff] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 animate-spin-slow text-teal-400" />
              <span>MISSIONS: <strong className="text-white">{successfulLaunchesCount}</strong></span>
            </div>
          )}

          {/* Sound Control Key Button */}
          <button
            onClick={onToggleSound}
            aria-label="Toggle simulator synthesizer audio"
            className={`cursor-pointer group flex items-center gap-2 px-4 py-1.5 rounded-sm transition-all duration-300 font-medium text-[11px] tracking-wider border uppercase ${
              soundEnabled
                ? 'bg-[#00f3ff]/10 text-[#00f3ff] border-[#00f3ff]/40 hover:bg-[#00f3ff]/20 shadow-xs'
                : 'bg-[#1e293b]/40 text-[#64748b] border-[#1e293b] hover:text-[#94a3b8]'
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Audio Engine On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Audio Muted</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
