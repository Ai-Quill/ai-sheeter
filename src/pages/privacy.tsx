import React from 'react';
import Layout from '@/components/Layout';
import PrivacyPolicy from '@/components/PrivacyPolicy';
import Link from 'next/link';

const PrivacyPolicyPage: React.FC = () => {
return (
<Layout>
<main className="flex-1">
<PrivacyPolicy />
<div className="mt-6 text-center">
<Link href="/contact" className="text-blue-600 hover:underline">
Contact Us
</Link>
</div>
</main>
</Layout>
);
};

export default PrivacyPolicyPage;