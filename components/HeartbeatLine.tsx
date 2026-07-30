"use client";

import React from "react";
import { motion } from "framer-motion";

interface HeartbeatLineProps {
  color?: string; // Hex or Tailwind color class
  className?: string;
  animated?: boolean;
  height?: number;
}

export default function HeartbeatLine({
  color = "#58816f", // Default sage-500
  className = "",
  animated = true,
  height = 60,
}: HeartbeatLineProps) {
  // A gentle, organic heartbeat path: flat start, soft wave, one gentle heartbeat spike, flat end
  const pathDefinition = "M 0 30 Q 30 30 50 30 T 70 30 Q 85 15 95 45 T 105 30 Q 120 30 140 5 T 155 55 T 165 30 Q 185 30 215 30 T 250 30 Q 280 30 300 30";

  const pathVariants = {
    hidden: { pathLength: 0, opacity: 0.3 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: {
          duration: 3,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "loop" as const,
        },
        opacity: {
          duration: 1.5,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse" as const,
        },
      },
    },
  };

  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ height }}>
      <svg
        viewBox="0 0 300 60"
        className="w-full h-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="heartbeatGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Soft glowing area under the path */}
        <path
          d={`${pathDefinition} L 300 60 L 0 60 Z`}
          fill="url(#heartbeatGlow)"
          className="transition-all duration-500"
        />

        {/* Background static line for depth */}
        <path
          d={pathDefinition}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity="0.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Animated foreground line */}
        {animated ? (
          <motion.path
            d={pathDefinition}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={pathVariants}
            initial="hidden"
            animate="visible"
            className="transition-all duration-500"
            style={{
              filter: `drop-shadow(0px 0px 3px ${color}40)`,
            }}
          />
        ) : (
          <path
            d={pathDefinition}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-500"
            style={{
              opacity: 0.8,
              filter: `drop-shadow(0px 0px 2px ${color}30)`,
            }}
          />
        )}
      </svg>
    </div>
  );
}