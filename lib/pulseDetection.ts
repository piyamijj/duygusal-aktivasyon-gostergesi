/**
 * Duygusal Aktivasyon Göstergesi - rPPG Pulse Detection Module
 * Pure browser-side signal processing for camera-based pulse (BPM) detection.
 * No AI/ML, pure DSP math.
 */

export interface PulseSample {
  t: number; // Timestamp in milliseconds
  r: number; // Average red channel value (0-255)
  g: number; // Average green channel value (0-255)
  b: number; // Average blue channel value (0-255)
}

export interface PulseAnalysisResult {
  bpm: number;
  quality: number; // 0.0 to 1.0
  fingerDetected: boolean;
  method: 'fft' | 'peak' | 'none';
  rrIntervalVarianceMs: number; // Proxy for heart rate variability (HRV)
}

/**
 * Samples the central region of a video frame to extract average RGB values.
 * When a finger covers the camera lens with the flash on, the frame is dominated
 * by red light scattering through tissue, which fluctuates with blood volume pulse (BVP).
 */
export function sampleRedChannel(
  videoEl: HTMLVideoElement,
  canvasEl: HTMLCanvasElement
): PulseSample | null {
  if (!videoEl || videoEl.paused || videoEl.ended) return null;

  const ctx = canvasEl.getContext('2d');
  if (!ctx) return null;

  // Keep canvas small to optimize pixel processing overhead
  const width = 120;
  const height = 120;
  if (canvasEl.width !== width || canvasEl.height !== height) {
    canvasEl.width = width;
    canvasEl.height = height;
  }

  // Draw central region of the video frame
  ctx.drawImage(videoEl, 0, 0, width, height);

  // Sample central 40x40 pixel region to avoid edge artifacts
  const sampleSize = 40;
  const startX = Math.floor((width - sampleSize) / 2);
  const startY = Math.floor((height - sampleSize) / 2);

  try {
    const imgData = ctx.getImageData(startX, startY, sampleSize, sampleSize);
    const data = imgData.data;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    const totalPixels = sampleSize * sampleSize;

    for (let i = 0; i < data.length; i += 4) {
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
    }

    return {
      t: performance.now(),
      r: sumR / totalPixels,
      g: sumG / totalPixels,
      b: sumB / totalPixels,
    };
  } catch (e) {
    console.error("Error sampling frame pixels:", e);
    return null;
  }
}

/**
 * Accumulates pulse samples over a sliding window.
 */
export class PulseSignalBuffer {
  private samples: PulseSample[] = [];
  private maxDurationMs: number;

  constructor(maxDurationMs: number = 25000) {
    this.maxDurationMs = maxDurationMs;
  }

  public addSample(sample: PulseSample): void {
    this.samples.push(sample);
    this.trim();
  }

  public getSamples(): PulseSample[] {
    return [...this.samples];
  }

  public reset(): void {
    this.samples = [];
  }

  public isFull(targetDurationMs: number): boolean {
    if (this.samples.length < 2) return false;
    const duration = this.samples[this.samples.length - 1].t - this.samples[0].t;
    return duration >= targetDurationMs;
  }

  private trim(): void {
    if (this.samples.length < 2) return;
    const latestTime = this.samples[this.samples.length - 1].t;
    while (this.samples.length > 0 && latestTime - this.samples[0].t > this.maxDurationMs) {
      this.samples.shift();
    }
  }
}

/**
 * Resamples irregular samples to a uniform sampling rate using linear interpolation.
 * Essential for FFT and digital filtering which assume constant dt.
 */
export function resampleSignal(
  samples: PulseSample[],
  targetFsHz: number = 30
): { t: number[]; r: number[] } {
  if (samples.length < 2) return { t: [], r: [] };

  const tStart = samples[0].t;
  const tEnd = samples[samples.length - 1].t;
  const durationSec = (tEnd - tStart) / 1000;
  const totalTargetSamples = Math.floor(durationSec * targetFsHz);

  const resampledT: number[] = [];
  const resampledR: number[] = [];
  const dt = 1000 / targetFsHz;

  for (let i = 0; i < totalTargetSamples; i++) {
    const targetT = tStart + i * dt;
    resampledT.push(targetT);

    // Find bounding samples
    let idx = 0;
    while (idx < samples.length - 1 && samples[idx + 1].t < targetT) {
      idx++;
    }

    const s0 = samples[idx];
    const s1 = samples[idx + 1] || s0;

    if (s1.t === s0.t) {
      resampledR.push(s0.r);
    } else {
      // Linear interpolation
      const ratio = (targetT - s0.t) / (s1.t - s0.t);
      resampledR.push(s0.r + ratio * (s1.r - s0.r));
    }
  }

  return { t: resampledT, r: resampledR };
}

