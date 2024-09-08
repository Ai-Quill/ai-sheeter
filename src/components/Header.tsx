import React from 'react';
import Link from 'next/link';
import Image from 'next/image'
const Header: React.FC = () => {
  return (
    <header className="px-6 lg:px-8 h-20 flex items-center border-b border-red-200">
        <Link className="flex items-center justify-center" href="/">
          <Image
            src="/images/logo.png"
            alt="Aisheet.app Logo"
            width={48}
            height={48}
            className="mr-3"
          />
          <span className="font-bold text-3xl text-red-600">Aisheet.app</span>
        </Link>
        <nav className="ml-auto flex gap-8">
          <Link className="text-base font-medium hover:text-red-600 transition-colors" href="#features">
            Features
          </Link>
          <Link className="text-base font-medium hover:text-red-600 transition-colors" href="#faq">
            FAQ
          </Link>
        </nav>
      </header>
  );
};

export default Header;