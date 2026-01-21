'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles, Zap, MessageSquare } from 'lucide-react';

interface Alternative {
  id: string;
  name: string;
  logo: string;
  question: string;
  reasons: {
    issue: string;
    detail: string;
  }[];
  aisheeterAdvantage: string;
}

const alternatives: Alternative[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    logo: '🔮',
    question: "Why not just use Google Gemini?",
    reasons: [
      {
        issue: "Forgets context between queries",
        detail: "Every question starts fresh. Ask about column B, then column C—Gemini doesn't remember what you discussed."
      },
      {
        issue: "No multi-step task chains",
        detail: "Can't say 'Extract, then score, then recommend actions.' You have to manually run each step."
      },
      {
        issue: "No custom output formats",
        detail: "Can't specify 'Output as Hot/Warm/Cold' or 'Return as JSON'. You get what you get."
      },
      {
        issue: "No conversation history",
        detail: "Close the sidebar? Your context is gone. No way to resume where you left off."
      }
    ],
    aisheeterAdvantage: "AISheeter remembers your conversation, chains multiple steps automatically, and lets you control exactly how results appear."
  },
  {
    id: 'gptforwork',
    name: 'GPT for Work',
    logo: '⚡',
    question: "Why not use GPT for Work?",
    reasons: [
      {
        issue: "Column-based, not conversational",
        detail: "Write formulas in cells, not natural conversations. =GPT(A1, 'prompt') isn't the same as 'analyze my sales data'."
      },
      {
        issue: "No proactive suggestions",
        detail: "It waits for your command. AISheeter notices patterns and suggests what you might want to do next."
      },
      {
        issue: "No formula-first intelligence",
        detail: "Uses AI for everything. AISheeter knows when a simple COUNTIF is better than burning API credits."
      },
      {
        issue: "Complex UI for power users",
        detail: "Great for bulk operations, overwhelming for 'just help me with this data' tasks."
      }
    ],
    aisheeterAdvantage: "AISheeter gives you the simplicity of conversation with the power of bulk processing when you need it."
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    logo: '💬',
    question: "Why not just use ChatGPT?",
    reasons: [
      {
        issue: "Not native to Sheets",
        detail: "Copy data out, paste into ChatGPT, copy results back. Every. Single. Time."
      },
      {
        issue: "No background processing",
        detail: "Processing 500 rows? You're watching ChatGPT for 20 minutes. Can't close that tab."
      },
      {
        issue: "Can't write to cells",
        detail: "Results are in ChatGPT, not your spreadsheet. Manual copy-paste is your new job."
      },
      {
        issue: "No spreadsheet context",
        detail: "Doesn't know your column headers, data types, or patterns. You explain everything every time."
      }
    ],
    aisheeterAdvantage: "AISheeter lives in your spreadsheet, understands your data, and writes results directly to cells."
  }
];

const AlternativeCard: React.FC<{ alt: Alternative; isExpanded: boolean; onToggle: () => void }> = ({
  alt,
  isExpanded,
  onToggle
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`bg-white rounded-3xl border-2 overflow-hidden transition-all duration-300 hover-lift ${
        isExpanded ? 'border-[#209EBB]/30 shadow-xl shadow-[#209EBB]/10' : 'border-gray-100 shadow-lg shadow-gray-200/50'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="text-4xl">{alt.logo}</span>
          <span className="font-serif text-xl text-[#023047]">{alt.question}</span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            isExpanded ? 'bg-[#209EBB]/10' : 'bg-gray-100'
          }`}
        >
          <ChevronDown size={20} className={isExpanded ? 'text-[#209EBB]' : 'text-gray-400'} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                {alt.reasons.map((reason, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-5 border border-red-100"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-red-500 text-sm font-bold">✕</span>
                      </div>
                      <div>
                        <div className="font-semibold text-red-800">{reason.issue}</div>
                        <div className="text-sm text-red-600/80 mt-1 leading-relaxed">{reason.detail}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border-2 border-emerald-200"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-green-200">
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-800 mb-1 text-lg">AISheeter Advantage</div>
                    <div className="text-emerald-700 leading-relaxed">{alt.aisheeterAdvantage}</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const WhyNotSection: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>('gemini');

  return (
    <section className="py-28 px-4 bg-gradient-to-b from-white via-gray-50/30 to-white relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 dot-pattern opacity-30" />
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-[#8ECAE6]/10 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/3 right-0 w-72 h-72 bg-[#FC8500]/10 rounded-full blur-3xl" />
      
      <div className="max-w-4xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <motion.span 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="inline-block px-4 py-1.5 bg-[#023047]/5 text-[#023047] text-sm font-medium rounded-full mb-6"
          >
            Common Questions
          </motion.span>
          <h2 className="font-serif text-4xl md:text-5xl text-[#023047] mb-6 tracking-tight">
            &quot;Why not just use...&quot;
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg leading-relaxed">
            Great question. Here&apos;s why teams choose AISheeter over alternatives.
          </p>
        </motion.div>

        <div className="space-y-4">
          {alternatives.map((alt) => (
            <AlternativeCard
              key={alt.id}
              alt={alt}
              isExpanded={expandedId === alt.id}
              onToggle={() => setExpandedId(expandedId === alt.id ? null : alt.id)}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-14 text-center"
        >
          <div className="inline-flex flex-col items-center gap-5 bg-gradient-to-br from-[#023047] via-[#034a6e] to-[#023047] text-white p-10 rounded-3xl shadow-2xl shadow-[#023047]/30 relative overflow-hidden">
            {/* Decorative glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFB701]/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#209EBB]/20 rounded-full blur-3xl" />
            
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <MessageSquare size={36} className="text-[#FFB701]" />
            </motion.div>
            <h3 className="font-serif text-2xl md:text-3xl relative">Ready to see the difference?</h3>
            <p className="text-white/70 max-w-md leading-relaxed relative">
              Try AISheeter free. No credit card required. 
              See why teams switch from Gemini, GPT for Work, and ChatGPT.
            </p>
            <motion.a 
              href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-[#FFB701] to-[#FC8500] text-[#023047] px-10 py-4 rounded-2xl font-bold hover:shadow-xl hover:shadow-[#FFB701]/30 transition-all mt-2 flex items-center gap-2 shimmer-btn relative"
            >
              <Zap size={20} />
              Start Free Trial
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
