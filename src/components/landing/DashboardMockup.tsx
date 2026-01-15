'use client';

import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, RotateCw, FileSpreadsheet, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Define multiple scenarios to cycle through
const SCENARIOS = [
  {
    id: 'leads',
    sheetName: 'Q1 Lead Pipeline',
    aiPrompt: "💬 Welcome back! Last time we qualified 200 leads. Continue?",
    userCommand: "Classify leads, then summarize by category",
    actions: [
      { text: "Extract company size to", col: "Col B" },
      { text: "Classify industry to", col: "Col C" },
      { text: "Score priority (1-10) to", col: "Col D" }
    ],
    colHeaders: ["A: Company Info", "B: Size", "C: Industry", "D: Priority"],
    colWidths: ["flex-1", "w-24", "w-28", "w-20"],
    initialData: [
      { id: 1, raw: "Acme Corp - Enterprise SaaS platform, 500+ employees, Series C funded", results: ["", "", ""] },
      { id: 2, raw: "TinyStartup.io - 2 founders building a mobile app, pre-seed", results: ["", "", ""] },
      { id: 3, raw: "MegaRetail Inc - Fortune 500 retailer, 50k staff globally", results: ["", "", ""] },
      { id: 4, raw: "LocalBakery - Family business, 3 locations in Seattle", results: ["", "", ""] },
    ],
    filledData: [
      { id: 1, raw: "Acme Corp - Enterprise SaaS platform, 500+ employees, Series C funded", results: ["Enterprise", "SaaS", "9"] },
      { id: 2, raw: "TinyStartup.io - 2 founders building a mobile app, pre-seed", results: ["Startup", "Mobile", "4"] },
      { id: 3, raw: "MegaRetail Inc - Fortune 500 retailer, 50k staff globally", results: ["Enterprise", "Retail", "10"] },
      { id: 4, raw: "LocalBakery - Family business, 3 locations in Seattle", results: ["SMB", "F&B", "3"] },
    ],
    resultColors: [
      (v: string) => v === "Enterprise" ? "bg-purple-100 text-purple-700" : v === "SMB" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700",
      (v: string) => "bg-gray-100 text-gray-700",
      (v: string) => parseInt(v) >= 8 ? "bg-green-100 text-green-700" : parseInt(v) >= 5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
    ]
  },
  {
    id: 'support',
    sheetName: 'Support Tickets',
    aiPrompt: "💡 Found 47 uncategorized tickets. Quick actions: [Triage] [Escalate urgent]",
    userCommand: "Triage tickets: category, urgency level, and suggested action",
    actions: [
      { text: "Categorize issue to", col: "Col B" },
      { text: "Rate urgency to", col: "Col C" },
      { text: "Suggest action to", col: "Col D" }
    ],
    colHeaders: ["A: Ticket", "B: Category", "C: Urgency", "D: Action"],
    colWidths: ["flex-1", "w-24", "w-24", "w-28"],
    initialData: [
      { id: 1, raw: "Can't login to my account, tried resetting password 3 times!!", results: ["", "", ""] },
      { id: 2, raw: "Would be nice to have dark mode in the mobile app", results: ["", "", ""] },
      { id: 3, raw: "URGENT: Payment failed, client demo in 2 hours", results: ["", "", ""] },
      { id: 4, raw: "How do I export my data to CSV?", results: ["", "", ""] },
    ],
    filledData: [
      { id: 1, raw: "Can't login to my account, tried resetting password 3 times!!", results: ["Auth", "High", "Escalate"] },
      { id: 2, raw: "Would be nice to have dark mode in the mobile app", results: ["Feature", "Low", "Log"] },
      { id: 3, raw: "URGENT: Payment failed, client demo in 2 hours", results: ["Billing", "Critical", "Call now"] },
      { id: 4, raw: "How do I export my data to CSV?", results: ["Docs", "Low", "Send link"] },
    ],
    resultColors: [
      (v: string) => "bg-gray-100 text-gray-700",
      (v: string) => v === "Critical" ? "bg-red-100 text-red-700" : v === "High" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700",
      (v: string) => v === "Call now" || v === "Escalate" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
    ]
  },
  {
    id: 'content',
    sheetName: 'Product Catalog',
    aiPrompt: "I see product descriptions. Want me to help with translations or SEO?",
    userCommand: "Translate to Spanish and French, keep it punchy",
    actions: [
      { text: "Translate to Spanish in", col: "Col B" },
      { text: "Translate to French in", col: "Col C" }
    ],
    colHeaders: ["A: English", "B: Español", "C: Français"],
    colWidths: ["flex-1", "w-40", "w-40"],
    initialData: [
      { id: 1, raw: "Smart home speaker with voice control", results: ["", ""] },
      { id: 2, raw: "Organic cotton t-shirt, breathable fabric", results: ["", ""] },
      { id: 3, raw: "Wireless earbuds with 24h battery life", results: ["", ""] },
      { id: 4, raw: "Minimalist leather wallet, RFID blocking", results: ["", ""] },
    ],
    filledData: [
      { id: 1, raw: "Smart home speaker with voice control", results: ["Altavoz inteligente con control por voz", "Enceinte connectée à commande vocale"] },
      { id: 2, raw: "Organic cotton t-shirt, breathable fabric", results: ["Camiseta de algodón orgánico transpirable", "T-shirt en coton bio respirant"] },
      { id: 3, raw: "Wireless earbuds with 24h battery life", results: ["Auriculares inalámbricos, 24h de batería", "Écouteurs sans fil, 24h d'autonomie"] },
      { id: 4, raw: "Minimalist leather wallet, RFID blocking", results: ["Cartera de cuero minimalista con RFID", "Portefeuille cuir minimaliste anti-RFID"] },
    ],
    resultColors: [
      () => "bg-orange-50 text-orange-800",
      () => "bg-blue-50 text-blue-800"
    ]
  }
];

