import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Zap, Shield } from 'lucide-react';

export const CTASection: React.FC = () => {
  return (
    <section className="py-24 px-4 bg-[#023047] relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute -top-[50%] -left-[10%] w-[500px] h-[500px] rounded-full bg-[#219EBB] blur-[100px]"></div>
            <div className="absolute -bottom-[50%] -right-[10%] w-[500px] h-[500px] rounded-full bg-[#FFB701] blur-[100px]"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
            >
                <h2 className="font-serif text-4xl md:text-6xl text-white mb-6">
                    Stop switching tabs. <br />
                    <span className="text-[#FFB701] italic">Start shipping.</span>
                </h2>
                <p className="text-white/70 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
                    Install in 30 seconds. Connect your API key. Start automating.
                </p>
                
                {/* Value props row */}
                <div className="flex flex-wrap justify-center gap-6 mb-10 text-white/60 text-sm">
                    <span className="flex items-center gap-2">
                        <Clock size={16} className="text-[#FFB701]" />
                        Setup in 30 seconds
                    </span>
                    <span className="flex items-center gap-2">
                        <Zap size={16} className="text-[#FFB701]" />
                        Free tier included
                    </span>
                    <span className="flex items-center gap-2">
                        <Shield size={16} className="text-[#FFB701]" />
                        Your keys, your data
                    </span>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <a 
                        href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-8 py-4 bg-[#FFB701] text-[#023047] rounded-full font-bold text-lg hover:bg-[#FFB701]/90 transition-transform hover:scale-105 active:scale-95 shadow-xl flex items-center gap-2"
                    >
                        Install from Marketplace
                        <ArrowRight size={20} />
                    </a>
                </div>
                
                <p className="text-white/30 text-xs mt-6">
                    Works with any Google account • No credit card required
                </p>
            </motion.div>
        </div>
    </section>
  );
};
