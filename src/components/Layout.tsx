import React from 'react';
import Header from './Header';
import Footer from './Footer';
import { poppins } from '@/app/fonts';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className={`${poppins.variable} font-sans`}>
      <Header />
      <div className="flex flex-col min-h-screen bg-white text-gray-800">
        {children}
      </div>
      <Footer />
    </div>
  );
};

export default Layout;