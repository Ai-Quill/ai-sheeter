import React from 'react';
import Layout from '@/components/Layout';
import PrivacyPolicy from '@/components/PrivacyPolicy';

const PrivacyPolicyPage: React.FC = () => {
return (
<Layout>
<main className="flex-1">
<PrivacyPolicy />
</main>
</Layout>
);
};

export default PrivacyPolicyPage;