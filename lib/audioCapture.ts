/**
 * Duygusal Aktivasyon Göstergesi - Web Audio API Capture Helper
 * 
 * GÜVENLİK VE GİZLİLİK AÇIKLAMASI:
 * Bu modül tarafından kaydedilen ses verileri KESİNLİKLE hiçbir sunucuya yüklenmez,
 * kaydedilmez veya üçüncü taraflarla paylaşılmaz. Tüm ses analizi (perde, duraklama, hız)
 * tamamen kullanıcının tarayıcısında (istemci tarafında) ve geçici bellek (RAM) üzerinde
 * anlık olarak gerçekleştirilir. Analiz bittiğinde ses verileri bellekten silinir.
 */

/**
 * Requests microphone access from the browser.
 * Disables echo cancellation, noise suppression, and auto gain control
 * to capture the raw, unadulterated acoustic signal for accurate DSP analysis.
 */
export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Tarayıcınız mikrofon erişimini desteklemiyor.");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    return stream;
  } catch (e: any) {
    console.error("Microphone access error:", e);
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      throw new Error("Mikrofon izni reddedildi. Lütfen tarayıcı ayarlarınızdan mikrofon iznini etkinleştirin.");
    }
    throw new Error("Mikrofon bağlantısı kurulamadı: " + (e.message || "Bilinmeyen hata"));
  }
}

/**
 * Stops all tracks on a MediaStream to release the hardware (microphone).
 */
export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      if (track.readyState === 'live') {
        track.stop();
      }
    });
  } catch (e) {
    console.error("Error stopping media stream tracks:", e);
  }
}

/**
 * Records audio from a MediaStream into a single Float32Array buffer for a fixed duration.
 * Uses ScriptProcessorNode for universal browser compatibility (including older mobile browsers).
 * Note: ScriptProcessorNode is deprecated in favor of AudioWorklet, but remains the most
 * reliable, dependency-free way to capture raw PCM samples in a single file without complex
 * multi-file bundling.
 */
export function recordAudioToBuffer(
  stream: MediaStream,
  durationMs: number,
  onProgress?: (elapsedMs: number) => void
): Promise<{ samples: Float32Array; sampleRate: number }> {
  return new Promise((resolve, reject) => {
    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;
    let silentGain: GainNode | null = null;
    
    const chunks: Float32Array[] = [];
    let totalSamplesRecorded = 0;
    let isFinished = false;

    const cleanup = () => {
      isFinished = true;
      try {
        if (processor) {
          processor.disconnect();
          processor.onaudioprocess = null;
        }
        if (source) {
          source.disconnect();
        }
        if (silentGain) {
          silentGain.disconnect();
        }
        if (audioCtx && audioCtx.state !== 'closed') {
          audioCtx.close();
        }
      } catch (e) {
        console.error("Error during audio recording cleanup:", e);
      }
    };

    try {
      // Create AudioContext (handle browser prefixes)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API bu tarayıcıda desteklenmiyor.");
      }

      audioCtx = new AudioContextClass();
      const sampleRate = audioCtx.sampleRate;

      // Create source from stream
      source = audioCtx.createMediaStreamSource(stream);

      // Create ScriptProcessorNode (bufferSize 4096, 1 input channel, 1 output channel)
      processor = audioCtx.createScriptProcessor(4096, 1, 1);

      const targetSamples = Math.round((durationMs / 1000) * sampleRate);
      let lastProgressUpdate = 0;

      processor.onaudioprocess = (e) => {
        if (isFinished) return;

        const inputBuffer = e.inputBuffer.getChannelData(0);
        // Clone the chunk to avoid garbage collection overwrites
        const chunkCopy = new Float32Array(inputBuffer.length);
        chunkCopy.set(inputBuffer);

        chunks.push(chunkCopy);
        totalSamplesRecorded += chunkCopy.length;

        const elapsedMs = (totalSamplesRecorded / sampleRate) * 1000;

        // Trigger progress callback
        if (onProgress) {
          const now = performance.now();
          if (now - lastProgressUpdate > 100 || elapsedMs >= durationMs) {
            onProgress(Math.min(durationMs, elapsedMs));
            lastProgressUpdate = now;
          }
        }

        // Check if target duration reached
        if (totalSamplesRecorded >= targetSamples) {
          isFinished = true;
          
          // Concatenate all chunks into a single Float32Array
          const finalBuffer = new Float32Array(totalSamplesRecorded);
          let offset = 0;
          for (const chunk of chunks) {
            finalBuffer.set(chunk, offset);
            offset += chunk.length;
          }

          cleanup();
          resolve({ samples: finalBuffer, sampleRate });
        }
      };

      // Connect the graph
      source.connect(processor);
      // ScriptProcessorNode must be connected to a destination to trigger onaudioprocess in some browsers.
      // We route through a zero-gain (silent) node instead of directly to speakers to avoid
      // audio feedback/echo of the user's own microphone input during recording.
      silentGain = audioCtx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioCtx.destination);

    } catch (e: any) {
      cleanup();
      reject(new Error("Ses kaydı başlatılamadı: " + (e.message || "Bilinmeyen hata")));
    }
  });
}