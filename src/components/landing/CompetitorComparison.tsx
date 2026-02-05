'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

interface FeatureRow {
  feature: string;
  description: string;
  aisheeter: 'yes' | 'no' | 'partial';
  gemini: 'yes' | 'no' | 'partial';
  gptForWork: 'yes' | 'no' | 'partial';
  chatgpt: 'yes' | 'no' | 'partial';
}

const features: FeatureRow[] = [
  {
    feature: "Conversation Memory",
    description: "Remember context across queries - pick up where you left off",
    aisheeter: 'yes',
    gemini: 'no',
    gptForWork: 'no',
    chatgpt: 'partial'
  },
  {
    feature: "Deep Context Awareness",
    description: "Understands headers, data types, and structure automatically",
    aisheeter: 'yes',
    gemini: 'partial',
    gptForWork: 'partial',
    chatgpt: 'no'
  },
  {
    feature: "Multi-Step Task Chains",
    description: "Execute complex workflows with one command",
    aisheeter: 'yes',
    gemini: 'no',
    gptForWork: 'no',
    chatgpt: 'no'
  },
  {
    feature: "Smart Suggestions",
    description: "AI that thinks ahead and recommends next steps",
    aisheeter: 'yes',
    gemini: 'no',
    gptForWork: 'no',
    chatgpt: 'no'
  },
  {
    feature: "Formula First (FREE)",
    description: "Uses native formulas when faster & cheaper - no AI cost",
    aisheeter: 'yes',
    gemini: 'no',
    gptForWork: 'no',
    chatgpt: 'no'
  },
  {
    feature: "10 Specialized Skills",
    description: "Format, chart, formula, filter, validation & more",
    aisheeter: 'yes',
    gemini: 'partial',
    gptForWork: 'partial',
    chatgpt: 'no'
  },
  {
    feature: "Multi-Model Support (BYOK)",
    description: "Use GPT, Claude, Gemini, Groq with your API key",
    aisheeter: 'yes',
    gemini: 'no',
    gptForWork: 'yes',
    chatgpt: 'no'
  },
  {
    feature: "Instant Sheet Actions",
    description: "Format, chart, sort, filter - executes in milliseconds",
    aisheeter: 'yes',
    gemini: 'partial',
    gptForWork: 'partial',
    chatgpt: 'no'
  },
  {
    feature: "Native Google Sheets",
    description: "Works directly in your spreadsheet",
    aisheeter: 'yes',
    gemini: 'yes',
    gptForWork: 'yes',
    chatgpt: 'no'
  },
  {
    feature: "Bulk Processing (10k+ rows)",
    description: "Process large datasets efficiently",
    aisheeter: 'yes',
    gemini: 'partial',
    gptForWork: 'yes',
    chatgpt: 'no'
  }
];

const StatusIcon: React.FC<{ status: 'yes' | 'no' | 'partial' }> = ({ status }) => {
  if (status === 'yes') {
    return (
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-md shadow-green-200">
        <Check size={16} className="text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === 'partial') {
    return (
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-300 to-yellow-400 flex items-center justify-center shadow-md shadow-yellow-200">
        <Minus size={16} className="text-white" strokeWidth={3} />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
      <X size={16} className="text-gray-300" strokeWidth={3} />
    </div>
  );
};

export const CompetitorComparison: React.FC = () => {
  return (
    <section className="py-28 px-4 bg-gradient-to-b from-gray-50/80 via-white to-gray-50/50 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-[#209EBB]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#FC8500]/5 rounded-full blur-3xl" />
      
      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.span 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="inline-block px-4 py-1.5 bg-[#FC8500]/10 text-[#FC8500] text-sm font-medium rounded-full mb-6"
          >
            Competitive Edge
          </motion.span>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-[#023047] mb-4 md:mb-6 tracking-tight px-4">
            Why choose <span className="italic gradient-text">AISheeter</span>?
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-sm sm:text-base md:text-lg leading-relaxed px-4">
            The only Google Sheets AI with intelligent agent capabilities. 
            See how we compare to alternatives.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="overflow-x-auto bg-white rounded-2xl md:rounded-3xl shadow-xl shadow-gray-200/50 border-2 border-gray-100 p-0.5 md:p-1"
        >
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-white">
                <th className="text-left py-3 sm:py-4 md:py-5 px-3 sm:px-4 md:px-6 font-semibold text-gray-500 w-1/3 text-[10px] sm:text-xs md:text-sm uppercase tracking-wider">Feature</th>
                <th className="text-center py-3 sm:py-4 md:py-5 px-2 sm:px-3 md:px-4 min-w-[100px] sm:min-w-[120px]">
                  <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                    <span className="font-bold text-[#023047] text-sm sm:text-base md:text-lg">AISheeter</span>
                    <span className="text-[9px] sm:text-[10px] md:text-xs bg-gradient-to-r from-[#FC8500] to-[#FFB701] text-white px-2 sm:px-3 py-0.5 rounded-full font-semibold">You&apos;re here</span>
                  </div>
                </th>
                <th className="text-center py-3 sm:py-4 md:py-5 px-2 sm:px-3 md:px-4 min-w-[100px] sm:min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-medium text-gray-600">Google Gemini</span>
                    <span className="text-xs text-gray-400">Native</span>
                  </div>
                </th>
                <th className="text-center py-5 px-4 min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-medium text-gray-600">GPT for Work</span>
                    <span className="text-xs text-gray-400">7M+ users</span>
                  </div>
                </th>
                <th className="text-center py-5 px-4 min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-medium text-gray-600">ChatGPT</span>
                    <span className="text-xs text-gray-400">Manual</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((row, idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className={`border-t border-gray-100 transition-colors hover:bg-[#8ECAE6]/5 ${
                    idx < 5 ? 'bg-gradient-to-r from-emerald-50/40 to-transparent' : ''
                  }`}
                >
                  <td className="py-5 px-6">
                    <div className="font-semibold text-[#023047]">{row.feature}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{row.description}</div>
                  </td>
                  <td className="text-center py-5 px-4 bg-[#209EBB]/5">
                    <motion.div 
                      className="flex justify-center"
                      whileHover={{ scale: 1.1 }}
                    >
                      <StatusIcon status={row.aisheeter} />
                    </motion.div>
                  </td>
                  <td className="text-center py-5 px-4">
                    <div className="flex justify-center">
                      <StatusIcon status={row.gemini} />
                    </div>
                  </td>
                  <td className="text-center py-5 px-4">
                    <div className="flex justify-center">
                      <StatusIcon status={row.gptForWork} />
                    </div>
                  </td>
                  <td className="text-center py-5 px-4">
                    <div className="flex justify-center">
                      <StatusIcon status={row.chatgpt} />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 text-center"
        >
          <div className="inline-flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-lg border border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-sm">
                <Check size={12} className="text-white" strokeWidth={3} />
              </div>
              <span className="font-medium">Full Support</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-300 to-yellow-400 flex items-center justify-center shadow-sm">
                <Minus size={12} className="text-white" strokeWidth={3} />
              </div>
              <span className="font-medium">Partial</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                <X size={12} className="text-gray-300" strokeWidth={3} />
              </div>
              <span className="font-medium">Not Available</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
