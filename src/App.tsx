import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { LaunchpadScreen } from './components/LaunchpadScreen';
import { KalamTribute } from './components/KalamTribute';
import { RocketModelId, BoosterPower, PayloadTargetId, LaunchStatus, Telemetry, FlightLogMessage } from './types';
import { INDIAN_ROCKETS, BOOSTER_OPTIONS, PAYLOAD_TARGETS } from './data';
import { 
  startRocketThrustEngine, 
  updateEngineSoundFrequency, 
  stopRocketThrustEngine, 
  playSuccessSignal, 
  playTickingCountdownSound 
} from './utils/audio';

export default function App() {
  // Customized specs states
  const [selectedModel, setSelectedModel] = useState<RocketModelId>('LVM3');
  const [selectedBooster, setSelectedBooster] = useState<BoosterPower>('Solid Strapon');
  const [selectedPayload, setSelectedPayload] = useState<PayloadTargetId>('Moon Orbit');
  
  // Audio state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Persistence state
  const [successfulLaunchesCount, setSuccessfulLaunchesCount] = useState<number>(0);

  // Flight simulator engine states
  const [infiniteFuelEnabled, setInfiniteFuelEnabled] = useState<boolean>(true);
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>('READY');
  const [countdown, setCountdown] = useState<number>(5);
  const [countdownTextOverride, setCountdownTextOverride] = useState<string>('');
  
  const [telemetry, setTelemetry] = useState<Telemetry>({
    altitude: 0,
    velocity: 0,
    fuelLeft: 100,
    gForce: 1.0,
    stage: 'LAUNCHPAD',
    timeElapsed: 0,
  });

  const [flightLogs, setFlightLogs] = useState<FlightLogMessage[]>([]);

  // Keep references to active intervals for cleanups
  const countdownIntervalRef = useRef<number | null>(null);
  const flightUpdateIntervalRef = useRef<number | null>(null);

  // Load persistence count on initial mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('isro_sim_success_count');
      if (cached) {
        setSuccessfulLaunchesCount(parseInt(cached, 10));
      }
    } catch (e) {
      console.warn('LocalStorage access is restricted in present frame context.', e);
    }

    // Insert startup message to terminal logs
    pushLog(
      'System ready. Primary spacecraft customization tools are online. Choose configuration and lock launcher permits.',
      'सिस्टम तैयार है। प्राथमिक रॉकेट कस्टमाइज़र चालू है। विकल्प चुनें और लॉन्च शुरू करें।'
    );

    return () => {
      // Cleanup all active intervals and stop active synthesizers on unmount
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (flightUpdateIntervalRef.current) clearInterval(flightUpdateIntervalRef.current);
      stopRocketThrustEngine();
    };
  }, []);

  // Helper to push a clean message with translation into logs
  const pushLog = (message: string, hindiMessage: string, type: 'info' | 'warning' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const newLog: FlightLogMessage = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp,
      message,
      hindiMessage,
      type,
    };
    setFlightLogs((prev) => [...prev, newLog]);
  };

  // Helper to trigger voice text-to-speech feedback using browser SpeechSynthesis
  const speakVoice = (text: string) => {
    if (!soundEnabled) return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.1; // crisp scientific tone
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn('SpeechSynthesis is unavailable in present window target.', e);
    }
  };

  // Helper to trigger countdown audios
  const handleCountdownTick = (currentTick: number) => {
    setCountdown(currentTick);
    if (soundEnabled) {
      playTickingCountdownSound();
      const numbers = ["Zero", "One", "Two", "Three", "Four", "Five"];
      if (currentTick >= 1 && currentTick <= 4) {
        speakVoice(numbers[currentTick]);
      }
    }
  };

  // Model update synchronization callbacks to update boosters automatically (preserving user choices but ensuring logical visual configurations)
  const handleModelChange = (modelId: RocketModelId) => {
    setSelectedModel(modelId);
    pushLog(
      `Spacecraft Core changed to: ${INDIAN_ROCKETS[modelId].name}`,
      `रॉकेट का ढांचा बदला गया: ${INDIAN_ROCKETS[modelId].hindiName}`
    );
    
    // Auto configure logical boosters for PSLV / SSLV if needed
    if (modelId === 'SSLV') {
      setSelectedBooster('No Booster');
      pushLog(
        `SSLV automatically configured to No Booster configuration due to lightweight payload architecture.`,
        `एसएसएलवी हल्के पेलोड के कारण बिना बूस्टर के कॉन्फ़िगर किया गया।`,
        'warning'
      );
    } else if (modelId === 'PSLV' && selectedBooster === 'Solid Strapon') {
      setSelectedBooster('Liquid Core');
      pushLog(
        `PSLV core stage equipped with modular Liquid Core vector boosters.`,
        `पीएसएलवी कोर स्टेज लिक्विड कोर बूस्टर के साथ कॉन्फ़िगर किया गया।`
      );
    } else if (modelId === 'LVM3' && selectedBooster === 'No Booster') {
      setSelectedBooster('Solid Strapon');
      pushLog(
        `LVM3 (Baahubali) heavy lifter equipped with raw Solid Strapon boosters.`,
        `एलवीएम3 (बाहुबली) भारी लिफ्टर होने के कारण सॉलिड स्ट्रैप-ऑन बूस्टर्स से लैस हुआ।`
      );
    }
  };

  const handleBoosterChange = (booster: BoosterPower) => {
    setSelectedBooster(booster);
    pushLog(
      `Auxiliary propulsion set to: ${BOOSTER_OPTIONS[booster].name}`,
      `सहायक बूस्टर कॉन्फ़िगरेशन: ${BOOSTER_OPTIONS[booster].hindiName}`
    );
  };

  const handlePayloadChange = (payload: PayloadTargetId) => {
    setSelectedPayload(payload);
    pushLog(
      `Flight trajectory target locked to: ${PAYLOAD_TARGETS[payload].name}`,
      `उड़ान मार्ग का लक्ष्य बदला गया: ${PAYLOAD_TARGETS[payload].hindiName}`
    );
  };

  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    if (!nextVal) {
      stopRocketThrustEngine();
    }
  };

  // Massive Launch Sequencer
  const triggerLaunchSequence = () => {
    // Lock controls
    setLaunchStatus('COUNTDOWN');
    setCountdown(5);
    setCountdownTextOverride('LOCKING LAUNCH ANGLE... PRE-LAUNCH SEQUENCE ENGAGED');
    
    // Clear old logs
    setFlightLogs([]);
    
    pushLog(
      `LAUNCH TRIGGERED! Mission Authorization Verified. Spec Vehicle: ${INDIAN_ROCKETS[selectedModel].name}`,
      `लॉन्च शुरू! मिशन नियंत्रण की मंजूरी मिली। विशेष यान: ${INDIAN_ROCKETS[selectedModel].hindiName}`,
      'warning'
    );
    pushLog(
      `Armed Payload: ${PAYLOAD_TARGETS[selectedPayload].name}. Propellant cores verified normal.`,
      `सक्रिय पेलोड: ${PAYLOAD_TARGETS[selectedPayload].hindiName}। प्रोपेलेंट सामान्य है।`
    );

    if (soundEnabled) {
      playTickingCountdownSound();
      speakVoice("Five");
    }

    let currentCountdown = 5;

    countdownIntervalRef.current = window.setInterval(() => {
      currentCountdown--;
      if (currentCountdown > 0) {
        handleCountdownTick(currentCountdown);
        setCountdownTextOverride(`AUTOPILOT SECURED. GROUND INERTIAL CODES LOCKED. T-${currentCountdown}s`);
        pushLog(
          `T-${currentCountdown}s countdown check. Guidance parameters verified.`,
          `टी-${currentCountdown} सेकंड। गाइडेंस परिमाप सत्यापित किए गए।`
        );
      } else {
        // Countdown reached 0 - Engage Ignition
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        executeIgnitionAndLiftoff();
      }
    }, 1000);
  };

  const executeIgnitionAndLiftoff = () => {
    const currentPayload = PAYLOAD_TARGETS[selectedPayload];
    setLaunchStatus('POWERING_UP');
    setCountdown(0);
    setCountdownTextOverride('🚀 IGNITION SUCCESSFUL! S200 BOOSTERS ARMED 🇮🇳');
    
    pushLog(
      'T-0s: MAIN CORE ENGINE IGNITION... LIQUID CORE ACTIVE!',
      'टी-0 सेकंड: मुख्य रॉकेट इंजन का दहन... लिक्विड कोर चालू!',
      'warning'
    );

    if (soundEnabled) {
      startRocketThrustEngine();
      speakVoice("Ignition. Lift off!");
    }

    // Reset physics vars
    let alt = 0;
    let vel = 0;
    let fuel = 100;
    let force = 1.0;
    let curStage = 'LAUNCHPAD';
    let elapsed = 0;

    // Sub-interval ticks every 100ms for continuous silky-smooth HUD gauge refresh
    flightUpdateIntervalRef.current = window.setInterval(() => {
      elapsed += 0.1;
      
      // 1. Calculate Fuel Consumption Rate
      // LVM3 uses fuel moderately, SSLV burns up quickly
      const fuelBurnFactor = selectedModel === 'LVM3' ? 0.65 : selectedModel === 'PSLV' ? 0.8 : 1.1;
      fuel = infiniteFuelEnabled ? 100 : Math.max(0, 100 - elapsed * 7.5 * fuelBurnFactor);

      // 2. Trajectory stages split calculations based on elapsed runtime ticks
      if (elapsed < 1.5) {
        // Ignition Phase
        curStage = 'LAUNCH IGNITION';
        vel = elapsed * 0.15;
        alt = elapsed * 0.1;
        force = 1.0 + elapsed * 1.5;
        
        if (elapsed >= 1.4 && elapsed < 1.5) {
          setLaunchStatus('ASCENDING');
          setCountdownTextOverride('LIFTOFF! Baahubali has cleared the Launch Tower!');
          pushLog(
            'T+1.5s: LIFTOFF! S200 solid rocket boosters initiated thrust. Launch vehicle cleared tower safely.',
            'टी+1.5 सेकंड: लिफ्ट ऑफ! सॉलिड रॉकेट बूस्टर्स ने जोर लगाया। यान लॉन्च टॉवर से सुरक्षित बाहर निकला।',
            'success'
          );
        }
      } else if (elapsed < 5.0) {
        // Core Stage flight
        curStage = 'STAGE 1 (SOLID CORE)';
        // Accelerating rapidly
        vel = 0.2 + (elapsed - 1.5) * 0.9 + (selectedBooster === 'Solid Strapon' ? 0.3 : 0);
        alt = 0.2 + vel * (elapsed - 1.5) * 2;
        // Peak G-force around Max Q
        force = 2.5 + (elapsed - 1.5) * 0.6;
        
        if (elapsed >= 4.9 && elapsed < 5.0) {
          setLaunchStatus('STAGE_SEPARATION');
          setCountdownTextOverride('STAGE BURN COMPLETING. DETACHING EXPENDED PROPELLANTS.');
          pushLog(
            'T+5.0s: Thrust limit threshold reached on Stage-1. Initiating pyrotechnic booster separation.',
            'टी+5.0 सेकंड: चरण-1 की सीमा पूरी। बूस्टर अलगाव की प्रक्रिया शुरू की गई।',
            'warning'
          );
        }
      } else if (elapsed < 9.5) {
        // Stage 2 Core Burn
        curStage = 'STAGE 2 (LIQUID CORE)';
        
        // Slightly damp G-force upon Stage 1 separation
        force = 1.5 + (elapsed - 5.0) * 0.4;
        vel = 3.5 + (elapsed - 5.0) * 1.8;
        alt = 24.5 + vel * (elapsed - 5.0) * 1.5;

        if (elapsed >= 9.4 && elapsed < 9.5) {
          setCountdownTextOverride('CRYOGENIC ENGINE PURGES LOCKS. DEEP SPACE TRANSIT ACTIVE');
          pushLog(
            'T+9.5s: Stage-2 separation complete. Payload Fairing discarded successfully into Mesosphere.',
            'टी+9.5 सेकंड: चरण-2 पूरा। अंतरिक्ष यान का सुरक्षा कवच सफलतापूर्वक अलग हो गया।',
            'success'
          );
        }
      } else if (elapsed < 14.0) {
        // Upper Cryogenic Stage burn in vacuum
        curStage = 'STAGE 3 (CRYOGENIC)';
        
        // High specific impulse speeds, less gravity drag in vacuum
        vel = 11.6 + (elapsed - 9.5) * 2.8;
        alt = 146.0 + vel * (elapsed - 9.5) * 6;
        force = 2.0 + (elapsed - 9.5) * 0.25;

        if (elapsed >= 13.9 && elapsed < 14.0) {
          // Reached Final Orbit Altitude Insertion!
          setLaunchStatus('INSERTION');
          setCountdownTextOverride('🛰️ DEPLOYING SPACECRAFT ELECTRONICS... COGNITIVE AUTOPILOT');
          pushLog(
            `T+14.0s: Deployed speed ${vel.toFixed(1)} km/s locked. Injecting spacecraft inside ${currentPayload.targetOrbit}.`,
            `टी+14.0 सेकंड: यान की गति ${vel.toFixed(1)} किमी/सेकंड। यान को ${currentPayload.hindiName} कक्षा में इंजेक्ट किया गया।`
          );
          if (soundEnabled) {
            speakVoice("Signal Received");
          }
        }
      } else {
        // Burn finishes - Target Orbiter inserted completely!
        if (flightUpdateIntervalRef.current) {
          clearInterval(flightUpdateIntervalRef.current);
          flightUpdateIntervalRef.current = null;
        }

        executeMissionCompletion(currentPayload, vel, alt, fuel);
      }

      // Update synth frequency according to altitude to model sound fading out as vacuum progresses
      if (soundEnabled) {
        updateEngineSoundFrequency(alt, vel);
      }

      setTelemetry({
        altitude: alt,
        velocity: vel,
        fuelLeft: infiniteFuelEnabled ? 100 : fuel,
        gForce: force,
        stage: curStage,
        timeElapsed: elapsed,
      });

    }, 100);
  };

  const executeMissionCompletion = (payload: typeof PAYLOAD_TARGETS[PayloadTargetId], finalVel: number, finalAlt: number, finalFuel: number) => {
    setLaunchStatus('SUCCESS');
    setCountdownTextOverride('');
    
    // Play telemetry satellite success beeps
    if (soundEnabled) {
      playSuccessSignal();
      stopRocketThrustEngine();
    }

    // Save success index log to storage
    try {
      const nextCount = successfulLaunchesCount + 1;
      setSuccessfulLaunchesCount(nextCount);
      localStorage.setItem('isro_sim_success_count', nextCount.toString());
    } catch (e) {
      // Local check warning
    }

    // The rocket should continue to run. Automatic reset is disabled to let the simulation persist.
  };

  const triggerDirectMoonLanding = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (flightUpdateIntervalRef.current) {
      clearInterval(flightUpdateIntervalRef.current);
      flightUpdateIntervalRef.current = null;
    }

    setLaunchStatus('SUCCESS');
    setCountdown(0);
    setCountdownTextOverride('🌕 DIRECT MOON LANDING ACTIVE - असीमित ईंधन!');
    
    // Set appropriate landing telemetry for moon touchdown descent
    setTelemetry({
      altitude: 12.5,
      velocity: 1.62,
      fuelLeft: 100,
      gForce: 1.62,
      stage: 'LUNAR LANDING DESCENT 🌕',
      timeElapsed: 11.5,
    });

    pushLog(
      'WARP ENGAGED: Spacecraft bypassed LEO. Initiating immediate lunar terrain descent touchdown sequence!',
      'वारप मोड सक्रिय: अंतरिक्ष यान सीधे चंद्र सतह पर लैंडिंग के लिए बढ़ा! सीधे चंद्रमा लैंडिंग सक्रिय।',
      'success'
    );
    speakVoice("Warp speed initiated. Bypassing Earth orbit and initiating direct lunar landing descent. Infinite fuel mode active.");
  };

  const resetSimulatorToReady = () => {
    setLaunchStatus('READY');
    setCountdown(5);
    setCountdownTextOverride('');
    
    setTelemetry({
      altitude: 0,
      velocity: 0,
      fuelLeft: 100,
      gForce: 1.0,
      stage: 'LAUNCHPAD',
      timeElapsed: 0,
    });

    pushLog(
      'Launchpad restored. Telemetry recalibrated. Systems green for subsequent customized vehicle launches.',
      'लॉन्चपैड वापस तैयार किया गया। टेलीमेट्री रीसेट हो गई है। आगामी वाहन लॉन्च के लिए प्रणालियां सुरक्षित हैं।'
    );
  };

  return (
    <div id="app" className="min-h-screen bg-[#030712] text-white flex flex-col justify-between selection:bg-[#ff9933] selection:text-[#03030a]">
      {/* Top glowing boundary */}
      <div className="fixed inset-x-0 top-0 h-0.5 bg-gradient-to-r from-orange-500 via-white to-green-600 z-50 shadow-sm" />

      {/* Header and Brand */}
      <Header 
        soundEnabled={soundEnabled} 
        onToggleSound={toggleSound} 
        successfulLaunchesCount={successfulLaunchesCount} 
      />

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto p-4 md:p-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8 items-start">
          {/* Left Column: Command customizer panel - occupies 2/5 columns on large screens */}
          <div className="lg:col-span-2">
            <ControlPanel
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              selectedBooster={selectedBooster}
              onBoosterChange={handleBoosterChange}
              selectedPayload={selectedPayload}
              onPayloadChange={handlePayloadChange}
              launchStatus={launchStatus}
              onLaunchTrigger={triggerLaunchSequence}
            />
          </div>

          {/* Right Column: Visualizer flight screen - occupies 3/5 columns */}
          <div className="lg:col-span-3">
            <LaunchpadScreen
              selectedModel={selectedModel}
              selectedBooster={selectedBooster}
              selectedPayload={selectedPayload}
              launchStatus={launchStatus}
              countdown={countdown}
              telemetry={telemetry}
              flightLogs={flightLogs}
              countdownTextOverride={countdownTextOverride}
              infiniteFuelEnabled={infiniteFuelEnabled}
              setInfiniteFuelEnabled={setInfiniteFuelEnabled}
              onTriggerDirectMoonLanding={triggerDirectMoonLanding}
            />
          </div>
        </div>

        {/* Tribute Section & APJ Quote board (full width) */}
        <KalamTribute />
      </main>

      {/* Footer disclaimer */}
      <footer className="w-full border-t border-[#1e293b] bg-[#030712] px-4 py-8 mt-12 text-center text-slate-500 text-xs tracking-wider font-mono">
        <div className="max-w-7xl mx-auto space-y-2">
          <p className="font-semibold text-slate-400">
            INDIAN SPACE GUIDE — INDEPENDENT AEROSPACE EDUCATION INITIATIVE 🇮🇳
          </p>
          <p className="max-w-2xl mx-auto text-[10px] leading-relaxed text-slate-600 uppercase">
            Designed as an immersive simulation portal for academy students. Fully synthesized audio engines and launch kinematics models operate with generalized parameters for academic interactive demonstration purposes only. Not affiliated with ISRO or the Government of India.
          </p>
          <p className="text-[9px] text-[#00f3ff] mt-2 font-bold uppercase tracking-widest">
            Jai Hind • Bharat Mata Ki Jai
          </p>
        </div>
      </footer>
    </div>
  );
}
