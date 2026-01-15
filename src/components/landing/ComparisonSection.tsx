/**
 * @file ComparisonSection.tsx
 * @version 1.0.0
 * @updated 2026-01-15
 * 
 * Comparison table: AISheeter vs competitors
 * Highlights intelligent agent advantages
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

const FEATURES = [
  {
    feature: "Context Persistence",
    description: "Remembers your conversation across sessions",
    aisheeter: "full",
    gemini: "none",
    gptforwork: "none"
  },
  {
    feature: "Multi-Step Tasks",
    description: "Chain commands: 'Classify, then summarize'",
    aisheeter: "full",
    gemini: "none",
    gptforwork: "none"
  },
  {
    feature: "Proactive Suggestions",
    description: "Analyzes data and suggests actions",
    aisheeter: "full",
    gemini: "partial",
    gptforwork: "none"
  },
  {
    feature: "Native Formulas",
    description: "=ChatGPT(), =Claude(), =Gemini()",
    aisheeter: "full",
    gemini: "none",
    gptforwork: "full"
  },
  {
    feature: "Bring Your Own Key",
    description: "Use your API keys, pay directly",
    aisheeter: "full",
    gemini: "none",
    gptforwork: "partial"
  },
  {
    feature: "Multi-Model Choice",
    description: "GPT-4, Claude, Gemini, Groq",
    aisheeter: "full",
    gemini: "none",
    gptforwork: "partial"
  },
  {
    feature: "Background Bulk Jobs",
    description: "Process 1000s of rows without freezing",
    aisheeter: "full",
    gemini: "none",
    gptforwork: "full"
  },
  {
    feature: "Natural Conversation",
    description: "Chat in plain English, not just commands",
    aisheeter: "full",
    gemini: "partial",
    gptforwork: "none"
  }
];

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'full') {
    return <Check className="w-5 h-5 text-green-500" />;
  } else if (status === 'partial') {
    return <Minus className="w-5 h-5 text-amber-500" />;
  }
  return <X className="w-5 h-5 text-red-400" />;
};

export const ComparisonSection: React.FC = () => {
  return (
    <section className="py-24 px-4 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h2 className="font-serif text-4xl md:text-5xl text-[#023047] mb-4">
          Unlike Gemini, we don't <br />
          <span className="italic text-[#FFB701]">forget</span> what you're working on.
        </h2>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Most AI tools reset with every interaction. AISheeter builds understanding over time.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="overflow-x-auto"
      >
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid grid-cols-4 gap-4 mb-4 px-4">
            <div className="text-left">
              <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Feature</span>
            </div>
            <div className="text-center">
              <div className="inline-flex flex-col items-center">
                <span className="text-sm font-bold text-[#023047]">AISheeter</span>
                <span className="text-[10px] text-green-600 font-semibold">SMART AGENT</span>
              </div>
            </div>
            <div className="text-center">
              <div className="inline-flex flex-col items-center">
                <span className="text-sm font-bold text-gray-500">Google Gemini</span>
                <span className="text-[10px] text-gray-400">Built-in</span>
              </div>
            </div>
            <div className="text-center">
              <div className="inline-flex flex-col items-center">
                <span className="text-sm font-bold text-gray-500">GPT for Work</span>
                <span className="text-[10px] text-gray-400">Add-on</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            {FEATURES.map((item, idx) => (
              <motion.div
                key={item.feature}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="grid grid-cols-4 gap-4 items-center px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <div className="font-medium text-gray-800 text-sm">{item.feature}</div>
                  <div className="text-[11px] text-gray-400">{item.description}</div>
                </div>
                <div className="flex justify-center">
                  <div className={`p-2 rounded-full ${item.aisheeter === 'full' ? 'bg-green-50' : item.aisheeter === 'partial' ? 'bg-amber-50' : 'bg-red-50'}`}>
                    <StatusIcon status={item.aisheeter} />
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className={`p-2 rounded-full ${item.gemini === 'full' ? 'bg-green-50' : item.gemini === 'partial' ? 'bg-amber-50' : 'bg-gray-50'}`}>
                    <StatusIcon status={item.gemini} />
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className={`p-2 rounded-full ${item.gptforwork === 'full' ? 'bg-green-50' : item.gptforwork === 'partial' ? 'bg-amber-50' : 'bg-gray-50'}`}>
                    <StatusIcon status={item.gptforwork} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Bottom CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-center mt-12"
      >
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-sm text-gray-700">
            <strong className="text-green-700">AISheeter</strong> is the only tool with intelligent context persistence
          </span>
        </div>
      </motion.div>
    </section>
  );
};
