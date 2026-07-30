"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Trash2,
  Calendar,
  Mic,
  Camera,
  Inbox,
  TrendingUp,
  HeartPulse,
} from "lucide-react";

import {
  getHistory,
  deleteMeasurement,
  clearHistory,
  getHistoryStats,
  MeasurementRecord,
} from "@/lib/history";
import { levelToColor } from "@/lib/activationLevel";

// Recharts components
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
} from "recharts";

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<MeasurementRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  const loadData = () => {
    const data = getHistory();
    setHistory(data);
    setStats(getHistoryStats());
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Bu ölçüm kaydını silmek istediğinizden emin misiniz?")) {
      deleteMeasurement(id);
      loadData();
    }
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        "Tüm ölçüm geçmişinizi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
      )
    ) {
      clearHistory();
      loadData();
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "dusuk":
        return "Düşük";
      case "orta":
        return "Orta";
      case "yuksek":
        return "Yüksek";
      default:
        return "";
    }
  };

  if (!isMounted) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-sage-100 border-t-sage-500 animate-spin" />
      </div>
    );
  }

  // Prepare chart data
  const chartData = history.map((item) => ({
    name: formatDate(item.timestamp),
    score: item.score,
    level: getLevelLabel(item.level),
  }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4, ease: "easeOut" },
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
        <h1 className="text-sm font-bold text-sage-800 uppercase tracking-wider">
          Ölçüm Geçmişim
        </h1>
      </div>

      {history.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-400">
            <Inbox className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-sage-900">Henüz Ölçüm Yok</h2>
            <p className="text-xs md:text-sm text-sage-600 leading-relaxed max-w-xs">
              Geçmişinizi görüntülemek için ilk ölçümünüzü yapın.
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 rounded-2xl bg-sage-600 hover:bg-sage-700 text-white font-bold text-sm shadow-sm transition-colors"
          >
            İlk Ölçümü Başlat
          </button>
        </div>
      ) : (
        /* History Content */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full space-y-6"
        >
          {/* Stats Row */}
          {stats && (
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-3 gap-3"
            >
              <div className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-3 text-center shadow-sm">
                <div className="text-[9px] font-bold text-sage-400 uppercase tracking-wider">
                  TOPLAM
                </div>
                <div className="text-lg font-extrabold text-sage-800">
                  {stats.totalCount}
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-3 text-center shadow-sm">
                <div className="text-[9px] font-bold text-sage-400 uppercase tracking-wider">
                  ORTALAMA
                </div>
                <div className="text-xs font-bold text-sage-800 truncate mt-1">
                  {stats.avgScore < 38
                    ? "Düşük"
                    : stats.avgScore <= 68
                    ? "Orta"
                    : "Yüksek"}
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-3 text-center shadow-sm">
                <div className="text-[9px] font-bold text-sage-400 uppercase tracking-wider">
                  SIK GÖRÜLEN
                </div>
                <div className="text-xs font-bold text-sage-800 truncate mt-1">
                  {stats.mostCommonLevel
                    ? getLevelLabel(stats.mostCommonLevel)
                    : "-"}
                </div>
              </div>
            </motion.div>
          )}

          {/* Trend Chart */}
          <motion.div
            variants={itemVariants}
            className="bg-white/60 backdrop-blur-md border border-white/40 rounded-3xl p-4 shadow-sm space-y-3"
          >
            <div className="flex items-center gap-1.5 px-1">
              <TrendingUp className="w-4 h-4 text-sage-600" />
              <h3 className="text-xs font-bold text-sage-800">Aktivasyon Eğilimi</h3>
            </div>

            <div className="w-full h-48 text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#58816f" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#58816f" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    stroke="#769d8b"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    stroke="#769d8b"
                    ticks={[20, 50, 80]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #cbdad1",
                      borderRadius: "12px",
                      fontSize: "11px",
                      color: "#2c3e35",
                    }}
                  />
                  {/* Qualitative background bands */}
                  <ReferenceArea
                    y1={0}
                    y2={38}
                    fill="#436656"
                    fillOpacity={0.03}
                  />
                  <ReferenceArea
                    y1={38}
                    y2={68}
                    fill="#d97706"
                    fillOpacity={0.03}
                  />
                  <ReferenceArea
                    y1={68}
                    y2={100}
                    fill="#c2622c"
                    fillOpacity={0.03}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#58816f"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorScore)"
                    name="Aktivasyon"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[9px] text-sage-400 text-center italic">
              Bu grafik genel eğilimi gösterir, kesin bir ölçüm veya teşhis değildir.
            </p>
          </motion.div>

          {/* Past Measurements List */}
          <motion.div variants={itemVariants} className="space-y-2.5">
            <h3 className="text-xs font-bold text-sage-800 px-1">Geçmiş Ölçümler</h3>
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {[...history].reverse().map((item) => {
                  const colors = levelToColor(item.level);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -15 }}
                      className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-3.5 flex items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Mode Icon */}
                        <div className="w-8 h-8 rounded-xl bg-sage-50 flex items-center justify-center text-sage-500 shrink-0">
                          {item.mode === "camera_audio" ? (
                            <Camera className="w-4 h-4" />
                          ) : (
                            <Mic className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-sage-800">
                              {getLevelLabel(item.level)} Aktivasyon
                            </span>
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: colors.primary }}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-sage-400">
                            <span className="flex items-center gap-0.5">
                              <Calendar className="w-3 h-3" />
                              {formatDate(item.timestamp)}
                            </span>
                            {item.pulseBpm && (
                              <span className="flex items-center gap-0.5 text-rose-600 font-semibold">
                                <HeartPulse className="w-3 h-3" />
                                {item.pulseBpm} BPM
                              </span>
                            )}
                            {item.voicePitchHz && (
                              <span className="flex items-center gap-0.5 text-sky-600 font-semibold">
                                <Mic className="w-3 h-3" />
                                {Math.round(item.voicePitchHz)} Hz
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="w-8 h-8 rounded-lg hover:bg-rose-50 text-sage-400 hover:text-rose-600 transition-colors flex items-center justify-center shrink-0"
                        aria-label="Ölçümü sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Clear All Button */}
          <motion.div variants={itemVariants} className="pt-2 flex justify-center">
            <button
              onClick={handleClearAll}
              className="text-xs font-bold text-sage-400 hover:text-rose-600 transition-colors py-2 px-4 rounded-xl hover:bg-rose-50/30"
            >
              Tüm Geçmişi Temizle
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}