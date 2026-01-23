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
        duration: 1.8,
        ease: [0.22, 1, 0.36, 1] as const,
        delay: 0.3
      }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { delay: 2, duration: 0.8 } 
    }
  };

  const dashboardVariants = {
    hidden: { y: 100, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { delay: 2.3, duration: 1, type: "spring" as const, stiffness: 50 }
    }
  };

  return (
    <div className="relative h-[120vh] sm:h-[130vh] md:h-[140vh] flex justify-center items-start overflow-hidden bg-white">
      
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

        {/* Hero Content - Clean & Minimal */}
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-4 text-center pointer-events-none">
            <motion.div 
                style={{ y: yText, opacity: opacityText }}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                className="max-w-4xl mx-auto pointer-events-auto -mt-20 md:-mt-32"
            >
                {/* Headline - The Star */}
                <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white drop-shadow-2xl mb-6 md:mb-8 leading-[1.05] tracking-tight">
                    The AI that <span className="italic text-[#FFB701] drop-shadow-[0_0_40px_rgba(255,183,1,0.4)]">remembers</span><br />your spreadsheet.
                </h1>
                
                {/* Single CTA - Clean & Bold */}
                <a 
                    href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-3 bg-white text-[#023047] px-10 py-5 rounded-full hover:bg-white/95 transition-all shadow-2xl font-bold text-base md:text-lg hover:scale-105 active:scale-95 duration-200"
                >
                    <Zap size={24} className="text-[#FFB701]" />
                    <span>Get Started Free</span>
                </a>
            </motion.div>
        </div>

        {/* Floating Dashboard Interface - Clean Placement */}
        <motion.div 
            className="absolute bottom-0 left-0 right-0 z-20 px-4 md:px-8 flex justify-center"
            variants={dashboardVariants}
            initial="hidden"
            animate="visible"
            style={{ transform: 'translateY(35%)' }}
        >
            <DashboardMockup />
        </motion.div>
      </motion.div>

      {/* Simple Intro - Just Logo */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0, scale: 0.8 }}
        transition={{ delay: 1.5, duration: 0.8 }}
      >
        <h2 className="font-serif text-4xl md:text-5xl text-white">AISheeter.</h2>
      </motion.div>

    </div>
  );
};
