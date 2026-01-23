import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { DashboardMockup } from './DashboardMockup';
import { Star, Zap, Github } from 'lucide-react';

interface HeroSectionProps {
  onAnimationComplete: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onAnimationComplete }) => {
  const { scrollY } = useScroll();
  
  // Parallax for the background image
  const yBackground = useTransform(scrollY, [0, 1000], [0, 300]);
  const yText = useTransform(scrollY, [0, 500], [0, 250]); 
  const opacityText = useTransform(scrollY, [0, 300], [1, 0]);

  // Initial Animation Variants
  const containerVariants = {
    initial: { 
        width: "100px", 
        height: "140px", 
        borderRadius: "70px 70px 0 0", // Arch shape
        y: 0 
    },
    animate: {
      width: "100%",
      height: "125vh", 
      borderRadius: "0px",
      transition: {
        duration: 2.5,
        ease: [0.22, 1, 0.36, 1] as const,
        delay: 0.5
      }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { delay: 3, duration: 1 } 
    }
  };

  const dashboardVariants = {
    hidden: { y: 200, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { delay: 3.2, duration: 1.2, type: "spring" as const, stiffness: 40 }
    }
  };

  return (
    <div className="relative h-[140vh] sm:h-[145vh] md:h-[150vh] flex justify-center items-start overflow-hidden bg-white">
      
      {/* The expanding window/portal */}
      <motion.div
        className="relative overflow-hidden z-0 shadow-2xl origin-center"
        initial="initial"
        animate="animate"
        variants={containerVariants}
        onAnimationComplete={onAnimationComplete}
      >
        {/* Background Image Layer */}
        <motion.div 
            style={{ y: yBackground }}
            className="absolute inset-0 w-full h-[120%] -top-[10%]"
        >
             {/* Lighter Gradient Overlay - Reverted from dark overlay */}
             <div className="absolute inset-0 bg-linear-to-b from-[#8ECAE6]/30 via-transparent to-[#023047]/10 z-10" />
             
             {/* Original Scenic Background */}
             <img 
                src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop" 
                alt="Green hills and blue sky" 
                className="w-full h-full object-cover"
             />
        </motion.div>

        {/* Hero Content */}
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-4 text-center pointer-events-none">
            <motion.div 
                style={{ y: yText, opacity: opacityText }}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                className="max-w-5xl mx-auto pointer-events-auto -mt-32 md:-mt-40"
            >
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 3.2, duration: 0.6 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-lg border border-white/20 text-white font-medium text-xs mb-6 shadow-lg"
                >
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                        <span className="text-white/80">GPT-4 • Claude • Gemini • Groq</span>
                    </span>
                    <span className="w-px h-4 bg-white/20"></span>
                    <span className="text-[#FFB701] font-bold">380k+ queries</span>
                </motion.div>

                <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl text-white drop-shadow-2xl mb-4 md:mb-6 leading-[1.1] tracking-tight px-4">
                    The AI that <span className="italic text-[#FFB701] drop-shadow-[0_0_30px_rgba(255,183,1,0.3)]">remembers</span> your spreadsheet.
                </h1>
                
                <p className="text-white/90 text-base md:text-lg max-w-2xl mx-auto font-light mb-6 md:mb-8 drop-shadow-xl px-4 leading-relaxed">
                    Persistent context. Multi-step tasks. Finally gets your data.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center mb-8 md:mb-12 w-full max-w-md mx-auto px-4 sm:px-0">
                    <a 
                        href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative bg-white text-[#023047] px-8 py-4 rounded-full hover:bg-white/95 transition-all shadow-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 hover:scale-105 active:scale-95 duration-200 whitespace-nowrap overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-linear-to-r from-[#FFB701]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Zap size={20} className="text-[#FFB701] relative z-10" />
                        <span className="relative z-10">Get Started Free</span>
                    </a>
                    <a 
                        href="#demo"
                        className="bg-white/10 backdrop-blur-md text-white border-2 border-white/30 px-8 py-4 rounded-full hover:bg-white/20 hover:border-white/50 transition-all shadow-xl font-semibold text-sm sm:text-base justify-center flex items-center whitespace-nowrap"
                    >
                        Watch Demo
                    </a>
                </div>

                {/* Social Proof */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-white/90 bg-black/30 backdrop-blur-md p-2.5 rounded-xl border border-white/20 shadow-lg max-w-lg mx-auto mb-12 md:mb-20">
                    {/* Open Source Badge */}
                    <a 
                        href="https://github.com/Ai-Quill/ai-sheeter" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 transition-all group"
                    >
                        <Github size={14} className="text-white group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-semibold">Open Source</span>
                    </a>
                    <div className="hidden sm:block h-6 w-px bg-white/30"></div>
                    <div className="flex -space-x-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white/50 overflow-hidden bg-gray-300">
                                <img src={`https://i.pravatar.cc/100?img=${i + 15}`} alt="User" />
                            </div>
                        ))}
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-0.5 text-[#FFB701]">
                            <Star size={10} fill="#FFB701" />
                            <Star size={10} fill="#FFB701" />
                            <Star size={10} fill="#FFB701" />
                            <Star size={10} fill="#FFB701" />
                            <Star size={10} fill="#FFB701" />
                        </div>
                        <p className="text-[10px] font-medium"><span className="font-bold">400+</span> Users</p>
                    </div>
                    <div className="hidden sm:block h-6 w-px bg-white/30"></div>
                    <div className="text-left">
                         <p className="text-sm font-bold leading-none">380k+</p>
                         <p className="text-[8px] opacity-80 uppercase tracking-wider">Tasks Done</p>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <motion.div 
                    className="flex flex-col items-center gap-2 text-white/60"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 3.5, duration: 0.8 }}
                >
                    <span className="text-xs font-medium uppercase tracking-wider">See it in action</span>
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-1.5"
                    >
                        <motion.div 
                            className="w-1.5 h-1.5 bg-white/60 rounded-full"
                            animate={{ y: [0, 16, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>

        {/* Floating Dashboard Interface - Positioned below hero content */}
        <motion.div 
            className="absolute bottom-0 left-0 right-0 z-20 px-2 md:px-8 flex justify-center"
            variants={dashboardVariants}
            initial="hidden"
            animate="visible"
            style={{ transform: 'translateY(45%)' }}
        >
            <div className="relative">
                {/* Glow effect behind demo */}
                <div className="absolute inset-0 bg-linear-to-t from-[#219EBB]/20 to-transparent blur-3xl scale-110 -z-10" />
                <DashboardMockup />
            </div>
        </motion.div>
      </motion.div>

      {/* Intro Text Overlay */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 2, duration: 0.5 }}
      >
        <h2 className="font-serif text-3xl text-[#023047]">AISheeter.</h2>
        <motion.div 
            className="h-1 bg-[#8ECAE6] mt-2 mx-auto rounded-full" 
            initial={{ width: 0 }}
            animate={{ width: 40 }}
            transition={{ duration: 1 }}
        />
      </motion.div>

    </div>
  );
};
