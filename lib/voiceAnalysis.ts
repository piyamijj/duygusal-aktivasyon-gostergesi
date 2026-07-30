/**
 * Duygusal Aktivasyon Göstergesi - Voice/Acoustic Analysis Module
 * Pure browser-side digital signal processing (DSP) for voice feature extraction.
 * No AI/ML, pure math and time-domain autocorrelation.
 */

export interface VoiceAnalysisResult {
  meanPitchHz: number;
  pitchStdHz: number;
  pitchRangeHz: number;
  jitterProxy: number; // Voice perturbation proxy
  speechRateSPM: number; // Speech rate in segments per minute
  totalPauseMs: number;
  pauseCount: number;
  avgPauseMs: number;
  longestPauseMs: number;
  voicedRatio: number; // Ratio of speech-active time to total time
  durationSec: number;
}

export interface Segment {
  startMs: number;
  endMs: number;
  durationMs: number;
}

/**
 * Computes the Root Mean Square (RMS) amplitude envelope of the audio signal.
 * Splits the signal into short, non-overlapping frames.
 */
export function computeRMSEnvelope(
  samples: Float32Array,
  sampleRate: number,
  frameMs: number = 20
): number[] {
  const frameSize = Math.round((frameMs / 1000) * sampleRate);
  if (frameSize <= 0 || samples.length === 0) return [];

  const numFrames = Math.floor(samples.length / frameSize);
  const envelope: number[] = [];

  for (let f = 0; f < numFrames; f++) {
    const startIdx = f * frameSize;
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      const val = samples[startIdx + i];
      sumSq += val * val;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    envelope.push(rms);
  }

  return envelope;
}

/**
 * Estimates an adaptive silence/noise threshold based on the envelope's percentile.
 * This helps adapt to different microphone gains and background noise levels.
 */
export function estimateAdaptiveThreshold(
  envelope: number[],
  percentile: number = 15,
  multiplier: number = 2.5
): number {
  if (envelope.length === 0) return 0.01;

  // Sort a copy of the envelope to find the percentile
  const sorted = [...envelope].sort((a, b) => a - b);
  const idx = Math.floor((percentile / 100) * sorted.length);
  const noiseFloor = sorted[idx] || 0.001;

  // Ensure a minimum threshold to avoid triggering on absolute digital silence
  return Math.max(0.008, noiseFloor * multiplier);
}

/**
 * Detects silent segments (pauses) in the audio based on the RMS envelope.
 * Consecutive frames below the threshold are grouped into pause segments.
 * Pauses shorter than minPauseMs are ignored to filter out micro-gaps between syllables.
 */
export function detectSilenceSegments(
  envelope: number[],
  frameMs: number,
  silenceThreshold: number,
  minPauseMs: number = 200
): { segments: Segment[]; totalPauseMs: number; pauseCount: number } {
  const segments: Segment[] = [];
  let inSilence = false;
  let silenceStartFrame = 0;

  for (let i = 0; i < envelope.length; i++) {
    const isSilent = envelope[i] < silenceThreshold;

    if (isSilent && !inSilence) {
      inSilence = true;
      silenceStartFrame = i;
    } else if (!isSilent && inSilence) {
      inSilence = false;
      const durationMs = (i - silenceStartFrame) * frameMs;
      if (durationMs >= minPauseMs) {
        segments.push({
          startMs: silenceStartFrame * frameMs,
          endMs: i * frameMs,
          durationMs,
        });
      }
    }
  }

  // Handle trailing silence
  if (inSilence) {
    const durationMs = (envelope.length - silenceStartFrame) * frameMs;
    if (durationMs >= minPauseMs) {
      segments.push({
        startMs: silenceStartFrame * frameMs,
        endMs: envelope.length * frameMs,
        durationMs,
      });
    }
  }

  const totalPauseMs = segments.reduce((sum, s) => sum + s.durationMs, 0);

  return {
    segments,
    totalPauseMs,
    pauseCount: segments.length,
  };
}

/**
 * Detects voiced (speech-active) segments in the audio.
 * Consecutive frames above the threshold are grouped into voiced segments.
 */
export function detectVoicedSegments(
  envelope: number[],
  frameMs: number,
  threshold: number,
  minVoicedMs: number = 80
): { segments: Segment[]; voicedFrameCount: number } {
  const segments: Segment[] = [];
  let inVoiced = false;
  let voicedStartFrame = 0;
  let voicedFrameCount = 0;

  for (let i = 0; i < envelope.length; i++) {
    const isVoiced = envelope[i] >= threshold;
    if (isVoiced) voicedFrameCount++;

    if (isVoiced && !inVoiced) {
      inVoiced = true;
      voicedStartFrame = i;
    } else if (!isVoiced && inVoiced) {
      inVoiced = false;
      const durationMs = (i - voicedStartFrame) * frameMs;
      if (durationMs >= minVoicedMs) {
        segments.push({
          startMs: voicedStartFrame * frameMs,
          endMs: i * frameMs,
          durationMs,
        });
      }
    }
  }

  // Handle trailing voiced segment
  if (inVoiced) {
    const durationMs = (envelope.length - voicedStartFrame) * frameMs;
    if (durationMs >= minVoicedMs) {
      segments.push({
        startMs: voicedStartFrame * frameMs,
        endMs: envelope.length * frameMs,
        durationMs,
      });
    }
  }

  return {
    segments,
    voicedFrameCount,
  };
}

