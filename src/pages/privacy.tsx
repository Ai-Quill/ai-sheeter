import React from 'react';
import Layout from '@/components/Layout';

const PrivacyPolicy: React.FC = () => {
  return (
    <Layout>
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-3xl w-full">
          <h1 className="text-3xl font-bold mb-6 text-center">Privacy Policy</h1>
          <p className="mb-4 text-sm text-gray-600 text-center">Last Updated: 24-09-2024</p>
          
          <p className="mb-4">Thank you for choosing AISheeter - Any LLM (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). This Privacy Policy explains how we collect, use, and safeguard your personal and non-personal information when you interact with our website located at https://aisheeter.com (the &quot;Website&quot;) and our Google Sheets add-on.</p>
          
          <p className="mb-4">By accessing or utilizing the Website and our add-on, you consent to the terms outlined in this Privacy Policy. If the practices described in this policy are not agreeable to you, please refrain from using our services.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
          <h3 className="text-xl font-semibold mt-4 mb-2">1.1 Personal Data</h3>
          <p className="mb-4">We gather the following personal information from you:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Name: To tailor your experience on our platform and facilitate effective communication.</li>
            <li>Email: For sending you essential information about your account, updates, and communication.</li>
            <li>Payment Information: To process your transactions securely. Please note, we do not retain your payment information on our servers. Transactions are conducted through reputable third-party payment processors.</li>
          </ul>
          
          <h3 className="text-xl font-semibold mt-4 mb-2">1.2 Non-Personal Data</h3>
          <p className="mb-4">We may utilize web cookies and similar technologies to gather non-personal data such as your IP address, browser type, device specifics, and browsing behavior. This information aids us in improving your browsing experience on our Website, understanding user trends, and enhancing our services.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Purpose of Data Collection</h2>
          <p className="mb-4">Your personal data is collected and utilized solely for processing your web scraping tasks and providing our add-on&apos;s functionality. This encompasses managing your requests, confirming your actions, offering customer support, and keeping you informed about the status of your requests and our services.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Google Workspace APIs Usage</h2>
          <p className="mb-4 font-bold">We explicitly affirm that we do not use Google Workspace APIs to develop, improve, or train generalized AI and/or ML models. Any data accessed through Google Workspace APIs is used solely for the purpose of providing our add-on&apos;s functionality to users.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Data Sharing</h2>
          <p className="mb-4">Your personal data is not shared with third parties, except as necessary for completing your web scraping requests (e.g., integrating with third-party APIs or payment processors for service enhancement). We strictly prohibit the selling, trading, or renting of your personal information to others.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Children&apos;s Privacy</h2>
          <p className="mb-4">AISheeter - Any LLM is not designed for children under the age of 13. We do not intentionally collect personal information from children. If you are a parent or guardian and suspect that your child has provided us with personal information, please contact us using the email address listed below.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">6. Data Protection Mechanisms</h2>
          <p className="mb-4">We take the protection of your sensitive data seriously and have implemented the following security measures:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Encryption: All data transmitted between your device and our servers is encrypted using industry-standard SSL/TLS protocols.</li>
            <li>Secure Storage: Sensitive data stored on our servers is encrypted at rest using AES-256 encryption.</li>
            <li>Access Controls: We employ strict access controls and authentication mechanisms to ensure that only authorized personnel can access user data, and only when necessary for providing our services.</li>
            <li>Regular Security Audits: We conduct regular security audits and vulnerability assessments to identify and address potential security risks.</li>
            <li>Data Minimization: We collect and retain only the minimum amount of data necessary to provide our services.</li>
            <li>Third-party Security: When we use third-party services, we ensure they adhere to similar security standards and have appropriate data protection measures in place.</li>
          </ul>
          <p className="mb-4">Despite these measures, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee its absolute security.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">7. Data Retention and Deletion</h2>
          <p className="mb-4">We retain user data only for as long as necessary to provide our service. Users can request deletion of their data at any time by contacting us at the email address provided below.</p>
          
          <h2 className="text-2xl font-semibold mt-8 mb-4">8. Contact Us</h2>
          <p className="mb-4">For any questions, concerns, or requests relating to this Privacy Policy or our data protection practices, please reach out to us at: tuanvutruong@gmail.com</p>
          
          <p className="mt-8 mb-4">By utilizing AISheeter - Any LLM, you acknowledge and agree to the terms of this Privacy Policy.</p>
        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;