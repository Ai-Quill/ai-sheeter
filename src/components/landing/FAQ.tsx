'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "Do I need my own API keys?",
    answer: "Yes. To keep our costs low and your privacy high, AISheeter uses a 'Bring Your Own Key' (BYOK) model. You plug in your keys from OpenAI, Anthropic, or Google, and you pay them directly for usage. This is often 10x cheaper than markup services."
  },
  {
    question: "Is there a free plan?",
    answer: "Absolutely. The Starter plan is free forever and includes 300 queries per month and full access to Agent Mode. You just need your own API keys."
  },
  {
    question: "Is my data secure?",
    answer: "Security is our priority. Your API keys are encrypted using AES-256 before being stored. Your spreadsheet data is sent directly to the AI providers (OpenAI/Google/Anthropic) via our secure proxy and is never stored on our servers."
  },
  {
    question: "Does it work on large datasets?",
    answer: "Yes. Our Bulk Processing feature is designed specifically for this. It can handle jobs with thousands of rows, running in the background even if you close the sidebar. We notify you when it's done."
  },
  {
    question: "Can I switch between AI models?",
    answer: "Instantly. You can use different formulas like =Claude() or =Gemini() in the same sheet, or toggle the model dropdown in the Agent sidebar to switch the 'brain' behind your automation."
  }
];

export const FAQ: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <section className="py-24 px-4 bg-white border-t border-gray-100">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12 md:mb-16 px-4">
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#023047] mb-3 md:mb-4">Frequently Asked Questions</h2>
          <p className="text-gray-500 text-sm sm:text-base">Everything you need to know about AISheeter.</p>
        </div>

        <div className="space-y-3 md:space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className="border border-gray-200 rounded-2xl overflow-hidden bg-[#FAFAFA] hover:border-[#219EBB]/50 transition-colors"
            >
              <button
                onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                className="w-full px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4 text-left focus:outline-none"
              >
                <span className="font-semibold text-sm sm:text-base text-[#023047]">{faq.question}</span>
                <motion.div
                  animate={{ rotate: activeIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="text-gray-400" size={20} />
                </motion.div>
              </button>

              <AnimatePresence>
                {activeIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 text-gray-600 text-sm leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
