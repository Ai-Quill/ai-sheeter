import React from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

export const PricingSection: React.FC = () => {
  return (
    <section id="pricing" className="py-24 px-4 bg-[#F5F7FA]">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 md:mb-16 px-4">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#023047] mb-3 md:mb-4">Simple, transparent pricing</h2>
                <p className="text-gray-500 text-sm sm:text-base">Start with free AI credits — no API keys needed. Upgrade for unlimited power.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 md:gap-8 justify-center items-stretch max-w-5xl mx-auto">
                {/* Free Plan */}
                <motion.div 
                    whileHover={{ y: -10 }}
                    className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 w-full lg:w-96 flex flex-col"
                >
                    <div className="mb-8">
                        <span className="text-[#219EBB] font-bold text-sm tracking-widest uppercase">Starter</span>
                        <h3 className="font-serif text-4xl text-[#023047] mt-4 mb-2">$0</h3>
                        <p className="text-gray-400 text-sm">Forever free. No credit card needed.</p>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                        {[
                            { text: "50 Free AI queries/month", highlight: true },
                            { text: "No API key setup needed" },
                            { text: "GPT-5 Mini, Gemini 2.5 Flash, Claude Haiku" },
                            { text: "300 BYOK queries / month" },
                            { text: "50 Bulk rows / job" },
                            { text: "Agent Mode + All 10 Skills" },
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                                <div className={`p-1 rounded-full ${item.highlight ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                                    {item.highlight ? <Sparkles size={12} /> : <Check size={12} />}
                                </div>
                                <span className={item.highlight ? 'font-medium text-green-700' : ''}>
                                    {item.text}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <a 
                        href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition text-center block"
                    >
                        Get Started Free
                    </a>
                </motion.div>

                {/* Pro Plan */}
                <motion.div 
                    whileHover={{ y: -10 }}
                    className="bg-[#023047] p-6 sm:p-8 rounded-3xl shadow-xl w-full lg:w-96 flex flex-col relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4">
                        <span className="bg-[#FFB701] text-[#023047] text-xs font-bold px-3 py-1 rounded-full">RECOMMENDED</span>
                    </div>
                    
                    <div className="mb-8">
                        <span className="text-[#8ECAE6] font-bold text-sm tracking-widest uppercase">Pro</span>
                        <h3 className="font-serif text-4xl text-white mt-4 mb-2">$14.99<span className="text-lg text-white/50 font-sans font-normal">/mo</span></h3>
                        <p className="text-white/60 text-sm">Unlimited power. Premium AI included.</p>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                        {[
                            { text: "$4.99/mo managed AI credits included", highlight: true },
                            { text: "GPT-5, Claude Sonnet 4.5, Gemini 2.5 Pro" },
                            { text: "Unlimited BYOK queries" },
                            { text: "1,000 Bulk rows / job" },
                            { text: "Persistent conversation memory" },
                            { text: "Priority support" },
                            { text: "Early access to new features" },
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-white/90">
                                <div className={`p-1 rounded-full ${item.highlight ? 'bg-[#FFB701] text-[#023047]' : 'bg-[#219EBB] text-white'}`}>
                                    {item.highlight ? <Sparkles size={12} /> : <Check size={12} />}
                                </div>
                                <span className={item.highlight ? 'font-medium text-[#FFB701]' : ''}>
                                    {item.text}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <a 
                        href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#219EBB] to-[#8ECAE6] text-white font-medium hover:opacity-90 transition shadow-lg text-center block"
                    >
                        Subscribe Now
                    </a>
                </motion.div>
            </div>

            {/* BYOK note */}
            <p className="text-center text-gray-400 text-xs mt-8">
                All plans support Bring Your Own Keys (BYOK) — use your own API keys for unlimited access at your own cost.
            </p>
        </div>
    </section>
  );
};