/**
 * Estimates speech rate as the number of distinct voiced segments (syllable/word bursts)
 * per minute of active speech (excluding long pauses).
 */
export function computeSpeechRate(
  voicedSegments: Segment[],
  totalDurationSec: number,
  totalPauseMs: number
): number {
  const activeDurationSec = totalDurationSec - totalPauseMs / 1000;
  if (activeDurationSec <= 1 || voicedSegments.length === 0) return 0;

  // Segments per minute
  const rate = (voicedSegments.length / activeDurationSec) * 60;
  // Clamp to realistic human speech rates (30 to 300 segments/min)
  return Math.min(300, Math.max(0, rate));
}

/**
 * Time-domain Autocorrelation Pitch Detection (YIN-lite approach).
 * Finds the fundamental frequency (F0) of a single audio frame.
 * Restricts search to typical human voice range: 70 Hz to 400 Hz.
 */
export function autocorrelate(buffer: Float32Array, sampleRate: number): number {
  const size = buffer.length;

  // 1. Check if frame is too quiet (noise gate)
  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.005) return -1; // Unvoiced/silent frame

  // 2. Normalize the buffer to maximize correlation range
  const normalized = new Float32Array(size);
  let maxVal = 0;
  for (let i = 0; i < size; i++) {
    if (Math.abs(buffer[i]) > maxVal) maxVal = Math.abs(buffer[i]);
  }
  if (maxVal > 0) {
    for (let i = 0; i < size; i++) {
      normalized[i] = buffer[i] / maxVal;
    }
  }

  // 3. Define lag bounds for 70 Hz to 400 Hz
  const maxLag = Math.floor(sampleRate / 70);
  const minLag = Math.floor(sampleRate / 400);

  if (maxLag >= size) return -1;

  const r = new Float32Array(maxLag + 1);

  // 4. Compute autocorrelation for each lag
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < size - lag; i++) {
      sum += normalized[i] * normalized[i + lag];
    }
    r[lag] = sum;
  }

  // 5. Find the first significant peak (avoiding octave errors)
  // Find the first zero-crossing or local minimum of autocorrelation to start peak search
  let startLag = minLag;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (r[lag] < r[lag - 1]) {
      startLag = lag;
    } else {
      break;
    }
  }

  let maxValCorr = -1;
  let bestLag = -1;

  for (let lag = startLag; lag <= maxLag; lag++) {
    if (r[lag] > maxValCorr) {
      maxValCorr = r[lag];
      bestLag = lag;
    }
  }

  // 6. Threshold check: correlation must be strong enough to indicate a periodic voice signal
  const energy = r[0] || 1;
  const correlationCoeff = maxValCorr / energy;

  if (bestLag === -1 || correlationCoeff < 0.35) {
    return -1; // Unvoiced frame
  }

  // 7. Parabolic interpolation around the peak lag for sub-sample precision
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const alpha = r[bestLag - 1];
    const beta = r[bestLag];
    const gamma = r[bestLag + 1];
    const denom = 2 * (2 * beta - alpha - gamma);
    if (denom !== 0) {
      const p = (alpha - gamma) / denom;
      refinedLag = bestLag + p;
    }
  }

  const pitchHz = sampleRate / refinedLag;

  // Double check bounds
  if (pitchHz < 70 || pitchHz > 400) return -1;

  return pitchHz;
}

/**
 * Slides a window across the audio signal to compute the pitch contour.
 * Only runs autocorrelation on voiced frames to optimize performance.
 */
export function computePitchContour(
  samples: Float32Array,
  sampleRate: number,
  frameMs: number = 40,
  hopMs: number = 20,
  silenceThreshold: number = 0.01
): { timesMs: number[]; pitchesHz: number[] } {
  const frameSize = Math.round((frameMs / 1000) * sampleRate);
  const hopSize = Math.round((hopMs / 1000) * sampleRate);

  const timesMs: number[] = [];
  const pitchesHz: number[] = [];

  if (frameSize <= 0 || hopSize <= 0 || samples.length < frameSize) {
    return { timesMs, pitchesHz };
  }

  let offset = 0;
  while (offset + frameSize <= samples.length) {
    const frame = samples.subarray(offset, offset + frameSize);

    // Compute frame RMS to skip silent frames
    let sumSq = 0;
    for (let i = 0; i < frame.length; i++) {
      sumSq += frame[i] * frame[i];
    }
    const rms = Math.sqrt(sumSq / frame.length);

    const timeMs = (offset + frameSize / 2) * (1000 / sampleRate);
    timesMs.push(timeMs);

    if (rms < silenceThreshold) {
      pitchesHz.push(-1);
    } else {
      const pitch = autocorrelate(frame, sampleRate);
      pitchesHz.push(pitch);
    }

    offset += hopSize;
  }

  return { timesMs, pitchesHz };
}

