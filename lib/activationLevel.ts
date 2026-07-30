/**
 * Duygusal Aktivasyon Göstergesi - Activation Level Combination Logic
 * 
 * ÖNEMLİ ETİK VE BİLİMSEL AÇIKLAMA:
 * Bu modül, tarayıcı tabanlı fizyolojik (nabız) ve akustik (ses) sinyalleri birleştirerek
 * genel bir "Aktivasyon Seviyesi" (Düşük, Orta, Yüksek) hesaplar.
 * 
 * Bu araç KESİNLİKLE:
 * 1. Bir yalan makinesi (poligraf) değildir. Yüksek aktivasyon dürüstlük veya yalan söyleme
 *    durumunu göstermez; heyecan, kaygı, kahve tüketimi, oda sıcaklığı, fiziksel yorgunluk
 *    veya konuşma heyecanı gibi düzinelerce farklı nedenden kaynaklanabilir.
 * 2. Tıbbi bir cihaz veya tanı aracı değildir. Herhangi bir psikolojik veya fizyolojik
 *    rahatsızlığı teşhis etmek için kullanılamaz.
 * 
 * Hesaplanan 0-100 arası puan ("ic_gosterge_puani") sadece arayüzdeki görsel geçişleri
 * ve renk gradyanlarını konumlandırmak için kullanılan dahili bir göstergedir. Kullanıcıya
 * asla bir "doğruluk yüzdesi", "yalan olasılığı" veya kesin bir skor olarak sunulmamalıdır.
 */

export type ActivationLevel = 'dusuk' | 'orta' | 'yuksek';
export type MeasurementMode = 'audio' | 'camera_audio';

export interface ActivationInputs {
  pulseBpm?: number;
  pulseQuality?: number;
  rrVarianceMs?: number;
  voicePitchHz?: number;
  voicePitchStd?: number;
  voiceJitterProxy?: number;
  speechRateSPM?: number;
  totalPauseMs?: number;
  pauseCount?: number;
  durationSec?: number;
}

export interface ActivationResult {
  score: number; // Dahili 0-100 puanı (ic_gosterge_puani)
  level: ActivationLevel;
  color: {
    primary: string;
    secondary: string;
    label: string;
  };
  description: string;
}

/**
 * Normalizes a value to a 0-100 scale based on min and max bounds.
 */
function normalize(val: number, min: number, max: number): number {
  if (val <= min) return 0;
  if (val >= max) return 100;
  return ((val - min) / (max - min)) * 100;
}

/**
 * Combines pulse and voice inputs into a single 0-100 score using a transparent heuristic.
 * This is an illustrative mathematical combination, not a clinically validated formula.
 */
