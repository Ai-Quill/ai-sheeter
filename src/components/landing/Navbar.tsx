import React from 'react';
import { motion } from 'framer-motion';
import { Github, Star } from 'lucide-react';

interface NavbarProps {
    show: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ show }) => {
  return (
    <motion.nav 
        className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 py-4 flex justify-between items-center"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: show ? 0 : -100, opacity: show ? 1 : 0 }}
        transition={{ duration: 0.5 }}
    >
        <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-sm border border-white/50 flex items-center gap-8">
            <span className="font-serif font-bold text-lg text-[#023047]">AISheeter.</span>
            <div className="hidden md:flex gap-6 text-sm text-gray-600 font-medium">
                <a href="#features" className="hover:text-[#219EBB] transition">Features</a>
                <a href="#usecases" className="hover:text-[#219EBB] transition">Use Cases</a>
                <a href="#pricing" className="hover:text-[#219EBB] transition">Pricing</a>
            </div>
        </div>

        <div className="flex items-center gap-3">
            {/* GitHub Link */}
            <motion.a 
                href="https://github.com/Ai-Quill/ai-sheeter" 
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="hidden md:flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-full text-sm font-medium text-[#023047] border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
            >
                <Github size={18} />
                <span>Open Source</span>
                <Star size={12} className="text-[#FFB701]" fill="#FFB701" />
            </motion.a>
            
            {/* Mobile GitHub Icon */}
            <a 
                href="https://github.com/Ai-Quill/ai-sheeter" 
                target="_blank"
                rel="noopener noreferrer"
                className="md:hidden flex items-center justify-center w-10 h-10 bg-white/90 backdrop-blur-md rounded-full border border-gray-200"
            >
                <Github size={18} className="text-[#023047]" />
            </a>
            
            {/* Desktop Button */}
            <a 
                href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:block bg-[#023047] text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-[#FFB701] hover:text-[#023047] transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 duration-200"
            >
                Install for Free
            </a>
            {/* Mobile Button (Condensed) */}
            <a 
                href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                target="_blank"
                rel="noopener noreferrer"
                className="md:hidden bg-[#023047] text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-[#FFB701] transition shadow-md"
            >
                Install
            </a>
        </div>
    </motion.nav>
  );
};
