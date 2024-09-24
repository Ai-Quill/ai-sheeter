import React from 'react';
import Layout from '@/components/Layout';
import TermsOfService from '@/components/TermsOfService';

const TermsOfServicePage: React.FC = () => {
  return (
    <Layout>
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-3xl w-full">
          <TermsOfService />
        </div>
      </div>
    </Layout>
  );
};

export default TermsOfServicePage;