/**
 * Summarizes the pitch contour into statistical features.
 * Computes mean, standard deviation, range, and a simplified jitter proxy.
 */
export function summarizePitch(pitchesHz: number[]): {
  meanHz: number;
  stdHz: number;
  rangeHz: number;
  jitterProxy: number;
} {
  const validPitches = pitchesHz.filter((p) => p > 0);

  if (validPitches.length < 3) {
    return { meanHz: 0, stdHz: 0, rangeHz: 0, jitterProxy: 0 };
  }

  // 1. Mean
  const sum = validPitches.reduce((a, b) => a + b, 0);
  const meanHz = sum / validPitches.length;

  // 2. Standard Deviation
  const sumSqDiff = validPitches.reduce((sum, p) => sum + Math.pow(p - meanHz, 2), 0);
  const stdHz = Math.sqrt(sumSqDiff / validPitches.length);

  // 3. Range (90th percentile - 10th percentile to avoid outlier spikes)
  const sorted = [...validPitches].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const rangeHz = Math.max(0, p90 - p10);

  // 4. Jitter Proxy (simplified voice perturbation)
  // Jitter is the cycle-to-cycle variation of fundamental frequency.
  // Proxy: average absolute difference between consecutive pitch periods (1/F0)
  // normalized by the average pitch period.
  let absoluteDiffSum = 0;
  let count = 0;
  for (let i = 1; i < validPitches.length; i++) {
    const periodPrev = 1 / validPitches[i - 1];
    const periodCurr = 1 / validPitches[i];
    absoluteDiffSum += Math.abs(periodCurr - periodPrev);
    count++;
  }

  const avgPeriod = 1 / meanHz;
  const jitterProxy = count > 0 ? (absoluteDiffSum / count) / avgPeriod : 0;

  return {
    meanHz: Math.round(meanHz * 10) / 10,
    stdHz: Math.round(stdHz * 10) / 10,
    rangeHz: Math.round(rangeHz * 10) / 10,
    jitterProxy: Math.round(jitterProxy * 10000) / 100, // Expressed as percentage (%)
  };
}

/**
 * Top-level orchestrator to analyze a voice recording.
 */
export function analyzeVoiceSignal(
  samples: Float32Array,
  sampleRate: number
): VoiceAnalysisResult {
  const durationSec = samples.length / sampleRate;

  // Guard against empty or extremely short recordings
  if (samples.length < sampleRate * 0.5) {
    return {
      meanPitchHz: 0,
      pitchStdHz: 0,
      pitchRangeHz: 0,
      jitterProxy: 0,
      speechRateSPM: 0,
      totalPauseMs: 0,
      pauseCount: 0,
      avgPauseMs: 0,
      longestPauseMs: 0,
      voicedRatio: 0,
      durationSec,
    };
  }

  const frameMs = 20;
  const envelope = computeRMSEnvelope(samples, sampleRate, frameMs);
  const threshold = estimateAdaptiveThreshold(envelope);

  // 1. Silence / Pause analysis
  const silenceAnalysis = detectSilenceSegments(envelope, frameMs, threshold, 200);

  // 2. Voiced segments (speech bursts)
  const voicedAnalysis = detectVoicedSegments(envelope, frameMs, threshold, 80);

  // 3. Pitch contour analysis
  const { pitchesHz } = computePitchContour(samples, sampleRate, 40, 20, threshold);
  const pitchStats = summarizePitch(pitchesHz);

  // 4. Speech rate calculation
  const speechRateSPM = computeSpeechRate(voicedAnalysis.segments, durationSec, silenceAnalysis.totalPauseMs);

  // 5. Pause metrics
  const totalPauseMs = silenceAnalysis.totalPauseMs;
  const pauseCount = silenceAnalysis.pauseCount;
  const avgPauseMs = pauseCount > 0 ? Math.round(totalPauseMs / pauseCount) : 0;
  const longestPauseMs = silenceAnalysis.segments.length > 0
    ? Math.max(...silenceAnalysis.segments.map((s) => s.durationMs))
    : 0;

  // 6. Voiced ratio (active speech time vs total time)
  const totalFrames = envelope.length || 1;
  const voicedRatio = Math.round((voicedAnalysis.voicedFrameCount / totalFrames) * 100) / 100;

  return {
    meanPitchHz: pitchStats.meanHz,
    pitchStdHz: pitchStats.stdHz,
    pitchRangeHz: pitchStats.rangeHz,
    jitterProxy: pitchStats.jitterProxy,
    speechRateSPM: Math.round(speechRateSPM * 10) / 10,
    totalPauseMs,
    pauseCount,
    avgPauseMs,
    longestPauseMs,
    voicedRatio,
    durationSec: Math.round(durationSec * 10) / 10,
  };
}