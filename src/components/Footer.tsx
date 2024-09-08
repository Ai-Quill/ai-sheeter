import React from 'react';
import Link from 'next/link';

const Footer: React.FC = () => {
  return (
    <footer className="flex flex-col gap-4 sm:flex-row py-8 w-full shrink-0 items-center px-6 md:px-8 border-t border-red-200">
    <p className="text-sm text-gray-500">
      © 2024 Aisheet.app. All rights reserved.
    </p>
    <nav className="sm:ml-auto flex gap-6">
      <Link className="text-sm hover:underline underline-offset-4 text-gray-500 hover:text-red-600" href="/terms">
        Terms of Service
      </Link>
      <Link className="text-sm hover:underline underline-offset-4 text-gray-500 hover:text-red-600" href="/privacy">
        Privacy
      </Link>
    </nav>
  </footer>
  );
};

export default Footer;