import React from 'react';
import Link from 'next/link';
import { Github, Twitter, MessageCircle, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gradient-to-b from-white to-gray-50 border-t border-gray-100 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                <div className="col-span-1 md:col-span-2">
                    <h2 className="font-serif text-2xl text-[#023047] mb-4">AISheeter.</h2>
                    <p className="text-gray-500 max-w-sm text-sm leading-relaxed mb-6">
                        Join a global community and unlock a new level of productivity within your spreadsheets.
                    </p>
                    
                    {/* Open Source Badge */}
                    <a 
                        href="https://github.com/Ai-Quill/ai-sheeter" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 px-5 py-3 bg-[#023047] text-white rounded-2xl hover:bg-[#034a6e] transition-all group shadow-lg hover:shadow-xl"
                    >
                        <Github size={20} className="group-hover:scale-110 transition-transform" />
                        <div className="text-left">
                            <div className="font-semibold text-sm">Open Source</div>
                            <div className="text-[10px] text-white/70 flex items-center gap-1">
                                <Heart size={10} fill="currentColor" className="text-red-400" />
                                Star us on GitHub
                            </div>
                        </div>
                    </a>
                </div>
                <div>
                    <h4 className="font-bold text-[#023047] mb-4 text-sm">Product</h4>
                    <ul className="space-y-3 text-sm text-gray-500">
                        <li><a href="#features" className="hover:text-[#219EBB] transition">Features</a></li>
                        <li><a href="#pricing" className="hover:text-[#219EBB] transition">Pricing</a></li>
                        <li>
                            <a 
                                href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-[#219EBB] transition"
                            >
                                Marketplace
                            </a>
                        </li>
                        <li>
                            <a 
                                href="https://github.com/Ai-Quill/ai-sheeter" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="hover:text-[#219EBB] transition flex items-center gap-2"
                            >
                                <Github size={14} />
                                GitHub
                            </a>
                        </li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-[#023047] mb-4 text-sm">Company</h4>
                    <ul className="space-y-3 text-sm text-gray-500">
                        <li><a href="#" className="hover:text-[#219EBB] transition">About</a></li>
                        <li><Link href="/privacy" className="hover:text-[#219EBB] transition">Privacy</Link></li>
                        <li><Link href="/terms" className="hover:text-[#219EBB] transition">Terms</Link></li>
                        <li><a href="#contact" className="hover:text-[#219EBB] transition">Contact</a></li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-gray-400">
                <p className="flex items-center gap-1">
                    © 2026 AISheeter. Made with <Heart size={12} fill="currentColor" className="text-red-400" /> by Ai-Quill
                </p>
                <div className="flex items-center gap-5 mt-4 md:mt-0">
                    <a 
                        href="https://github.com/Ai-Quill/ai-sheeter" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:text-[#023047] transition-colors"
                    >
                        <Github size={16} />
                        <span>GitHub</span>
                    </a>
                    <a href="https://twitter.com/tuantruong" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-[#1DA1F2] transition-colors">
                        <Twitter size={16} />
                        <span>Twitter</span>
                    </a>
                    <a href="#" className="flex items-center gap-1.5 hover:text-[#5865F2] transition-colors">
                        <MessageCircle size={16} />
                        <span>Discord</span>
                    </a>
                </div>
            </div>
        </div>
    </footer>
  );
};
