import React from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div>
      <Header />
      <div className="flex flex-col min-h-screen bg-white text-gray-800 font-sans">
      {children}
      </div>
      <Footer />
    </div>
  );
};

export default Layout;