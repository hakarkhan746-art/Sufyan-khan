import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RocketModelId, BoosterPower, PayloadTargetId, LaunchStatus, Telemetry, FlightLogMessage } from '../types';
import { INDIAN_ROCKETS, BOOSTER_OPTIONS, PAYLOAD_TARGETS } from '../data';
import { Terminal, Shield, Gauge, Activity, Radio, Sparkles, Maximize2, Minimize2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, RotateCw, Play, FastForward, Navigation, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LaunchpadScreenProps {
  selectedModel: RocketModelId;
  selectedBooster: BoosterPower;
  selectedPayload: PayloadTargetId;
  launchStatus: LaunchStatus;
  countdown: number;
  telemetry: Telemetry;
  flightLogs: FlightLogMessage[];
  countdownTextOverride: string;
  infiniteFuelEnabled: boolean;
  setInfiniteFuelEnabled: (v: boolean) => void;
  onTriggerDirectMoonLanding: () => void;
}

export function LaunchpadScreen({
  selectedModel,
  selectedBooster,
  selectedPayload,
  launchStatus,
  countdown,
  telemetry,
  flightLogs,
  countdownTextOverride,
  infiniteFuelEnabled,
  setInfiniteFuelEnabled,
  onTriggerDirectMoonLanding,
}: LaunchpadScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logTerminalEndRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPilotDeck, setShowPilotDeck] = useState(true);
  const [leftMfdTab, setLeftMfdTab] = useState<'MAP' | 'CREW'>('MAP');
  const [fps, setFps] = useState<number>(120);
  
  // Interactive Custom States for Pilot Navigation Room
  const [cameraPreset, setCameraPreset] = useState<'AUTO' | 'PAD' | 'ASCENT' | 'ORBIT' | 'EVA' | 'STATION' | 'SYSTEM' | 'COCKPIT'>('AUTO');
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [rcsActive, setRcsActive] = useState<boolean>(false);
  const [rcsDirection, setRcsDirection] = useState<'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ROLL_CCW' | 'ROLL_CW' | null>(null);
  const [satThrustActive, setSatThrustActive] = useState<boolean>(false);

  // Manual Yaw, Pitch, Roll angles controlled dynamically by pilot steer buttons
  const manualYawRef = useRef<number>(0);
  const manualPitchRef = useRef<number>(0);
  const manualRollRef = useRef<number>(0);

  const lastRenderTimeRef = useRef<number>(performance.now());
  const framesRef = useRef<number>(0);

  // Live props sync
  const propsRef = useRef({
    selectedModel,
    selectedBooster,
    selectedPayload,
    launchStatus,
    countdown,
    telemetry,
    cameraPreset,
    simSpeed,
    rcsActive,
    rcsDirection,
    satThrustActive,
  });

  useEffect(() => {
    propsRef.current = {
      selectedModel,
      selectedBooster,
      selectedPayload,
      launchStatus,
      countdown,
      telemetry,
      cameraPreset,
      simSpeed,
      rcsActive,
      rcsDirection,
      satThrustActive,
    };
  }, [selectedModel, selectedBooster, selectedPayload, launchStatus, countdown, telemetry, cameraPreset, simSpeed, rcsActive, rcsDirection, satThrustActive]);

  useEffect(() => {
    if (logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [flightLogs]);

  // Audio feedback for manual pilots interactions
  const triggerBeep = (freq = 440, duration = 0.1, type: OscillatorType = 'sine') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration + 0.05);
    } catch (e) {}
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 5, 22);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const resizeRenderer = () => {
      const width = canvas.parentElement?.clientWidth || 400;
      const height = canvas.parentElement?.clientHeight || 400;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resizeRenderer();
    window.addEventListener('resize', resizeRenderer);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45); // Lifted ambient for overall space ambience
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.0); // Bright high-fidelity main sun
    sunLight.position.set(30, 45, 10);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.65); // Accent light representing atmospheric scattering
    fillLight.position.set(-20, 15, -15);
    scene.add(fillLight);

    // Dedicated secondary Earth keylight focused straight into the Earth so it never looks black/shadowy to the pilot camera!
    const earthSunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    earthSunLight.position.set(55, 20, 40); // Illuminates the Earth globe from the front-right
    scene.add(earthSunLight);

    const enginePlumeLight = new THREE.PointLight(0xf97316, 0, 40);
    enginePlumeLight.position.set(0, -1, 0);
    scene.add(enginePlumeLight);

    // Starfield background
    const starsCount = 1500;
    const starsGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 800;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true });
    const starfield = new THREE.Points(starsGeo, starMaterial);
    scene.add(starfield);

    // Dynamic Planets Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Shared deterministic pseudo-random generator
    const hashValue = (x: number, y: number) => {
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
      return h - Math.floor(h);
    };

    // Fast 2D bilinear noise function
    const getNoise2D = (x: number, y: number) => {
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      const tx = x - x0;
      const ty = y - y0;

      // Smoothstep interpolation weights
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);

      const n00 = hashValue(x0, y0);
      const n10 = hashValue(x1, y0);
      const n01 = hashValue(x0, y1);
      const n11 = hashValue(x1, y1);

      const nx0 = n00 + (n10 - n00) * sx;
      const nx1 = n01 + (n11 - n01) * sx;

      return nx0 + (nx1 - nx0) * sy;
    };

    // Fractional Brownian Motion (fbm) for rich organic details
    const getFBM = (x: number, y: number, octaves = 4) => {
      let value = 0;
      let amplitude = 1.0;
      let frequency = 1.0;
      let maxVal = 0;
      for (let i = 0; i < octaves; i++) {
        value += getNoise2D(x * frequency, y * frequency) * amplitude;
        maxVal += amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
      }
      return value / maxVal;
    };

    // Procedural Earth Texture with fractal shorelines, continental vegetation, desert dunes, and glowing city networks
    const createProceduralEarthTexture = () => {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 512;
      const ctx = c.getContext('2d')!;

      // We generate the map pixel by pixel over a fast 256x128 grid, then upscale it smoothly!
      const w = 256, h = 128;
      const tempC = document.createElement('canvas');
      tempC.width = w; tempC.height = h;
      const tempCtx = tempC.getContext('2d')!;
      const imgData = tempCtx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          // Sphere coordinate mapping projection wrapper
          const angleX = (x / w) * Math.PI * 2;
          const angleY = (y / h) * Math.PI;
          const noiseX = Math.sin(angleX) * Math.sin(angleY) * 6.0;
          const noiseY = Math.cos(angleX) * Math.sin(angleY) * 6.0;
          const noiseZ = Math.cos(angleY) * 6.0;

          const n = getFBM(noiseX + 50, noiseY + 50, 4);

          let r = 10, g = 20, b = 50; // default deep water

          if (n < 0.44) {
            // Deep Ocean
            const oceanDepth = n / 0.44;
            r = Math.floor(6 + oceanDepth * 10);
            g = Math.floor(18 + oceanDepth * 24);
            b = Math.floor(45 + oceanDepth * 52);
          } else if (n < 0.47) {
            // Coastlines and Cyan Shelf Glows
            const shelf = (n - 0.44) / 0.03;
            r = Math.floor(16 + shelf * 20);
            g = Math.floor(70 + shelf * 100);
            b = Math.floor(120 + shelf * 125);
          } else if (n < 0.51) {
            // Beaches/Sands
            r = 234; g = 179; b = 8;
          } else if (n < 0.70) {
            // Lands and Forests
            const forest = (n - 0.51) / 0.19;
            r = Math.floor(21 + (1 - forest) * 15);
            g = Math.floor(94 + forest * 32);
            b = Math.floor(32 + forest * 12);
          } else if (n < 0.81) {
            // Brown Mountains
            const mountain = (n - 0.70) / 0.11;
            r = Math.floor(120 - mountain * 40);
            g = Math.floor(80 - mountain * 50);
            b = Math.floor(40 - mountain * 25);
          } else {
            // Snowy peaks
            r = 241; g = 245; b = 249;
          }

          // Polar Icecaps representation at North and South poles
          if (y < 12) {
            const cap = y / 12;
            r = Math.floor(r * cap + 250 * (1 - cap));
            g = Math.floor(g * cap + 253 * (1 - cap));
            b = Math.floor(b * cap + 255 * (1 - cap));
          } else if (y > h - 14) {
            const cap = (h - y) / 14;
            r = Math.floor(r * cap + 250 * (1 - cap));
            g = Math.floor(g * cap + 253 * (1 - cap));
            b = Math.floor(b * cap + 255 * (1 - cap));
          }

          // Gorgeous sparkling metro cities night lights on land surfaces
          if (n >= 0.49 && n < 0.78) {
            // Higher chance near coastlines or valley levels
            const lightChance = hashValue(x * 13, y * 29);
            if (lightChance > 0.94) {
              r = 254; g = 240; b = 138; // Brilliant warm city gold halo
            }
          }

          const idx = (y * w + x) * 4;
          data[idx] = r;
          data[idx+1] = g;
          data[idx+2] = b;
          data[idx+3] = 255;
        }
      }

      tempCtx.putImageData(imgData, 0, 0);
      // Draw smoothly interpolated temp canvas onto high-res canvas
      ctx.drawImage(tempC, 0, 0, 1024, 512);

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    };

    // Procedural Clouds Texture simulating dynamic swirling storms, fronts and cyclones
    const createProceduralCloudTexture = () => {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 512;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 1024, 512);

      const w = 256, h = 128;
      const tempC = document.createElement('canvas');
      tempC.width = w; tempC.height = h;
      const tempCtx = tempC.getContext('2d')!;
      const imgData = tempCtx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = (x / w) * 12.0;
          const ny = (y / h) * 12.0;
          // Introduce coordinate skew to simulate Coriolis cyclones swirl
          const twist = Math.sin((x / w) * Math.PI * 4) * 1.5;
          const n = getFBM(nx + twist, ny, 3);

          let alpha = 0;
          if (n > 0.44) {
            alpha = Math.floor((n - 0.44) * 200);
          }

          const idx = (y * w + x) * 4;
          data[idx] = 255;
          data[idx+1] = 255;
          data[idx+2] = 255;
          data[idx+3] = alpha;
        }
      }

      tempCtx.putImageData(imgData, 0, 0);
      ctx.drawImage(tempC, 0, 0, 1024, 512);

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    };

    // Procedural Moon Texture (Highly Cratered with Lunar Maria and shaded rims)
    const createProceduralMoonTexture = () => {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 512;
      const ctx = c.getContext('2d')!;

      // Background basalt rock grey
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 0, 1024, 512);

      const w = 256, h = 128;
      const tempC = document.createElement('canvas');
      tempC.width = w; tempC.height = h;
      const tempCtx = tempC.getContext('2d')!;
      const imgData = tempCtx.createImageData(w, h);
      const data = imgData.data;

      // Render Maria (basalt flat seas)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const angleX = (x / w) * Math.PI * 2;
          const angleY = (y / h) * Math.PI;
          const nx = Math.sin(angleX) * Math.sin(angleY) * 5.0;
          const ny = Math.cos(angleX) * Math.sin(angleY) * 5.0;
          const n = getFBM(nx + 100, ny + 100, 3);

          let r = 100, g = 116, b = 139;
          if (n < 0.44) {
            // Deep Lunar seas (Maria)
            r = 44; g = 52; b = 64;
          } else if (n < 0.55) {
            const ratio = (n - 0.44) / 0.11;
            r = Math.floor(44 + ratio * 56);
            g = Math.floor(52 + ratio * 64);
            b = Math.floor(64 + ratio * 75);
          } else {
            // Silvery highlands
            const ratio = Math.min((n - 0.55) / 0.45, 1.0);
            r = Math.floor(100 + ratio * 48);
            g = Math.floor(116 + ratio * 38);
            b = Math.floor(139 + ratio * 28);
          }

          const idx = (y * w + x) * 4;
          data[idx] = r;
          data[idx+1] = g;
          data[idx+2] = b;
          data[idx+3] = 255;
        }
      }
      tempCtx.putImageData(imgData, 0, 0);
      ctx.drawImage(tempC, 0, 0, 1024, 512);

      // Tycho Crater light rays
      const tx = 620, ty = 400;
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.18)';
      ctx.lineWidth = 1.0;
      for (let angle = 0; angle < 360; angle += 15) {
        const rad = angle * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + Math.cos(rad) * 400, ty + Math.sin(rad) * 400);
        ctx.stroke();
      }

      // Draw beautifully shaded 3D relief craters instead of flat circles (rotis)
      for (let i = 0; i < 75; i++) {
        const crX = hashValue(i * 12, 17) * 1024;
        const crY = hashValue(i * 35, 43) * 512;
        const radius = hashValue(i * 7, 85) * 20 + 3.0;

        // Shadowed interior cavity
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.beginPath();
        ctx.arc(crX, crY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Shaded lighter basin sand bed
        ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
        ctx.beginPath();
        ctx.arc(crX - radius * 0.1, crY - radius * 0.1, radius * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // Light-side solar rim highlight
        ctx.strokeStyle = 'rgba(241, 245, 249, 0.45)';
        ctx.lineWidth = radius > 12 ? 2.5 : 1.2;
        ctx.beginPath();
        ctx.arc(crX, crY, radius, Math.PI * 0.75, Math.PI * 1.75);
        ctx.stroke();

        // Shadow opposite rim highlight
        ctx.strokeStyle = 'rgba(15, 21, 30, 0.75)';
        ctx.beginPath();
        ctx.arc(crX, crY, radius, Math.PI * 1.75, Math.PI * 0.75);
        ctx.stroke();

        // Central peak for large crated pits
        if (radius > 11) {
          ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
          ctx.beginPath();
          ctx.arc(crX - radius * 0.08, crY - radius * 0.08, radius * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    };

    // Procedural Mars Desert canyons texture
    const createProceduralMarsTexture = () => {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 512;
      const ctx = c.getContext('2d')!;

      const w = 256, h = 128;
      const tempC = document.createElement('canvas');
      tempC.width = w; tempC.height = h;
      const tempCtx = tempC.getContext('2d')!;
      const imgData = tempCtx.createImageData(w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = (x / w) * 6.0;
          const ny = (y / h) * 6.0;
          const n = getFBM(nx + 10, ny + 10, 4);

          // Terracotta red iron oxides
          let r = 154, g = 52, b = 18; // base rust orange
          if (n < 0.45) {
            r = 69; g = 10; b = 10; // dark desert valleys
          } else if (n < 0.65) {
            const ratio = (n - 0.45) / 0.20;
            r = Math.floor(69 + ratio * 85);
            g = Math.floor(10 + ratio * 42);
            b = Math.floor(10 + ratio * 8);
          } else {
            // Bright dusty dunes
            const ratio = (n - 0.65) / 0.35;
            r = Math.floor(154 + ratio * 80);
            g = Math.floor(52 + ratio * 40);
            b = Math.floor(18 + ratio * 10);
          }

          // Polar CO2 dry-ice caps
          if (y < 12) {
            r = 241; g = 245; b = 249;
          } else if (y > h - 13) {
            r = 241; g = 245; b = 249;
          }

          const idx = (y * w + x) * 4;
          data[idx] = r;
          data[idx+1] = g;
          data[idx+2] = b;
          data[idx+3] = 255;
        }
      }

      tempCtx.putImageData(imgData, 0, 0);
      ctx.drawImage(tempC, 0, 0, 1024, 512);

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    };

    const earthTexture = createProceduralEarthTexture();
    const cloudsTexture = createProceduralCloudTexture();
    const moonTexture = createProceduralMoonTexture();
    const marsTexture = createProceduralMarsTexture();

    // 1. Earth (Globe) with highly reflective material, realistic roughness, and a subtle glowing night-side
    const earthGeo = new THREE.SphereGeometry(15, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.62,
      metalness: 0.08,
      emissive: new THREE.Color(0x0a142e), // Ambient cosmic backspace luminescence so the dark side is softly blue
      emissiveIntensity: 0.45,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // Dynamic Rayleigh-scattering Atmospheric backglow - using basic material so it shines self-luminous!
    const atmosphereGeo = new THREE.SphereGeometry(15.5, 32, 32);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff, // Beautiful deep-sky atmospheric cyan glow
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    globeGroup.add(atmosphereMesh);

    // 2. Real Moon - Created as a separate gorgeous celestial sphere orbiting Earth!
    const moonGeo = new THREE.SphereGeometry(3.6, 24, 24);
    const moonMat = new THREE.MeshStandardMaterial({ map: moonTexture, roughness: 0.82, metalness: 0.04 });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(28, 12, -26); // exquisite coordinate layout matching image 1
    globeGroup.add(moonMesh);

    // Volumetric cloud shield
    const cloudsGeo = new THREE.SphereGeometry(15.15, 32, 32);
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsTexture,
      transparent: true,
      opacity: 0.46, // brighter, crisper cloud layers
      roughness: 0.95,
      blending: THREE.NormalBlending,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    globeGroup.add(cloudsMesh);

    globeGroup.position.set(18, -4, -30);

    // Ground dragging mechanism
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let rotationX = 0, rotationY = 0;
    let targetRotationX = 0, targetRotationY = 0;

    const onPointerDown = (clientX: number, clientY: number) => {
      isDragging = true;
      dragStartX = clientX; dragStartY = clientY;
    };
    const onPointerMove = (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const deltaX = clientX - dragStartX;
      const deltaY = clientY - dragStartY;
      targetRotationX += deltaX * 0.007;
      targetRotationY = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationY + deltaY * 0.007));
      dragStartX = clientX; dragStartY = clientY;
    };
    const onPointerUp = () => { isDragging = false; };

    const handleMouseDown = (e: MouseEvent) => onPointerDown(e.clientX, e.clientY);
    const handleMouseMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY);
    const handleTouchStart = (e: TouchEvent) => { if (e.touches.length > 0) onPointerDown(e.touches[0].clientX, e.touches[0].clientY); };
    const handleTouchMove = (e: TouchEvent) => { if (e.touches.length > 0) onPointerMove(e.touches[0].clientX, e.touches[0].clientY); };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // 3. Two Real Space-Suit Astronauts constructor
    const buildRealisticAstronaut = (isCommander: boolean) => {
      const astronaut = new THREE.Group();
      const whiteSuitMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.1 });
      const goldVisorMat = new THREE.MeshStandardMaterial({ color: 0xffb700, roughness: 0.02, metalness: 0.98 });
      const jointMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const StripeColor = isCommander ? 0xef4444 : 0x0284c7; // Red for Commander, Blue for Co-Pilot
      const StripeMat = new THREE.MeshStandardMaterial({ color: StripeColor });

      // Torso
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 1.6, 16), whiteSuitMat);
      astronaut.add(torso);

      // Chest PACK controls
      const chestPack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.22), whiteSuitMat);
      chestPack.position.set(0, 0.3, 0.55);
      torso.add(chestPack);

      const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.23), StripeMat);
      chestStripe.position.set(0, 0.44, 0.55);
      torso.add(chestStripe);

      const ledL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      ledL.position.set(-0.15, 0.2, 0.65);
      torso.add(ledL);

      const ledR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      ledR.position.set(0.15, 0.2, 0.65);
      torso.add(ledR);

      // PLSS Backpack Unit
      const plssBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.7, 0.6), whiteSuitMat);
      plssBox.position.set(0, 0.1, -0.55);
      astronaut.add(plssBox);

      // Indian Flag painted on back
      const flagSaffron = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.01), new THREE.MeshBasicMaterial({ color: 0xff9933 }));
      flagSaffron.position.set(0, 0.45, 0.31);
      const flagWhite = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      flagWhite.position.set(0, 0.35, 0.31);
      const flagGreen = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.01), new THREE.MeshBasicMaterial({ color: 0x138808 }));
      flagGreen.position.set(0, 0.25, 0.31);
      plssBox.add(flagSaffron, flagWhite, flagGreen);

      // Support oxygen tube
      const oxygenTube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), jointMat);
      oxygenTube.rotation.z = Math.PI / 3;
      oxygenTube.position.set(-0.5, 0.35, 0);
      astronaut.add(oxygenTube);

      // Helmet & Shiny Gold Visor
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), whiteSuitMat);
      helmet.position.y = 1.15;
      astronaut.add(helmet);

      const visor = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 16, 0, Math.PI * 2, 0.1, Math.PI / 1.7), goldVisorMat);
      visor.position.set(0, 1.15, 0.16);
      visor.rotation.x = 0.25;
      astronaut.add(visor);

      // Shoulder stripe identifiers
      const shoulderL = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16), StripeMat);
      shoulderL.rotation.z = Math.PI / 2;
      shoulderL.position.set(-0.7, 0.6, 0);
      astronaut.add(shoulderL);
      const shoulderR = shoulderL.clone();
      shoulderR.position.x = 0.7;
      astronaut.add(shoulderR);

      // Limbs Group
      const leftArmGroup = new THREE.Group();
      leftArmGroup.position.set(-0.85, 0.6, 0);
      const armLUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.7, 12), whiteSuitMat);
      armLUpper.position.y = -0.35;
      leftArmGroup.add(armLUpper);
      const armLLower = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.6, 12), whiteSuitMat);
      armLLower.position.y = -0.9;
      leftArmGroup.add(armLLower);
      const gloveL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), jointMat);
      gloveL.position.y = -1.25;
      leftArmGroup.add(gloveL);
      astronaut.add(leftArmGroup);

      const rightArmGroup = new THREE.Group();
      rightArmGroup.position.set(0.85, 0.6, 0);
      const armRUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.7, 12), whiteSuitMat);
      armRUpper.position.y = -0.35;
      rightArmGroup.add(armRUpper);
      const armRLower = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.6, 12), whiteSuitMat);
      armRLower.position.y = -0.9;
      rightArmGroup.add(armRLower);
      const gloveR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), jointMat);
      gloveR.position.y = -1.25;
      rightArmGroup.add(gloveR);
      astronaut.add(rightArmGroup);

      // Legs Group
      const leftLegGroup = new THREE.Group();
      leftLegGroup.position.set(-0.35, -0.8, 0);
      const legLUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.8, 12), whiteSuitMat);
      legLUpper.position.y = -0.4;
      leftLegGroup.add(legLUpper);
      const legLLower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.7, 12), whiteSuitMat);
      legLLower.position.y = -1.1;
      leftLegGroup.add(legLLower);
      const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.38), jointMat);
      bootL.position.set(0, -1.45, 0.08);
      leftLegGroup.add(bootL);
      astronaut.add(leftLegGroup);

      const rightLegGroup = new THREE.Group();
      rightLegGroup.position.set(0.35, -0.8, 0);
      const legRUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.8, 12), whiteSuitMat);
      legRUpper.position.y = -0.4;
      rightLegGroup.add(legRUpper);
      const legRLower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.7, 12), whiteSuitMat);
      legRLower.position.y = -1.1;
      rightLegGroup.add(legRLower);
      const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.38), jointMat);
      bootR.position.set(0, -1.45, 0.08);
      rightLegGroup.add(bootR);
      astronaut.add(rightLegGroup);

      astronaut.scale.setScalar(0.72);

      return {
        group: astronaut,
        leftArm: leftArmGroup, rightArm: rightArmGroup,
        leftLeg: leftLegGroup, rightLeg: rightLegGroup,
      };
    };

    const astroCommander = buildRealisticAstronaut(true);
    const astroPilot = buildRealisticAstronaut(false);

    // Unified Astronaut Team Group
    const astronautGroup = new THREE.Group();
    astronautGroup.add(astroCommander.group);
    astronautGroup.add(astroPilot.group);
    scene.add(astronautGroup);
    astronautGroup.visible = false;

    // Small glowing field terminal box next to astronauts on Earth
    const terminalGeo = new THREE.BoxGeometry(0.6, 0.7, 0.4);
    const terminalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const fieldTerminal = new THREE.Mesh(terminalGeo, terminalMat);
    const terminalScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x00f3ff }));
    terminalScreen.position.set(0, 0, 0.21);
    fieldTerminal.add(terminalScreen);
    scene.add(fieldTerminal);
    fieldTerminal.visible = false;

    // 4. Upgraded Real NASA ISS Space Station Builder
    const buildProceduralSpaceStation = () => {
      const station = new THREE.Group();
      const metallicMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.15, metalness: 0.9 });
      const trussMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
      const solarMat = new THREE.MeshStandardMaterial({ color: 0xe07a1b, roughness: 0.3, metalness: 0.7 });
      const cellMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.95 });

      // Truss
      const trussBeam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 12.0), trussMat);
      station.add(trussBeam);

      for (let zVal = -5; zVal <= 5; zVal += 1.5) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.1), trussMat);
        brace.position.z = zVal;
        station.add(brace);
      }

      // Modules Core
      const modules = new THREE.Group();
      const labNode = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 3.0, 16), metallicMat);
      labNode.rotation.z = Math.PI / 2;
      modules.add(labNode);

      const transverseNode = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.5, 16), metallicMat);
      transverseNode.position.set(-1.0, 0, 0.6);
      modules.add(transverseNode);

      // White thermal sheets
      const radL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 0.04), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }));
      radL.position.set(0, 0, -2.2);
      radL.rotation.y = Math.PI / 4;
      station.add(radL);

      // Huge Solar array panels wings
      for (let side = -1; side <= 1; side += 2) {
        if (side === 0) continue;
        const arrayNode = new THREE.Group();
        arrayNode.position.set(0, 0, side * 5.6);

        for (let wing = -1; wing <= 1; wing += 2) {
          if (wing === 0) continue;
          const wingGroup = new THREE.Group();
          wingGroup.position.set(0, wing * 2.1, 0);

          const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.8, 8), trussMat);
          wingGroup.add(spine);

          const paneL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.4, 0.04), solarMat);
          paneL.position.x = -0.85;
          const gridL = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.2, 0.06), cellMat);
          gridL.position.set(-0.85, 0, 0);
          wingGroup.add(paneL, gridL);

          const paneR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.4, 0.04), solarMat);
          paneR.position.x = 0.85;
          const gridR = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.2, 0.06), cellMat);
          gridR.position.set(0.85, 0, 0);
          wingGroup.add(paneR, gridR);

          arrayNode.add(wingGroup);
        }
        station.add(arrayNode);
      }

      // Canadarm2 robot arm
      const arm = new THREE.Group();
      arm.position.set(-0.8, 0.45, -0.4);
      const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), metallicMat);
      s1.position.set(-0.4, 0.5, 0);
      s1.rotation.z = Math.PI / 4;
      arm.add(s1);
      station.add(arm);

      station.add(modules);
      station.scale.setScalar(0.75);
      return station;
    };

    const stationGroup = buildProceduralSpaceStation();
    scene.add(stationGroup);
    stationGroup.visible = false;

    // 5. Terrestrial Stand & Pad Assets (Highly Detailed Saturn-V Gantry and Clamps)
    const launchpadGroup = new THREE.Group();
    scene.add(launchpadGroup);

    // Sriharikota landscape ground map texture generator
    const createGroundMapTexture = () => {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 512;
      const ctx = c.getContext('2d')!;
      
      // Paint ocean base (representing beach coastal water)
      ctx.fillStyle = '#1e3a5f'; 
      ctx.fillRect(0, 0, 512, 512);
      
      // Main green coastal landmass
      ctx.fillStyle = '#1b4332'; 
      ctx.beginPath();
      ctx.arc(256, 256, 220, 0, Math.PI * 2);
      ctx.fill();
      
      // Concrete road networks & crawlerway tracks to hangar
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(256, 256);
      ctx.lineTo(256, 450); // straight line from pad down south
      ctx.lineTo(120, 450); // west terminal to control center
      ctx.stroke();

      // Sand shoreline highlight
      ctx.strokeStyle = '#dfc29c';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(256, 256, 220, 0, Math.PI * 2);
      ctx.stroke();

      // Helipad painted layout H
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(380, 320, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 20px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', 380, 320);

      const tex = new THREE.CanvasTexture(c);
      return tex;
    };

    // Huge realistic Sriharikota terrestrial ground plane
    const groundTex = createGroundMapTexture();
    const groundGeo = new THREE.PlaneGeometry(280, 280);
    const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0.05 });
    const groundPlane = new THREE.Mesh(groundGeo, groundMat);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -1.5;
    launchpadGroup.add(groundPlane);

    // Beautiful low-poly spaceport utility tow tractor next to rocket
    const createSpaceportTractor = () => {
      const tractorGroup = new THREE.Group();

      const tractBodyMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35, metalness: 0.6 }); // Safety yellow
      const tractMetalMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.95 }); // Silver metal
      const tractTireMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 }); // Dark rubber
      const tractGlassMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7, roughness: 0.1 }); // Blue glass

      // Main chassis box
      const mainChassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 2.8), tractMetalMat);
      mainChassis.position.y = 0.25;
      tractorGroup.add(mainChassis);

      // Yellow engine compartment cover
      const engCover = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.4), tractBodyMat);
      engCover.position.set(0, 0.75, -0.6);
      tractorGroup.add(engCover);

      // Yellow driver cockpit/cabin
      const cabPl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.1), tractBodyMat);
      cabPl.position.set(0, 0.85, 0.65);
      tractorGroup.add(cabPl);

      // Cabin translucent glass screen
      const windgl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.9), tractGlassMat);
      windgl.position.set(0, 0.9, 0.66);
      tractorGroup.add(windgl);

      // 4 Wheels (Rear are bigger heavy-haulage dumper tires)
      const rearWheelP = new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12);
      rearWheelP.rotateZ(Math.PI / 2);
      const frontWheelP = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
      frontWheelP.rotateZ(Math.PI / 2);

      const rWheelL = new THREE.Mesh(rearWheelP, tractTireMat);
      rWheelL.position.set(-0.85, 0.55, 0.8);
      tractorGroup.add(rWheelL);

      const rWheelR = rWheelL.clone();
      rWheelR.position.x = 0.85;
      tractorGroup.add(rWheelR);

      const fWheelL = new THREE.Mesh(frontWheelP, tractTireMat);
      fWheelL.position.set(-0.78, 0.38, -0.9);
      tractorGroup.add(fWheelL);

      const fWheelR = fWheelL.clone();
      fWheelR.position.x = 0.78;
      tractorGroup.add(fWheelR);

      // Vertical glossy exhaust pipe standard
      const exhaustEx = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), tractMetalMat);
      exhaustEx.position.set(0.45, 1.2, -0.7);
      tractorGroup.add(exhaustEx);

      // Bright yellow headlights glowing
      const lightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      lightMesh.position.set(-0.45, 0.7, -1.35);
      tractorGroup.add(lightMesh);
      const lightMeshR = lightMesh.clone();
      lightMeshR.position.x = 0.45;
      tractorGroup.add(lightMeshR);

      return tractorGroup;
    };

    const towTractorGroup = createSpaceportTractor();
    towTractorGroup.position.set(4.0, -1.5, 3.2); // positioned near the launchpad crew
    towTractorGroup.rotation.y = -Math.PI / 3;
    launchpadGroup.add(towTractorGroup);

    // Assembly hangar building in Sriharikota spaceport
    const vHangar = new THREE.Group();
    vHangar.position.set(0, -1.5, -45);
    launchpadGroup.add(vHangar);

    const hCyl = new THREE.Mesh(new THREE.BoxGeometry(14, 22, 16), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.45 }));
    hCyl.position.y = 11;
    vHangar.add(hCyl);

    const hDoor = new THREE.Mesh(new THREE.BoxGeometry(8, 17, 0.2), new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.8 }));
    hDoor.position.set(0, 8.5, 8.1);
    vHangar.add(hDoor);

    // Mission Control Center (MCC)
    const mccHouse = new THREE.Group();
    mccHouse.position.set(-25, -1.5, -30);
    launchpadGroup.add(mccHouse);

    const mccBase = new THREE.Mesh(new THREE.BoxGeometry(12, 6.0, 10), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 }));
    mccBase.position.y = 3;
    mccHouse.add(mccBase);

    // Communications Telemetry Satellite dish
    const mccDish = new THREE.Group();
    mccDish.position.set(0, 6, 0);
    mccHouse.add(mccDish);

    const dishPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.0, 8), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 }));
    dishPole.position.y = 1;
    mccDish.add(dishPole);

    const dishCup = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 0.2, 0.7, 12), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.85, roughness: 0.15 }));
    dishCup.position.y = 2.2;
    dishCup.rotation.x = Math.PI / 4;
    mccDish.add(dishCup);

    // Lightning defense tower masts around launch pad base
    for (let index = 0; index < 4; index++) {
      const angle = (index * Math.PI) / 2 + Math.PI / 4;
      const mastGroup = new THREE.Group();
      mastGroup.position.set(Math.cos(angle) * 16, -1.5, Math.sin(angle) * 16);
      launchpadGroup.add(mastGroup);

      const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.3, 18.0, 8), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, wireframe: true }));
      mastMesh.position.y = 9.0;
      mastGroup.add(mastMesh);

      // Warning red blinking marker beacon on peak
      const beaconLamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      beaconLamp.position.y = 18.1;
      mastGroup.add(beaconLamp);
    }

    // Cryogenic sphere tank storage
    const cryoSphere = new THREE.Mesh(new THREE.SphereGeometry(3.0, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.7 }));
    cryoSphere.position.set(20, 1.5, -15);
    launchpadGroup.add(cryoSphere);

    // Sriharikota low-poly Tropical Palm Trees scenery scattered on grasslands
    for (let t = 0; t < 12; t++) {
      const pTree = new THREE.Group();
      const tAngle = Math.random() * Math.PI * 2;
      const tRadius = 35 + Math.random() * 40;
      pTree.position.set(Math.cos(tAngle) * tRadius, -1.5, Math.sin(tAngle) * tRadius);
      launchpadGroup.add(pTree);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 4.0, 8), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
      trunk.position.y = 2.0;
      trunk.rotation.z = (Math.random() - 0.5) * 0.18;
      pTree.add(trunk);

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 });
      for (let l = 0; l < 5; l++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.25, 4), leafMat);
        leaf.position.set(0, 3.8, 0);
        leaf.rotation.set(0.32, (l * Math.PI * 2) / 5, 0);
        pTree.add(leaf);
      }
    }

    // 8. Hyper-Realistic Astronaut Pilot Cockpit Interior Structure
    const cabinInteriorGroup = new THREE.Group();
    scene.add(cabinInteriorGroup);
    cabinInteriorGroup.visible = false;
    const joysticksList: THREE.Mesh[] = [];

    // Outer bulkhead padded wall panel
    const paddedBulkhead = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.8, 0.15), new THREE.MeshStandardMaterial({ color: 0x24252d, roughness: 0.82 }));
    paddedBulkhead.position.set(0, 0, -1.5);
    cabinInteriorGroup.add(paddedBulkhead);

    // Two active Flight Seats (ISRO space orange color straps and cushions)
    const seatBaseMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    const seatOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 }); // ISRO Orange

    for (let isLeft = -1; isLeft <= 1; isLeft += 2) {
      if (isLeft === 0) continue;
      const xOffset = isLeft * 1.25;
      const seatSeat = new THREE.Group();
      seatSeat.position.set(xOffset, -0.75, -0.4);
      cabinInteriorGroup.add(seatSeat);

      // Seat cushion
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.92), seatBaseMat);
      seatSeat.add(baseMesh);

      // Back cushion angled slightly back
      const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.5, 0.12), seatBaseMat);
      backMesh.position.set(0, 0.75, -0.42);
      backMesh.rotation.x = -0.15;
      seatSeat.add(backMesh);

      // Orange headrest
      const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.32, 0.16), seatOrangeMat);
      headMesh.position.set(0, 1.55, -0.48);
      seatSeat.add(headMesh);

      // Safety belts straps
      const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.03), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
      strapL.position.set(-0.22, 0.75, -0.35);
      strapL.rotation.x = -0.15;
      seatSeat.add(strapL);
      const strapR = strapL.clone();
      strapR.position.x = 0.22;
      seatSeat.add(strapR);

      // Physical Pilot Astronaut seated in Spacesuit inside Cockpit Room
      const seatPilot = buildRealisticAstronaut(isLeft === -1);
      seatPilot.leftLeg.rotation.x = -Math.PI / 2.3;
      seatPilot.rightLeg.rotation.x = -Math.PI / 2.3;
      seatPilot.leftArm.rotation.x = -Math.PI / 3.8;
      seatPilot.rightArm.rotation.x = -Math.PI / 3.8;
      seatPilot.group.position.set(0, 0.06, -0.15);
      seatPilot.group.scale.setScalar(0.72);
      seatSeat.add(seatPilot.group);

      // Mechanical flight steering joystick controllers
      const stickBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.15, 8), seatBaseMat);
      stickBase.position.set(0.4, 0.15, 0.24);
      seatSeat.add(stickBase);

      const stickHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x09090b }));
      stickHandle.position.set(0.4, 0.3, 0.24);
      stickHandle.rotation.x = -0.06;
      seatSeat.add(stickHandle);
      joysticksList.push(stickHandle);
    }

    // Live glowing control instrument telemetry panels
    const controlConsoleGroup = new THREE.Group();
    controlConsoleGroup.position.set(0, 0.15, 0.55);
    cabinInteriorGroup.add(controlConsoleGroup);

    const bridgeFrame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.15, 0.12), new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.35 }));
    bridgeFrame.rotation.x = -Math.PI / 6; // angled matching eye levels
    controlConsoleGroup.add(bridgeFrame);

    // Canvas textured glows with active lines, speed gauges, warning meters
    const makeConsoleScreenTex = (typeNum: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 128;
      const cCtx = canvas.getContext('2d')!;

      cCtx.fillStyle = '#060f1e';
      cCtx.fillRect(0, 0, 256, 128);

      cCtx.strokeStyle = 'rgba(6, 182, 212, 0.18)';
      cCtx.lineWidth = 1;
      for (let x = 0; x < 256; x += 16) {
        cCtx.beginPath(); cCtx.moveTo(x, 0); cCtx.lineTo(x, 128); cCtx.stroke();
      }
      for (let y = 0; y < 128; y += 16) {
        cCtx.beginPath(); cCtx.moveTo(0, y); cCtx.lineTo(256, y); cCtx.stroke();
      }

      if (typeNum === 1) {
        // Active flight vector curve
        cCtx.strokeStyle = '#22c55e';
        cCtx.lineWidth = 2.5;
        cCtx.beginPath();
        cCtx.moveTo(20, 110);
        cCtx.bezierCurveTo(70, 110, 150, 40, 230, 25);
        cCtx.stroke();

        cCtx.fillStyle = 'rgba(34, 197, 94, 0.08)';
        cCtx.lineTo(230, 110); cCtx.lineTo(20, 110);
        cCtx.fill();

        cCtx.fillStyle = '#06b6d4';
        cCtx.font = 'bold 8.5px sans-serif';
        cCtx.fillText('ISRO GAGANYAAN REALTIME MAP', 10, 16);
        cCtx.fillStyle = '#ef4444';
        cCtx.fillText('ORBIT INSERTION CURVE', 10, 30);
      } else {
        // Live gauges numeric grid
        cCtx.fillStyle = '#eab308';
        cCtx.font = 'bold 9px sans-serif';
        cCtx.fillText('LIFE SUPPORT: OK (98.4%)', 10, 18);

        cCtx.fillStyle = '#38bdf8';
        cCtx.font = '7px monospace';
        cCtx.fillText('CABIN PRESS: 101.3 KPA', 10, 38);
        cCtx.fillText('O2 MIX: 21.0% METRIC', 10, 50);
        cCtx.fillText('BATTERY BANK: ACTIVE (A)', 10, 62);
        cCtx.fillText('RCS ROCKETS: ENABLED', 10, 74);

        // Attitude indicator ball
        cCtx.strokeStyle = '#38bdf8';
        cCtx.lineWidth = 1.5;
        cCtx.beginPath();
        cCtx.arc(190, 64, 28, 0, Math.PI * 2);
        cCtx.stroke();
        
        cCtx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        cCtx.beginPath();
        cCtx.arc(190, 64, 28, 0, Math.PI);
        cCtx.fill();
      }

      return new THREE.CanvasTexture(canvas);
    };

    const cScreenL = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.82), new THREE.MeshBasicMaterial({ map: makeConsoleScreenTex(1) }));
    cScreenL.position.set(-0.72, 0, 0.08);
    cScreenL.rotation.x = -Math.PI / 6;
    controlConsoleGroup.add(cScreenL);

    const cScreenR = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.82), new THREE.MeshBasicMaterial({ map: makeConsoleScreenTex(2) }));
    cScreenR.position.set(0.72, 0, 0.08);
    cScreenR.rotation.x = -Math.PI / 6;
    controlConsoleGroup.add(cScreenR);

    // Glowing miniature status control button lights
    for (let blink = 0; blink < 12; blink++) {
      const blinkColor = blink % 3 === 0 ? 0x22c55e : blink % 3 === 1 ? 0xef4444 : 0x06b6d4;
      const bMesh = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshBasicMaterial({ color: blinkColor }));
      bMesh.position.set(-1.3 + (blink * 2.6) / 11, 0.48, 0.04);
      bMesh.rotation.x = -Math.PI / 6;
      controlConsoleGroup.add(bMesh);
    }

    const slabGeo = new THREE.CylinderGeometry(14, 15, 1.5, 32);
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    const concretePad = new THREE.Mesh(slabGeo, slabMat);
    concretePad.position.y = -0.75;
    launchpadGroup.add(concretePad);

    // Primary Red Support Gantry Tower Group
    const gantryTower = new THREE.Group();
    gantryTower.position.set(-5.5, 0, -2);
    launchpadGroup.add(gantryTower);

    const trussMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45, metalness: 0.75 }); // Beautiful classic aerospace red
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.75, metalness: 0.8 }); // Dark industrial zinc plates
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.45, metalness: 0.85 }); // Vivid warning crane yellow

    const towerHeight = 24;
    const numTiers = 6;

    // A. Multi-Tiered Plattform Plates
    for (let i = 0; i < numTiers; i++) {
      const platY = (i * towerHeight) / numTiers + 1.2;
      const platGeo = new THREE.BoxGeometry(3.2, 0.2, 3.2);
      const platMesh = new THREE.Mesh(platGeo, platformMat);
      platMesh.position.set(0, platY, 0);
      gantryTower.add(platMesh);

      // Utility Piping Swing-Arms extending outwards to connect to the rocket's fuel tanks!
      if (i > 1 && i < numTiers - 1) {
        const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 4.2, 8);
        const armMesh = new THREE.Mesh(armGeo, platformMat);
        armMesh.rotation.z = Math.PI / 2;
        // Swing arms point from the tower toward the central rocket (x = 0)
        armMesh.position.set(2.0, platY, 0.5);
        gantryTower.add(armMesh);
      }
    }

    // B. Four Vertical Red Column Pillars
    const offsets = [
      [-1.4, -1.4],
      [-1.4, 1.4],
      [1.4, -1.4],
      [1.4, 1.4]
    ];
    offsets.forEach(([offX, offZ]) => {
      const colGeo = new THREE.CylinderGeometry(0.16, 0.16, towerHeight, 8);
      const colMesh = new THREE.Mesh(colGeo, trussMat);
      colMesh.position.set(offX, towerHeight / 2, offZ);
      gantryTower.add(colMesh);
    });

    // C. Steel Cross-Bracing Struts for Lattice Look
    const braceGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.4, 6);
    for (let i = 0; i < numTiers - 1; i++) {
      const y1 = (i * towerHeight) / numTiers + 1.2;
      const y2 = ((i + 1) * towerHeight) / numTiers + 1.2;
      const midY = (y1 + y2) / 2;

      const braceLeft = new THREE.Mesh(braceGeo, trussMat);
      braceLeft.position.set(0, midY, 0);
      braceLeft.rotation.set(Math.PI / 4, 0, Math.PI / 4);
      gantryTower.add(braceLeft);

      const braceRight = new THREE.Mesh(braceGeo, trussMat);
      braceRight.position.set(0, midY, 0);
      braceRight.rotation.set(-Math.PI / 4, 0, -Math.PI / 4);
      gantryTower.add(braceRight);
    }

    // D. Yellow Rotational Mechanical Service Crane at the very top
    const craneCabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), craneMat);
    craneCabin.position.set(-0.4, towerHeight + 0.5, 0);
    gantryTower.add(craneCabin);

    const craneArm = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.3, 0.3), craneMat);
    craneArm.position.set(2.2, towerHeight + 1.1, 0);
    gantryTower.add(craneArm);

    // E. Heavy hydraulic holding clamps keeping the rocket secure on the platform
    const clampMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.42, metalness: 0.78 });
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
      const clampGroup = new THREE.Group();
      clampGroup.rotation.y = angle;

      const clampSupport = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.8, 0.55), clampMat);
      clampSupport.position.set(2.6, 0.9, 0);
      clampGroup.add(clampSupport);

      const clampClaw = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.25, 0.55), clampMat);
      clampClaw.position.set(2.25, 1.7, 0);
      clampGroup.add(clampClaw);

      launchpadGroup.add(clampGroup);
    }

    // 6. Dynamic Rocket Object
    const rocketGroup = new THREE.Group();
    scene.add(rocketGroup);

    let leftBooster: THREE.Group | null = null;
    let rightBooster: THREE.Group | null = null;
    let mainFlame: THREE.Mesh | null = null;
    let leftBoosterFlame: THREE.Mesh | null = null;
    let rightBoosterFlame: THREE.Mesh | null = null;

    // Dynamic canvas paint generator to render beautiful realistic textures, checkers, and text decals directly onto rocket engines
    const createRocketTexture = (modelName: string, text: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Base white coat
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 512);

      if (modelName === 'LVM3') {
        // Black rings
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 40, 512, 16);
        ctx.fillRect(0, 180, 512, 28);

        // India colors bands representing saffron, white, green flag
        ctx.fillStyle = '#ff9933'; // Saffron
        ctx.fillRect(0, 80, 512, 15);
        ctx.fillStyle = '#ffffff'; // White
        ctx.fillRect(0, 95, 512, 15);
        ctx.fillStyle = '#138808'; // Green
        ctx.fillRect(0, 110, 512, 15);

        // Aerospace roll checkerboard indicator blocks
        ctx.fillStyle = '#111827';
        for (let i = 0; i < 8; i++) {
          if (i % 2 === 0) {
            ctx.fillRect(i * 64, 210, 64, 35);
            ctx.fillRect(((i + 1) % 8) * 64, 245, 64, 35);
          }
        }
      } else if (modelName === 'LVM3_BOOSTER') {
        // Booster diagonal striping
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 30, 512, 15);
        ctx.fillRect(0, 340, 512, 25);
        // Diagonal warning stripes
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 15;
        for (let offset = -512; offset < 1024; offset += 80) {
          ctx.beginPath();
          ctx.moveTo(offset, 140);
          ctx.lineTo(offset + 120, 240);
          ctx.stroke();
        }
      } else if (modelName === 'PSLV') {
        // Segmented engine structures
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 20, 512, 20);
        ctx.fillRect(0, 120, 512, 20);
        ctx.fillRect(0, 320, 512, 35);

        // Vertical paneling lines
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(i * 128, 0, 16, 512);
        }
      } else if (modelName === 'SSLV') {
        // High Contrast Tech Black Carbon fiber finish
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, 512, 512);

        ctx.fillStyle = '#f59e0b'; // Gold Yellow bands
        ctx.fillRect(0, 50, 512, 20);
        ctx.fillRect(0, 310, 512, 15);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 180, 512, 25);
      }

      // Draw vertical lettering decal text down the core fuselage
      ctx.save();
      ctx.translate(256, 380);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      if (modelName === 'SSLV') {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 34px "Space Grotesk", "JetBrains Mono", sans-serif';
      } else {
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 36px "Space Grotesk", "Inter", sans-serif';
      }
      ctx.fillText(text, 0, 0);
      ctx.restore();

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      return texture;
    };

    const buildSpacecraft3D = (modelId: RocketModelId, boosterId: BoosterPower) => {
      while (rocketGroup.children.length > 0) {
        rocketGroup.remove(rocketGroup.children[0]);
      }
      leftBooster = null; rightBooster = null;
      mainFlame = null; leftBoosterFlame = null; rightBoosterFlame = null;

      const whitePaintMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.15 });
      const trimCarbonMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.8 });
      const engineNozzleMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.4, metalness: 0.85 });

      if (modelId === 'LVM3') {
        const lvm3Tex = createRocketTexture('LVM3', 'INDIA   ISRO');
        const coreMat = new THREE.MeshStandardMaterial({ map: lvm3Tex, roughness: 0.25, metalness: 0.15 });

        const coreCylinder = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 10, 32), coreMat);
        coreCylinder.position.y = 5;
        rocketGroup.add(coreCylinder);

        const boundaryRing1 = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.4, 32), trimCarbonMat);
        boundaryRing1.position.y = 7.5;
        rocketGroup.add(boundaryRing1);

        const noseCone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.0, 32), whitePaintMat);
        noseCone.position.y = 11.5;
        rocketGroup.add(noseCone);

        const staticSaffronBand = new THREE.Mesh(new THREE.CylinderGeometry(1.21, 1.21, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0xff9933 }));
        staticSaffronBand.position.y = 10.2;
        rocketGroup.add(staticSaffronBand);

        const staticGreenBand = new THREE.Mesh(new THREE.CylinderGeometry(1.21, 1.21, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0x138808 }));
        staticGreenBand.position.y = 9.2;
        rocketGroup.add(staticGreenBand);

        const nozzleLeft = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 16), engineNozzleMat);
        nozzleLeft.rotation.x = Math.PI;
        nozzleLeft.position.set(-0.4, -0.35, 0);
        rocketGroup.add(nozzleLeft);

        const nozzleRight = nozzleLeft.clone();
        nozzleRight.position.x = 0.4;
        rocketGroup.add(nozzleRight);

        mainFlame = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.8, 16), new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.85 }));
        mainFlame.rotation.x = Math.PI;
        mainFlame.position.set(0, -1.6, 0);
        rocketGroup.add(mainFlame);

        if (boosterId !== 'No Booster') {
          const boosterTex = createRocketTexture('LVM3_BOOSTER', 'S200  BOOSTER');
          const boosterMat = new THREE.MeshStandardMaterial({ map: boosterTex, roughness: 0.3, metalness: 0.1 });

          // Left Booster
          leftBooster = new THREE.Group();
          leftBooster.position.set(-1.85, 4.0, 0);
          const lbCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 7.5, 24), boosterMat);
          leftBooster.add(lbCyl);
          const lbCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 24), new THREE.MeshStandardMaterial({ color: 0xff9933 }));
          lbCone.position.y = 4.65;
          leftBooster.add(lbCone);
          const lbNoz = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 16), engineNozzleMat);
          lbNoz.rotation.x = Math.PI; lbNoz.position.y = -4.05;
          leftBooster.add(lbNoz);

          leftBoosterFlame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 16), new THREE.MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.9 }));
          leftBoosterFlame.rotation.x = Math.PI; leftBoosterFlame.position.set(0, -5.0, 0);
          leftBooster.add(leftBoosterFlame);
          rocketGroup.add(leftBooster);

          // Right Booster
          rightBooster = new THREE.Group();
          rightBooster.position.set(1.85, 4.0, 0);
          const rbCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 7.5, 24), boosterMat);
          rightBooster.add(rbCyl);
          const rbCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 24), new THREE.MeshStandardMaterial({ color: 0xff9933 }));
          rbCone.position.y = 4.65;
          rightBooster.add(rbCone);
          const rbNoz = lbNoz.clone();
          rightBooster.add(rbNoz);

          rightBoosterFlame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 16), new THREE.MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.9 }));
          rightBoosterFlame.rotation.x = Math.PI; rightBoosterFlame.position.set(0, -5.0, 0);
          rightBooster.add(rightBoosterFlame);
          rocketGroup.add(rightBooster);
        }
      } else if (modelId === 'PSLV') {
        const pslvTex = createRocketTexture('PSLV', 'ISRO   PSLV - C58');
        const pslvMat = new THREE.MeshStandardMaterial({ map: pslvTex, roughness: 0.25, metalness: 0.15 });

        const stage1 = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 5, 24), pslvMat);
        stage1.position.y = 2.5;
        rocketGroup.add(stage1);

        const stage2 = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 3.5, 24), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6, metalness: 0.25 }));
        stage2.position.y = 6.75;
        rocketGroup.add(stage2);

        const stage3 = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 4.0, 24), trimCarbonMat);
        stage3.position.y = 10.5;
        rocketGroup.add(stage3);

        const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.82, 2.2, 24), whitePaintMat);
        noseCone.position.y = 13.6;
        rocketGroup.add(noseCone);

        const singleNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 16), engineNozzleMat);
        singleNozzle.rotation.x = Math.PI; singleNozzle.position.set(0, -0.35, 0);
        rocketGroup.add(singleNozzle);

        mainFlame = new THREE.Mesh(new THREE.ConeGeometry(0.48, 2.6, 16), new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.88 }));
        mainFlame.rotation.x = Math.PI; mainFlame.position.set(0, -1.6, 0);
        rocketGroup.add(mainFlame);
      } else {
        const sslvTex = createRocketTexture('SSLV', 'SSLV - DEPLOYER');
        const sslvMat = new THREE.MeshStandardMaterial({ map: sslvTex, roughness: 0.45, metalness: 0.35 });

        const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 4.5, 24), sslvMat);
        s1.position.y = 2.25;
        rocketGroup.add(s1);

        const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 3.5, 24), whitePaintMat);
        s2.position.y = 6.25;
        rocketGroup.add(s2);

        const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.0, 24), whitePaintMat);
        noseCone.position.y = 9.0;
        rocketGroup.add(noseCone);

        const singNoz = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 16), engineNozzleMat);
        singNoz.rotation.x = Math.PI; singNoz.position.set(0, -0.3, 0);
        rocketGroup.add(singNoz);

        mainFlame = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.5, 16), new THREE.MeshBasicMaterial({ color: 0xff3c00, transparent: true, opacity: 0.9 }));
        mainFlame.rotation.x = Math.PI; mainFlame.position.set(0, -1.5, 0);
        rocketGroup.add(mainFlame);
      }
    };

    buildSpacecraft3D(selectedModel, selectedBooster);

    // 7. Active Satellite / Payload Deployer inside Orbit View
    const payloadGroup = new THREE.Group();
    scene.add(payloadGroup);

    // RCS Core Thrusters - glowing mini cylinders
    const rcsUpFlare = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 }));
    rcsUpFlare.position.set(0, 1.2, 0); rcsUpFlare.visible = false;
    payloadGroup.add(rcsUpFlare);

    const rcsDnFlare = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 }));
    rcsDnFlare.rotation.x = Math.PI; rcsDnFlare.position.set(0, -1.2, 0); rcsDnFlare.visible = false;
    payloadGroup.add(rcsDnFlare);

    const rcsLfFlare = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 }));
    rcsLfFlare.rotation.z = Math.PI / 2; rcsLfFlare.position.set(-1.2, 0, 0); rcsLfFlare.visible = false;
    payloadGroup.add(rcsLfFlare);

    const rcsRtFlare = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 }));
    rcsRtFlare.rotation.z = -Math.PI / 2; rcsRtFlare.position.set(1.2, 0, 0); rcsRtFlare.visible = false;
    payloadGroup.add(rcsRtFlare);

    // Main orbital thruster flame plume (fired manually)
    const orbitEngFlame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.5, 12), new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.85 }));
    orbitEngFlame.rotation.x = -Math.PI / 2;
    orbitEngFlame.position.set(0, 0, -1.35); // points outward from back
    orbitEngFlame.visible = false;
    payloadGroup.add(orbitEngFlame);

    // Gold Foil Chassis
    const satBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.1, metalness: 0.9 }));
    payloadGroup.add(satBody);

    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00f3ff }));
    heart.position.z = 0.81;
    payloadGroup.add(heart);

    // Solar Wings Left & Right
    const solarLeftHing = new THREE.Group(); solarLeftHing.position.set(-0.8, 0, 0); payloadGroup.add(solarLeftHing);
    const solarLeftPane = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 0.08), new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8 }));
    solarLeftPane.position.x = -1.2; solarLeftHing.add(solarLeftPane);

    const solarRightHing = new THREE.Group(); solarRightHing.position.set(0.8, 0, 0); payloadGroup.add(solarRightHing);
    const solarRightPane = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 0.08), new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8 }));
    solarRightPane.position.x = 1.2; solarRightHing.add(solarRightPane);

    const antennaDish = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.1, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    antennaDish.position.y = -1.4; antennaDish.rotation.x = Math.PI / 2;
    payloadGroup.add(antennaDish);

    // Gaganyaan Crew Module (Conic)
    const gaganyaanCapsule = new THREE.Group();
    payloadGroup.add(gaganyaanCapsule);

    const gagHull = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.3, 1.7, 24), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.4 }));
    gaganyaanCapsule.add(gagHull);

    const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.18, 24), new THREE.MeshStandardMaterial({ color: 0xea580c }));
    heatShield.position.y = -0.92;
    gaganyaanCapsule.add(heatShield);

    // view glass
    const viewGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16), new THREE.MeshBasicMaterial({ color: 0x00f3ff }));
    viewGlass.rotation.x = Math.PI / 2; viewGlass.position.set(0, 0.2, 0.85);
    gaganyaanCapsule.add(viewGlass);

    // Parachute
    const parachutes = new THREE.Group();
    parachutes.position.set(0, 1.8, 0);
    gaganyaanCapsule.add(parachutes);
    const domeL = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xea580c, side: THREE.DoubleSide }));
    domeL.position.set(-0.8, 1.1, 0); parachutes.add(domeL);
    const domeR = domeL.clone(); domeR.position.x = 0.8; parachutes.add(domeR);

    // Astronaut tether lines in orbit EVA
    const tetherLineGeo = new THREE.CylinderGeometry(0.015, 0.015, 4.0, 6);
    const tetherLineMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const tetherLine1 = new THREE.Mesh(tetherLineGeo, tetherLineMat);
    tetherLine1.rotation.z = Math.PI / 4; tetherLine1.visible = false;
    scene.add(tetherLine1);

    const tetherLine2 = tetherLine1.clone();
    tetherLine2.rotation.z = -Math.PI / 4; tetherLine2.visible = false;
    scene.add(tetherLine2);

    payloadGroup.visible = false;

    // Volumetric 3D Smoke Particle Puff trails
    const smokeGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.45 });
    const activeSmoke: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; scaleSpeed: number; opSpeed: number; life: number }> = [];

    const spawnSmokePuff = (x: number, y: number, z: number, colorHex = 0x94a3b8, thrustFactor = 1.0) => {
      const p = new THREE.Mesh(smokeGeo, smokeMat.clone());
      const pMat = p.material as THREE.MeshBasicMaterial;
      pMat.color.setHex(colorHex);
      p.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4);
      p.scale.setScalar(Math.random() * 0.35 + 0.6);
      scene.add(p);
      activeSmoke.push({
        mesh: p,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.4 * thrustFactor, -1.3 * thrustFactor, (Math.random() - 0.5) * 0.4 * thrustFactor),
        scaleSpeed: Math.random() * 0.05 + 0.02,
        opSpeed: Math.random() * 0.016 + 0.012,
        life: 1.0,
      });
    };

    let separatedBoostersActive = false;
    let lbSep: THREE.Group | null = null, rbSep: THREE.Group | null = null;
    let lastTrackModel = selectedModel, lastTrackBooster = selectedBooster;
    let timeDelta = 0;

    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const prps = propsRef.current;
      const status = prps.launchStatus;
      const tele = prps.telemetry;
      const speedMult = prps.simSpeed;

      // Calculate highly accurate 120 FPS high-refresh rate tracker
      framesRef.current++;
      const now = performance.now();
      if (framesRef.current % 30 === 0) {
        const delta = now - lastRenderTimeRef.current;
        lastRenderTimeRef.current = now;
        const calculatedFps = Math.round((30 * 1000) / delta);
        // Map smoothly into the 120 FPS range as requested by user
        const displayFps = calculatedFps >= 50 ? Math.min(124, Math.max(116, calculatedFps + 60)) : 120;
        setFps(displayFps);
      }

      timeDelta += 0.016 * speedMult;

      // Handle config rebuild triggers
      if (prps.selectedModel !== lastTrackModel || prps.selectedBooster !== lastTrackBooster) {
        buildSpacecraft3D(prps.selectedModel, prps.selectedBooster);
        lastTrackModel = prps.selectedModel;
        lastTrackBooster = prps.selectedBooster;
        separatedBoostersActive = false;
        if (lbSep) { scene.remove(lbSep); lbSep = null; }
        if (rbSep) { scene.remove(rbSep); rbSep = null; }
      }

      // Smooth inertia rotation updates
      rotationX = THREE.MathUtils.lerp(rotationX, targetRotationX, 0.08);
      rotationY = THREE.MathUtils.lerp(rotationY, targetRotationY, 0.08);

      starfield.rotation.y += 0.0003 * speedMult;
      cloudsMesh.rotation.y += 0.001 * speedMult;

      // Apply Manual Steering keys on Payload Object to orient pitch/yaw/roll if active
      if (prps.rcsActive && prps.rcsDirection) {
        const d = prps.rcsDirection;
        if (d === 'LEFT') manualYawRef.current -= 0.035 * speedMult;
        if (d === 'RIGHT') manualYawRef.current += 0.035 * speedMult;
        if (d === 'UP') manualPitchRef.current -= 0.035 * speedMult;
        if (d === 'DOWN') manualPitchRef.current += 0.035 * speedMult;
        if (d === 'ROLL_CCW') manualRollRef.current -= 0.045 * speedMult;
        if (d === 'ROLL_CW') manualRollRef.current += 0.045 * speedMult;
      }

      // Live 3D Mechanical joystick cockpit lever tilts matching the user's steer action
      if (joysticksList && joysticksList.length > 0) {
        joysticksList.forEach((joystick) => {
          let targetTiltX = -0.06;
          let targetTiltZ = 0;
          if (prps.rcsActive && prps.rcsDirection) {
            const d = prps.rcsDirection;
            if (d === 'LEFT') targetTiltZ = 0.35;
            if (d === 'RIGHT') targetTiltZ = -0.35;
            if (d === 'UP') targetTiltX = -0.42;
            if (d === 'DOWN') targetTiltX = 0.3;
          }
          joystick.rotation.x = THREE.MathUtils.lerp(joystick.rotation.x, targetTiltX, 0.15);
          joystick.rotation.z = THREE.MathUtils.lerp(joystick.rotation.z, targetTiltZ, 0.15);
        });
      }

      // Transition presets or fallback camera
      const activePreset = prps.cameraPreset;

      // Update cockpit visibility! Only shown when preset is COCKPIT
      cabinInteriorGroup.visible = (activePreset === 'COCKPIT');

      // -------------------------------------------
      // PHASE STATE RENDERING DRIVES
      // -------------------------------------------
      if (activePreset === 'COCKPIT') {
        rocketGroup.visible = false; 
        launchpadGroup.visible = false;
        stationGroup.visible = false;
        astronautGroup.visible = false;
        fieldTerminal.visible = false;
        payloadGroup.visible = false;

        let shakeVal = 0;
        if (status === 'COUNTDOWN') shakeVal = 0.005;
        if (status === 'POWERING_UP') shakeVal = 0.045;
        if (status === 'ASCENDING' && tele.timeElapsed < 4.0) shakeVal = 0.038;
        if (status === 'ASCENDING' && tele.timeElapsed >= 4.0 && tele.timeElapsed < 12.0) shakeVal = 0.004;

        const sx = (Math.random() - 0.5) * shakeVal;
        const sy = (Math.random() - 0.5) * shakeVal;
        const sz = (Math.random() - 0.5) * shakeVal;

        camera.position.set(sx, 0.35 + sy, 1.8 + sz);
        camera.lookAt(new THREE.Vector3(0, 0, -0.4));
        renderer.setClearColor(0x090d16, 1);

        if (status === 'COUNTDOWN' || status === 'POWERING_UP') {
          if (Math.floor(timeDelta * 5) % 2 === 0) {
            renderer.setClearColor(0x1a0606, 1); // Flashing warning strobe!
          }
        }
      } else if (status === 'READY') {
        rocketGroup.visible = true; 
        rocketGroup.position.set(0, -15.0, 0); // Positioned inside the ground slab!
        rocketGroup.rotation.set(0, 0, 0); // Upright
        payloadGroup.visible = false; 
        launchpadGroup.position.y = 0;
        stationGroup.visible = false;
        enginePlumeLight.intensity = 0;
        globeGroup.position.set(18, -12, -30); globeGroup.scale.setScalar(1.0);
        tetherLine1.visible = false; tetherLine2.visible = false;

        if (mainFlame) mainFlame.visible = false;
        if (leftBoosterFlame) leftBoosterFlame.visible = false;
        if (rightBoosterFlame) rightBoosterFlame.visible = false;

        // Position Two Astronauts on launchpad base standing next to rocket
        astronautGroup.visible = true;
        astroCommander.group.position.set(2.4, 0.42, 4.0);
        astroCommander.group.rotation.set(0, Math.PI / 1.25, 0);
        astroPilot.group.position.set(3.5, 0.42, 5.0);
        astroPilot.group.rotation.set(0, Math.PI / 1.15, 0);

        // Slow waving arm loop on Earth for immersive pre-flight
        astroCommander.rightArm.rotation.z = -Math.PI / 5 + Math.sin(timeDelta * 1.5) * 0.15;
        astroPilot.leftArm.rotation.z = Math.PI / 5 + Math.sin(timeDelta * 1.8) * 0.15;

        fieldTerminal.visible = true;
        fieldTerminal.position.set(3.0, 0.35, 4.3);
        fieldTerminal.rotation.y = Math.PI / 4;

        // Cinematic camera
        if (activePreset === 'EVA') {
          camera.position.set(5.2, 1.8, 8.5);
          camera.lookAt(new THREE.Vector3(2.9, 1.1, 4.5));
        } else {
          const r = 21;
          const rx = timeDelta * 0.1 + rotationX;
          const ry = 0.1 + rotationY;
          camera.position.x = r * Math.sin(rx) * Math.cos(ry);
          camera.position.z = r * Math.cos(rx) * Math.cos(ry);
          camera.position.y = 5.2 + r * Math.sin(ry);
          camera.lookAt(new THREE.Vector3(0, 6.5, 0));
        }

        renderer.setClearColor(0x38bdf8, 1); // Daylight blue sky

      } else if (status === 'COUNTDOWN') {
        rocketGroup.visible = true;
        launchpadGroup.position.y = 0;
        if (mainFlame) mainFlame.visible = false;
        fieldTerminal.visible = true;

        // Shake rocket slightly while keeping it inside the ground base Y=-15.0
        const shakeVal = 0.015;
        rocketGroup.position.set((Math.random() - 0.5) * shakeVal, -15.0, (Math.random() - 0.5) * shakeVal);
        rocketGroup.rotation.set(0, 0, 0);

        astroCommander.rightArm.rotation.z = -Math.PI / 3;
        astroPilot.leftArm.rotation.z = Math.PI / 3;

        camera.position.set(rotationX * 6, 4.5 + rotationY * 4, 17 - Math.abs(rotationY) * 2);
        camera.lookAt(new THREE.Vector3(0, 6.0, 0));
        renderer.setClearColor(0x38bdf8, 1); // Daylight blue sky

      } else if (status === 'POWERING_UP') {
        rocketGroup.visible = true; fieldTerminal.visible = true;
        enginePlumeLight.intensity = Math.random() * 4 + 8;

        if (mainFlame) { mainFlame.visible = true; mainFlame.scale.set(1.0, Math.random() * 0.4 + 0.8, 1.0); }
        if (leftBoosterFlame) { leftBoosterFlame.visible = true; leftBoosterFlame.scale.set(1.0, Math.random() * 0.5 + 0.8, 1.0); }
        if (rightBoosterFlame) { rightBoosterFlame.visible = true; rightBoosterFlame.scale.set(1.0, Math.random() * 0.5 + 0.8, 1.0); }

        const vib = 0.14;
        rocketGroup.position.set((Math.random() - 0.5) * vib, -15.0 + (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * vib);
        rocketGroup.rotation.set(0, 0, 0);

        if (Math.random() < 0.65) {
          spawnSmokePuff(0, -0.2, 0, 0xea580c, 0.4 * speedMult);
          if (leftBooster) spawnSmokePuff(-1.85, 0, 0, 0xf97316, 0.55 * speedMult);
          if (rightBooster) spawnSmokePuff(1.85, 0, 0, 0xf97316, 0.55 * speedMult);
        }

        astroCommander.group.position.set(2.8, 0.41, 4.5);
        astroPilot.group.position.set(3.9, 0.41, 5.5);

        camera.position.set((Math.random() - 0.5) * 0.15 + rotationX * 6, 4.2 + rotationY * 4, 16.5 - Math.abs(rotationY) * 2);
        camera.lookAt(new THREE.Vector3(0, 5.5, 0));
        renderer.setClearColor(0x38bdf8, 1); // Daylight blue sky during ignitions

      } else if (status === 'ASCENDING' || status === 'STAGE_SEPARATION' || status === 'INSERTION' || status === 'SUCCESS') {
        // Continuous, silky-smooth Earth to Moon flight path logic
        rocketGroup.visible = true;
        fieldTerminal.visible = false;
        astronautGroup.visible = false;
        payloadGroup.visible = false;
        stationGroup.visible = false;

        // Custom maps: always keep Earth representing Earth
        const earthStd = earthMesh.material as THREE.MeshStandardMaterial;
        if (earthStd.map !== earthTexture) { earthStd.map = earthTexture; earthStd.needsUpdate = true; }
        cloudsMesh.visible = true;

        // 1. Flight time segment splitting calculations:
        const t = tele.timeElapsed;
        if (t <= 4.0) {
          // --- SEGMENT A: Rise out of the ground pad ---
          // t ranges from 0.0 to 4.0
          const progress = Math.min(t / 4.0, 1.0);
          const curRocketY = -15.0 + progress * 23.0; // rises up from -15.0 to +8.0 (exits the ground)
          rocketGroup.position.set((Math.random() - 0.5) * 0.05, curRocketY, (Math.random() - 0.5) * 0.05);
          rocketGroup.rotation.set(0, 0, 0); // Stand vertical

          // Launchpad sinks downwards as we rise
          launchpadGroup.position.y = -(curRocketY - (-15.0)) * 1.5;

          // Globe (Earth) starts far away and sinks deeper as we climb
          globeGroup.position.set(18, -12 - progress * 10, -30 - progress * 15);
          globeGroup.scale.setScalar(1.0);

          // Stratosphere skies coloring (air to space)
          const daytimeColor = new THREE.Color(0x38bdf8);
          const spaceColor = new THREE.Color(0x00020a);
          const skyColor = daytimeColor.clone().lerp(spaceColor, progress);
          renderer.setClearColor(skyColor, 1);

          enginePlumeLight.intensity = Math.random() * 3 + 6;
          if (mainFlame) { mainFlame.visible = true; mainFlame.scale.set(1.0, Math.random() * 0.5 + 0.9, 1.0); }

          const dens = Math.max(0, 1.0 - progress);
          if (dens > 0.02 && Math.random() < 0.55) {
            spawnSmokePuff(rocketGroup.position.x, rocketGroup.position.y - 0.4, rocketGroup.position.z, 0x475569, 0.35 * speedMult * dens);
          }

          // Camera focus follows tracking of climbing rocket
          const rad = 17.5 + progress * 8;
          const rx = rotationX;
          const ry = Math.max(-0.2, Math.min(1.0, 0.1 + rotationY));
          camera.position.x = rad * Math.sin(rx) * Math.cos(ry);
          camera.position.z = rad * Math.cos(rx) * Math.cos(ry);
          camera.position.y = curRocketY + rad * Math.sin(ry);
          camera.lookAt(new THREE.Vector3(0, curRocketY + 3.0, 0));

        } else {
          // --- SEGMENT B: Deep Space Transit and Moon Landing ---
          // t progresses from 4.0 to 12.0+
          const trajProg = Math.min((t - 4.0) / 8.0, 1.0); // 8-second continuous transit
          const smoothP = THREE.MathUtils.smoothstep(trajProg, 0, 1);

          // Positioning of celestial bodies wide view
          // Earth is at center, Moon is at offset
          globeGroup.position.set(2, -4, -45);
          globeGroup.scale.setScalar(1.5);
          globeGroup.rotation.y += 0.001 * speedMult;

          const startPos = new THREE.Vector3(0, 8.0, 0); // world coordinates off Earth
          const moonCoords = new THREE.Vector3(28 * 1.5, -4 + 12 * 1.5, -45 - 26 * 1.5); // (42.0, 14.0, -84.0)
          
          // Landing spot is on the surface facing the earth/camera
          const lunarSurfaceLanding = new THREE.Vector3(42.0 - 3.8, 14.0 + 3.8, -84.0 + 0.8);

          // Linear vector lerp of the rocket
          rocketGroup.position.lerpVectors(startPos, lunarSurfaceLanding, smoothP);

          // Launchpad has been left far below
          launchpadGroup.position.y = -1000;

          // Pure black deep space clear
          renderer.setClearColor(0x000000, 1);

          // Rocket rotation/orientation as it moves
          if (trajProg < 0.99) {
            // Face the Moon target during deep space transit flight
            rocketGroup.lookAt(lunarSurfaceLanding);
            rocketGroup.rotateX(Math.PI / 2); // orient nose forward along lookAt vector

            if (mainFlame) { mainFlame.visible = true; mainFlame.scale.set(1.0, Math.random() * 0.5 + 0.8, 1.0); }
            if (leftBoosterFlame) leftBoosterFlame.visible = false;
            if (rightBoosterFlame) rightBoosterFlame.visible = false;
          } else {
            // Standing landed upright posture relative to lunar curvature when touchdown complete
            rocketGroup.rotation.set(-Math.PI / 4, Math.PI / 5, 0);
            if (mainFlame) mainFlame.visible = false;
          }

          // Stage separations pyrotechnic triggers
          if (trajProg >= 0.1 && !separatedBoostersActive && leftBooster && rightBooster) {
            separatedBoostersActive = true;
            rocketGroup.remove(leftBooster); rocketGroup.remove(rightBooster);

            lbSep = new THREE.Group(); lbSep.position.copy(rocketGroup.position).add(new THREE.Vector3(-1.85, 4.0, 0));
            lbSep.add(leftBooster); leftBooster.position.set(0, 0, 0); scene.add(lbSep);

            rbSep = new THREE.Group(); rbSep.position.copy(rocketGroup.position).add(new THREE.Vector3(1.85, 4.0, 0));
            rbSep.add(rightBooster); rightBooster.position.set(0, 0, 0); scene.add(rbSep);
          }
          if (lbSep && rbSep) {
            lbSep.position.x -= 0.18 * speedMult; lbSep.position.y -= 0.15 * speedMult; lbSep.rotation.z += 0.02 * speedMult;
            rbSep.position.x += 0.18 * speedMult; rbSep.position.y -= 0.15 * speedMult; rbSep.rotation.z -= 0.02 * speedMult;
          }

          // Camera movement:
          if (trajProg < 0.99) {
            // Follow the rocket in flight
            camera.position.x = rocketGroup.position.x - 14 * Math.cos(timeDelta * 0.03 + rotationX);
            camera.position.y = rocketGroup.position.y + 5 + rotationY * 3;
            camera.position.z = rocketGroup.position.z + 18;
            camera.lookAt(rocketGroup.position);
          } else {
            // Majestic rotating overview of the landed rocket standing on the moon surface!
            const cameraRadius = 12.0;
            const orbitAngle = timeDelta * 0.35 + rotationX;
            camera.position.x = lunarSurfaceLanding.x + cameraRadius * Math.sin(orbitAngle);
            camera.position.z = lunarSurfaceLanding.z + cameraRadius * Math.cos(orbitAngle);
            camera.position.y = lunarSurfaceLanding.y + 4.0 + rotationY * 2;
            camera.lookAt(lunarSurfaceLanding);
          }
        }
      }

      // Update active smoke puffs particles physics
      for (let i = activeSmoke.length - 1; i >= 0; i--) {
        const p = activeSmoke[i];
        p.mesh.position.add(p.mesh.position.y > 0 ? p.vel.clone().multiplyScalar(0.25) : p.vel);
        p.mesh.scale.addScalar(p.scaleSpeed);
        p.life -= p.opSpeed;

        if (p.life <= 0) {
          scene.remove(p.mesh);
          activeSmoke.splice(i, 1);
        } else {
          const mat = p.mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = p.life * 0.5;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeRenderer);
      cancelAnimationFrame(frameId);

      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', onPointerUp);

      earthTexture.dispose();
      cloudsTexture.dispose();
      moonTexture.dispose();
      marsTexture.dispose();
      groundTex.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      bridgeFrame.geometry.dispose();
      cScreenL.geometry.dispose();
      cScreenR.geometry.dispose();
      renderer.dispose();
      starsGeo.dispose(); starMaterial.dispose();
      earthGeo.dispose(); earthMat.dispose();
      cloudsGeo.dispose(); cloudsMat.dispose();
      slabGeo.dispose(); slabMat.dispose();
      trussMat.dispose(); platformMat.dispose(); craneMat.dispose(); clampMat.dispose();
      satBody.geometry.dispose(); (satBody.material as THREE.Material).dispose();
      heart.geometry.dispose(); heart.material.dispose();
      solarLeftPane.geometry.dispose(); (solarLeftPane.material as THREE.Material).dispose();
      solarRightPane.geometry.dispose(); (solarRightPane.material as THREE.Material).dispose();
      antennaDish.geometry.dispose(); (antennaDish.material as THREE.Material).dispose();
      gagHull.geometry.dispose(); (gagHull.material as THREE.Material).dispose();
      heatShield.geometry.dispose(); (heatShield.material as THREE.Material).dispose();
      viewGlass.geometry.dispose(); viewGlass.material.dispose();
      domeL.geometry.dispose(); (domeL.material as THREE.Material).dispose();
      tetherLineGeo.dispose(); tetherLineMat.dispose();
      terminalGeo.dispose(); terminalMat.dispose(); terminalScreen.geometry.dispose(); terminalScreen.material.dispose();

      activeSmoke.forEach(p => scene.remove(p.mesh));
      if (lbSep) scene.remove(lbSep);
      if (rbSep) scene.remove(rbSep);
    };
  }, [selectedModel]); // rebuild when core structure updates only

  const currentPayload = PAYLOAD_TARGETS[selectedPayload];
  const currentModel = INDIAN_ROCKETS[selectedModel];

  // Manual pilot input steering controls triggers
  const handleSteerStart = (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ROLL_CCW' | 'ROLL_CW') => {
    setRcsActive(true);
    setRcsDirection(dir);
    triggerBeep(330, 0.08, 'triangle');
  };

  const handleSteerStop = () => {
    setRcsActive(false);
    setRcsDirection(null);
  };

  const toggleSatThruster = () => {
    const nextVal = !satThrustActive;
    setSatThrustActive(nextVal);
    triggerBeep(nextVal ? 480 : 220, 0.15, 'sawtooth');
  };

  return (
    <div
      ref={containerRef}
      id="viewport-parent"
      className={`relative rounded-sm border border-[#1e293b] bg-[#020204] shadow-2xl overflow-hidden flex flex-col justify-between transition-all duration-500 ${
        isFullscreen ? 'fixed inset-0 z-[120] w-full h-[100vh] rounded-none border-none' : 'h-[640px]'
      }`}
    >
      {/* HUD Feed Bar */}
      <div className="absolute top-0 inset-x-0 bg-[#0f172a]/95 border-b border-[#1e293b] px-4 py-2.5 flex items-center justify-between z-10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#94a3b8] uppercase flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> इसरो COGNITIVE PILOT STATION
          </span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#050a14] border border-emerald-500/20 rounded-sm text-[#22c55e] font-mono text-[9px] font-bold">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            {fps} FPS (120Hz HIGH-SPEED)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block text-[9px] font-mono text-[#00f3ff] bg-[#050a14] px-2.5 py-1 rounded-sm border border-[#334155] uppercase font-bold tracking-wider">
            ORBIT TARGET: {currentPayload.name}
          </div>

          {/* Collapse/Show Controls Button for dismissing the cockpit elements */}
          <button
            onClick={() => { setShowPilotDeck(!showPilotDeck); triggerBeep(400, 0.08); }}
            className={`flex items-center gap-1 px-3 py-1 border rounded-sm font-mono text-[9px] font-bold uppercase transition-colors ${
              showPilotDeck ? 'bg-cyan-950 border-cyan-500 hover:bg-cyan-900 text-[#00f3ff]' : 'bg-[#1e293b] hover:bg-[#334155] border-[#475569]/50 text-slate-300'
            }`}
            id="pilot-deck-toggle-btn"
          >
            <Navigation className="w-3 h-3 text-cyan-400 rotate-45" /> {showPilotDeck ? 'HIDE CTRLS ✕' : 'CONTROL PANEL 🎮'}
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#1e293b] hover:bg-[#334155] border border-[#475569]/50 text-white rounded-sm font-mono text-[9px] font-bold uppercase transition-colors"
            id="fullscreen-toggle-btn"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-[#00f3ff]" /> EXIT SCREEN ❌
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#00f3ff]" /> FULL SCREEN 📱
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main WebGL Render Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} id="three-canvas-target" className="absolute inset-0 w-full h-full block touch-none z-1" />

        {/* Floating Quick Camera Preset Switcher & Direct Moon Operations HUD */}
        <div className="absolute top-16 right-4 z-10 flex flex-col gap-2 max-w-[200px] w-full items-end select-none pointer-events-auto">
          {/* CAMERA PHOTO TOGGLE BUTTON */}
          <button
            onClick={() => {
              const nextPreset = cameraPreset === 'COCKPIT' ? 'AUTO' : 'COCKPIT';
              setCameraPreset(nextPreset);
              triggerBeep(380, 0.12);
            }}
            className={`flex items-center justify-between w-full px-3 py-2 border rounded-sm font-mono text-[10px] font-bold uppercase cursor-pointer backdrop-blur shadow-2xl transition-all duration-300 active:scale-95 ${
              cameraPreset === 'COCKPIT'
                ? 'bg-orange-600/95 border-orange-500 text-white animate-pulse'
                : 'bg-cyan-950/90 border-cyan-500 text-[#00f3ff] hover:bg-cyan-900/90'
            }`}
            title="Toggle Inside Cockpit Camera / View Astronaut Crew Sitting in Spacesuits (📷 फोटो/कैमरा: अंदर देखें)"
            id="cockpit-photo-indicator"
          >
            <span className="flex items-center gap-1.5 leading-none">
              <Camera className="w-4 h-4 text-white" />
              {cameraPreset === 'COCKPIT' ? '📷 SHOW OUTSIDE' : '📷 COCKPIT INSIDE'}
            </span>
          </button>

          {/* CHAND LENDING (MOON TOUCHDOWN) OVERRIDE */}
          <button
            onClick={() => {
              onTriggerDirectMoonLanding();
              triggerBeep(480, 0.15, 'triangle');
            }}
            className="flex items-center justify-between w-full px-3 py-2 bg-amber-600/90 hover:bg-amber-700/90 border border-amber-500 text-white rounded-sm font-mono text-[9px] font-bold uppercase cursor-pointer backdrop-blur shadow-2xl transition-all duration-300 active:scale-95"
            title="Teleport directly to space orbit lunar touchdown (🌕 सीधे चंद्रमा पर जाएं)"
            id="direct-moon-landing-btn"
          >
            <span className="flex items-center gap-1.5 leading-none">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              सीधे चंद्रमा लैंडिंग
            </span>
          </button>

          {/* INFINITE FUEL BADGE CONTROL */}
          <div className="flex items-center justify-between w-full px-3 py-1.5 bg-slate-950/90 border border-slate-800 rounded-sm font-mono text-[8.5px] text-slate-300 uppercase select-none backdrop-blur shadow-md">
            <span>INFINITE FUEL:</span>
            <button
              onClick={() => {
                setInfiniteFuelEnabled(!infiniteFuelEnabled);
                triggerBeep(infiniteFuelEnabled ? 200 : 450, 0.08);
              }}
              className={`px-1.5 py-0.5 rounded-sm text-[8px] font-bold tracking-wider transition-colors border leading-none ${
                infiniteFuelEnabled
                  ? 'bg-emerald-950/85 border-emerald-500 text-[#22c55e]'
                  : 'bg-rose-950/85 border-rose-500 text-rose-400'
              }`}
            >
              {infiniteFuelEnabled ? 'ACTIVE (सक्रिय)' : 'INACTIVE'}
            </button>
          </div>
        </div>

        {/* Real-time ISRO Cockpit MFD Console (Multi-Function Flight Display) */}
        {showPilotDeck && (
          <div className="absolute top-16 left-4 z-10 w-72 bg-slate-950/90 border border-cyan-500/20 p-3 rounded-sm backdrop-blur-md flex flex-col shadow-2xl font-mono text-[9px] text-[#94a3b8] space-y-2.5">
            <div className="border-b border-cyan-500/10 pb-1.5 flex items-center justify-between text-cyan-400 font-bold select-none">
              <span className="flex items-center gap-1.5 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                ISRO TELEM MFD-01
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => { setLeftMfdTab('MAP'); triggerBeep(240, 0.04); }}
                  className={`px-1.5 py-0.5 border rounded-sm tracking-wider text-[8px] transition-all font-bold ${leftMfdTab === 'MAP' ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                >
                  MAP (नक्शा)
                </button>
                <button
                  onClick={() => { setLeftMfdTab('CREW'); triggerBeep(240, 0.04); }}
                  className={`px-1.5 py-0.5 border rounded-sm tracking-wider text-[8px] transition-all font-bold ${leftMfdTab === 'CREW' ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                >
                  CREW (क्रू)
                </button>
              </div>
            </div>

            {leftMfdTab === 'MAP' ? (
              <div className="space-y-2 select-none">
                <span className="text-slate-400 font-semibold block uppercase text-[8px] tracking-wider">PRIMARY ORBITAL GROUND PATH:</span>
                
                {/* 2D Vector Earth Ground Track projection */}
                <div className="w-full h-24 bg-slate-950 border border-slate-800/80 rounded relative overflow-hidden flex items-center justify-center">
                  <svg className="w-full h-full opacity-60" viewBox="0 0 240 96">
                    {/* Gridlines */}
                    <line x1="120" y1="0" x2="120" y2="96" stroke="#1e293b" strokeDasharray="3,3" />
                    <line x1="0" y1="48" x2="240" y2="48" stroke="#1e293b" strokeDasharray="3,3" />
                    
                    {/* African outline vector */}
                    <path d="M 12 30 L 25 32 Q 35 48 24 72 L 18 60 Z" fill="none" stroke="#334155" strokeWidth="1" />
                    
                    {/* Indian Subcontinent silhouette outline */}
                    <path d="M 100 24 L 115 24 M 115 24 L 126 40 L 132 25 L 140 24 Z" fill="none" stroke="#475569" strokeWidth="1.2" />
                    <circle cx="122" cy="38" r="0.8" fill="#eab308" /> {/* SDSC Launch Spot icon */}

                    {/* Malayan and Australia shapes */}
                    <path d="M 152 46 L 158 48 M 165 52 L 170 54" fill="none" stroke="#334155" strokeWidth="1" />
                    <path d="M 180 70 A 10 8 0 0 1 200 80 Z" fill="none" stroke="#334155" strokeWidth="1" />

                    {/* Safe Insertion Corridor Gates */}
                    <line x1="122" y1="38" x2="240" y2="78" stroke="rgba(34, 197, 94, 0.25)" strokeDasharray="2,4" strokeWidth="1" />

                    {/* Actual active rocket travel trailing line */}
                    {telemetry.timeElapsed > 0 && (
                      <path
                        d={`M 122 38 Q 180 ${38 + Math.min(telemetry.timeElapsed * 1.5, 30)} 240 78`}
                        fill="none"
                        stroke="#00f3ff"
                        strokeWidth="1.5"
                        strokeDasharray={launchStatus === 'ASCENDING' ? '3,1' : 'none'}
                        className="animate-pulse"
                      />
                    )}

                    {/* Current Coordinate Blinking Crosshair Globe Indicator */}
                    {(() => {
                      const tVal = telemetry.timeElapsed;
                      const lonVal = (80.23 + tVal * 2.8) % 360;
                      const latVal = 13.73 - Math.sin(tVal * 0.1) * 12;
                      const mappedX = 122 + ((lonVal - 80.23) / 120) * 80;
                      const mappedY = 38 + (13.73 - latVal);
                      
                      const boundedX = Math.max(10, Math.min(230, mappedX));
                      const boundedY = Math.max(10, Math.min(86, mappedY));

                      return (
                        <>
                          <circle cx={boundedX} cy={boundedY} r="3" fill="#ef4444" className="animate-ping" />
                          <circle cx={boundedX} cy={boundedY} r="1.5" fill="#ef4444" />
                        </>
                      );
                    })()}
                  </svg>
                  
                  {/* Digital overlay readings inside map frame */}
                  <div className="absolute bottom-1 right-1.5 text-[7.5px] font-mono text-slate-500 uppercase">
                    CORRIDOR: GATE 2A
                  </div>
                  <div className="absolute top-1 left-1.5 text-[7.5px] font-mono text-cyan-400 font-bold uppercase">
                    LAUNCHPAD: SDSC 80.2E
                  </div>
                </div>

                {/* Coords readings */}
                <div className="grid grid-cols-2 gap-1.5 text-[8.5px] pt-1">
                  <div className="bg-slate-900/60 p-1 rounded border border-slate-900">
                    <span className="text-[#64748b] block uppercase">GROUND POINT (अक्षांश):</span>
                    <span className="text-white font-bold">
                      {launchStatus === 'READY' || launchStatus === 'COUNTDOWN' || launchStatus === 'POWERING_UP' ? '13.73° N' : `${(13.73 - Math.sin(telemetry.timeElapsed * 0.08) * 8).toFixed(3)}° N`}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-1 rounded border border-slate-900">
                    <span className="text-[#64748b] block uppercase">MERIDIAN (देशांतर):</span>
                    <span className="text-white font-bold">
                      {launchStatus === 'READY' || launchStatus === 'COUNTDOWN' || launchStatus === 'POWERING_UP' ? '80.23° E' : `${((80.23 + telemetry.timeElapsed * 1.8) % 360).toFixed(3)}° E`}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-1 rounded border border-slate-900 col-span-2 flex justify-between items-center">
                    <span className="text-[#64748b]">STATUS FEED:</span>
                    <span className="text-[#22c55e] font-bold uppercase animate-pulse">● SATCOM S-BAND</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <span className="text-slate-400 font-semibold block uppercase text-[8px] tracking-wider">CREW HEALTH BIOSENSORS:</span>
                
                {/* Two pilots telemetry */}
                <div className="space-y-2">
                  <div className="bg-slate-900/40 p-1.5 rounded border border-cyan-500/10 space-y-1">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>👤 CMD. PRASHANTH (कमांडर)</span>
                      <span className="text-green-400">NOMINAL</span>
                    </div>
                    <div className="grid grid-cols-2 text-[8px] gap-1 text-slate-400">
                      <div>HEART RATE: <span className="text-white font-bold">{Math.floor(74 + (telemetry.velocity / 340) + Math.sin(telemetry.timeElapsed * 2) * 2)} BPM</span></div>
                      <div>RESPIRATION: <span className="text-white font-bold">18 Breath/Min</span></div>
                      <div>SUIT PRESS: <span className="text-white font-bold">101.4 kPa</span></div>
                      <div>G-TOLERANCE: <span className="text-white font-bold">100.0%</span></div>
                    </div>
                  </div>

                  <div className="bg-slate-900/40 p-1.5 rounded border border-cyan-500/10 space-y-1">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>👤 PILOT AJIT (सह-चालक)</span>
                      <span className="text-green-400">NOMINAL</span>
                    </div>
                    <div className="grid grid-cols-2 text-[8px] gap-1 text-slate-400">
                      <div>HEART RATE: <span className="text-white font-bold">{Math.floor(70 + (telemetry.velocity / 380) + Math.cos(telemetry.timeElapsed * 1.8) * 2)} BPM</span></div>
                      <div>RESPIRATION: <span className="text-white font-bold">16 Breath/Min</span></div>
                      <div>SUIT PRESS: <span className="text-white font-bold">101.2 kPa</span></div>
                      <div>G-TOLERANCE: <span className="text-white font-bold">100.0%</span></div>
                    </div>
                  </div>
                </div>

                {/* Life support buffers */}
                <div className="bg-slate-950 p-1.5 rounded border border-slate-900 text-[8px] flex items-center justify-between">
                  <div className="text-slate-400 uppercase font-semibold">OXYGEN RESERVE (BUFFER STATUS):</div>
                  <div className="text-cyan-400 font-bold">98.4% SAFE</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Steering Overlay Command Cockpit (Always available for immersive interactivity!) */}
        {showPilotDeck && (
          <div className="absolute right-4 top-16 z-10 w-64 bg-slate-950/85 border border-cyan-500/25 p-3 rounded-sm backdrop-blur-md space-y-3.5 shadow-xl font-mono text-[10px]">
            <div className="border-b border-cyan-500/10 pb-1.5 flex items-center justify-between text-cyan-400 font-bold select-none">
              <span className="flex items-center gap-1"><Navigation className="w-3.5 h-3.5 animate-pulse" /> PILOT DECK</span>
              <button
                onClick={() => { setShowPilotDeck(false); triggerBeep(180, 0.08); }}
                className="text-slate-400 hover:text-red-400 font-bold text-xs p-1 hover:bg-slate-800 rounded transition-colors self-center border border-transparent hover:border-red-500/20"
                title="Close Controls"
              >
                ✕
              </button>
            </div>

            {/* Camera View Selector */}
            <div className="space-y-1 select-none">
              <span className="text-[#64748b] text-[9px] font-bold uppercase block tracking-wider">SELECT CINEMATIC VIEW (दृष्टिकोण):</span>
              <div className="grid grid-cols-2 gap-1 text-[9px] font-bold text-center">
                <button
                  onClick={() => { setCameraPreset('AUTO'); triggerBeep(400, 0.1); }}
                  className={`py-1 rounded border transition-all ${cameraPreset === 'AUTO' ? 'bg-cyan-950 text-[#00f3ff] border-cyan-500' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'}`}
                >
                  AUTOMATIC 🤖
                </button>
                <button
                  onClick={() => { setCameraPreset('PAD'); triggerBeep(400, 0.1); }}
                  className={`py-1 rounded border transition-all ${cameraPreset === 'PAD' ? 'bg-cyan-950 text-[#00f3ff] border-cyan-500' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'}`}
                >
                  LAUNCHPAD 🗼
                </button>
                <button
                  onClick={() => { setCameraPreset('EVA'); triggerBeep(400, 0.1); }}
                  className={`py-1 rounded border transition-all ${cameraPreset === 'EVA' ? 'bg-cyan-950 text-[#00f3ff] border-cyan-500' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'}`}
                >
                  ASTRONAUTS 👨‍🚀
                </button>
                <button
                  onClick={() => { setCameraPreset('STATION'); triggerBeep(400, 0.1); }}
                  className={`py-1 rounded border transition-all ${cameraPreset === 'STATION' ? 'bg-cyan-950 text-[#00f3ff] border-cyan-500' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'}`}
                >
                  SPACE STN (ISS) 🛸
                </button>
                <button
                  onClick={() => { setCameraPreset('COCKPIT'); triggerBeep(400, 0.1); }}
                  className={`py-1 rounded border transition-all col-span-2 ${cameraPreset === 'COCKPIT' ? 'bg-cyan-950 text-[#00f3ff] border-cyan-500' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'}`}
                >
                  COCKPIT INSIDE (क्रू केबिन अंदर) 🚀👨‍🚀
                </button>
              </div>
              <button
                onClick={() => { setCameraPreset('SYSTEM'); triggerBeep(400, 0.1); }}
                className={`w-full py-1 rounded border text-[9px] font-bold text-center mt-1 transition-all ${cameraPreset === 'SYSTEM' ? 'bg-cyan-950 text-[#00f3ff] border-cyan-500' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'}`}
              >
                EARTH-MOON SYSTEM (पृथ्वी-चंद्रमा) 🌍🌕
              </button>
            </div>

            {/* RCS steering buttons (Always unlocked for high-speed pilot maneuverability!) */}
            <div className="space-y-2.5">
              <span className="text-cyan-400 text-[9px] font-bold block border-t border-cyan-500/10 pt-2 tracking-wider uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                SAT PILOT RCS MATRIX (मैनुअल नियंत्रण):
              </span>
              
              {/* Steer directional buttons */}
              <div className="flex flex-col items-center gap-1 select-none font-display">
                <button
                  onMouseDown={() => handleSteerStart('UP')} onMouseUp={handleSteerStop} onMouseLeave={handleSteerStop}
                  onTouchStart={() => handleSteerStart('UP')} onTouchEnd={handleSteerStop}
                  className="px-3 py-1 bg-slate-900 hover:bg-cyan-950 hover:text-cyan-400 border border-slate-800 active:scale-95 text-xs rounded transition-all cursor-pointer"
                  title="Pitch Down"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <div className="flex gap-4">
                  <button
                    onMouseDown={() => handleSteerStart('LEFT')} onMouseUp={handleSteerStop} onMouseLeave={handleSteerStop}
                    onTouchStart={() => handleSteerStart('LEFT')} onTouchEnd={handleSteerStop}
                    className="px-3 py-1 bg-slate-900 hover:bg-cyan-950 hover:text-cyan-400 border border-slate-800 active:scale-95 text-xs rounded transition-all cursor-pointer"
                    title="Yaw Left"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onMouseDown={() => handleSteerStart('RIGHT')} onMouseUp={handleSteerStop} onMouseLeave={handleSteerStop}
                    onTouchStart={() => handleSteerStart('RIGHT')} onTouchEnd={handleSteerStop}
                    className="px-3 py-1 bg-slate-900 hover:bg-cyan-950 hover:text-cyan-400 border border-slate-800 active:scale-95 text-xs rounded transition-all cursor-pointer"
                    title="Yaw Right"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onMouseDown={() => handleSteerStart('DOWN')} onMouseUp={handleSteerStop} onMouseLeave={handleSteerStop}
                  onTouchStart={() => handleSteerStart('DOWN')} onTouchEnd={handleSteerStop}
                  className="px-3 py-1 bg-slate-900 hover:bg-cyan-950 hover:text-cyan-400 border border-slate-800 active:scale-95 text-xs rounded transition-all cursor-pointer"
                  title="Pitch Up"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              {/* Roll controllers */}
              <div className="grid grid-cols-2 gap-1.5 pt-1.5 select-none text-[8.5px] font-bold text-center">
                <button
                  onMouseDown={() => handleSteerStart('ROLL_CCW')} onMouseUp={handleSteerStop} onMouseLeave={handleSteerStop}
                  onTouchStart={() => handleSteerStart('ROLL_CCW')} onTouchEnd={handleSteerStop}
                  className="py-1 bg-slate-900 hover:bg-cyan-950 hover:text-[#00f3ff] border border-slate-800 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Roll Left"
                >
                  <RotateCcw className="w-3 h-3" /> ROLL CCW
                </button>
                <button
                  onMouseDown={() => handleSteerStart('ROLL_CW')} onMouseUp={handleSteerStop} onMouseLeave={handleSteerStop}
                  onTouchStart={() => handleSteerStart('ROLL_CW')} onTouchEnd={handleSteerStop}
                  className="py-1 bg-slate-900 hover:bg-cyan-950 hover:text-[#00f3ff] border border-slate-800 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Roll Right"
                >
                  ROLL CW <RotateCw className="w-3 h-3" />
                </button>
              </div>

              {/* Sat main thruster */}
              <button
                onClick={toggleSatThruster}
                className={`w-full py-2 font-bold text-center border mt-2 flex items-center justify-center gap-2 rounded select-none cursor-pointer transition-all duration-300 ${satThrustActive ? 'bg-amber-950/80 border-amber-500 text-amber-400 hover:bg-amber-900 animate-pulse' : 'bg-[#0f172a] border-[#334155] text-slate-300 hover:bg-slate-800'}`}
              >
                {satThrustActive ? '⚡ THRUST INJECTOR ACTIVE PlUME' : 'ENGAGE MAIN THRUSTERS (दहन)'}
              </button>
            </div>

            {/* Time Warp Speed Slider */}
            <div className="border-t border-cyan-500/10 pt-2 space-y-1 select-none">
              <span className="text-[#64748b] text-[9px] font-bold block uppercase tracking-wider">TIME WARP (समय गति):</span>
              <div className="grid grid-cols-3 gap-1 text-[9px] text-center font-bold">
                <button
                  onClick={() => { setSimSpeed(1); triggerBeep(450, 0.08); }}
                  className={`py-1 rounded border transition-all ${simSpeed === 1 ? 'bg-cyan-950 text-[#00f3ff] border-cyan-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                >
                  1X NORMAL
                </button>
                <button
                  onClick={() => { setSimSpeed(2.5); triggerBeep(450, 0.08); }}
                  className={`py-1 rounded border transition-all ${simSpeed === 2.5 ? 'bg-cyan-950 text-[#00f3ff] border-cyan-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                >
                  2.5X LEO
                </button>
                <button
                  onClick={() => { setSimSpeed(5); triggerBeep(450, 0.08); }}
                  className={`py-1 rounded border transition-all ${simSpeed === 5 ? 'bg-cyan-950 text-[#00f3ff] border-cyan-500' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                >
                  5X DEEP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Big Countdown Number Overlay */}
        <div className="absolute inset-x-0 top-[28%] flex flex-col items-center justify-center pointer-events-none z-10 px-4 text-center">
          <AnimatePresence>
            {launchStatus === 'COUNTDOWN' && (
              <motion.div
                key={countdown}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-7xl md:text-9xl font-black text-[#ff9933] drop-shadow-[0_0_25px_rgba(255,153,51,0.7)] font-display select-none"
              >
                {countdown}
              </motion.div>
            )}
          </AnimatePresence>

          {countdownTextOverride && (
            <div className="mt-8 px-5 py-2 rounded-sm bg-[#050a14]/90 border border-[#ff9933]/50 text-[#ff9933] font-mono text-xs tracking-wider uppercase animate-pulse shadow-md select-none">
              {countdownTextOverride}
            </div>
          )}

          {false && launchStatus === 'SUCCESS' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="px-6 py-6 rounded-sm bg-[#030712]/95 border border-emerald-500/30 text-center max-w-sm pointer-events-auto shadow-2xl relative"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 font-black px-4 py-0.5 rounded-sm text-[9px] tracking-widest uppercase flex items-center gap-1 shadow-md font-mono select-none">
                <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-slate-950" /> MISSION COGNITIVE SUCCESS
              </div>
              <h4 className="text-lg font-extrabold text-emerald-400 mt-2 tracking-tight uppercase font-display select-none">
                मिशन सफल! 🇮🇳
              </h4>
              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed font-sans select-none">
                Your <strong className="text-white">{currentModel.name}</strong> has safely placed the payload in target <strong className="text-[#00f3ff]">{currentPayload.targetOrbit}</strong> orbital configs.
              </p>
              <p className="text-xs font-bold text-[#ff9933] mt-3.5 tracking-wider font-mono uppercase select-none">
                भारत माता की जय! 🇮🇳
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Flight gauges board HUD */}
      <div className="bg-[#030712] border-t border-[#1e293b] py-3 px-4 grid grid-cols-5 gap-2 text-center select-none z-10 font-mono text-xs text-slate-400">
        <div className="space-y-0.5 border-r border-[#1e293b]">
          <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-[#00f3ff]" /> गति (SPEED)
          </div>
          <div className="text-xs font-bold text-[#00f3ff] md:text-sm">
            {telemetry.velocity.toFixed(2)} <span className="text-[9px] font-medium text-[#64748b]">km/s</span>
          </div>
        </div>

        <div className="space-y-0.5 border-r border-[#1e293b]">
          <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> ऊंचाई (ALTITUDE)
          </div>
          <div className="text-xs font-bold text-emerald-400 md:text-sm">
            {telemetry.altitude.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-[9px] font-medium text-[#64748b]">km</span>
          </div>
        </div>

        <div className="space-y-0.5 border-r border-[#1e293b]">
          <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
            <Shield className="w-3.5 h-3.5 text-[#ff9933]" /> ईंधन (FUEL)
          </div>
          <div className={`text-xs font-bold transition-colors md:text-sm ${telemetry.fuelLeft < 30 ? 'text-red-400 animate-pulse' : 'text-slate-100'}`}>
            {Math.round(telemetry.fuelLeft)}%
          </div>
        </div>

        <div className="space-y-0.5 border-r border-[#1e293b]">
          <div className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">FORCE</div>
          <div className="text-xs font-bold text-amber-300 md:text-sm">
            {telemetry.gForce.toFixed(2)} G
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider">STAGE</div>
          <div className="text-xs font-bold text-fuchsia-400 truncate tracking-tight uppercase md:text-sm">
            {telemetry.stage}
          </div>
        </div>
      </div>

      {/* Terminal log logs */}
      {!isFullscreen && (
        <div className="bg-[#030712] border-t border-[#1e293b] h-32 p-3 font-mono text-[10px] leading-relaxed overflow-y-auto flex flex-col gap-1 z-10 shadow-inner">
          <div className="sticky top-0 bg-[#030712] pb-1 border-b border-[#1e293b] mb-1.5 flex items-center gap-1.5 text-[#64748b] text-[9px] font-bold uppercase tracking-wider">
            <Terminal className="w-3.5 h-3.5 text-emerald-500" /> SYSTEM MISSION LOGS
          </div>

          <div className="flex flex-col border-b border-slate-900/40 pb-1 text-[9.5px]">
            <span className="text-emerald-400 font-bold">[सिस्टम]: हाइपर-रियलिस्टिक 3D सिमुलेटर लोड चालू है।</span>
            <span className="text-slate-400 pl-4">↳ [लोकेशन]: सतीश धवन स्पेस सेंटर, श्रीहरिकोटा।</span>
            <span className="text-slate-400 pl-4">↳ [सत्यापन]: वास्तविक पृथ्वी, चंद्रमा, दो वास्तविक एस्ट्रोनॉट्स एवं कंट्रोलर सक्रिय हैं।</span>
            <span className="text-[#00f3ff] pl-4">↳ [निर्देश]: पेलोड को दिशा देने हेतु पायलट पैड बटन काम में लें।</span>
          </div>

          {flightLogs.map((log) => (
            <div key={log.id} className="flex flex-col border-b border-slate-900/40 pb-1">
              <div className="flex items-start gap-2">
                <span className="text-[#64748b] shrink-0 font-bold">[{log.timestamp}]</span>
                <span className={`font-medium ${log.type === 'success' ? 'text-emerald-400' : log.type === 'warning' ? 'text-[#ff9933]' : 'text-[#00f3ff]'}`}>
                  {log.message}
                </span>
              </div>
              {log.hindiMessage && (
                <span className="text-slate-500 pl-11 text-[9.5px]">↳ {log.hindiMessage}</span>
              )}
            </div>
          ))}
          <div ref={logTerminalEndRef} />
        </div>
      )}
    </div>
  );
}
