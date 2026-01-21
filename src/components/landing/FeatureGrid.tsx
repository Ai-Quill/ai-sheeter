'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, MessageSquare, Shield, Workflow, Sliders, BrainCircuit, Sparkles, History } from 'lucide-react';

const features = [
  {
    title: "Multi-Step Task Chains",
    description: "One command executes multiple steps. Extract → Score → Recommend in a single conversation.",
    icon: <Workflow size={24} className="text-[#209EBB]" />,
    color: "bg-[#209EBB]",
    colSpan: "md:col-span-1",
    tag: "Unique"
  },
  {
    title: "Conversation Persistence",
    description: "Unlike Gemini, we remember context. Build on previous commands without repeating yourself.",
    icon: <History size={24} className="text-[#FC8500]" />,
    color: "bg-[#FC8500]",
    colSpan: "md:col-span-1",
    tag: "Unique"
  },
  {
    title: "Output Format Control",
    description: "Configure exactly how results appear: JSON, lists, scores with reasons, or custom formats.",
    icon: <Sliders size={24} className="text-[#8ECAE6]" />,
    color: "bg-[#8ECAE6]",
    colSpan: "md:col-span-1",
    tag: "New"
  },
  {
    title: "Formula-First Intelligence",
    description: "AI that knows when NOT to use AI. Uses native formulas when they're faster and cheaper.",
    icon: <BrainCircuit size={24} className="text-purple-500" />,
    color: "bg-purple-500",
    colSpan: "md:col-span-1"
  },
  {
    title: "Proactive Suggestions",
    description: "AI that thinks ahead. After completing a task, suggests what you might want to do next.",
    icon: <Sparkles size={24} className="text-emerald-500" />,
    color: "bg-emerald-500",
    colSpan: "md:col-span-1",
    tag: "Unique"
  },
  {
    title: "5+ AI Models (BYOK)",
    description: "Use GPT-5, Claude, Gemini, Groq, or bring your own API key. Switch models per task.",
    icon: <Zap size={24} className="text-amber-500" />,
    color: "bg-amber-500",
    colSpan: "md:col-span-1"
  },
  {
    title: "Data Security",
    description: "Your API keys, your data. No training on your content. Process locally when possible.",
    icon: <Shield size={24} className="text-[#023047]" />,
    color: "bg-[#023047]",
    colSpan: "md:col-span-2"
  },
  {
    title: "Natural Conversation",
    description: "Just describe what you want. No formulas to learn, no complex syntax to memorize.",
    icon: <MessageSquare size={24} className="text-rose-500" />,
    color: "bg-rose-500",
    colSpan: "md:col-span-1"
  }
];

export const FeatureGrid: React.FC = () => {
  return (
    <section id="features" className="py-28 px-4 max-w-7xl mx-auto relative">
        {/* Subtle background accents */}
        <div className="absolute top-20 right-0 w-96 h-96 bg-[#8ECAE6]/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-20 left-0 w-72 h-72 bg-[#FFB701]/10 rounded-full blur-3xl -z-10" />
        
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
        >
            <motion.span 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              className="inline-block px-4 py-1.5 bg-[#023047]/5 text-[#023047] text-sm font-medium rounded-full mb-6"
            >
              Agent Capabilities
            </motion.span>
            <h2 className="font-serif text-4xl md:text-5xl text-[#023047] mb-6 tracking-tight">
                Capabilities <br />
                <span className="italic gradient-text">no one else has</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg leading-relaxed">
                Beyond simple AI formulas. AISheeter is a true intelligent agent that understands, remembers, and acts.
            </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: idx * 0.08 }}
                    whileHover={{ y: -6, scale: 1.01 }}
                    className={`bg-white rounded-3xl p-7 shadow-lg shadow-gray-200/50 border-2 border-gray-100 flex flex-col justify-between hover:shadow-xl hover:border-[#209EBB]/20 transition-all duration-300 group ${feature.colSpan}`}
                >
                    <div>
                        <div className="flex items-center justify-between mb-5">
                            <div className={`w-12 h-12 rounded-2xl ${feature.color} bg-opacity-10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                {feature.icon}
                            </div>
                            {feature.tag && (
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${
                                    feature.tag === 'Unique' ? 'bg-gradient-to-r from-[#FC8500]/10 to-[#FFB701]/10 text-[#FC8500]' :
                                    feature.tag === 'New' ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                    {feature.tag}
                                </span>
                            )}
                        </div>
                        
                        <h3 className="font-serif text-xl text-[#023047] mb-3 group-hover:text-[#209EBB] transition-colors">{feature.title}</h3>
                        <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    </section>
  );
};
