import React from 'react';
import Link from 'next/link';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                <div className="col-span-1 md:col-span-2">
                    <h2 className="font-serif text-2xl text-[#023047] mb-4">AISheeter.</h2>
                    <p className="text-gray-500 max-w-sm text-sm leading-relaxed">
                        Join a global community and unlock a new level of productivity within your spreadsheets.
                    </p>
                </div>
                <div>
                    <h4 className="font-bold text-[#023047] mb-4 text-sm">Product</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
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
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-[#023047] mb-4 text-sm">Company</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li><a href="#" className="hover:text-[#219EBB] transition">About</a></li>
                        <li><Link href="/privacy" className="hover:text-[#219EBB] transition">Privacy</Link></li>
                        <li><Link href="/terms" className="hover:text-[#219EBB] transition">Terms</Link></li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-gray-400">
                <p>© 2026 AISheeter. All rights reserved.</p>
                <div className="flex gap-4 mt-4 md:mt-0">
                    <a href="#" className="hover:text-[#023047]">Twitter</a>
                    <a href="#" className="hover:text-[#023047]">Discord</a>
                </div>
            </div>
        </div>
    </footer>
  );
};
