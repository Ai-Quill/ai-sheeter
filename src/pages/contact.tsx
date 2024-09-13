import React, { useState } from 'react';
import Layout from '@/components/Layout';

const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred');
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <Layout>
            <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4 text-gray-800">
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4">Contact Us</h1>
        <p className="mb-4">For support, please email us at: <a href="mailto:tuanvutruong@gmail.com" className="text-blue-600 hover:underline">tuanvutruong@gmail.com</a>
         <br/>or fill out the form below.
        </p>
        
        {submitted ? (
          <p className="text-green-600">Thank you for your message. We&apos;ll get back to you soon!</p>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-md">
            <div className="mb-4">
              <label htmlFor="name" className="block mb-2">Name:</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="email" className="block mb-2">Email:</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="message" className="block mb-2">Message:</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
                rows={4}
              ></textarea>
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Submit
            </button>
            {error && <p className="text-red-600 mt-2">{error}</p>}
          </form>
        )}
      </main>
      </div>
    </Layout>
  );
};

export default ContactPage;