/**
 * Removes slow baseline drift (DC component) using a moving average filter.
 * This isolates the AC pulsatile component.
 */
export function detrend(signal: number[], windowSize: number = 30): number[] {
  const detrended: number[] = [];
  const halfWin = Math.floor(windowSize / 2);

  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    const start = Math.max(0, i - halfWin);
    const end = Math.min(signal.length - 1, i + halfWin);

    for (let j = start; j <= end; j++) {
      sum += signal[j];
      count++;
    }

    const mean = sum / count;
    detrended.push(signal[i] - mean);
  }

  return detrended;
}

/**
 * Simple bandpass filter restricting signal to plausible human heart rate range.
 * 42 BPM (0.7 Hz) to 210 BPM (3.5 Hz).
 * Implemented via a difference of two moving averages (acting as a bandpass).
 */
export function bandpassFilter(
  signal: number[],
  fs: number,
  lowHz: number = 0.7,
  highHz: number = 3.5
): number[] {
  // Convert cutoff frequencies to sample window sizes
  // Window size = fs / cutoff_freq
  const highPassWindow = Math.max(3, Math.round(fs / lowHz)); // Slow fluctuations (low frequency)
  const lowPassWindow = Math.max(1, Math.round(fs / highHz));  // Fast noise (high frequency)

  // 1. Low-pass filter (smooth out high-frequency noise)
  const lowPassed: number[] = [];
  const lpHalf = Math.floor(lowPassWindow / 2);
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    const start = Math.max(0, i - lpHalf);
    const end = Math.min(signal.length - 1, i + lpHalf);
    for (let j = start; j <= end; j++) {
      sum += signal[j];
      count++;
    }
    lowPassed.push(sum / count);
  }

  // 2. High-pass filter by subtracting a very wide moving average (removes slow drift)
  const bandPassed: number[] = [];
  const hpHalf = Math.floor(highPassWindow / 2);
  for (let i = 0; i < lowPassed.length; i++) {
    let sum = 0;
    let count = 0;
    const start = Math.max(0, i - hpHalf);
    const end = Math.min(lowPassed.length - 1, i + hpHalf);
    for (let j = start; j <= end; j++) {
      sum += lowPassed[j];
      count++;
    }
    const baseline = sum / count;
    bandPassed.push(lowPassed[i] - baseline);
  }

  return bandPassed;
}

/**
 * Radix-2 Cooley-Tukey FFT (In-place, iterative)
 * Pads input to next power of 2.
 */
