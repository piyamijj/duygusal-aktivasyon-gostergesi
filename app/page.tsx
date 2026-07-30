"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, Camera, HeartPulse, History, HelpCircle, ArrowRight, Info } from "lucide-react";
import HeartbeatLine from "@/components/HeartbeatLine";

export default function HomePage() {
  const router = useRouter();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] md:w-[500px] h-[350px] md:h-[500px] rounded-full bg-gradient-to-tr from-sage-200/30 to-amber-100/20 blur-3xl -z-10 animate-pulse-slow" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-2xl flex flex-col items-center text-center space-y-8 md:space-y-10"
      >
        {/* Hero Section */}
        <motion.div variants={itemVariants} className="space-y-4 w-full">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-100 text-sage-800 text-xs font-semibold tracking-wide mb-2">
            <HeartPulse className="w-3.5 h-3.5 text-sage-600 animate-heartbeat-pulse" />
            <span>Kişisel Farkındalık Aracı</span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-sage-900 leading-tight">
            Duygusal Aktivasyon <br className="hidden sm:inline" /> Göstergesi
          </h1>
          <p className="text-base md:text-lg text-sage-600 max-w-lg mx-auto leading-relaxed">
            Bedeninizin ve sesinizin o anki ritmini sakin bir şekilde keşfedin. Fizyolojik ve akustik uyarılma seviyenizi ölçerek kendinize bir anlık farkındalık molası verin.
          </p>
        </motion.div>

        {/* Heartbeat Visual Motif */}
        <motion.div variants={itemVariants} className="w-full max-w-md px-6">
          <HeartbeatLine color="#58816f" height={50} animated={true} />
        </motion.div>

        {/* Honest Framing Banner */}
        <motion.div
          variants={itemVariants}
          className="w-full bg-white/50 backdrop-blur-sm border border-sage-100 rounded-2xl p-4 text-left text-xs md:text-sm text-sage-700 flex items-start gap-3 shadow-sm"
        >
          <Info className="w-5 h-5 text-sage-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sage-800">Bu bir yalan makinesi veya tıbbi cihaz değildir.</p>
            <p className="leading-relaxed">
              Uygulama, ses perdesi ve nabız gibi fizyolojik uyarılma (arousal) sinyallerini ölçer. Yüksek sonuçlar dürüstlükle ilgili olmayıp; heyecan, kaygı, kahve tüketimi veya konuşma coşkusu gibi düzinelerce doğal nedenden kaynaklanabilir.{" "}
              <Link href="/nasil-calisir" className="font-bold text-sage-900 underline hover:text-sage-950 transition-colors">
                Nasıl çalıştığını öğrenin.
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Mode Selection Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {/* Audio-only Mode */}
          <motion.button
            whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(67, 102, 86, 0.1), 0 8px 10px -6px rgba(67, 102, 86, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/olcum?mode=audio")}
            className="flex flex-col text-left p-6 bg-white border border-sage-100 rounded-3xl shadow-sm transition-all duration-300 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-sage-50 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
            <div className="w-12 h-12 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-700 mb-4 group-hover:bg-sage-500 group-hover:text-white transition-colors duration-300">
              <Mic className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-sage-900 mb-2 flex items-center gap-1.5">
              Hızlı Ses Analizi
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-sage-500" />
            </h2>
            <p className="text-xs md:text-sm text-sage-600 leading-relaxed">
              Sadece mikrofon kullanılır, kamera izni istenmez. Kısa bir konuşma kaydı ile ses perdesi, konuşma hızı ve duraklamalar analiz edilir.
            </p>
          </motion.button>

          {/* Camera + Audio Mode */}
          <motion.button
            whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(217, 119, 6, 0.1), 0 8px 10px -6px rgba(217, 119, 6, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/olcum?mode=camera_audio")}
            className="flex flex-col text-left p-6 bg-white border border-amber-100/60 rounded-3xl shadow-sm transition-all duration-300 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/50 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-700 mb-4 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
              <div className="relative">
                <Camera className="w-6 h-6" />
                <HeartPulse className="w-3.5 h-3.5 absolute -bottom-1 -right-1 bg-amber-50 rounded-full p-0.5 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-sage-900 mb-2 flex items-center gap-1.5">
              Detaylı Analiz
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-amber-600" />
            </h2>
            <p className="text-xs md:text-sm text-sage-600 leading-relaxed">
              Kamera ve mikrofon birlikte kullanılır. Parmağınızı kameraya yerleştirerek nabız (rPPG) ölçümü ve ses analizi eş zamanlı yapılır.
            </p>
          </motion.button>
        </motion.div>

        {/* Secondary Navigation Links */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-center gap-6 pt-4 border-t border-sage-100 w-full text-xs md:text-sm font-medium text-sage-500"
        >
          <Link
            href="/gecmis"
            className="flex items-center gap-1.5 hover:text-sage-800 transition-colors py-1 px-2 rounded-lg hover:bg-sage-100/50"
          >
            <History className="w-4 h-4" />
            <span>Ölçüm Geçmişim</span>
          </Link>
          <span className="text-sage-200">|</span>
          <Link
            href="/nasil-calisir"
            className="flex items-center gap-1.5 hover:text-sage-800 transition-colors py-1 px-2 rounded-lg hover:bg-sage-100/50"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Nasıl Çalışır?</span>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}