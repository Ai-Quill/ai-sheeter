'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, Layers, Zap, X, Bell } from 'lucide-react';

export const UseCases: React.FC = () => {
  const [activeModel, setActiveModel] = useState<'gemini' | 'gpt' | 'claude'>('gemini');
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'running' | 'minimized'>('idle');

  // Loop the bulk animation
  useEffect(() => {
    const loop = async () => {
        if(bulkStatus === 'idle') {
            await new Promise(r => setTimeout(r, 2000));
            setBulkStatus('running');
            await new Promise(r => setTimeout(r, 3000));
            setBulkStatus('minimized');
            await new Promise(r => setTimeout(r, 4000));
            setBulkStatus('idle');
        }
    }
    loop();
  }, [bulkStatus]);

  const formulas = {
      gemini: {
          code: '=Gemini("Extract email from: " & A1)',
          color: 'text-blue-300',
          desc: "Best for bulk processing. High speed, low cost."
      },
      gpt: {
          code: '=ChatGPT("Summarize text", A1, "gpt-5-mini")',
          color: 'text-green-300',
          desc: "The industry standard for reasoning and general knowledge."
      },
      claude: {
          code: '=Claude("Analyze tone", A1, "claude-sonnet-4-5")',
          color: 'text-orange-300',
          desc: "Superior at nuanced writing and complex instructions."
      }
  };

  return (
    <section id="usecases" className="py-24 bg-[#023047] text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
            
            {/* Section 1: Multi-LLM Formulas */}
            <div className="flex flex-col md:flex-row gap-16 items-center mb-40">
                <div className="flex-1">
                    <div className="w-12 h-12 bg-[#FFB701] rounded-2xl flex items-center justify-center text-[#023047] mb-6 shadow-lg shadow-orange-500/20">
                        <Code size={24} />
                    </div>
                    <h3 className="text-4xl font-serif mb-6">Multi-Model Formula Engine</h3>
                    <p className="text-white/70 text-lg mb-8 leading-relaxed">
                        Don&apos;t get locked into one provider. Switch models instantly by changing the function name.
                    </p>
                    
                    {/* Tabs */}
                    <div className="flex gap-4 border-b border-white/10 mb-8">
                        {(['gemini', 'gpt', 'claude'] as const).map(model => (
                            <button 
                                key={model}
                                onClick={() => setActiveModel(model)}
                                className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all ${activeModel === model ? 'text-[#219EBB] border-b-2 border-[#219EBB]' : 'text-white/40 hover:text-white/60'}`}
                            >
                                {model}
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={activeModel}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-4">
                                <code className={`font-mono text-lg ${formulas[activeModel].color}`}>
                                    {formulas[activeModel].code}
                                </code>
                            </div>
                            <p className="text-sm text-white/50">{formulas[activeModel].desc}</p>
                        </motion.div>
                    </AnimatePresence>
                </div>
                
                <motion.div 
                    className="flex-1 relative w-full"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                >
                     <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1 border border-white/20 shadow-2xl">
                         <div className="bg-[#0f172a] rounded-xl overflow-hidden">
                             <div className="flex border-b border-white/10 text-xs text-white/40">
                                 <div className="p-3 border-r border-white/10 w-12"></div>
                                 <div className="p-3 border-r border-white/10 w-1/2">A</div>
                                 <div className="p-3 w-1/2">B</div>
                             </div>
                             <div className="flex border-b border-white/10">
                                 <div className="p-3 border-r border-white/10 w-12 text-white/40 text-xs">1</div>
                                 <div className="p-3 border-r border-white/10 w-1/2 text-sm text-white">Apple Inc.</div>
                                 <div className="p-3 w-1/2 relative bg-[#219EBB]/10">
                                     <span className={`font-mono text-xs ${formulas[activeModel].color}`}>{formulas[activeModel].code}</span>
                                     <div className="absolute right-0 bottom-0 px-2 py-0.5 bg-[#219EBB] text-[#023047] text-[10px] font-bold">Computing...</div>
                                 </div>
                             </div>
                              <div className="flex border-b border-white/10">
                                 <div className="p-3 border-r border-white/10 w-12 text-white/40 text-xs">2</div>
                                 <div className="p-3 border-r border-white/10 w-1/2 text-sm text-white">Tesla</div>
                                 <div className="p-3 w-1/2"></div>
                             </div>
                         </div>
                    </div>
                </motion.div>
            </div>

            {/* Section 2: Bulk Processing (Run & Leave) */}
            <div className="flex flex-col md:flex-row-reverse gap-16 items-center">
                <div className="flex-1">
                    <div className="w-12 h-12 bg-[#219EBB] rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-cyan-500/20">
                        <Layers size={24} />
                    </div>
                    <h3 className="text-4xl font-serif mb-6">Start Job, Close Tab</h3>
                    <p className="text-white/70 text-lg mb-8 leading-relaxed">
                        Bulk jobs run on our servers, not your browser. Start a job on 5,000 rows and feel free to close the sidebar or the entire sheet.
                    </p>
                    <ul className="space-y-4">
                         <li className="flex items-center gap-3 text-white/80">
                            <div className="p-1 bg-green-500/20 rounded-full"><Zap size={14} className="text-green-400"/></div>
                            Process 1,000+ rows per job
                         </li>
                         <li className="flex items-center gap-3 text-white/80">
                            <div className="p-1 bg-green-500/20 rounded-full"><Bell size={14} className="text-green-400"/></div>
                            Email notification on completion
                         </li>
                         <li className="flex items-center gap-3 text-white/80">
                            <div className="p-1 bg-green-500/20 rounded-full"><Layers size={14} className="text-green-400"/></div>
                            Parallel execution for multiple columns
                         </li>
                    </ul>
                </div>

                <div className="flex-1 relative h-[400px] w-full flex items-center justify-center">
                    {/* The Sidebar Animation */}
                    <AnimatePresence>
                        {bulkStatus !== 'minimized' && (
                            <motion.div 
                                initial={{ x: 100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 100, opacity: 0, scale: 0.9 }}
                                transition={{ type: "spring", bounce: 0.2 }}
                                className="absolute right-0 top-0 bottom-0 w-80 bg-white rounded-l-2xl shadow-2xl border-l-4 border-[#FFB701] overflow-hidden z-10"
                            >
                                <div className="h-12 border-b border-gray-100 flex items-center justify-between px-4">
                                    <span className="font-bold text-[#023047] text-sm">Bulk Processor</span>
                                    <button className="text-gray-400"><X size={16}/></button>
                                </div>
                                <div className="p-6">
                                    <h4 className="font-bold text-gray-800 mb-2">Translation Job</h4>
                                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                                        <span>Target: Column B</span>
                                        <span>500 Rows</span>
                                    </div>
                                    
                                    {bulkStatus === 'idle' ? (
                                        <button className="w-full bg-[#023047] text-white py-3 rounded-xl font-bold text-sm mt-4 shadow-lg hover:scale-105 transition-transform">
                                            Run Job
                                        </button>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#FFB701] w-1/3 animate-pulse"></div>
                                            </div>
                                            <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-lg">
                                                Job started. You can safely close this sidebar.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* The Background Sheet */}
                    <div className="w-full h-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-4 relative grayscale opacity-50">
                        <div className="grid grid-cols-4 gap-2">
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="h-8 bg-white/10 rounded"></div>
                            ))}
                        </div>
                    </div>

                    {/* The Toast Notification (appears when sidebar minimizes) */}
                    <AnimatePresence>
                        {bulkStatus === 'minimized' && (
                            <motion.div 
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 50, opacity: 0 }}
                                className="absolute bottom-4 right-4 bg-white p-4 rounded-xl shadow-2xl flex items-center gap-4 z-20 border border-green-100"
                            >
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                    <RotateIcon />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">Job Running in Background</p>
                                    <p className="text-xs text-gray-500">234 / 500 rows completed</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

        </div>
    </section>
  );
};

const RotateIcon = () => (
    <svg className="animate-spin h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);
