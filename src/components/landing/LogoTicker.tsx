import React from 'react';
import { motion } from 'framer-motion';

// AI Providers we integrate with
const AI_PROVIDERS = [
  { name: "OpenAI", tag: "GPT-4o" },
  { name: "Anthropic", tag: "Claude 3.5" },
  { name: "Google", tag: "Gemini" },
  { name: "Groq", tag: "Llama 3" },
];

export const LogoTicker: React.FC = () => {
  return (
    <div className="py-10 bg-white border-b border-gray-100 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4">
            {/* Changed from misleading "Powering teams" to accurate "Powered by" */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-8">
                Powered by leading AI models
            </p>
            
            {/* Static grid instead of confusing ticker */}
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
                {AI_PROVIDERS.map((provider, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 group">
                        <span className="text-xl md:text-2xl font-serif font-bold text-gray-300 group-hover:text-[#023047] transition-colors">
                            {provider.name}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                            {provider.tag}
                        </span>
                    </div>
                ))}
            </div>
            
            {/* BYOK callout */}
            <p className="text-center text-xs text-gray-400 mt-6">
                Bring your own API keys • Pay providers directly • No markup
            </p>
        </div>
    </div>
  );
};
