"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ChevronUp, ChevronDown, Info } from "lucide-react";

export default function EthicalFooter() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 w-full bg-amber-50/95 border-t border-amber-200/60 shadow-lg backdrop-blur-md text-amber-900 text-xs md:text-sm">
      <div className="max-w-4xl mx-auto px-4 py-2.5 md:py-3">
        {/* Always Visible Header Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="font-medium truncate">
              <span className="font-bold">Önemli Uyarı:</span> Bu bir tıbbi cihaz veya yalan makinesi <span className="underline decoration-amber-500 decoration-2">DEĞİLDİR</span>.
            </p>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-100 hover:bg-amber-200/80 transition-colors text-amber-800 font-semibold shrink-0"
            aria-label="Daha fazla bilgi göster veya gizle"
          >
            <span>{isExpanded ? "Kapat" : "Detaylar"}</span>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Expandable Detailed Disclaimer */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 8 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-2 border-t border-amber-200/40 space-y-2 text-amber-800 leading-relaxed">
                <p>
                  Bu uygulama, tarayıcınız üzerinden tamamen yerel sinyal işleme yöntemleriyle (rPPG ve ses analizi) genel fizyolojik ve akustik uyarılma seviyenizi ölçen bir <span className="font-semibold">öz-yansıtma ve farkındalık aracıdır</span>.
                </p>
                <p>
                  Ölçülen yüksek aktivasyon seviyeleri kesinlikle bir dürüstlük veya yalan göstergesi değildir. Kalp atış hızı ve ses perdesindeki değişimler; heyecan, kaygı, stres, fiziksel yorgunluk, kafein tüketimi, oda sıcaklığı veya o anki konuşma coşkunuz gibi tamamen doğal ve geçici düzinelerce faktörden kaynaklanabilir.
                </p>
                <p className="flex items-start gap-1.5 bg-amber-100/50 p-2 rounded border border-amber-200/30">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Bu araç tıbbi teşhis, tedavi veya profesyonel psikolojik danışmanlık yerine geçmez. Bilimsel sınırlamalar ve çalışma prensipleri hakkında daha fazla bilgi edinmek için lütfen{" "}
                    <Link
                      href="/nasil-calisir"
                      className="font-bold text-amber-900 underline hover:text-amber-950 transition-colors"
                    >
                      Nasıl Çalışır?
                    </Link>{" "}
                    sayfamızı ziyaret edin.
                  </span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}