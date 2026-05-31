export type RocketModelId = 'LVM3' | 'PSLV' | 'SSLV';

export interface RocketModel {
  id: RocketModelId;
  name: string;
  hindiName: string;
  description: string;
  specs: {
    height: string;
    diameter: string;
    liftOffMass: string;
    stages: number;
    payloadCapacity: string;
  };
}

export type BoosterPower = 'Solid Strapon' | 'Liquid Core' | 'No Booster';

export interface BoosterOption {
  id: BoosterPower;
  name: string;
  hindiName: string;
  thrust: string;
  isp: string; // Specific Impulse
  description: string;
}

export type PayloadTargetId = 'Moon Orbit' | 'Mars Mission' | 'Earth Weather' | 'Gaganyaan Mission';

export interface PayloadTarget {
  id: PayloadTargetId;
  name: string;
  hindiName: string;
  targetOrbit: string;
  distance: string;
  description: string;
}

export interface KalamQuote {
  quote: string;
  hindiQuote: string;
  context: string;
}

export type LaunchStatus = 'READY' | 'COUNTDOWN' | 'POWERING_UP' | 'ASCENDING' | 'STAGE_SEPARATION' | 'INSERTION' | 'SUCCESS';

export interface Telemetry {
  altitude: number; // in km
  velocity: number; // in km/s
  fuelLeft: number; // percentage 0-100
  gForce: number; // Gs
  stage: string;
  timeElapsed: number; // in seconds
}

export interface FlightLogMessage {
  id: string;
  timestamp: string;
  message: string;
  hindiMessage: string;
  type: 'info' | 'warning' | 'success';
}