export function computeActivationScore(inputs: ActivationInputs, mode: MeasurementMode): number {
  let pulseScore = 50; // Default neutral
  let voiceScore = 50; // Default neutral
  let hasPulse = false;
  let hasVoice = false;

  // 1. Process Pulse Signal (if available and quality is sufficient)
  if (
    mode === 'camera_audio' &&
    inputs.pulseBpm !== undefined &&
    inputs.pulseBpm > 0 &&
    inputs.pulseQuality !== undefined &&
    inputs.pulseQuality > 0.2
  ) {
    hasPulse = true;
    
    // Base BPM score: typical resting heart rate is 60-80 BPM.
    // We map 60 BPM to 0, and 120 BPM (or higher) to 100.
    const bpmNorm = normalize(inputs.pulseBpm, 60, 120);

    // RR-interval variance (HRV proxy):
    // In states of high sympathetic activation (stress/excitement), HRV typically decreases.
    // However, in irregular breathing or speech, it can fluctuate.
    // We use a minor weight for RR variance. High variance (calm/parasympathetic) reduces score,
    // low variance (stressed/sympathetic) increases score.
    // Typical SDNN proxy ranges from 20ms (high stress) to 100ms (very calm).
    let hrvNorm = 50;
    if (inputs.rrVarianceMs !== undefined && inputs.rrVarianceMs > 0) {
      // Invert so low variance = high activation score
      hrvNorm = 100 - normalize(inputs.rrVarianceMs, 20, 100);
    }

    // Combine pulse metrics: 80% BPM, 20% HRV proxy
    pulseScore = bpmNorm * 0.8 + hrvNorm * 0.2;
  }

  // 2. Process Voice Signal (if available)
  if (
    inputs.voicePitchHz !== undefined &&
    inputs.voicePitchHz > 0 &&
    inputs.durationSec !== undefined &&
    inputs.durationSec > 0
  ) {
    hasVoice = true;

    // Pitch Mean: Elevated pitch often correlates with higher emotional arousal (excitement, tension).
    // Typical conversational pitch: Male ~100-150Hz, Female ~180-240Hz.
    // We use a generic range of 100Hz (low activation) to 280Hz (high activation) for normalization.
    const pitchNorm = normalize(inputs.voicePitchHz, 110, 260);

    // Pitch Variability (Std Dev): High variability can indicate expressive/excited speech,
    // while extremely low variability (monotone) can indicate low activation or controlled tension.
    // Typical std dev ranges from 10Hz to 50Hz.
    const pitchStdNorm = normalize(inputs.voicePitchStd || 20, 10, 45);

    // Speech Rate (Segments per Minute): Fast, pressured speech indicates high activation.
    // Typical rate: 80 to 180 segments/min.
    const rateNorm = normalize(inputs.speechRateSPM || 120, 80, 180);

    // Pause Ratio: High activation often leads to fewer/shorter pauses (rushed speech).
    // We calculate the ratio of silence to total duration.
    // Typical pause ratio: 15% (rushed/excited) to 45% (calm/reflective).
    let pauseNorm = 50;
    if (inputs.totalPauseMs !== undefined) {
      const totalPauseSec = inputs.totalPauseMs / 1000;
      const pauseRatio = totalPauseSec / inputs.durationSec;
      // Invert so lower pause ratio (less silence) = higher activation score
      pauseNorm = 100 - normalize(pauseRatio, 0.15, 0.45);
    }

    // Jitter Proxy (Voice perturbation): Micro-instability in vocal fold vibration.
    // Can increase with muscle tension/stress. Typical range: 0.5% to 4.0%.
    const jitterNorm = normalize(inputs.voiceJitterProxy || 1.5, 0.8, 3.5);

    // Combine voice metrics:
    // 30% Pitch Mean, 20% Pitch Std, 20% Speech Rate, 20% Pause Ratio, 10% Jitter
    voiceScore = (
      pitchNorm * 0.3 +
      pitchStdNorm * 0.2 +
      rateNorm * 0.2 +
      pauseNorm * 0.2 +
      jitterNorm * 0.1
    );
  }

  // 3. Combine Scores based on Mode
  let finalScore = 50;

  if (mode === 'camera_audio') {
    if (hasPulse && hasVoice) {
      // Both signals active: 50% pulse, 50% voice
      finalScore = pulseScore * 0.5 + voiceScore * 0.5;
    } else if (hasPulse) {
      // Fallback to pulse only if voice failed
      finalScore = pulseScore;
    } else if (hasVoice) {
      // Fallback to voice only if pulse failed
      finalScore = voiceScore;
    }
  } else {
    // Audio-only mode: 100% voice
    if (hasVoice) {
      finalScore = voiceScore;
    }
  }

  // Clamp final score to 0-100 range
  return Math.min(100, Math.max(0, finalScore));
}

/**
 * Maps the internal 0-100 score to a qualitative Activation Level.
 */
export function scoreToLevel(score: number): ActivationLevel {
  if (score < 38) return 'dusuk';
  if (score <= 68) return 'orta';
  return 'yuksek';
}

/**
 * Returns the visual styling parameters (colors and Turkish labels) for each level.
 * Uses a warm, non-alarming palette (sage green, soft amber, warm terracotta).
 * Deliberately avoids clinical or emergency-red colors.
 */
export function levelToColor(level: ActivationLevel): {
  primary: string; // Hex color for primary elements
  secondary: string; // Hex color for backgrounds/gradients
  label: string; // Turkish display label
} {
  switch (level) {
    case 'dusuk':
      return {
        primary: '#436656', // Sage green
        secondary: '#e5ece8', // Soft sage background
        label: 'Düşük Aktivasyon',
      };
    case 'orta':
      return {
        primary: '#d97706', // Warm amber
        secondary: '#fef3c7', // Soft amber background
        label: 'Orta Aktivasyon',
      };
    case 'yuksek':
      return {
        primary: '#c2622c', // Warm terracotta / soft rust (non-alarming)
        secondary: '#ffedd5', // Soft orange/terracotta background
        label: 'Yüksek Aktivasyon',
      };
  }
}

/**
 * Returns a calm, non-diagnostic Turkish description of what the level represents.
 * Emphasizes that this is a general state of arousal with many possible benign causes.
 */
export function getLevelDescription(level: ActivationLevel): string {
  switch (level) {
    case 'dusuk':
      return 'Bedeniniz ve sesiniz oldukça sakin, dingin bir ritimde seyrediyor. Bu durum dinlenme, odaklanma veya düşük fiziksel enerji anlarında görülen doğal bir uyarılma seviyesidir.';
    case 'orta':
      return 'Sisteminizde hafif ila orta düzeyde bir hareketlilik ve uyarılma mevcut. Günlük tatlı bir heyecan, odaklanmış bir çalışma, hafif bir konuşma telaşı veya kahve tüketimi bu seviyeyi tetikleyebilir.';
    case 'yuksek':
      return 'Fizyolojik ve akustik göstergeleriniz belirgin bir uyarılma ve enerji artışına işaret ediyor. Bu durum yoğun bir heyecan, tatlı bir telaş, fiziksel hareketlilik, stres veya o anki konuşma coşkusundan kaynaklanıyor olabilir.';
  }
}