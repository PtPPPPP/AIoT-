import { DataOrigin, DeviceStateKey, SensorKey, SensorQuality } from '../types';

export type Sample = {
  id: string; zoneId: string; sensorId: string; gatewayId: string; key: SensorKey; unit: string;
  value: number | null; sourceKind: DataOrigin; source: string; quality: SensorQuality; originalQuality: SensorQuality;
  capturedAt: string; receivedAt: string; serviceReceivedAt: string; validationNotes: string[];
  rawValue?: number; calibratedValue?: number; calibrationVersion?: string;
};
export type DataEvent = {
  id: string; zoneId: string; kind: 'command' | 'feedback' | 'alarm' | 'manual' | 'collector-gap';
  observedAt: string; receivedAt?: string; sourceKind?: DataOrigin; device?: DeviceStateKey;
  commandId?: string; source?: string; reason?: string; strategyVersion?: string;
  target?: boolean; status?: string; actual?: boolean | null; feedbackLevel?: string; precisionMs?: number; timeBasis?: string;
  note?: string; operation?: string; title?: string; irrigationId?: string; firstObservedAt?: string; observationCount?: number;
};
export type TargetRange = { low: number; high: number; unit: string; confirmed: boolean };
export type PlantContext = {
  version: string; zoneId: string; effectiveAt: string; batchId?: string | null; crop?: string | null; variety?: string | null;
  stage?: string | null; substrate?: string | null; plantedAt?: string | null; notes?: string | null; soilSensorId?: string | null;
  targets: Partial<Record<SensorKey, TargetRange>>; targetBasis?: string; analysisBasis?: string;
  analysis: { maxGapSeconds?: number | null; preWindowSeconds?: number | null; postWindowSeconds?: number | null; responseDelta?: number | null };
};
export type SeriesStats = {
  metric: SensorKey; sensorId: string | null; unit: string; sourceKind: DataOrigin; sampleCount: number; validSampleCount: number;
  minimum: { value: number; at: string; sampleId: string } | null; maximum: { value: number; at: string; sampleId: string } | null;
  timeWeightedMean: number | null; coverage: number; denominatorSeconds: number; validSeconds: number; unknownSeconds: number;
  targetInSeconds: number | null; targetOutSeconds: number | null; targetUnknownSeconds: number; targetUnconfiguredValidSeconds: number;
  longestOutSeconds: number | null; targetVersions: string[]; missingPeriods: Array<{ from: string; to: string; seconds: number }>;
  changeRatePerHour: number | null; rateFrom: string | null; rateTo: string | null; reason: string | null;
};
export type EnvironmentReport = { dataset: DataOrigin; zoneId: string; from: string; to: string; requestedTo: string; timezone: string; metrics: SeriesStats[]; contexts: PlantContext[]; method: string; maxGapSeconds: number; sampleCount: number };
export type ChartData = { items: Sample[]; rawCount: number; downsampled: boolean; events: DataEvent[]; eventsTruncated: boolean; maxGapSeconds: number; contexts: PlantContext[]; from: string; to: string };
export type Irrigation = {
  id: string; aliases: string[]; zoneId: string; batchId: string | null; requestedAt: string | null; startedAt: string | null; stoppedAt: string | null;
  startBounds: { earliest: string | null; latest: string } | null; stopBounds: { earliest: string | null; latest: string } | null;
  startFeedbackLevel: string | null; stopFeedbackLevel: string | null; supportedRunSeconds: number;
  durationBoundsSeconds: { minimum: number | null; maximum: number | null } | null; hasGap: boolean; timeline: DataEvent[];
  context: PlantContext | null; physicalStartObserved: boolean; physicalStopObserved: boolean; evidenceState: string;
  outcome: string; limitations: string[]; before: SeriesStats | null; after: SeriesStats | null; moistureDelta: number | null;
  responseAt: string | null; responseDelaySeconds: number | null; targetReturnAt: string | null; targetReturnVersion: string | null;
  observationUntil: string | null; windowFrom: string; windowTo: string; interventions: DataEvent[]; notes: DataEvent[];
  samples: Sample[]; relatedEvents: DataEvent[]; responseMethod?: string;
  relatedEventsTruncated?: boolean;
};
export type Health = {
  schemaVersion: number; service: string; collector: { state: string; lastSuccessAt: string | null; error: string | null; invalidPackets: number };
  collectorMode: string; timezone: string; retentionDays: number; maxGapSeconds: number; serverTime: string; controlCapability: boolean;
  datasets: Record<DataOrigin, { sampleCount: number; eventCount: number; latestAt: string | null; earliestAt: string | null; conflictCount: number }>;
};
