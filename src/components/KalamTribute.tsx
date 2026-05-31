import React, { useState } from 'react';
import { KALAM_QUOTES } from '../data';
import { Quote, Sparkles, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function KalamTribute() {
  const [quoteIndex, setQuoteIndex] = useState(0);

  const currentQuoteObj = KALAM_QUOTES[quoteIndex];

  const handleNextQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % KALAM_QUOTES.length);
  };

  return (
    <div className="relative mt-8 overflow-hidden rounded-sm border border-[#1e293b] bg-[#050a14] p-6 md:p-8 shadow-2xl">
      {/* Precision design sub-lighting gradient blueprint shadow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-start lg:gap-8">
        {/* Kalam Avatar in circular picture lens */}
        <div className="flex-shrink-0 relative">
          <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-[#ff9933] via-white to-[#138808] opacity-50 blur-xs" />
          <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full bg-slate-900 flex items-center justify-center border-2 border-[#1e293b] shadow-2xl overflow-hidden">
            <div className="flex flex-col items-center">
              <span className="text-4xl md:text-5xl select-none">👨‍🔬</span>
              <span className="text-[10px] font-mono tracking-widest text-[#00f3ff] font-extrabold mt-1">ISRO</span>
            </div>
          </div>
          {/* Scientific badge indicator */}
          <div className="absolute -bottom-2 -right-1 p-1 bg-[#ff9933] text-slate-950 rounded-full border border-[#1e293b] shadow-md">
            <Award className="w-4 h-4 text-black" />
          </div>
        </div>

        {/* Tribute Details */}
        <div className="flex-1 text-center md:text-left flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#ff9933] uppercase">INSPIRATIONAL TRIBUTE</span>
              <span className="h-4 w-[1px] bg-[#1e293b] hidden sm:block" />
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-[#00f3ff]/10 text-[#00f3ff] rounded-sm border border-[#00f3ff]/20">THE MISSILE MAN</span>
            </div>
            
            <h3 className="text-xl font-extrabold mt-2 text-white tracking-wide font-display">
              डॉ. एपीजे अब्दुल कलाम (Dr. APJ Abdul Kalam)
            </h3>
            
            <p className="mt-3 text-[#94a3b8] leading-relaxed text-sm md:text-base">
              Dr. Kalam guided India into the space age as the Project Director of India's first home-grown Satellite Launch Vehicle (<strong>SLV-3</strong>). 
              His pioneering leadership subsequently steered legendary aerospace programs (Agni and Prithvi), establishing robust defensive capability while dedicating his life to cultivating science and dreams among Indian students.
            </p>
          </div>

          {/* Interactive Quotes Engine */}
          <div className="mt-6 border-t border-[#1e293b] pt-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-mono font-bold text-[#64748b] flex items-center gap-1.5 uppercase">
                <Quote className="w-3.5 h-3.5 text-[#00f3ff]" /> State Wisdom Capsule
              </span>
              <button
                onClick={handleNextQuote}
                className="cursor-pointer text-xs font-semibold text-[#00f3ff] hover:text-[#ff9933] flex items-center gap-1 bg-[#0f172a] hover:bg-[#1e293b] px-3 py-1.5 rounded-sm border border-[#334155] hover:border-[#00f3ff]/30 transition-all duration-200 uppercase font-mono tracking-wider text-[11px]"
              >
                <Sparkles className="w-3 h-3 text-[#ff9933]" />
                <span>Next Quote</span>
              </button>
            </div>

            {/* Quotation screen with fade transition */}
            <div className="min-h-[105px] bg-[#0f172a] border-l-2 border-[#00f3ff] rounded-sm p-4 relative overflow-hidden">
              <div className="absolute top-2 right-3 opacity-[0.03] pointer-events-none">
                <Quote className="w-20 h-20 text-white" />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={quoteIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-2.5"
                >
                  <p className="text-[#00f3ff] font-medium italic text-sm md:text-base leading-relaxed">
                    "{currentQuoteObj.quote}"
                  </p>
                  <p className="text-[#ff9933] font-semibold text-xs md:text-sm font-sans">
                     "{currentQuoteObj.hindiQuote}"
                  </p>
                  <div className="text-[10px] text-slate-500 font-mono tracking-wide uppercase mt-1">
                    Context: {currentQuoteObj.context}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
