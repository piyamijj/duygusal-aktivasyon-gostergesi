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
 * Attempts to enable the camera flash/torch, AND in the same single
 * applyConstraints() call, best-effort tries to stabilize exposure/white
 * balance so the camera's auto-exposure doesn't keep fighting the bright
 * torch + covered-lens scene mid-measurement (which would otherwise
 * introduce brightness swings unrelated to the actual pulse signal).
 *
 * IMPORTANT: these are combined into ONE applyConstraints() call on purpose.
 * Issuing two separate applyConstraints({advanced:[...]}) calls back-to-back
 * on the same track is NOT guaranteed to merge on many Android camera
 * drivers — a second call can silently reset/override the first "advanced"
 * constraint set, which was observed to turn the torch back OFF after an
 * exposure-lock call ran right after it. Bundling both into a single
 * advanced-constraint object avoids that class of bug entirely.
 *
 * Returns whether torch was successfully enabled. Never throws — exposure
 * locking is pure best-effort and silently ignored if unsupported/rejected.
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

    // Build a single advanced constraint set: torch is mandatory here,
    // exposure/white-balance stabilization is opportunistic add-ons.
    const advancedConstraint: any = { torch: true };
    try {
      if (typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities() as any;
        if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
          advancedConstraint.exposureMode = 'continuous';
        }
        if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
          advancedConstraint.whiteBalanceMode = 'continuous';
        }
      }
    } catch {
      // Capability probing failed — just proceed with torch-only constraint below.
    }

    await track.applyConstraints({ advanced: [advancedConstraint] });
    return true;
  } catch (e) {
    console.error("Failed to enable torch:", e);
    // Retry with a torch-only constraint in case the combined object
    // (with exposure/whiteBalance fields) was what got rejected.
    try {
      const track = stream.getVideoTracks()[0];
      if (track) {
        await track.applyConstraints({ advanced: [{ torch: true } as any] });
        return true;
      }
    } catch (e2) {
      console.error("Torch-only retry also failed:", e2);
    }
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