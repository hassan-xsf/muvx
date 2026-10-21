"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface OrbitBorderButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  cometColor?: string;
  borderColor?: string;
  fill?: string;
  speed?: number; // seconds per rotation
  className?: string;
}

export function OrbitBorderButton({
  children,
  cometColor = "#d9622b",
  borderColor = "rgba(22, 24, 29, 0.22)",
  fill = "#16181d",
  speed = 3.5,
  className,
  ...props
}: OrbitBorderButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      {...props}
      onMouseEnter={(e) => {
        setIsHovered(true);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        props.onMouseLeave?.(e);
      }}
      className={cn(
        "group relative inline-flex items-center justify-center rounded-full p-[1.5px] font-geist text-base font-medium text-[#f5f2ec] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9622b]/50 overflow-hidden",
        className
      )}
      style={{
        backgroundColor: borderColor,
        ...props.style,
      }}
    >
      {/* Comet orbit border mask */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-full"
        style={{
          WebkitMaskImage:
            "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
          WebkitMaskClip: "border-box, content-box",
          WebkitMaskComposite: "xor",
          maskImage: "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
          maskClip: "border-box, content-box",
          maskComposite: "exclude",
          padding: "1.5px",
        }}
      >
        {/* Rotating blurred comet glow */}
        <span
          className="absolute -inset-[200%] animate-spin blur-[3px]"
          style={{
            animationDuration: `${speed}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            background: isHovered
              ? `conic-gradient(from 0deg, transparent 0deg, ${cometColor} 180deg, transparent 270deg)`
              : `conic-gradient(from 0deg, transparent 0deg, ${cometColor} 65deg, transparent 100deg)`,
            transition: "background 0.4s ease",
          }}
        />
        {/* Rotating crisp comet arc */}
        <span
          className="absolute -inset-[200%] animate-spin"
          style={{
            animationDuration: `${speed}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            background: isHovered
              ? `conic-gradient(from 0deg, transparent 0deg, ${cometColor} 180deg, transparent 270deg)`
              : `conic-gradient(from 0deg, transparent 0deg, ${cometColor} 65deg, transparent 100deg)`,
            transition: "background 0.4s ease",
          }}
        />
      </span>

      {/* Button inner content */}
      <span
        className="relative z-10 flex h-full w-full items-center justify-center gap-2 rounded-full px-7 py-4 font-geist text-base font-medium text-[#f5f2ec] transition-colors duration-200"
        style={{ backgroundColor: fill }}
      >
        {children}
      </span>
    </button>
  );
}

export default OrbitBorderButton;
