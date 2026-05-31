import React from 'react';
import { RocketModelId, BoosterPower, PayloadTargetId, LaunchStatus } from '../types';
import { INDIAN_ROCKETS, BOOSTER_OPTIONS, PAYLOAD_TARGETS } from '../data';
import { Settings, ShieldAlert, Cpu, Orbit, Info, Zap } from 'lucide-react';

interface ControlPanelProps {
  selectedModel: RocketModelId;
  onModelChange: (modelId: RocketModelId) => void;
  selectedBooster: BoosterPower;
  onBoosterChange: (booster: BoosterPower) => void;
  selectedPayload: PayloadTargetId;
  onPayloadChange: (payload: PayloadTargetId) => void;
  launchStatus: LaunchStatus;
  onLaunchTrigger: () => void;
}

export function ControlPanel({
  selectedModel,
  onModelChange,
  selectedBooster,
  onBoosterChange,
  selectedPayload,
  onPayloadChange,
  launchStatus,
  onLaunchTrigger,
}: ControlPanelProps) {
  const currentModel = INDIAN_ROCKETS[selectedModel];
  const currentBooster = BOOSTER_OPTIONS[selectedBooster];
  const currentPayload = PAYLOAD_TARGETS[selectedPayload];

  const isLocked = launchStatus !== 'READY' && launchStatus !== 'SUCCESS';

  return (
    <div className="relative rounded-sm border border-[#1e293b] bg-[#050a14] p-6 md:p-8 shadow-2xl flex flex-col justify-between overflow-hidden">
      {/* Precision corner ticks of the Geometric Balance theme */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#00f3ff] pointer-events-none" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#00f3ff] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#00f3ff] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#00f3ff] pointer-events-none" />

      <div>
        {/* Header section */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#1e293b] mb-6">
          <Settings className="w-5 h-5 text-[#00f3ff]" />
          <div>
            <h2 className="text-sm font-bold tracking-widest text-[#00f3ff] uppercase font-display">
              Launch Configuration
            </h2>
            <p className="text-[10px] text-[#64748b] tracking-wider uppercase mt-0.5">
              PROPULSION CORES & TARGET SIMULATION
            </p>
          </div>
        </div>

        {/* 1. Rocket Model Selection */}
        <div className="mb-5 space-y-2">
          <label htmlFor="rocket-model" className="block text-[10px] text-[#94a3b8] uppercase font-semibold tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#00f3ff]" />
            1. रॉकेट का मॉडल (Model Vehicle Selection)
          </label>
          <select
            id="rocket-model"
            disabled={isLocked}
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value as RocketModelId)}
            className="w-full bg-[#0f172a] border border-[#334155] focus:border-[#00f3ff] text-slate-100 font-medium px-4 py-3 rounded-sm outline-none cursor-pointer text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
          >
            <option value="LVM3">{INDIAN_ROCKETS.LVM3.name}</option>
            <option value="PSLV">{INDIAN_ROCKETS.PSLV.name}</option>
            <option value="SSLV">{INDIAN_ROCKETS.SSLV.name}</option>
          </select>

          {/* Mini specifications display */}
          <div className="p-4 bg-[#0f172a] rounded-sm border border-[#1e293b] space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#64748b]">HEIGHT</span>
              <span className="text-[#00f3ff] font-bold">{currentModel.specs.height}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#64748b]">DIAMETER</span>
              <span className="text-[#00f3ff] font-bold">{currentModel.specs.diameter}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#64748b]">LIFTOFF MASS</span>
              <span className="text-[#00f3ff] font-bold">{currentModel.specs.liftOffMass}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#64748b]">PAYLOAD CAPACITY</span>
              <span className="text-[#ff9933] font-bold">{currentModel.specs.payloadCapacity}</span>
            </div>
            <p className="text-[11px] text-slate-400 italic pt-2 border-t border-[#1e293b] leading-relaxed font-sans">
              {currentModel.description}
            </p>
          </div>
        </div>

        {/* 2. Booster Power Settings */}
        <div className="mb-5 space-y-2">
          <label htmlFor="booster-power" className="block text-[10px] text-[#94a3b8] uppercase font-semibold tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#ff9933]" />
            2. बूस्टर पावर सेटिंग्स (Booster Integration)
          </label>
          <select
            id="booster-power"
            disabled={isLocked}
            value={selectedBooster}
            onChange={(e) => onBoosterChange(e.target.value as BoosterPower)}
            className="w-full bg-[#0f172a] border border-[#334155] focus:border-[#00f3ff] text-slate-100 font-medium px-4 py-3 rounded-sm outline-none cursor-pointer text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
          >
            <option value="Solid Strapon">सॉलिड स्ट्रैप-ऑन बूस्टर्स (Max Thrust)</option>
            <option value="Liquid Core">लिक्विड कोर बूस्टर्स (Controlled Thrust)</option>
            <option value="No Booster">बिना बूस्टर (No Booster Core Only)</option>
          </select>

          {/* Booster specs telemetry details */}
          <div className="p-4 bg-[#0f172a] rounded-sm border border-[#1e293b] space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#64748b]">THRUST STRENGTH</span>
              <span className="text-[#ff9933] font-bold">{currentBooster.thrust}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#64748b]">SPECIFIC IMPULSE (ISP)</span>
              <span className="text-[#ff9933] font-bold">{currentBooster.isp}</span>
            </div>
            <p className="text-[11px] text-slate-400 italic pt-2 border-t border-[#1e293b] leading-relaxed font-sans">
              {currentBooster.description}
            </p>
          </div>
        </div>

        {/* 3. Space Payload Target Selection */}
        <div className="mb-6 space-y-2">
          <label htmlFor="payload-target" className="block text-[10px] text-[#94a3b8] uppercase font-semibold tracking-wider flex items-center gap-1.5">
            <Orbit className="w-3.5 h-3.5 text-emerald-400" />
            3. अंतरिक्ष पेलोड (Orbital Target Destination)
          </label>
          <select
            id="payload-target"
            disabled={isLocked}
            value={selectedPayload}
            onChange={(e) => onPayloadChange(e.target.value as PayloadTargetId)}
            className="w-full bg-[#0f172a] border border-[#334155] focus:border-[#00f3ff] text-slate-100 font-medium px-4 py-3 rounded-sm outline-none cursor-pointer text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
          >
            <option value="Moon Orbit">चंद्रयान मिशन (Moon Orbit)</option>
            <option value="Mars Mission">मंगलयान मिशन (Mars Orbit)</option>
            <option value="Earth Weather">मौसम सैटेलाइट (Earth Orbit)</option>
            <option value="Gaganyaan Mission">गगनयान मिशन (Gaganyaan LEO)</option>
          </select>

          {/* Payload orbit goals details */}
          <div className="p-4 bg-[#0f172a] rounded-sm border border-[#1e293b] space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#64748b]">DESTINATION ORBIT</span>
              <span className="text-emerald-400 font-bold">{currentPayload.targetOrbit}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#64748b]">CRITICAL DISTANCE</span>
              <span className="text-emerald-400 font-bold">{currentPayload.distance}</span>
            </div>
            <p className="text-[11px] text-slate-400 italic pt-2 border-t border-[#1e293b] leading-relaxed font-sans">
              {currentPayload.description}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Giant launch system button */}
      <div>
        {/* Pre-flight diagnostics indicators */}
        <div className="grid grid-cols-3 gap-2 text-[9px] font-mono tracking-wider text-center mb-4 text-[#64748b] uppercase">
          <div className="py-1.5 bg-[#0f172a] border border-[#1e293b] rounded-sm flex items-center justify-center gap-1">
            <span className="w-1 h-1 bg-green-500 rounded-full animate-ping" />
            <span>FUEL: GD</span>
          </div>
          <div className="py-1.5 bg-[#0f172a] border border-[#1e293b] rounded-sm flex items-center justify-center gap-1">
            <span className="w-1 h-1 bg-green-500 rounded-full" />
            <span>NAVIGATION: LKD</span>
          </div>
          <div className="py-1.5 bg-[#0f172a] border border-[#1e293b] rounded-sm flex items-center justify-center gap-1">
            <span className="w-1 h-1 bg-green-500 rounded-full" />
            <span>COMMS: RDY</span>
          </div>
        </div>

        <button
          id="launch-trigger"
          disabled={isLocked}
          onClick={onLaunchTrigger}
          className="cursor-pointer relative overflow-hidden w-full bg-gradient-to-r from-[#ff5f1f] to-[#ff2e00] text-white font-black py-4 px-6 rounded-sm outline-none shadow-xl shadow-orange-950/10 select-none transition-all duration-350 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs tracking-widest uppercase font-display"
        >
          <div className="flex items-center justify-center gap-3">
            <span>READY</span>
            <span className="h-4 w-[1px] bg-white/20"></span>
            <span>
              {isLocked ? 'MISSION IN PROGRESS...' : 'INITIATE IGNITION SEQUENCE 🚀'}
            </span>
          </div>
        </button>

        {isLocked && (
          <div className="mt-3 text-center text-[10px] italic font-mono text-[#ff9933] flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Launchpad automated safeties are engaged. Please wait.</span>
          </div>
        )}
      </div>
    </div>
  );
}
