/**
 * Duygusal Aktivasyon Göstergesi - Gemini AI Commentary Client Helper
 * 
 * ÖNEMLİ ETİK VE GÜVENLİK NOTU:
 * 1. Bu özellik varsayılan olarak KAPALIDIR (OFF). Kullanıcı sadece kendi isteğiyle
 *    "Yapay Zeka Yorumu Ekle" butonuna basarsa tetiklenir.
 * 2. Gemini API'sine KESİNLİKLE ham ses veya video verisi gönderilmez. Sadece ve sadece
 *    hesaplanmış özet sayısal değerler ve sözel tanımlayıcılar (ör. "orta hızda konuşma") iletilir.
 * 3. Bu yorum tamamen ek bir katmandır; hesaplanan aktivasyon seviyesini veya puanını
 *    kesinlikle etkilemez.
 * 4. API anahtarının (GEMINI_API_KEY) istemci tarafında (tarayıcıda) açıkça görünmesini
 *    engellemek için, istekler Next.js API Route Handler (/api/gemini-commentary) üzerinden
 *    güvenli bir şekilde sunucu tarafında proxy edilir.
 */

export interface ActivationSummaryForAI {
  mode: 'audio' | 'camera_audio';
  level: 'dusuk' | 'orta' | 'yuksek';
  pulseBpmRounded?: number;
  voicePitchRounded?: number;
  speechRateDescriptor?: 'yavas' | 'normal' | 'hizli';
  pauseDescriptor?: 'az' | 'orta' | 'sik';
}

/**
 * Converts raw metrics and results into a descriptive summary suitable for the AI.
 * Buckets raw numbers into friendly Turkish descriptors to keep the prompt non-clinical.
 */
export function buildSummaryForAI(
  mode: 'audio' | 'camera_audio',
  level: 'dusuk' | 'orta' | 'yuksek',
  pulseBpm?: number,
  voicePitchHz?: number,
  speechRateSPM?: number,
  totalPauseMs?: number,
  durationSec?: number
): ActivationSummaryForAI {
  const summary: ActivationSummaryForAI = { mode, level };

  if (mode === 'camera_audio' && pulseBpm && pulseBpm > 0) {
    summary.pulseBpmRounded = Math.round(pulseBpm);
  }

  if (voicePitchHz && voicePitchHz > 0) {
    summary.voicePitchRounded = Math.round(voicePitchHz);
  }

  if (speechRateSPM && speechRateSPM > 0) {
    if (speechRateSPM < 100) {
      summary.speechRateDescriptor = 'yavas';
    } else if (speechRateSPM <= 160) {
      summary.speechRateDescriptor = 'normal';
    } else {
      summary.speechRateDescriptor = 'hizli';
    }
  }

  if (totalPauseMs !== undefined && durationSec && durationSec > 0) {
    const pauseRatio = (totalPauseMs / 1000) / durationSec;
    if (pauseRatio < 0.20) {
      summary.pauseDescriptor = 'az';
    } else if (pauseRatio <= 0.38) {
      summary.pauseDescriptor = 'orta';
    } else {
      summary.pauseDescriptor = 'sik';
    }
  }

  return summary;
}

/**
 * Sends the summary to the local Next.js API route to fetch Gemini's warm, reflective commentary.
 * Uses an AbortController to enforce a 15-second timeout.
 */
export async function requestAiCommentary(
  summary: ActivationSummaryForAI
): Promise<{ success: boolean; text?: string; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('/api/gemini-commentary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(summary),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `Sunucu hatası: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      text: data.text,
    };
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      return {
        success: false,
        error: 'Yapay zeka yanıt süresi doldu (15 saniye). Lütfen tekrar deneyin.',
      };
    }
    return {
      success: false,
      error: e.message || 'Bağlantı hatası oluştu.',
    };
  }
}