export function fft(real: number[]): { re: number[]; im: number[] } {
  const n = real.length;
  // Find next power of 2
  let m = 1;
  while (m < n) m <<= 1;

  const re = new Float64Array(m);
  const im = new Float64Array(m);

  // Copy and pad with zeros
  for (let i = 0; i < n; i++) {
    re[i] = real[i];
  }

  // Bit reversal permutation
  let j = 0;
  for (let i = 0; i < m - 1; i++) {
    if (i < j) {
      const tempRe = re[i];
      re[i] = re[j];
      re[j] = tempRe;
    }
    let k = m >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey decimation-in-time
  for (let size = 2; size <= m; size <<= 1) {
    const halfSize = size >> 1;
    const tabStep = m / size;
    for (let i = 0; i < m; i += size) {
      for (let k = 0; k < halfSize; k++) {
        const angle = (-2 * Math.PI * k) / size;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const tRe = re[i + k + halfSize] * wr - im[i + k + halfSize] * wi;
        const tIm = re[i + k + halfSize] * wi + im[i + k + halfSize] * wr;

        re[i + k + halfSize] = re[i + k] - tRe;
        im[i + k + halfSize] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
      }
    }
  }

  return { re: Array.from(re), im: Array.from(im) };
}

/**
 * Computes BPM by finding the dominant frequency peak in the FFT spectrum
 * within the physiological range (0.7 Hz to 3.5 Hz).
 */
export function computeBPMviaFFT(
  signal: number[],
  fs: number,
  lowHz: number = 0.7,
  highHz: number = 3.5
): { bpm: number; confidence: number } {
  const { re, im } = fft(signal);
  const n = re.length;
  const halfN = n / 2;

  const magnitudes: number[] = [];
  let maxMag = 0;
  let peakBin = -1;

  // Calculate frequency resolution
  const df = fs / n;

  // Find peak in the physiological range
  const minBin = Math.ceil(lowHz / df);
  const maxBin = Math.floor(highHz / df);

  for (let i = 0; i < halfN; i++) {
    const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    magnitudes.push(mag);

    if (i >= minBin && i <= maxBin) {
      if (mag > maxMag) {
        maxMag = mag;
        peakBin = i;
      }
    }
  }

  if (peakBin === -1) {
    return { bpm: 0, confidence: 0 };
  }

  // Parabolic interpolation for sub-bin frequency precision
  let refinedBin = peakBin;
  if (peakBin > 0 && peakBin < halfN - 1) {
    const alpha = magnitudes[peakBin - 1];
    const beta = magnitudes[peakBin];
    const gamma = magnitudes[peakBin + 1];
    const denom = 2 * (2 * beta - alpha - gamma);
    if (denom !== 0) {
      const p = (alpha - gamma) / denom;
      refinedBin = peakBin + p;
    }
  }

  const peakFreqHz = refinedBin * df;
  const bpm = peakFreqHz * 60;

  // Calculate confidence as peak magnitude relative to average magnitude in range
  let sumMag = 0;
  let count = 0;
  for (let i = minBin; i <= maxBin; i++) {
    sumMag += magnitudes[i] || 0;
    count++;
  }
  const avgMag = sumMag / (count || 1);
  const confidence = Math.min(1.0, Math.max(0.0, (maxMag - avgMag) / (maxMag + 1e-5)));

  return { bpm, confidence };
}

/**
 * Fallback peak detection algorithm to find local maxima in the filtered signal.
 * Computes average peak-to-peak distance to estimate BPM and RR-interval variance.
 */
export function computeBPMviaPeakDetection(
  signal: number[],
  fs: number,
  minDistanceMs: number = 300 // Refractory period (~200 BPM max)
): { bpm: number; rrIntervals: number[]; peaks: number[] } {
  const minDistanceSamples = Math.round((minDistanceMs / 1000) * fs);
  const peaks: number[] = [];

  // Simple local maxima finder with refractory period
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1] && signal[i] > 0) {
      // Check if this peak is far enough from the last peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistanceSamples) {
        peaks.push(i);
      } else {
        // If too close, keep the larger one
        const lastPeakIdx = peaks[peaks.length - 1];
        if (signal[i] > signal[lastPeakIdx]) {
          peaks[peaks.length - 1] = i;
        }
      }
    }
  }

  if (peaks.length < 2) {
    return { bpm: 0, rrIntervals: [], peaks };
  }

  // Calculate RR intervals in milliseconds
  const rrIntervals: number[] = [];
  const dtMs = 1000 / fs;
  for (let i = 1; i < peaks.length; i++) {
    const intervalSamples = peaks[i] - peaks[i - 1];
    rrIntervals.push(intervalSamples * dtMs);
  }

  // Compute average interval and convert to BPM
  const avgIntervalMs = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  const bpm = 60000 / avgIntervalMs;

  return { bpm, rrIntervals, peaks };
}

/**
 * Heuristic to check if a finger is actually covering the camera lens.
 * When covered, the red channel should be high, and green/blue should be significantly lower.
 * Also checks for signal variance to ensure it's not just a static red surface.
 */
export function checkFingerDetection(samples: PulseSample[]): {
  detected: boolean;
  reason: string;
} {
  if (samples.length < 10) {
    return { detected: false, reason: "Yetersiz veri" };
  }

  // Take the last 10 samples to check current state
  const recent = samples.slice(-10);
  const avgR = recent.reduce((sum, s) => sum + s.r, 0) / recent.length;
  const avgG = recent.reduce((sum, s) => sum + s.g, 0) / recent.length;
  const avgB = recent.reduce((sum, s) => sum + s.b, 0) / recent.length;

  // NOTE on thresholds: when a finger fully covers the lens+torch, phone
  // auto-exposure/auto-gain frequently compensates the "too bright" red blob
  // DOWN, so the frame can land anywhere from a dim, dark-red/maroon tissue
  // tone to a bright saturated red depending on device (observed on e.g.
  // Motorola g73 5G). A single fixed brightness floor (previously avgR<100)
  // rejects legitimate dark-red "finger fully covering lens" frames. We
  // instead check for the RATIO/dominance of red over green+blue, which
  // stays true whether the frame is dim or bright, plus a much lower floor
  // that only rejects near-total darkness (lens fully blocked/no light at all).

  // 1. Near-total darkness (e.g. finger covering lens with torch OFF, or a
  //    lens obstruction with no light reaching the sensor at all).
  if (avgR < 15 && avgG < 15 && avgB < 15) {
    return { detected: false, reason: "Işık algılanamıyor. Flaşın açık olduğundan ve parmağınızın lensi tam kapattığından emin olun." };
  }

  // 2. Red must be dominant relative to green/blue — this holds true across
  //    the full brightness range (dim maroon tissue tone through bright red),
  //    so it is a much more device-independent finger-presence signal than
  //    an absolute brightness floor.
  const redDominance = avgR / Math.max(1, (avgG + avgB) / 2);
  if (redDominance < 1.15) {
    return { detected: false, reason: "Lütfen parmak ucunuzu kamera lensi VE flaşın üzerine birlikte, hafif bir baskıyla tam kapatın." };
  }

  // 3. Check for saturation (if completely white/blown out, flash might be too bright or finger not pressed)
  if (avgR > 254 && avgG > 250 && avgB > 250) {
    return { detected: false, reason: "Aşırı parlaklık. Parmağınızı biraz daha bastırarak lensi ve flaşı tam kapatın." };
  }

  // 4. Extremely low overall signal even if red-dominant (e.g. barely grazing
  //    the lens edge) — ask for firmer, fuller coverage.
  if (avgR < 40) {
    return { detected: false, reason: "Sinyal çok zayıf. Parmağınızı lense biraz daha bastırıp tam ortalayın." };
  }

  return { detected: true, reason: "Parmak algılandı ✓" };
}

