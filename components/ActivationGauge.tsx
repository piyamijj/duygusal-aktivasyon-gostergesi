"use client";

import React, { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { levelToColor, ActivationLevel } from "@/lib/activationLevel";
import HeartbeatLine from "./HeartbeatLine";

interface ActivationGaugeProps {
  level: ActivationLevel;
  score: number; // 0-100, used only for positioning the indicator dot
  animate?: boolean;
  description?: string;
}

export default function ActivationGauge({
  level,
  score,
  animate = true,
  description,
}: ActivationGaugeProps) {
  const colors = levelToColor(level);
  const [isMounted, setIsMounted] = useState(false);

  // Spring animation for the score position (0 to 100)
  const springValue = useSpring(0, {
    stiffness: 45,
    damping: 20,
    mass: 1,
  });

  useEffect(() => {
    setIsMounted(true);
    if (animate) {
      // Small delay before starting the gauge sweep for premium feel
      const timer = setTimeout(() => {
        springValue.set(score);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      springValue.set(score);
    }
  }, [score, animate, springValue]);

  // SVG Arc parameters (semi-circle from -180deg to 0deg)
  const radius = 90;
  const strokeWidth = 12;
  const cx = 120;
  const cy = 110;
  const circumference = Math.PI * radius; // Semi-circle length

  // Map 0-100 score to stroke-dashoffset (from full circumference to 0)
  const strokeDashoffset = useTransform(springValue, [0, 100], [circumference, 0]);

  // Map 0-100 score to rotation angle for the indicator dot (-90deg to 90deg)
  const angle = useTransform(springValue, [0, 100], [-90, 90]);

  // Calculate indicator dot coordinates based on angle
  const [dotCoords, setDotCoords] = useState({ x: cx - radius, y: cy });

  useEffect(() => {
    return angle.onChange((latestAngle) => {
      const rad = (latestAngle * Math.PI) / 180;
      const x = cx + radius * Math.sin(rad);
      const y = cy - radius * Math.cos(rad);
      setDotCoords({ x, y });
    });
  }, [angle, cx, cy, radius]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-6 bg-white/60 backdrop-blur-md rounded-3xl border border-white/40 shadow-sm">
      {/* Gauge Visual Area */}
      <div className="relative w-64 h-44 flex items-center justify-center overflow-hidden">
        {/* Soft breathing background glow matching the level color */}
        <div
          className="absolute w-40 h-40 rounded-full blur-3xl opacity-20 animate-breathe transition-colors duration-1000"
          style={{ backgroundColor: colors.primary }}
        />

        <svg viewBox="0 0 240 140" className="w-full h-full z-10">
          <defs>
            {/* Smooth gradient across the arc: Sage -> Amber -> Terracotta */}
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#436656" /> {/* Sage (Low) */}
              <stop offset="50%" stopColor="#d97706" /> {/* Amber (Medium) */}
              <stop offset="100%" stopColor="#c2622c" /> {/* Terracotta (High) */}
            </linearGradient>

            {/* Soft shadow for the indicator dot */}
            <filter id="dotShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={colors.primary} floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Background Track (Light grey/sage) */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#e5ece8"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Animated Colored Gauge Arc */}
          {isMounted && (
            <motion.path
              d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: strokeDashoffset,
              }}
            />
          )}

          {/* Animated Indicator Dot */}
          {isMounted && (
            <motion.circle
              cx={dotCoords.x}
              cy={dotCoords.y}
              r="9"
              fill="#ffffff"
              stroke={colors.primary}
              strokeWidth="4"
              filter="url(#dotShadow)"
              className="transition-colors duration-500"
            />
          )}
        </svg>

        {/* Center Text Area */}
        <div className="absolute bottom-2 flex flex-col items-center text-center z-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <span
              className="text-2xl font-bold tracking-tight transition-colors duration-500"
              style={{ color: colors.primary }}
            >
              {colors.label}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Heartbeat Line Motif */}
      <div className="w-full px-8 -mt-2 mb-4">
        <HeartbeatLine color={colors.primary} height={40} animated={level !== "dusuk"} />
      </div>

      {/* Qualitative Description */}
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-sm text-center text-sage-700 leading-relaxed px-4 border-t border-sage-100 pt-4"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}