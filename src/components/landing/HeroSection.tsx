import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { DashboardMockup } from './DashboardMockup';
import { Star, Zap, Github } from 'lucide-react';

interface HeroSectionProps {
  onAnimationComplete: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onAnimationComplete }) => {
  const { scrollY } = useScroll();
  
  // Subtle parallax for background only
  const yBackground = useTransform(scrollY, [0, 1000], [0, 150]);

  // Initial Animation Variants
  const containerVariants = {
    initial: { 
      opacity: 0
    },
    animate: {
      opacity: 1,
      transition: {
        duration: 1,
        ease: "easeOut",
        delay: 0.3
      }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { delay: 1.5, duration: 0.6 } 
    }
  };

  const dashboardVariants = {
    hidden: { y: 60, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { delay: 1.8, duration: 0.8, ease: "easeOut" }
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      
      {/* Full Screen Background */}
      <motion.div
        className="absolute inset-0 z-0"
        initial="initial"
        animate="animate"
        variants={containerVariants}
        onAnimationComplete={onAnimationComplete}
      >
        <motion.div 
            style={{ y: yBackground }}
            className="absolute inset-0 w-full h-[120%] -top-[10%]"
        >
             {/* Light Gradient Overlay */}
             <div className="absolute inset-0 bg-linear-to-b from-[#8ECAE6]/20 via-transparent to-transparent z-10" />
             
             {/* Scenic Background */}
             <img 
                src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop" 
                alt="Green hills and blue sky" 
                className="w-full h-full object-cover"
             />
        </motion.div>
      </motion.div>

      {/* Content Layer */}
      <div className="relative z-20 min-h-screen flex flex-col">
        
        {/* Hero Content - Top Section */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pt-32 pb-20 text-center">
            <motion.div 
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                className="max-w-4xl mx-auto"
            >
                {/* Smaller Headline */}
                <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-white drop-shadow-2xl mb-6 leading-tight tracking-tight">
                    The AI that <span className="italic text-[#FFB701] drop-shadow-[0_0_40px_rgba(255,183,1,0.4)]">remembers</span><br />your spreadsheet.
                </h1>
                
                {/* CTA Button */}
                <a 
                    href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-white text-[#023047] px-8 py-4 rounded-full hover:bg-white/95 transition-all shadow-2xl font-bold text-base hover:scale-105 active:scale-95 duration-200 mb-6"
                >
                    <Zap size={20} className="text-[#FFB701]" />
                    <span>Get Started Free</span>
                </a>

                {/* Social Proof */}
                <div className="flex items-center justify-center gap-4 text-white/90 text-sm">
                    <div className="flex items-center gap-1">
                        <span className="text-[#FFB701]">★★★★★</span>
                        <span className="ml-1">4.9/5</span>
                    </div>
                    <div className="w-px h-4 bg-white/30" />
                    <div>500+ active users</div>
                    <div className="w-px h-4 bg-white/30" />
                    <div>Free forever</div>
                </div>
            </motion.div>
        </div>

        {/* Demo - Bottom */}
        <div className="px-4 md:px-8 pb-16">
            <motion.div
                variants={dashboardVariants}
                initial="hidden"
                animate="visible"
                className="max-w-6xl mx-auto"
            >
                <DashboardMockup />
            </motion.div>
        </div>
      </div>

      {/* Simple Intro */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0, scale: 0.8 }}
        transition={{ delay: 1, duration: 0.6 }}
      >
        <h2 className="font-serif text-4xl text-white drop-shadow-2xl">AISheeter.</h2>
      </motion.div>
    </div>
  );
};