/**
 * Top-level orchestrator to process raw camera samples and return pulse metrics.
 */
export function analyzePulseSignal(rawSamples: PulseSample[]): PulseAnalysisResult {
  const fingerCheck = checkFingerDetection(rawSamples);
  if (!fingerCheck.detected) {
    return {
      bpm: 0,
      quality: 0,
      fingerDetected: false,
      method: 'none',
      rrIntervalVarianceMs: 0,
    };
  }

  const fsHz = 30; // Target uniform sampling rate
  const { r: resampledR } = resampleSignal(rawSamples, fsHz);

  if (resampledR.length < fsHz * 5) {
    // Need at least 5 seconds of data for any meaningful analysis
    return {
      bpm: 0,
      quality: 0.1,
      fingerDetected: true,
      method: 'none',
      rrIntervalVarianceMs: 0,
    };
  }

  // 1. Detrend and Bandpass filter
  const detrended = detrend(resampledR, fsHz);
  const filtered = bandpassFilter(detrended, fsHz);

  // 2. Compute BPM via FFT
  const fftResult = computeBPMviaFFT(filtered, fsHz);

  // 3. Compute BPM via Peak Detection
  const peakResult = computeBPMviaPeakDetection(filtered, fsHz);

  // 4. Reconcile results and estimate quality
  let finalBpm = 0;
  let method: 'fft' | 'peak' | 'none' = 'fft';
  let quality = fftResult.confidence;

  const bpmDiff = Math.abs(fftResult.bpm - peakResult.bpm);

  if (fftResult.bpm > 0 && peakResult.bpm > 0) {
    if (bpmDiff < 12) {
      // High agreement, average them
      finalBpm = (fftResult.bpm + peakResult.bpm) / 2;
      quality = Math.min(1.0, quality + 0.15);
    } else if (fftResult.confidence > 0.4) {
      // Disagreement, but FFT confidence is decent
      finalBpm = fftResult.bpm;
      method = 'fft';
      quality = Math.max(0.2, quality - 0.1);
    } else {
      // Low confidence, fallback to peak detection if it found reasonable peaks
      finalBpm = peakResult.bpm;
      method = 'peak';
      quality = Math.max(0.1, peakResult.rrIntervals.length / 15);
    }
  } else if (fftResult.bpm > 0) {
    finalBpm = fftResult.bpm;
    method = 'fft';
  } else if (peakResult.bpm > 0) {
    finalBpm = peakResult.bpm;
    method = 'peak';
    quality = 0.3;
  }

  // Sanity check physiological bounds
  if (finalBpm < 40 || finalBpm > 200) {
    finalBpm = 0;
    quality = 0;
    method = 'none';
  }

  // Calculate RR-interval variance (HRV proxy)
  let rrVar = 0;
  if (peakResult.rrIntervals.length > 2) {
    const mean = peakResult.rrIntervals.reduce((a, b) => a + b, 0) / peakResult.rrIntervals.length;
    const variance = peakResult.rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / peakResult.rrIntervals.length;
    rrVar = Math.sqrt(variance); // Standard Deviation of NN intervals (SDNN proxy)
  }

  return {
    bpm: Math.round(finalBpm * 10) / 10,
    quality: Math.round(quality * 100) / 100,
    fingerDetected: true,
    method,
    rrIntervalVarianceMs: Math.round(rrVar * 10) / 10,
  };
}