export const DashboardMockup: React.FC = () => {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [step, setStep] = useState(0);
  
  const scenario = SCENARIOS[scenarioIndex];

  // Animation sequence that loops through scenarios
  useEffect(() => {
    const runSequence = async () => {
      // Initial delay
      await new Promise(r => setTimeout(r, 5000));
      setStep(1); // User typing
      await new Promise(r => setTimeout(r, 2500));
      setStep(2); // Processing
      await new Promise(r => setTimeout(r, 2000));
      setStep(3); // Results
      await new Promise(r => setTimeout(r, 4000));
      
      // Move to next scenario
      setStep(0);
      setScenarioIndex((prev) => (prev + 1) % SCENARIOS.length);
    };
    
    runSequence();
  }, [scenarioIndex]);

  const currentData = step === 3 ? scenario.filledData : scenario.initialData;

  return (
    <div className="w-full max-w-6xl mx-auto h-[450px] md:h-[650px] bg-white/70 backdrop-blur-xl border border-white/60 rounded-t-3xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col md:flex-row relative group">
        
        {/* Left Sidebar (Glassy) */}
        <div className="w-full md:w-72 bg-white/40 border-r border-white/30 flex flex-col z-20 backdrop-blur-md">
            <div className="p-6 border-b border-white/30 flex items-center justify-between">
                <div className="flex items-center gap-3 text-[#023047]">
                     <div className="w-8 h-8 bg-[#219EBB] rounded-lg flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
                        <FileSpreadsheet size={18} />
                    </div>
                    <span className="font-serif font-bold text-lg">AISheeter</span>
                </div>
                {/* Scenario indicator */}
                <div className="flex gap-1">
                    {SCENARIOS.map((_, i) => (
                        <div 
                            key={i} 
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === scenarioIndex ? 'bg-[#219EBB]' : 'bg-gray-300'}`}
                        />
                    ))}
                </div>
            </div>

            <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden relative">
                {/* Chat Interface */}
                <div className="space-y-3 flex-1">
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={`ai-${scenario.id}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-white/80 p-3 rounded-2xl rounded-tl-none border border-white/50 shadow-sm text-xs text-gray-700 leading-relaxed"
                        >
                            {scenario.aiPrompt}
                        </motion.div>
                    </AnimatePresence>

                    <AnimatePresence>
                        {step >= 1 && (
                            <motion.div 
                                key={`user-${scenario.id}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-[#219EBB]/20 p-3 rounded-2xl rounded-tr-none border border-[#219EBB]/20 text-xs text-[#023047] font-medium self-end ml-6 shadow-sm backdrop-blur-sm"
                            >
                                {step === 1 ? (
                                    <span className="typing-cursor">{scenario.userCommand}</span>
                                ) : (
                                    scenario.userCommand
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {step >= 2 && (
                             <motion.div 
                                key={`plan-${scenario.id}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-white/90 p-3 rounded-2xl rounded-tl-none border border-white/60 shadow-md text-xs w-full backdrop-blur-md"
                             >
                                <div className="flex items-center justify-between mb-2 border-b border-gray-100 pb-2">
                                    <span className="font-bold text-[#023047] uppercase tracking-wider text-[10px]">Action Plan</span>
                                    {step === 2 ? (
                                        <RotateCw size={12} className="animate-spin text-[#FFB701]"/>
                                    ) : (
                                        <span className="text-green-600 font-bold text-[10px]">✓ DONE</span>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    {scenario.actions.map((action, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${step > 2 ? 'bg-green-100' : 'bg-gray-100'}`}>
                                                {step > 2 && <div className="w-1 h-1 bg-green-500 rounded-full"></div>}
                                            </div>
                                            <span className="text-gray-600 text-[11px]">
                                                {action.text} <span className="font-mono text-[#219EBB]">{action.col}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                             </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Input Area */}
                <div className="relative">
                    <input 
                        disabled 
                        className="w-full bg-white/60 border border-white/50 rounded-xl py-2.5 px-4 text-xs shadow-inner backdrop-blur-sm placeholder:text-gray-400" 
                        placeholder="Tell me what to do..." 
                    />
                    <div className="absolute right-3 top-2.5 text-[#FFB701]"><Sparkles size={14} /></div>
                </div>
            </div>
        </div>

        {/* Right Spreadsheet Grid */}
        <div className="flex-1 bg-white/30 backdrop-blur-sm flex flex-col relative overflow-hidden">
             {/* Header Toolbar */}
             <div className="h-12 border-b border-white/30 flex items-center justify-between px-4 bg-white/20">
                <div className="flex items-center gap-3">
                    <AnimatePresence mode="wait">
                        <motion.h3 
                            key={scenario.sheetName}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="font-serif text-sm text-[#023047]"
                        >
                            {scenario.sheetName}
                        </motion.h3>
                    </AnimatePresence>
                    <span className="px-2 py-0.5 bg-green-100/80 text-green-800 text-[9px] rounded-full font-bold border border-green-200/50">LIVE</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                        <span className="hidden md:inline">Using</span>
                        <span className="font-mono text-[#219EBB] font-bold">Gemini Flash</span>
                        <ChevronRight size={10} />
                    </div>
                    <div className="w-7 h-7 bg-white/40 rounded-full flex items-center justify-center border border-white/40">
                        <Bot size={12}/>
                    </div>
                </div>
             </div>

             {/* Grid */}
             <div className="flex-1 overflow-auto p-3 md:p-4">
                 <div className="bg-white/80 border border-white/60 shadow-sm rounded-lg overflow-hidden backdrop-blur-md">
                     {/* Grid Header */}
                     <div className="flex border-b border-gray-200/50 bg-gray-50/50">
                         <div className="w-8 border-r border-gray-200/50 p-2"></div>
                         {scenario.colHeaders.map((header, i) => (
                             <motion.div 
                                key={`${scenario.id}-header-${i}`}
                                className={`${scenario.colWidths[i]} border-r border-gray-200/50 p-2 text-[10px] font-bold uppercase tracking-wide ${
                                    i === 0 ? 'text-gray-500' : 'text-[#219EBB]'
                                } ${i > 0 ? 'bg-[#219EBB]/5' : ''}`}
                                initial={{ opacity: i === 0 ? 1 : 0 }}
                                animate={{ opacity: i === 0 ? 1 : step >= 2 ? 1 : 0 }}
                             >
                                {header}
                             </motion.div>
                         ))}
                     </div>

                     {/* Rows */}
                     {currentData.map((row, rowIdx) => (
                         <div key={`${scenario.id}-row-${row.id}`} className="flex border-b border-gray-100 last:border-0 hover:bg-white/60 transition-colors">
                             <div className="w-8 border-r border-gray-100 p-2 text-center text-[10px] text-gray-400 font-mono bg-gray-50/30">
                                {row.id}
                             </div>
                             
                             <div className={`${scenario.colWidths[0]} border-r border-gray-100 p-2 text-[10px] text-gray-700 font-mono truncate`}>
                                 {row.raw}
                             </div>

                             {row.results.map((result, colIdx) => (
                                 <motion.div 
                                    key={`${scenario.id}-${row.id}-${colIdx}`}
                                    className={`${scenario.colWidths[colIdx + 1]} border-r border-gray-100 p-2 text-[10px] font-medium flex items-center bg-[#219EBB]/5`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: step >= 2 ? 1 : 0 }}
                                 >
                                    {step === 3 && result ? (
                                        <motion.span 
                                            initial={{ opacity: 0, scale: 0.8 }} 
                                            animate={{ opacity: 1, scale: 1 }} 
                                            transition={{ delay: rowIdx * 0.08 + colIdx * 0.05 }}
                                            className={`px-1.5 py-0.5 rounded text-[9px] ${scenario.resultColors[colIdx](result)}`}
                                        >
                                            {result}
                                        </motion.span>
                                    ) : step === 2 ? (
                                        <div className="h-2 w-12 bg-gray-200/50 rounded animate-pulse"/>
                                    ) : null}
                                 </motion.div>
                             ))}
                         </div>
                     ))}
                 </div>
             </div>
             
             {/* Bottom status bar */}
             <div className="h-8 border-t border-white/30 bg-white/20 flex items-center justify-between px-4 text-[9px] text-gray-500">
                <span>{currentData.length} rows × {scenario.colHeaders.length} columns</span>
                <span className="flex items-center gap-1">
                    {step === 3 && <span className="text-green-600 font-medium">✓ Processed in 1.2s</span>}
                    {step === 2 && <span className="text-[#FFB701] font-medium animate-pulse">Processing...</span>}
                </span>
             </div>
        </div>
    </div>
  );
};
