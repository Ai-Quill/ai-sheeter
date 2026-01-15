import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Copy, Database, Zap, Clock } from 'lucide-react';

export const ProblemSolution: React.FC = () => {
  // Default to "new" - show solution first (positive framing)
  const [view, setView] = useState<'old' | 'new'>('new');

  return (
    <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-serif text-[#023047] mb-6">
                Spreadsheets haven&apos;t changed in 20 years. <br />
                <span className="italic text-[#FFB701]">Until now.</span>
            </h2>
            
            {/* Magic Switch */}
            <div className="flex items-center justify-center gap-4 mt-8">
                <span className={`text-sm font-bold transition-colors ${view === 'old' ? 'text-red-500' : 'text-gray-400'}`}>The Old Way</span>
                <button 
                    onClick={() => setView(view === 'old' ? 'new' : 'old')}
                    className={`w-16 h-8 rounded-full p-1 transition-colors duration-300 relative ${view === 'old' ? 'bg-red-100' : 'bg-green-100'}`}
                >
                    <motion.div 
                        className={`w-6 h-6 rounded-full shadow-md flex items-center justify-center ${view === 'old' ? 'bg-red-500' : 'bg-green-500'}`}
                        layout
                        transition={{ type: "spring", stiffness: 700, damping: 30 }}
                        style={{ marginLeft: view === 'old' ? '0%' : 'auto', marginRight: view === 'new' ? '0%' : 'auto' }}
                    >
                         {view === 'old' ? <X size={14} className="text-white"/> : <Check size={14} className="text-white"/>}
                    </motion.div>
                </button>
                <span className={`text-sm font-bold transition-colors ${view === 'new' ? 'text-green-600' : 'text-gray-400'}`}>The AISheeter Way</span>
            </div>
        </div>

        <div className="max-w-4xl mx-auto relative min-h-[400px]">
            <AnimatePresence mode="wait">
                {view === 'old' ? (
                    <motion.div 
                        key="old"
                        initial={{ opacity: 0, rotateX: -90 }}
                        animate={{ opacity: 1, rotateX: 0 }}
                        exit={{ opacity: 0, rotateX: 90 }}
                        transition={{ duration: 0.4 }}
                        className="bg-white p-8 md:p-12 rounded-3xl border border-red-100 shadow-xl shadow-red-50 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><X size={200} /></div>
                        
                        <div className="flex flex-col md:flex-row gap-12 items-center">
                            <div className="flex-1 space-y-8">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-red-50 rounded-xl text-red-500"><Copy size={24}/></div>
                                    <div>
                                        <h4 className="text-lg font-bold text-red-900 mb-1">Manual Copy-Paste Hell</h4>
                                        <p className="text-gray-500 text-sm">Copying cell by cell into ChatGPT and pasting answers back. One mistake ruins everything.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-red-50 rounded-xl text-red-500"><Clock size={24}/></div>
                                    <div>
                                        <h4 className="text-lg font-bold text-red-900 mb-1">Hours of Busywork</h4>
                                        <p className="text-gray-500 text-sm">Cleaning 500 rows takes an entire afternoon of repetitive clicking.</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Visual representation of chaos */}
                            <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-200 opacity-70 grayscale">
                                <div className="space-y-2">
                                    <div className="h-2 w-3/4 bg-gray-300 rounded"></div>
                                    <div className="h-2 w-full bg-gray-300 rounded"></div>
                                    <div className="h-2 w-1/2 bg-gray-300 rounded"></div>
                                    <div className="h-20 bg-red-100 rounded border border-red-200 flex items-center justify-center text-red-400 text-xs">ERROR #REF!</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="new"
                        initial={{ opacity: 0, rotateX: 90 }}
                        animate={{ opacity: 1, rotateX: 0 }}
                        exit={{ opacity: 0, rotateX: -90 }}
                        transition={{ duration: 0.4 }}
                        className="bg-[#023047] p-8 md:p-12 rounded-3xl shadow-2xl shadow-cyan-900/20 relative overflow-hidden"
                    >
                         <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Zap size={200} className="text-white"/></div>

                         <div className="flex flex-col md:flex-row gap-12 items-center">
                            <div className="flex-1 space-y-8">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-[#219EBB]/20 rounded-xl text-[#219EBB]"><Database size={24}/></div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-1">AI Inside the Cell</h4>
                                        <p className="text-white/60 text-sm">Just type =Gemini(&quot;Extract email&quot;, A1). It behaves exactly like a native formula.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-[#FFB701]/20 rounded-xl text-[#FFB701]"><Zap size={24}/></div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-1">Bulk Process &amp; Leave</h4>
                                        <p className="text-white/60 text-sm">Run a job on 10,000 rows. Close the tab. We&apos;ll email you when it&apos;s done.</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Visual representation of order */}
                            <div className="flex-1 bg-white/10 rounded-xl p-6 border border-white/20 backdrop-blur-sm">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-white/50 text-xs uppercase font-bold tracking-wider mb-2">
                                        <span>Status</span>
                                        <span className="text-green-400">Active</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full w-3/4 bg-[#219EBB] shadow-[0_0_15px_rgba(32,158,187,0.8)]"></div>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <div className="h-8 w-8 rounded bg-white/20"></div>
                                        <div className="flex-1 h-8 rounded bg-white/10 flex items-center px-3 text-xs text-white/80 font-mono">=Gemini(A1)</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    </section>
  );
};
