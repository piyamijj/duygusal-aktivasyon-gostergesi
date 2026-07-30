"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Activity,
  Mic2,
  Clock,
  Wind,
  Droplet,
  Coffee,
  MessageCircle,
  Sparkles,
  Loader2,
  RotateCcw,
  History,
  Info,
  HeartPulse,
} from "lucide-react";

import ActivationGauge from "@/components/ActivationGauge";
import { levelToColor, ActivationLevel } from "@/lib/activationLevel";
import { getRandomSuggestions } from "@/lib/suggestions";
import { buildSummaryForAI, requestAiCommentary } from "@/lib/geminiCommentary";

interface ResultData {
  mode: "audio" | "camera_audio";
  score: number;
  level: ActivationLevel;
  description: string;
  pulse: {
    bpm: number;
    quality: number;
    rrVarianceMs: number;
  } | null;
  voice: {
    meanPitchHz: number;
    pitchStdHz: number;
    pitchRangeHz: number;
    jitterProxy: number;
    speechRateSPM: number;
    totalPauseMs: number;
    pauseCount: number;
    voicedRatio: number;
    durationSec: number;
  };
}

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<ResultData | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // AI Commentary State
  const [aiCommentary, setAiCommentary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRequested, setAiRequested] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = sessionStorage.getItem("dag_last_result");
      if (stored) {
        const parsed = JSON.parse(stored) as ResultData;
        setResult(parsed);
        // Generate random suggestions once on mount
        setSuggestions(getRandomSuggestions(parsed.level, 3));
      }
    } catch (e) {
      console.error("Error reading result from sessionStorage:", e);
    }
  }, []);

  if (!isMounted) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-sage-100 border-t-sage-500 animate-spin" />
      </div>
    );
  }

  // Empty state if no result found
  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-500">
          <Info className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-sage-900">Ölçüm Bulunamadı</h1>
          <p className="text-sm text-sage-600 leading-relaxed">
            Görünüşe göre henüz bir ölçüm yapmadınız veya mevcut oturum süreniz doldu.
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="w-full py-3.5 rounded-2xl bg-sage-600 hover:bg-sage-700 text-white font-bold text-sm shadow-sm transition-colors"
        >
          Yeni Ölçüm Başlat
        </button>
      </div>
    );
  }

  const colors = levelToColor(result.level);

  // Handle AI Commentary Request
  const handleRequestAiCommentary = async () => {
    if (aiLoading || aiRequested) return;
    setAiLoading(true);
    setAiError(null);
    setAiRequested(true);

    try {
      const summary = buildSummaryForAI(
        result.mode,
        result.level,
        result.pulse?.bpm,
        result.voice.meanPitchHz,
        result.voice.speechRateSPM,
        result.voice.totalPauseMs,
        result.voice.durationSec
      );

      const res = await requestAiCommentary(summary);
      if (res.success && res.text) {
        setAiCommentary(res.text);
        // Update the record in sessionStorage to include the commentary
        const updatedResult = { ...result, aiCommentary: res.text };
        sessionStorage.setItem("dag_last_result", JSON.stringify(updatedResult));
      } else {
        setAiError(res.error || "Yapay zeka yorumu alınamadı.");
        setAiRequested(false); // Allow retry
      }
    } catch (e) {
      setAiError("Bağlantı hatası oluştu.");
      setAiRequested(false);
    } finally {
      setAiLoading(false);
    }
  };

  // Helper to map suggestion text to appropriate icon
  const getSuggestionIcon = (text: string, index: number) => {
    const lower = text.toLowerCase();
    if (lower.includes("nefes") || lower.includes("breathe")) {
      return <Wind className="w-5 h-5 text-sky-600" />;
    }
    if (lower.includes("su") || lower.includes("water") || lower.includes("yıkayın")) {
      return <Droplet className="w-5 h-5 text-blue-600" />;
    }
    if (lower.includes("mola") || lower.includes("yürüyün") || lower.includes("ekran")) {
      return <Coffee className="w-5 h-5 text-amber-600" />;
    }
    if (lower.includes("dost") || lower.includes("yakın") || lower.includes("görüşmeyi") || lower.includes("uzman")) {
      return <MessageCircle className="w-5 h-5 text-emerald-600" />;
    }
    // Fallback icons based on index
    const fallbacks = [
      <Wind className="w-5 h-5 text-sage-600" />,
      <Droplet className="w-5 h-5 text-sage-600" />,
      <Coffee className="w-5 h-5 text-sage-600" />,
    ];
    return fallbacks[index % fallbacks.length];
  };

  // Framer-motion animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-6 md:py-10 max-w-xl mx-auto w-full">
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-xs font-semibold text-sage-500 hover:text-sage-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Ana Sayfa</span>
        </button>
        <div className="text-[10px] font-bold text-sage-400 uppercase tracking-wider">
          {result.mode === "camera_audio" ? "Detaylı Analiz" : "Hızlı Ses Analizi"}
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full space-y-6"
      >
        {/* 1. Main Gauge Card */}
        <motion.div variants={itemVariants} className="w-full">
          <ActivationGauge
            level={result.level}
            score={result.score}
            description={result.description}
          />
        </motion.div>

        {/* 2. Raw Numbers Section */}
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="px-1">
            <h3 className="text-sm font-bold text-sage-800">Ölçüm Detayları</h3>
            <p className="text-[10px] text-sage-400 italic mt-0.5">
              Bu sayılar ham sinyal ölçümleridir, tıbbi bir teşhis veya kesinlik ifade etmez.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Pulse Card (if available) */}
            {result.pulse && (
              <div className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                  <HeartPulse className="w-5 h-5 animate-heartbeat-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-sage-400 uppercase tracking-wider">NABIZ</div>
                  <div className="text-base font-extrabold text-sage-800 truncate">
                    {result.pulse.bpm} <span className="text-xs font-semibold text-sage-500">BPM</span>
                  </div>
                </div>
              </div>
            )}

            {/* Voice Pitch Card */}
            <div className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                <Mic2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-sage-400 uppercase tracking-wider">SES PERDESİ</div>
                <div className="text-base font-extrabold text-sage-800 truncate">
                  {Math.round(result.voice.meanPitchHz)} <span className="text-xs font-semibold text-sage-500">Hz</span>
                </div>
              </div>
            </div>

            {/* Speech Rate Card */}
            <div className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-sage-400 uppercase tracking-wider">KONUŞMA HIZI</div>
                <div className="text-base font-extrabold text-sage-800 truncate">
                  {Math.round(result.voice.speechRateSPM)} <span className="text-[10px] font-semibold text-sage-500">seg/dk</span>
                </div>
              </div>
            </div>

            {/* Pause Duration Card */}
            <div className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-sage-400 uppercase tracking-wider">DURAKLAMA</div>
                <div className="text-base font-extrabold text-sage-800 truncate">
                  {Math.round((result.voice.totalPauseMs / 1000) * 10) / 10} <span className="text-xs font-semibold text-sage-500">sn</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 3. Optional AI Commentary Section */}
        <motion.div variants={itemVariants} className="w-full">
          <div className="bg-gradient-to-br from-sage-100/40 to-amber-50/30 backdrop-blur-md border border-sage-200/40 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-sage-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Yapay Zeka Yorumu Ekle
                </h3>
                <p className="text-xs text-sage-600 leading-relaxed">
                  İsteğe bağlıdır. Sadece yukarıdaki özet sayılar (ham ses/görüntü değil) Gemini API&apos;sine gönderilerek sıcak, destekleyici bir yansıtma metni üretilir.
                </p>
              </div>

              {!aiCommentary && !aiLoading && (
                <button
                  onClick={handleRequestAiCommentary}
                  className="px-3 py-2 rounded-xl bg-white border border-sage-200 hover:bg-sage-50 active:scale-95 text-xs font-bold text-sage-700 shadow-sm transition-all shrink-0 flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Yorum Üret</span>
                </button>
              )}
            </div>

            {/* Loading State */}
            {aiLoading && (
              <div className="flex items-center justify-center py-4 gap-2 text-xs font-semibold text-sage-500">
                <Loader2 className="w-4 h-4 animate-spin text-sage-600" />
                <span>Yapay zeka rehberiniz yazıyor...</span>
              </div>
            )}

            {/* Error State */}
            {aiError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800 leading-relaxed flex flex-col gap-2">
                <p>{aiError}</p>
                <button
                  onClick={handleRequestAiCommentary}
                  className="self-start text-[10px] font-bold text-amber-900 underline hover:text-amber-950"
                >
                  Yeniden Dene
                </button>
              </div>
            )}

            {/* AI Commentary Output */}
            {aiCommentary && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-white/80 border border-amber-100 rounded-2xl p-4 shadow-inner"
              >
                <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9px] font-bold tracking-wide flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                  <span>YAPAY ZEKA YORUMU</span>
                </div>
                <p className="text-xs md:text-sm text-sage-800 leading-relaxed italic pt-1">
                  &quot;{aiCommentary}&quot;
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* 4. Self-Care Suggestions */}
        <motion.div variants={itemVariants} className="space-y-3">
          <h3 className="text-sm font-bold text-sage-800 px-1">Şimdi Ne Yapabilirsiniz?</h3>
          <div className="space-y-2.5">
            {suggestions.map((text, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-sage-50 flex items-center justify-center shrink-0 mt-0.5">
                  {getSuggestionIcon(text, idx)}
                </div>
                <p className="text-xs md:text-sm text-sage-700 leading-relaxed">
                  {text}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 5. Action Buttons */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3 pt-4">
          <button
            onClick={() => router.push("/")}
            className="py-3.5 rounded-2xl bg-sage-600 hover:bg-sage-700 active:scale-[0.98] text-white font-bold text-sm shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Yeni Ölçüm</span>
          </button>
          <button
            onClick={() => router.push("/gecmis")}
            className="py-3.5 rounded-2xl bg-white border border-sage-200 hover:bg-sage-50 active:scale-[0.98] text-sage-700 font-bold text-sm shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
          >
            <History className="w-4 h-4" />
            <span>Geçmişim</span>
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}