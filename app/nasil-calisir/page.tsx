"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Mic2,
  XCircle,
  FlaskConical,
  ShieldCheck,
  LifeBuoy,
  CheckCircle2,
} from "lucide-react";

export default function HowItWorksPage() {
  const router = useRouter();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
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
    <div className="flex-1 flex flex-col items-center px-4 py-6 md:py-10 max-w-2xl mx-auto w-full">
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
          Nasıl Çalışır?
        </h1>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full space-y-5"
      >
        {/* Intro */}
        <motion.div variants={itemVariants} className="text-center space-y-2 mb-2">
          <h2 className="text-xl font-bold text-sage-900">
            Şeffaflık Bizim İçin Önemli
          </h2>
          <p className="text-sm text-sage-600 leading-relaxed">
            Bu sayfada, uygulamanın tam olarak ne yaptığını, ne yapmadığını ve bilimsel sınırlamalarını dürüstçe açıklıyoruz.
          </p>
        </motion.div>

        {/* Section 1: What we do */}
        <motion.div
          variants={itemVariants}
          className="bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-5 md:p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-sage-100 flex items-center justify-center text-sage-600 shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-sage-900">Bu Uygulama Ne Yapar?</h3>
          </div>

          <div className="space-y-3 pl-1">
            <div className="flex items-start gap-3">
              <Camera className="w-4 h-4 text-sage-500 shrink-0 mt-1" />
              <p className="text-xs md:text-sm text-sage-700 leading-relaxed">
                <span className="font-bold">Kamera ile Nabız Ölçümü (rPPG):</span> Parmağınızı kamera ve flaşın üzerine yerleştirdiğinizde, kalp atışınızla birlikte deri altındaki kan akışı hafifçe değişir ve bu durum kameranın algıladığı kırmızı ışık miktarında çok küçük dalgalanmalara yol açar. Uygulama bu dalgalanmaları yakalar; sinyali temizler (detrend), belirli bir frekans aralığına filtreler (bandpass) ve FFT (Hızlı Fourier Dönüşümü) ile tepe noktası tespiti kullanarak dakikadaki atım sayısını (BPM) hesaplar. <span className="font-bold">Bu işlemde YAPAY ZEKA veya MAKİNE ÖĞRENMESİ kullanılmaz</span> — tamamen klasik matematiksel sinyal işleme yöntemleridir.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Mic2 className="w-4 h-4 text-sage-500 shrink-0 mt-1" />
              <p className="text-xs md:text-sm text-sage-700 leading-relaxed">
                <span className="font-bold">Ses Analizi:</span> Kısa bir konuşma kaydından üç temel akustik özellik çıkarılır: <span className="font-semibold">ses perdesi</span> (oto-korelasyon yöntemiyle temel frekans tahmini), <span className="font-semibold">duraklamalar</span> (genlik eşiği tabanlı sessizlik tespiti) ve <span className="font-semibold">konuşma hızı</span> (birim zamandaki sesli segment sayısı). Burada da herhangi bir yapay zeka modeli değil, saf dijital sinyal işleme (DSP) matematiği kullanılır.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Section 2: What we DON'T measure */}
        <motion.div
          variants={itemVariants}
          className="bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-5 md:p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-sage-900">Ne Ölçmüyoruz?</h3>
          </div>

          <ul className="space-y-2.5 pl-1">
            {[
              "Yalan söyleyip söylemediğinizi veya dürüstlüğünüzü ASLA tespit etmez.",
              "Kaygı, depresyon veya herhangi bir tıbbi/psikolojik durumu teşhis etmez.",
              "Bilimsel geçerliliği zaten tartışmalı olan bir poligrafın (yalan makinesi) yerini tutmaz ve tıbbi bir cihaz değildir.",
              "Yüz ifadesi veya duygu tanıma yapay zekası KULLANMAZ.",
              "Konuştuğunuz kelimelerin anlamını veya içeriğini analiz etmez — sadece sesin akustik özelliklerine (perde, zamanlama) bakar.",
            ].map((text, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs md:text-sm text-sage-700 leading-relaxed">
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Section 3: Scientific Limitations */}
        <motion.div
          variants={itemVariants}
          className="bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-5 md:p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-sage-900">Bilimsel Sınırlamalar</h3>
          </div>

          <div className="space-y-3 pl-1 text-xs md:text-sm text-sage-700 leading-relaxed">
            <p>
              <span className="font-bold">1. Kamera Ölçümü Hassasiyeti:</span> rPPG yönteminin doğruluğu; el hareketi, ortam ışığı, cilt tonu ve parmağın kameraya bastırılma şekli gibi faktörlerden ciddi şekilde etkilenir. Telefon kameraları klinik ölçüm cihazları değildir — BPM sonuçlarını kaba bir tahmin olarak değerlendirin, tıbbi düzeyde kesin bir ölçüm olarak değil.
            </p>
            <p>
              <span className="font-bold">2. Ses Analizi Değişkenleri:</span> Ses perdeniz ve konuşma hızınız; arka plan gürültüsü, mikrofon kalitesi, o anki konuşma tarzınız, oda akustiği ve söylediğiniz şeyin içeriği gibi sayısız alakasız faktörden etkilenebilir.
            </p>
            <p>
              <span className="font-bold">3. "Aktivasyon" Ne Anlama Gelir?:</span> Kalp atış hızı ve ses değişimleri, psikofizyolojide "uyarılma" (arousal) olarak bilinen genel ve spesifik olmayan bir yapının göstergeleridir. Bu sinyal; heyecan, stres, fiziksel aktivite, kafein, sıcaklık veya hastalık gibi birbirinden tamamen farklı onlarca duruma karşılık verebilir. Onlarca yıllık bilimsel araştırma (örneğin poligraf geçerliliği üzerine yapılan çalışmalar), uyarılma sinyallerinin yalanı doğrudan ayırt edemeyeceğini veya belirli bir duyguyu kesin olarak işaret edemeyeceğini açıkça göstermektedir.
            </p>
            <p>
              <span className="font-bold">4. Tek Ölçümün Sınırlı Anlamı:</span> Kişisel bir referans (bazal seviye) olmadan yapılan tek seferlik bir ölçümün bireysel anlamı sınırlıdır. Geçmiş/Trend özelliğimiz, tek bir sonucu aşırı yorumlamak yerine zaman içindeki kişisel örüntülerinizi görebilmeniz için tasarlanmıştır.
            </p>
          </div>
        </motion.div>

        {/* Section 4: Privacy */}
        <motion.div
          variants={itemVariants}
          className="bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-5 md:p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-sage-900">Gizlilik</h3>
          </div>
          <div className="space-y-2 pl-1 text-xs md:text-sm text-sage-700 leading-relaxed">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
              <p>Kamera görüntüsü ve ses kaydınız hiçbir zaman cihazınızdan dışarı gönderilmez; tüm analiz tarayıcınızda, yerel olarak yapılır.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
              <p>Ölçüm geçmişiniz yalnızca kendi cihazınızın tarayıcı belleğinde (localStorage) saklanır; herhangi bir sunucuya kaydedilmez.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
              <p>"Yapay Zeka Yorumu Ekle" özelliği tamamen isteğe bağlıdır (varsayılan kapalı); yalnızca siz butona bastığınızda devreye girer ve yalnızca yuvarlanmış/özetlenmiş sayısal değerleri gönderir — ham ses veya görüntü verisi ASLA gönderilmez.</p>
            </div>
          </div>
        </motion.div>

        {/* Section 5: Professional Help */}
        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-br from-sage-50 to-amber-50/40 border border-sage-100 rounded-3xl p-5 md:p-6 shadow-sm space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-sage-600 shrink-0 shadow-sm">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-sage-900">Ne Zaman Profesyonel Yardım Almalısınız?</h3>
          </div>
          <p className="text-xs md:text-sm text-sage-700 leading-relaxed pl-1">
            Bu uygulamanın gösterdiği sonuçtan bağımsız olarak, eğer sürekli bir kaygı, stres veya duygusal zorluk yaşıyorsanız; lisanslı bir ruh sağlığı uzmanına veya doktorunuza danışmak her zaman atılabilecek en doğru adımdır. Bu araç, hiçbir şekilde profesyonel desteğin yerini tutmaz; sadece anlık bir farkındalık molası sunar.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
