import React from 'react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <h1 className="text-4xl font-bold mb-4">Welcome to AI Sheet - Any LLM</h1>
      <p className="text-lg mb-8 text-center">
        Supercharge your Google Sheets with the power of AI. Seamlessly integrate with any Large Language Model (LLM) and transform your data processing and analysis.
      </p>
      <div className="mb-8">
        <a href="/api/get-user-settings" className="px-4 py-2 bg-blue-500 text-white rounded mr-2">Get Started</a>
        <a href="#features" className="px-4 py-2 bg-gray-500 text-white rounded">Learn More</a>
      </div>
      <div id="features" className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-4">Features</h2>
        <ul className="list-disc list-inside mb-8">
          <li className="mb-2">Integrate with multiple LLMs like ChatGPT, Claude, Groq, and Gemini.</li>
          <li className="mb-2">Easily manage API keys and model configurations.</li>
          <li className="mb-2">Track your credit usage and logs in real-time.</li>
          <li className="mb-2">User-friendly interface with seamless Google Sheets integration.</li>
          <li className="mb-2">Secure and private - your data is always protected.</li>
        </ul>
        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
        <p className="mb-4">
          AI Sheet - Any LLM allows you to harness the power of AI directly within your Google Sheets. Simply configure your API keys and model preferences, and start using custom functions to interact with the AI models. Whether you need to generate text, analyze data, or automate tasks, AI Sheet has got you covered.
        </p>
        <h2 className="text-2xl font-bold mb-4">Get Started</h2>
        <p className="mb-4">
          Click the &quot;Get Started&quot; button above to configure your settings and start using AI Sheet - Any LLM today!
        </p>
      </div>
    </div>
  );
};

export default LandingPage;