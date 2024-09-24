import React from 'react';
import Layout from '@/components/Layout';

const PrivacyPolicy: React.FC = () => {
  return (
    <Layout>
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-3xl w-full">
          <h1 className="text-3xl font-bold mb-6 text-center">Privacy Policy</h1>
          <p className="mb-4 text-sm text-gray-600 text-center">Last updated: 24-09-2024</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Introduction</h2>
          <p className="mb-4">This Privacy Policy describes how ai-sheet (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) collects, uses, and shares your information when you use our Google Sheets add-on.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Information Collection and Use</h2>
          <p className="mb-4">We collect and use information to provide and improve our service. This may include:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Email address and basic profile information (for user identification and personalization)</li>
            <li>Google Sheets data (to perform add-on functions)</li>
          </ul>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Google Workspace APIs Usage</h2>
          <p className="mb-4 font-bold">We explicitly affirm that we do not use Google Workspace APIs to develop, improve, or train generalized AI and/or ML models. Any data accessed through Google Workspace APIs is used solely for the purpose of providing our add-on&apos;s functionality to users.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Data Retention and Deletion</h2>
          <p className="mb-4">We retain user data only for as long as necessary to provide our service. Users can request deletion of their data at any time.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Changes to This Privacy Policy</h2>
          <p className="mb-4">We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">6. Contact Us</h2>
          <p className="mb-4">If you have any questions about this Privacy Policy, please contact us at: tuanvutruong@gmail.com</p>
        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;