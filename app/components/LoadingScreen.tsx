"use client";

import React, { useEffect, useState } from "react";

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Simulate loading progress for the visual effect
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Randomize the progress step slightly for a more organic feel
        const step = Math.floor(Math.random() * 12) + 3;
        return Math.min(prev + step, 100);
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  const totalSegments = 12;
  const activeSegments = Math.floor((progress / 100) * totalSegments);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface relative overflow-hidden">

      {/* Subtle Background Glow */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] sm:w-[40rem] sm:h-[40rem] bg-gradient-to-tr from-indigo-200/40 via-cyan-100/40 to-orange-100/40 rounded-full blur-[80px] pointer-events-none transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      ></div>

      <div className={`z-10 flex flex-col items-center justify-center transition-all duration-1000 ease-out transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

        {/* Main Brand Area */}
        <div className="flex flex-col items-center space-y-2 mb-32">
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 via-red-500 to-blue-500 drop-shadow-sm pb-2 select-none">
            Gemma
          </h1>
          <p className="text-sm sm:text-base md:text-lg font-light tracking-[0.35em] text-text-secondary opacity-70 uppercase select-none">
            Study Assistant
          </p>
        </div>

        {/* Loading Segment Bar */}
        <div className="absolute bottom-24 flex flex-col items-center space-y-4">
          <div className="flex space-x-1.5 sm:space-x-2">
            {Array.from({ length: totalSegments }).map((_, i) => {
              const isActive = i < activeSegments;
              return (
                <div
                  key={i}
                  className={`h-2 sm:h-2.5 w-6 sm:w-8 rounded-[1px] transition-all duration-300 ease-out ${isActive
                    ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] scale-y-100"
                    : "bg-divider scale-y-75 opacity-50"
                    }`}
                />
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
