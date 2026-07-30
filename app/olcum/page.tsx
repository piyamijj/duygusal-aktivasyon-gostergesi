"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Camera,
  HeartPulse,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

// Import DSP and capture helpers
import {
  requestMicrophoneStream,
  recordAudioToBuffer,
  stopStream,
} from "@/lib/audioCapture";
import {
  requestCameraStream,
  tryEnableTorch,
  disableTorch,
  stopCameraStream,
  checkTorchSupport,
} from "@/lib/cameraCapture";
import {
  sampleRedChannel,
  PulseSignalBuffer,
  checkFingerDetection,
  analyzePulseSignal,
  computeBPMviaPeakDetection,
  resampleSignal,
  detrend,
  bandpassFilter,
} from "@/lib/pulseDetection";
import { analyzeVoiceSignal } from "@/lib/voiceAnalysis";
import {
  computeActivationScore,
  scoreToLevel,
  getLevelDescription,
} from "@/lib/activationLevel";
import { saveMeasurement } from "@/lib/history";

type Step = "izin" | "kamera_nabiz" | "ses_kaydi" | "isleniyor" | "hata";

function MeasurementPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode = modeParam === "camera_audio" ? "camera_audio" : "audio";

  // State Machine
  const [step, setStep] = useState<Step>("izin");
  const [errorMessage, setErrorMessage] = useState("");

  // Hardware Streams
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Live Video Ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pulse Capture State
  const [fingerStatus, setFingerStatus] = useState("Parmak bekleniyor...");
  const [fingerDetected, setFingerDetected] = useState(false);
  const [pulseProgress, setPulseProgress] = useState(0); // 0 to 100
  const [liveBpm, setLiveBpm] = useState<number | null>(null);
  const pulseBufferRef = useRef<PulseSignalBuffer>(new PulseSignalBuffer(25000));
  const pulseSamplesRef = useRef<{ t: number; r: number; g: number; b: number }[]>([]);
  const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseRafRef = useRef<number | null>(null);

  // Voice Capture State
  const [voiceProgress, setVoiceProgress] = useState(0); // 0 to 100
  const [voiceElapsedSec, setVoiceElapsedSec] = useState(0);

  // Final Results Accumulator
  const [pulseResult, setPulseResult] = useState<any>(null);
  const [voiceResult, setVoiceResult] = useState<any>(null);

  // --- TEMPORARY ON-SCREEN DEBUG PANEL ---
  // This surfaces real device/browser state directly in the UI, since mobile
  // testers usually cannot see the browser devtools console. Remove once the
  // camera pulse detection issue is confirmed fixed on the target device.
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const addDebug = (line: string) => {
    const stamped = `${new Date().toLocaleTimeString("tr-TR")} — ${line}`;
    console.log("[DAG_DEBUG]", stamped);
    setDebugLines((prev) => [...prev.slice(-19), stamped]);
  };

  // Global catch-all: any uncaught synchronous error OR unhandled promise
  // rejection anywhere on the page gets surfaced into the same debug panel.
  // Without this, a silent exception (e.g. inside an event listener or a
  // fire-and-forget async call) can stop a whole flow dead with ZERO trace,
  // which is exactly the symptom we're chasing (log stops after mic granted,
  // no error shown anywhere).
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      addDebug(
        `GENEL HATA (window.onerror): ${event.message} @ ${event.filename}:${event.lineno}`
      );
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      addDebug(
        `YAKALANMAMIŞ PROMISE HATASI: ${reason?.name || ""} ${reason?.message || reason}`
      );
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Duration Constants
  const PULSE_DURATION_MS = 20000; // 20 seconds
  const VOICE_DURATION_MS = 15000; // 15 seconds

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupHardware();
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      if (pulseRafRef.current) cancelAnimationFrame(pulseRafRef.current);
    };
  }, []);

  // Wire the camera stream to the <video> element whenever it changes, and
  // only START the pulse-sampling loop once the video is ACTUALLY playing
  // real frames (confirmed via the 'playing' event, with a readyState-based
  // fallback for browsers that don't fire it reliably). The <video> element
  // itself is now ALWAYS mounted (see the top-level return below) rather
  // than only inside the step==="kamera_nabiz" JSX branch — on-device
  // debugging confirmed that conditional mounting caused videoRef.current to
  // still be null at the exact moment this effect ran right after
  // setStep("kamera_nabiz"), which made sampleRedChannel see no video at all
  // and return null forever (looking exactly like "torch turns on but
  // nothing ever reacts").
  const pulseStartRequestedRef = useRef(false);

  useEffect(() => {
    addDebug(
      `[EFEKT TETİKLENDİ] step=${step}, cameraStream=${cameraStream ? "VAR" : "YOK"}, videoRef=${videoRef.current ? "VAR" : "YOK"}`
    );
    const video = videoRef.current;
    if (!video || !cameraStream || step !== "kamera_nabiz") return;

    const tracks = cameraStream.getVideoTracks();
    addDebug(
      `Kamera akışı bağlandı. Track sayısı: ${tracks.length}, track etiketi: ${tracks[0]?.label || "yok"}, track durumu: ${tracks[0]?.readyState || "yok"}`
    );

    video.srcObject = cameraStream;

    const beginSamplingOnce = () => {
      if (pulseStartRequestedRef.current) return;
      pulseStartRequestedRef.current = true;
      addDebug(
        `Video oynatılıyor. videoWidth=${video.videoWidth}, videoHeight=${video.videoHeight}, readyState=${video.readyState}`
      );
      startPulseMeasurement(cameraStream);
    };

    video.addEventListener("playing", beginSamplingOnce);
    video
      .play()
      .then(() => addDebug("video.play() başarılı şekilde çözüldü (resolved)."))
      .catch((e) => {
        addDebug(`video.play() HATA VERDİ: ${e?.name || ""} ${e?.message || e}`);
        console.error("Video play error:", e);
      });

    // Fallback: some Android WebViews never fire 'playing' reliably even
    // though frames are already flowing — if readyState indicates enough
    // data after a short delay, start anyway instead of hanging forever.
    const fallbackTimer = setTimeout(() => {
      if (!pulseStartRequestedRef.current) {
        addDebug(
          `'playing' eventi 800ms içinde ateşlenmedi. readyState=${video.readyState}, paused=${video.paused}. ${video.readyState >= 2 ? "Fallback ile başlatılıyor." : "Henüz veri yok, bekleniyor."}`
        );
      }
      if (video.readyState >= 2) {
        beginSamplingOnce();
      }
    }, 800);

    return () => {
      video.removeEventListener("playing", beginSamplingOnce);
      clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraStream, step]);

  const cleanupHardware = () => {
    if (cameraStream) {
      disableTorch(cameraStream);
      stopCameraStream(cameraStream);
      setCameraStream(null);
    }
    if (micStream) {
      stopStream(micStream);
      setMicStream(null);
    }
    setTorchEnabled(false);
  };

  // STEP 1: Request Permissions
  const handleStartPermissions = async () => {
    setErrorMessage("");
    try {
      if (mode === "camera_audio") {
        // Request camera first
        addDebug("Kamera izni isteniyor (getUserMedia)...");
        const cam = await requestCameraStream();
        const camTrack = cam.getVideoTracks()[0];
        addDebug(
          `Kamera izni ALINDI. Track etiketi: "${camTrack?.label || "bilinmiyor"}", ayarlar: ${JSON.stringify(camTrack?.getSettings?.() || {})}`
        );
        setCameraStream(cam);
        
        // Check torch support
        const hasTorch = checkTorchSupport(cam);
        addDebug(`Torch (flaş) desteği kontrolü: ${hasTorch ? "DESTEKLENİYOR" : "DESTEKLENMİYOR"}`);
        setTorchSupported(hasTorch);

        // Request mic
        addDebug("Mikrofon izni isteniyor...");
        const mic = await requestMicrophoneStream();
        addDebug("Mikrofon izni ALINDI.");
        setMicStream(mic);

        // Advance to camera pulse step. The actual sampling loop starts
        // reactively once the <video> element mounts and starts playing
        // (see the useEffect wired to [cameraStream, step]) — not here,
        // to avoid racing React's render commit.
        pulseStartRequestedRef.current = false;
        setStep("kamera_nabiz");
      } else {
        // Audio-only mode: request mic only
        const mic = await requestMicrophoneStream();
        setMicStream(mic);

        // Advance straight to voice recording step
        setStep("ses_kaydi");
        startVoiceMeasurement(mic);
      }
    } catch (err: any) {
      addDebug(`HATA (izin/kurulum aşamasında): ${err?.name || ""} ${err?.message || err}`);
      cleanupHardware();
      setErrorMessage(err.message || "İzinler alınırken bir hata oluştu.");
      setStep("hata");
    }
  };

  // STEP 2: Camera Pulse Measurement Loop
  const startPulseMeasurement = async (stream: MediaStream) => {
    // Reset buffers
    pulseBufferRef.current.reset();
    pulseSamplesRef.current = [];
    setPulseProgress(0);
    setLiveBpm(null);
    setFingerDetected(false);
    setFingerStatus("Lütfen parmağınızı arka kameraya yerleştirin.");

    // Try to enable torch (this single call also opportunistically tries to
    // stabilize exposure/white-balance in the SAME applyConstraints() call —
    // see lib/cameraCapture.ts for why these must not be two separate calls).
    addDebug("Flaş (torch) açma denemesi başlıyor...");
    const torchOn = await tryEnableTorch(stream);
    addDebug(`Flaş açma sonucu: ${torchOn ? "BAŞARILI ✓" : "BAŞARISIZ ✗"}`);
    setTorchEnabled(torchOn);

    // Setup offscreen canvas for pixel sampling
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;

    let startTime = performance.now();
    let lastBpmEstimateTime = startTime;
    let lastDebugLogTime = startTime;
    let frameCallCount = 0;
    let nullSampleCount = 0;

    const sampleFrame = () => {
      frameCallCount++;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        // Video not yet mounted or not enough data buffered to read frames —
        // keep polling via RAF instead of sampling garbage/black pixels.
        const now0 = performance.now();
        if (now0 - lastDebugLogTime > 2000) {
          lastDebugLogTime = now0;
          addDebug(
            `Örnekleme bekliyor: video=${video ? "var" : "YOK"}, readyState=${video?.readyState ?? "-"} (2+ gerekli)`
          );
        }
        pulseRafRef.current = requestAnimationFrame(sampleFrame);
        return;
      }

      const sample = sampleRedChannel(video, canvas);
      if (sample) {
        pulseBufferRef.current.addSample(sample);
        pulseSamplesRef.current.push(sample);

        const samples = pulseBufferRef.current.getSamples();
        const check = checkFingerDetection(samples);
        setFingerDetected(check.detected);
        setFingerStatus(check.reason);

        // Throttled debug: show actual sampled RGB values every ~1.5s so we
        // can see whether the camera is reading real (bright/dark red)
        // pixels or something unexpected (all-black, all-white, etc.)
        const nowDbg = performance.now();
        if (nowDbg - lastDebugLogTime > 1500) {
          lastDebugLogTime = nowDbg;
          addDebug(
            `Örnek RGB: R=${sample.r.toFixed(0)} G=${sample.g.toFixed(0)} B=${sample.b.toFixed(0)} | ${check.reason}`
          );
        }

        const elapsed = performance.now() - startTime;
        const progress = Math.min(100, (elapsed / PULSE_DURATION_MS) * 100);
        setPulseProgress(progress);

        // Live rolling BPM estimate every 3 seconds if finger is detected
        const now = performance.now();
        if (check.detected && now - lastBpmEstimateTime > 3000 && samples.length > 150) {
          lastBpmEstimateTime = now;
          try {
            const fsHz = 30;
            const { r: resampledR } = resampleSignal(samples, fsHz);
            const detrended = detrend(resampledR, fsHz);
            const filtered = bandpassFilter(detrended, fsHz);
            const peakRes = computeBPMviaPeakDetection(filtered, fsHz);
            if (peakRes.bpm >= 45 && peakRes.bpm <= 180) {
              setLiveBpm(Math.round(peakRes.bpm));
            }
          } catch (e) {
            console.error("Live BPM estimation error:", e);
          }
        }

        if (elapsed >= PULSE_DURATION_MS) {
          // Finished pulse capture
          finishPulseMeasurement();
          return;
        }
      } else {
        nullSampleCount++;
        const nowNull = performance.now();
        if (nowNull - lastDebugLogTime > 2000) {
          lastDebugLogTime = nowNull;
          addDebug(
            `sampleRedChannel null döndürdü (${nullSampleCount} kez). video.paused=${video.paused}, videoWidth=${video.videoWidth}`
          );
        }
      }

      pulseRafRef.current = requestAnimationFrame(sampleFrame);
    };

    // Start the loop
    pulseRafRef.current = requestAnimationFrame(sampleFrame);
  };

  const finishPulseMeasurement = () => {
    if (pulseRafRef.current) cancelAnimationFrame(pulseRafRef.current);
    
    // Disable torch and stop camera stream to release hardware
    if (cameraStream) {
      disableTorch(cameraStream);
      stopCameraStream(cameraStream);
      setCameraStream(null);
    }
    setTorchEnabled(false);

    // Analyze final signal
    const finalSamples = pulseSamplesRef.current;
    const analysis = analyzePulseSignal(finalSamples);

    if (analysis.fingerDetected && analysis.quality > 0.15 && analysis.bpm > 0) {
      setPulseResult(analysis);
      // Advance to voice recording step
      setStep("ses_kaydi");
      if (micStream) {
        startVoiceMeasurement(micStream);
      } else {
        // Re-request mic if somehow lost
        requestMicrophoneStream()
          .then((stream) => {
            setMicStream(stream);
            startVoiceMeasurement(stream);
          })
          .catch((err) => {
            setErrorMessage("Mikrofon bağlantısı kurulamadı: " + err.message);
            setStep("hata");
          });
      }
    } else {
      cleanupHardware();
      setErrorMessage(
        "Nabız sinyali tam olarak algılanamadı. Lütfen parmağınızı kamera lensinin üzerine tam yerleştirdiğinizden ve ölçüm sırasında sabit tuttuğunuzdan emin olun."
      );
      setStep("hata");
    }
  };

  // STEP 3: Voice Recording Loop
  const startVoiceMeasurement = async (stream: MediaStream) => {
    setVoiceProgress(0);
    setVoiceElapsedSec(0);

    const startTime = performance.now();
    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(100, (elapsed / VOICE_DURATION_MS) * 100);
      setVoiceProgress(progress);
      setVoiceElapsedSec(Math.round(elapsed / 1000));
    }, 200);

    try {
      const { samples, sampleRate } = await recordAudioToBuffer(
        stream,
        VOICE_DURATION_MS
      );

      clearInterval(interval);
      
      // Stop mic stream to release hardware
      if (micStream) {
        stopStream(micStream);
        setMicStream(null);
      }

      // Process voice signal
      const analysis = analyzeVoiceSignal(samples, sampleRate);
      setVoiceResult(analysis);

      // Advance to processing step
      setStep("isleniyor");
      processAndRedirect(analysis);
    } catch (err: any) {
      clearInterval(interval);
      cleanupHardware();
      setErrorMessage(err.message || "Ses kaydı sırasında bir hata oluştu.");
      setStep("hata");
    }
  };

  // STEP 4: Combine Results and Redirect
  const processAndRedirect = (voiceAnalysis: any) => {
    // Small artificial delay for premium transition feel
    setTimeout(() => {
      const inputs = {
        pulseBpm: pulseResult?.bpm,
        pulseQuality: pulseResult?.quality,
        rrVarianceMs: pulseResult?.rrIntervalVarianceMs,
        voicePitchHz: voiceAnalysis.meanPitchHz,
        voicePitchStd: voiceAnalysis.pitchStdHz,
        voiceJitterProxy: voiceAnalysis.jitterProxy,
        speechRateSPM: voiceAnalysis.speechRateSPM,
        totalPauseMs: voiceAnalysis.totalPauseMs,
        pauseCount: voiceAnalysis.pauseCount,
        durationSec: voiceAnalysis.durationSec,
      };

      const score = computeActivationScore(inputs, mode);
      const level = scoreToLevel(score);
      const description = getLevelDescription(level);

      const fullResult = {
        mode,
        score,
        level,
        description,
        pulse: pulseResult
          ? {
              bpm: pulseResult.bpm,
              quality: pulseResult.quality,
              rrVarianceMs: pulseResult.rrIntervalVarianceMs,
            }
          : null,
        voice: {
          meanPitchHz: voiceAnalysis.meanPitchHz,
          pitchStdHz: voiceAnalysis.pitchStdHz,
          pitchRangeHz: voiceAnalysis.pitchRangeHz,
          jitterProxy: voiceAnalysis.jitterProxy,
          speechRateSPM: voiceAnalysis.speechRateSPM,
          totalPauseMs: voiceAnalysis.totalPauseMs,
          pauseCount: voiceAnalysis.pauseCount,
          voicedRatio: voiceAnalysis.voicedRatio,
          durationSec: voiceAnalysis.durationSec,
        },
      };

      // Save to localStorage history
      saveMeasurement({
        mode,
        score,
        level,
        pulseBpm: pulseResult?.bpm,
        voicePitchHz: voiceAnalysis.meanPitchHz,
        speechRateSPM: voiceAnalysis.speechRateSPM,
      });

      // Store in sessionStorage for the results page
      sessionStorage.setItem("dag_last_result", JSON.stringify(fullResult));

      // Redirect to results page
      router.push("/sonuc");
    }, 2000);
  };

  // Helper to render step indicator dots
  const renderStepper = () => {
    const steps =
      mode === "camera_audio"
        ? [
            { id: "izin", label: "İzinler" },
            { id: "kamera_nabiz", label: "Nabız" },
            { id: "ses_kaydi", label: "Ses" },
          ]
        : [
            { id: "izin", label: "İzinler" },
            { id: "ses_kaydi", label: "Ses" },
          ];

    const currentIdx = steps.findIndex((s) => s.id === step);

    return (
      <div className="flex items-center justify-center gap-3 mb-8">
        {steps.map((s, idx) => {
          const isActive = s.id === step;
          const isCompleted = currentIdx > idx;

          return (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? "bg-sage-500 text-white ring-4 ring-sage-100"
                      : isCompleted
                      ? "bg-sage-100 text-sage-700"
                      : "bg-white border border-sage-200 text-sage-400"
                  }`}
                >
                  {isCompleted ? "✓" : idx + 1}
                </div>
                <span
                  className={`text-[10px] font-semibold mt-1 transition-colors duration-300 ${
                    isActive ? "text-sage-800 font-bold" : "text-sage-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 -mt-4 transition-colors duration-500 ${
                    currentIdx > idx ? "bg-sage-300" : "bg-sage-100"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 md:py-10 max-w-md mx-auto w-full">
      {/* Video element for camera pulse capture — ALWAYS mounted (never
          conditionally rendered per step) and hidden purely via CSS.
          ROOT CAUSE FIX: previously this was only rendered inside the
          step==="kamera_nabiz" JSX branch. That meant videoRef.current was
          still null at the exact moment the effect watching [cameraStream,
          step] ran right after setStep("kamera_nabiz") — confirmed via the
          on-screen debug log showing "videoRef=YOK" even once
          step==='kamera_nabiz'. Keeping the element permanently in the DOM
          removes that whole mount-timing race: the ref is populated on the
          FIRST render of this component, long before any camera flow starts. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* Back Button */}
      {step === "izin" && (
        <button
          onClick={() => router.push("/")}
          className="self-start flex items-center gap-1.5 text-xs font-semibold text-sage-500 hover:text-sage-800 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Ana Sayfa</span>
        </button>
      )}

      {/* Stepper */}
      {step !== "isleniyor" && step !== "hata" && renderStepper()}

      {/* Main Card Container */}
      <div className="w-full bg-white/80 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden">
        <AnimatePresence mode="wait">
          {/* STEP 1: PERMISSIONS */}
          {step === "izin" && (
            <motion.div
              key="izin"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 w-full flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-600">
                {mode === "camera_audio" ? (
                  <div className="relative">
                    <Camera className="w-8 h-8" />
                    <Mic className="w-4 h-4 absolute -bottom-1 -right-1 bg-sage-100 rounded-full p-0.5 text-sage-700" />
                  </div>
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-sage-900">
                  {mode === "camera_audio"
                    ? "Kamera ve Mikrofon İzni"
                    : "Mikrofon İzni"}
                </h2>
                <p className="text-sm text-sage-600 leading-relaxed">
                  {mode === "camera_audio"
                    ? "Detaylı analiz için kameranız (parmak ucundan nabız ölçümü için) ve mikrofonunuz (ses analizi için) kullanılacaktır."
                    : "Hızlı analiz için mikrofonunuz kullanılarak kısa bir ses kaydı alınacaktır. Kamera izni istenmez."}
                </p>
              </div>

              {/* Privacy Reassurance */}
              <div className="flex items-start gap-2.5 bg-sage-50 p-3.5 rounded-2xl border border-sage-100 text-left text-xs text-sage-700 w-full">
                <ShieldCheck className="w-5 h-5 text-sage-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <span className="font-bold">Gizlilik Güvencesi:</span> Görüntü ve ses verileriniz KESİNLİKLE hiçbir sunucuya gönderilmez. Tüm analiz tamamen cihazınızda, yerel olarak saniyeler içinde yapılır ve anında silinir.
                </p>
              </div>

              <button
                onClick={handleStartPermissions}
                className="w-full py-3.5 rounded-2xl bg-sage-600 hover:bg-sage-700 active:scale-[0.98] text-white font-bold text-sm shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
              >
                <span>Ölçümü Başlat</span>
              </button>
            </motion.div>
          )}

          {/* STEP 2: CAMERA PULSE MEASUREMENT */}
          {step === "kamera_nabiz" && (
            <motion.div
              key="kamera_nabiz"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 w-full flex flex-col items-center"
            >
              {/* Circular Camera Preview Frame */}
              <div className="relative w-32 h-32 rounded-full border-4 border-sage-100 flex items-center justify-center overflow-hidden bg-sage-950 shadow-inner">
                {/* Pulsing fingerprint icon inside */}
                <motion.div
                  animate={{
                    scale: fingerDetected ? [1, 1.08, 1] : 1,
                    opacity: fingerDetected ? 1 : 0.4,
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="text-white z-10"
                >
                  <HeartPulse
                    className={`w-12 h-12 ${
                      fingerDetected ? "text-rose-500" : "text-sage-400"
                    }`}
                  />
                </motion.div>

                {/* Soft red glow if finger detected */}
                <AnimatePresence>
                  {fingerDetected && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-rose-900/80 blur-sm"
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Live BPM Display */}
              <div className="h-12 flex flex-col items-center justify-center">
                {fingerDetected && liveBpm ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-baseline gap-1"
                  >
                    <span className="text-3xl font-extrabold text-rose-600 tracking-tight">
                      {liveBpm}
                    </span>
                    <span className="text-xs font-bold text-rose-500">BPM</span>
                  </motion.div>
                ) : (
                  <span className="text-xs font-semibold text-sage-400 animate-pulse">
                    {fingerDetected ? "Nabız hesaplanıyor..." : "-- BPM"}
                  </span>
                )}
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-sage-900">
                  Parmağınızı Kameraya Yerleştirin
                </h2>
                <p className="text-xs md:text-sm text-sage-600 leading-relaxed max-w-xs mx-auto">
                  İşaret parmağınızın ucunu, arka kameranın <span className="font-bold">hem lensini hem de yanındaki flaşı aynı anda</span> kapatacak şekilde, hafif ama sabit bir baskıyla üzerine yerleştirin. Parmağınızı ölçüm boyunca hareket ettirmeyin.
                </p>
              </div>

              {/* Live Finger Status Badge */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-300 ${
                  fingerDetected
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                    : "bg-amber-50 text-amber-800 border border-amber-100"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    fingerDetected ? "bg-emerald-500 animate-ping" : "bg-amber-500"
                  }`}
                />
                <span>{fingerStatus}</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-sage-400">
                  <span>NABIZ ÖLÇÜMÜ</span>
                  <span>{Math.round(pulseProgress)}%</span>
                </div>
                <div className="w-full h-2 bg-sage-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-sage-500 rounded-full"
                    style={{ width: `${pulseProgress}%` }}
                    transition={{ ease: "linear" }}
                  />
                </div>
              </div>

              {/* Torch Warning */}
              {!torchSupported && (
                <p className="text-[10px] text-amber-600 leading-relaxed max-w-xs">
                  Not: Cihazınızda flaş kontrolü desteklenmiyor (iOS Safari vb.). Lütfen parmağınızı güçlü bir ışık kaynağına (lamba, güneş) doğru tutarak lensi kapatın.
                </p>
              )}

              {/* TEMPORARY DEBUG PANEL — remove once camera pulse detection
                  is confirmed working across target devices. Shows real-time
                  internal state directly on screen since mobile testers
                  usually can't reach the browser devtools console. */}
              <div className="w-full mt-2 bg-slate-950 rounded-xl p-3 text-left max-h-40 overflow-y-auto">
                <p className="text-[9px] font-bold text-amber-400 mb-1 uppercase tracking-wider">
                  Hata Ayıklama Kaydı (Geçici)
                </p>
                {debugLines.length === 0 ? (
                  <p className="text-[9px] text-slate-500">Henüz kayıt yok...</p>
                ) : (
                  debugLines.map((line, idx) => (
                    <p key={idx} className="text-[9px] text-emerald-400 font-mono leading-tight break-all mb-0.5">
                      {line}
                    </p>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 3: VOICE RECORDING */}
          {step === "ses_kaydi" && (
            <motion.div
              key="ses_kaydi"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 w-full flex flex-col items-center"
            >
              {/* Pulsing Mic Icon */}
              <div className="relative w-24 h-24 rounded-full bg-sage-100 flex items-center justify-center text-sage-600">
                <motion.div
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 rounded-full bg-sage-100/60 -z-10"
                />
                <Mic className="w-10 h-10 text-sage-600" />
              </div>

              {/* Waveform Visualizer (Decorative) */}
              <div className="flex items-center justify-center gap-1 h-8 w-full">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: [8, Math.random() * 28 + 8, 8],
                    }}
                    transition={{
                      duration: 0.6 + Math.random() * 0.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-1 bg-sage-400 rounded-full"
                  />
                ))}
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-sage-900">
                  Doğal Bir Şekilde Konuşun
                </h2>
                <p className="text-xs md:text-sm text-sage-600 leading-relaxed max-w-xs mx-auto">
                  Lütfen mikrofonunuza doğru yaklaşık 15 saniye boyunca normal bir ses tonuyla konuşun.
                </p>
                <div className="bg-sage-50 p-3 rounded-xl border border-sage-100 text-xs text-sage-700 italic max-w-xs mx-auto">
                  &quot;Bugün nasıl hissediyorsunuz? Son zamanlarda sizi heyecanlandıran veya düşündüren bir olayı birkaç cümleyle anlatın.&quot;
                </div>
              </div>

              {/* Countdown Timer */}
              <div className="text-2xl font-extrabold text-sage-800 tracking-tight">
                00:{String(15 - voiceElapsedSec).padStart(2, "0")}
              </div>

              {/* Progress Bar */}
              <div className="w-full space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-sage-400">
                  <span>SES KAYDEDİLİYOR</span>
                  <span>{Math.round(voiceProgress)}%</span>
                </div>
                <div className="w-full h-2 bg-sage-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-sage-500 rounded-full"
                    style={{ width: `${voiceProgress}%` }}
                    transition={{ ease: "linear" }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: PROCESSING */}
          {step === "isleniyor" && (
            <motion.div
              key="isleniyor"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 w-full flex flex-col items-center py-8"
            >
              {/* Rotating loading spinner */}
              <div className="relative w-16 h-16">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="w-full h-full rounded-full border-4 border-sage-100 border-t-sage-500"
                />
                <HeartPulse className="w-6 h-6 text-sage-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-heartbeat-pulse" />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold text-sage-900">
                  Sinyalleriniz İşleniyor
                </h2>
                <p className="text-xs md:text-sm text-sage-600 leading-relaxed max-w-xs mx-auto">
                  Fizyolojik ve akustik verileriniz yerel olarak birleştiriliyor. Lütfen bekleyin...
                </p>
              </div>

              <div className="text-xs text-sage-400 italic">
                Hiçbir veri cihazınızdan dışarı aktarılmıyor.
              </div>
            </motion.div>
          )}

          {/* STEP 5: ERROR */}
          {step === "hata" && (
            <motion.div
              key="hata"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 w-full flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold text-sage-900">
                  Ölçüm Tamamlanamadı
                </h2>
                <p className="text-xs md:text-sm text-amber-800 leading-relaxed max-w-xs mx-auto bg-amber-50/50 p-3 rounded-xl border border-amber-100/40">
                  {errorMessage || "Beklenmeyen bir hata oluştu."}
                </p>
              </div>

              <div className="w-full space-y-2">
                <button
                  onClick={() => setStep("izin")}
                  className="w-full py-3 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Yeniden Dene</span>
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="w-full py-3 rounded-xl bg-sage-100 hover:bg-sage-200 text-sage-700 font-bold text-sm transition-colors"
                >
                  Ana Sayfaya Dön
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Persistent small privacy reminder */}
      {step !== "isleniyor" && step !== "hata" && (
        <p className="text-[10px] text-sage-400 text-center mt-4 leading-relaxed">
          🔒 Tüm işlemler tarayıcınızda yerel olarak gerçekleşir. <br />
          Ses veya görüntü kaydı cihazınızdan dışarı gönderilmez.
        </p>
      )}
    </div>
  );
}

export default function MeasurementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-sage-100 border-t-sage-500 animate-spin" />
        </div>
      }
    >
      <MeasurementPageContent />
    </Suspense>
  );
}