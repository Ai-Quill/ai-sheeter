import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { DashboardMockup } from './DashboardMockup';
import { Star, Zap } from 'lucide-react';

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
        width: "120px", 
        height: "160px", 
        borderRadius: "80px 80px 0 0", // Arch shape
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
    <div className="relative h-[140vh] md:h-[150vh] flex justify-center items-start overflow-hidden bg-white">
      
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
             <div className="absolute inset-0 bg-gradient-to-b from-[#8ECAE6]/30 via-transparent to-[#023047]/10 z-10" />
             
             {/* Original Scenic Background */}
             <img 
                src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop" 
                alt="Green hills and blue sky" 
                className="w-full h-full object-cover"
             />
        </motion.div>

        {/* Hero Content */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-start pt-32 md:pt-40 px-4 text-center">
            <motion.div 
                style={{ y: yText, opacity: opacityText }}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                className="max-w-5xl mx-auto"
            >
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/40 text-white font-medium text-sm mb-8 shadow-sm">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        GPT-4 • Claude • Gemini • Groq
                    </span>
                    <span className="w-px h-4 bg-white/30"></span>
                    <span className="text-[#FFB701] font-bold">380k+ queries processed</span>
                </div>

                <h1 className="font-serif text-5xl md:text-8xl text-white drop-shadow-2xl mb-6 leading-[1.1] tracking-tight">
                    The AI that <br />
                    <span className="italic text-[#FFB701]">remembers</span> your spreadsheet.
                </h1>
                
                <p className="text-white text-base md:text-lg max-w-xl mx-auto font-light mb-6 drop-shadow-xl">
                    Persistent context. Multi-step tasks. Finally gets your data.
                </p>

                <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-12">
                    <a 
                        href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#023047] text-white px-8 py-4 rounded-full hover:bg-[#023047]/90 transition-all shadow-xl font-semibold text-lg flex items-center gap-2 hover:scale-105 active:scale-95 duration-200"
                    >
                        <Zap size={20} className="text-[#FFB701]" />
                        Get Started Free
                    </a>
                    <a 
                        href="#demo"
                        className="bg-white/20 backdrop-blur-md text-white border border-white/40 px-8 py-4 rounded-full hover:bg-white/30 transition-all shadow-xl font-medium text-lg"
                    >
                        Watch Demo
                    </a>
                </div>

                {/* Social Proof */}
                <div className="flex items-center justify-center gap-6 text-white/90 bg-black/30 backdrop-blur-md p-4 rounded-2xl border border-white/20 inline-flex shadow-lg">
                    <div className="flex -space-x-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="w-10 h-10 rounded-full border-2 border-white/50 overflow-hidden bg-gray-300">
                                <img src={`https://i.pravatar.cc/100?img=${i + 15}`} alt="User" />
                            </div>
                        ))}
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-1 text-[#FFB701]">
                            <Star size={14} fill="#FFB701" />
                            <Star size={14} fill="#FFB701" />
                            <Star size={14} fill="#FFB701" />
                            <Star size={14} fill="#FFB701" />
                            <Star size={14} fill="#FFB701" />
                        </div>
                        <p className="text-xs font-medium"><span className="font-bold">400+</span> Verified Users</p>
                    </div>
                    <div className="h-8 w-[1px] bg-white/30 mx-2"></div>
                    <div className="text-left">
                         <p className="text-lg font-bold leading-none">380k+</p>
                         <p className="text-[10px] opacity-80 uppercase tracking-wider">Tasks Automated</p>
                    </div>
                </div>
            </motion.div>
        </div>

        {/* Floating Dashboard Interface */}
        <motion.div 
            className="absolute bottom-0 left-0 right-0 z-30 px-2 md:px-8 flex justify-center translate-y-20 md:translate-y-24"
            variants={dashboardVariants}
            initial="hidden"
            animate="visible"
        >
            <DashboardMockup />
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
