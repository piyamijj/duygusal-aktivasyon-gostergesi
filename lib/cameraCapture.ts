/**
 * Duygusal Aktivasyon Göstergesi - Camera & Torch Capture Helper
 * 
 * GÜVENLİK VE GİZLİLİK AÇIKLAMASI:
 * Bu modül tarafından yakalanan kamera görüntüleri KESİNLİKLE hiçbir sunucuya yüklenmez,
 * kaydedilmez veya üçüncü taraflarla paylaşılmaz. Görüntüler tamamen kullanıcının tarayıcısında
 * (istemci tarafında) anlık olarak işlenir (rPPG piksel analizi) ve hiçbir kare diske kaydedilmez.
 * 
 * TARAYICI UYUMLULUK NOTU:
 * Kamera flaşını (torch) açma özelliği tarayıcılar arasında farklılık gösterir.
 * Android Chrome üzerinde genellikle sorunsuz çalışırken, iOS Safari (Apple) güvenlik
 * kısıtlamaları nedeniyle web sitelerinin flaşı kontrol etmesine izin vermez.
 * Bu nedenle flaş kontrolü "en iyi çaba" (best-effort) esasıyla çalışır; flaşın açılamadığı
 * durumlarda uygulama hata vermez, kullanıcıyı iyi aydınlatılmış bir alana geçmeye yönlendirir.
 */

/**
 * Requests camera access from the browser.
 * Prefers the rear/environment camera since it is adjacent to the flash/torch on mobile devices.
 * Low resolution (320x240) is requested to optimize pixel processing performance.
 */
export async function requestCameraStream(): Promise<MediaStream> {
  if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Tarayıcınız kamera erişimini desteklemiyor.");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // Prefer rear camera for flash proximity
        width: { ideal: 320 },
        height: { ideal: 240 },
      },
    });
    return stream;
  } catch (e: any) {
    console.error("Camera access error:", e);
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      throw new Error("Kamera izni reddedildi. Nabız ölçümü için lütfen tarayıcı ayarlarınızdan kamera iznini etkinleştirin.");
    }
    throw new Error("Kamera bağlantısı kurulamadı: " + (e.message || "Bilinmeyen hata"));
  }
}

/**
 * Synchronously checks if the video track supports torch (flash) control.
 */
export function checkTorchSupport(stream: MediaStream | null): boolean {
  if (!stream) return false;
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) return false;
    
    // Check capabilities (supported in Chrome/Android, usually undefined in iOS Safari)
    if (typeof track.getCapabilities === 'function') {
      const capabilities = track.getCapabilities() as any;
      return !!capabilities.torch;
    }
  } catch (e) {
    console.error("Error checking torch support:", e);
  }
  return false;
}

/**
 * Attempts to enable the camera flash/torch.
 * Returns true if successful, false otherwise. Never throws.
 */
export async function tryEnableTorch(stream: MediaStream | null): Promise<boolean> {
  if (!stream) return false;
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) return false;

    // Check support first
    const hasTorch = checkTorchSupport(stream);
    if (!hasTorch) {
      console.warn("Torch is not supported on this device/browser.");
      return false;
    }

    // Apply constraints to turn torch on
    await track.applyConstraints({
      advanced: [{ torch: true } as any]
    });
    return true;
  } catch (e) {
    console.error("Failed to enable torch:", e);
    return false;
  }
}

/**
 * Best-effort attempt to lock auto-exposure/auto-white-balance so the
 * bright torch + finger-covered-lens scene doesn't keep getting
 * re-exposed (darkened/brightened) by the camera pipeline mid-measurement,
 * which would otherwise corrupt the pulsatile red-channel signal with
 * exposure-driven brightness swings unrelated to blood volume changes.
 *
 * Support is inconsistent across devices/browsers (most desktop webcams and
 * iOS Safari do not expose these controls at all) — this NEVER throws, and
 * the app works fine without it; it simply reduces one source of noise on
 * devices that DO support it (many Android Chrome builds do).
 */
export async function tryLockExposure(stream: MediaStream | null): Promise<boolean> {
  if (!stream) return false;
  try {
    const track = stream.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== 'function') return false;

    const capabilities = track.getCapabilities() as any;
    const advancedConstraints: any = {};

    if (capabilities.exposureMode && capabilities.exposureMode.includes('manual')) {
      advancedConstraints.exposureMode = 'manual';
    } else if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
      // If manual isn't available, at least keep it continuous (default) rather
      // than leaving it unset — some devices default to single-shot 'auto'
      // which re-locks exposure once and then never adapts, which can also
      // hurt signal quality in the opposite direction.
      advancedConstraints.exposureMode = 'continuous';
    }

    if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('manual')) {
      advancedConstraints.whiteBalanceMode = 'manual';
    }

    if (Object.keys(advancedConstraints).length === 0) return false;

    await track.applyConstraints({ advanced: [advancedConstraints] });
    return true;
  } catch (e) {
    // Best-effort only — many devices reject this constraint set entirely.
    console.warn("Exposure lock not applied (device/browser likely unsupported):", e);
    return false;
  }
}

/**
 * Attempts to disable the camera flash/torch.
 * Best-effort, never throws.
 */
export async function disableTorch(stream: MediaStream | null): Promise<void> {
  if (!stream) return;
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    const hasTorch = checkTorchSupport(stream);
    if (!hasTorch) return;

    await track.applyConstraints({
      advanced: [{ torch: false } as any]
    });
  } catch (e) {
    console.error("Failed to disable torch:", e);
  }
}

/**
 * Stops all video tracks on a MediaStream to release the camera hardware.
 */
export function stopCameraStream(stream: MediaStream | null): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      if (track.readyState === 'live') {
        track.stop();
      }
    });
  } catch (e) {
    console.error("Error stopping camera stream tracks:", e);
  }
}