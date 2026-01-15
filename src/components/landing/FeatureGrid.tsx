import React from 'react';
import { motion } from 'framer-motion';
import { FunctionSquare, KeyRound, Layers, Repeat, Bot } from 'lucide-react';

const features = [
  {
    title: "Native Formula Functions",
    description: "Use =ChatGPT(), =Claude(), =Gemini() like any spreadsheet formula. Fill down, reference cells, chain with other functions. It just works.",
    icon: <FunctionSquare size={24} className="text-[#219EBB]" />,
    color: "bg-[#219EBB]",
    colSpan: "md:col-span-1"
  },
  {
    title: "Bring Your Own Keys",
    description: "Connect your own API keys from OpenAI, Anthropic, or Google. Pay providers directly — often 10x cheaper than markup services.",
    icon: <KeyRound size={24} className="text-[#FFB701]" />,
    color: "bg-[#FFB701]",
    colSpan: "md:col-span-1"
  },
  {
    title: "Background Bulk Jobs",
    description: "Process 1,000+ rows without freezing your browser. Jobs run on our servers — close the tab and we'll email you when it's done.",
    icon: <Layers size={24} className="text-[#8ECAE6]" />,
    color: "bg-[#8ECAE6]",
    colSpan: "md:col-span-1"
  },
  {
    title: "Multi-Model Freedom",
    description: "Switch between GPT-4o, Claude Sonnet, Gemini Flash, or Groq instantly. Pick the best model for each task — speed, cost, or quality. No lock-in.",
    icon: <Repeat size={24} className="text-purple-500" />,
    color: "bg-purple-500",
    colSpan: "md:col-span-2"
  },
  {
    title: "Smart Agent Mode",
    description: "Tell it what you want in plain English: \"Extract emails and classify sentiment.\" The agent plans the steps, picks columns, and executes.",
    icon: <Bot size={24} className="text-[#023047]" />,
    color: "bg-[#023047]",
    colSpan: "md:col-span-1"
  }
];

export const FeatureGrid: React.FC = () => {
  return (
    <section id="features" className="py-24 px-4 max-w-7xl mx-auto">
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
        >
            <h2 className="font-serif text-4xl md:text-5xl text-[#023047] mb-6">
                Focus on what matters — <br />
                <span className="italic text-[#FFB701]">leave the rest to AI</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
                No more copy-pasting into ChatGPT. AISheeter puts GPT-4, Claude, and Gemini right inside your spreadsheet — as simple formulas or a conversational agent.
            </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    whileHover={{ y: -5 }}
                    className={`bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-lg transition-shadow ${feature.colSpan}`}
                >
                    <div className="mb-6">
                        <div className={`w-12 h-1 ${feature.color} mb-4 opacity-50 rounded-full`}></div>
                        {/* Abstract Art Placeholder related to feature color */}
                        <div className="h-24 w-full mb-6 relative overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center group">
                             <div className={`absolute inset-0 opacity-10 ${feature.color}`}></div>
                             <div className="transform transition-transform group-hover:scale-110 duration-500">
                                {feature.icon}
                             </div>
                        </div>
                        
                        <h3 className="font-serif text-2xl text-[#023047] mb-3">{feature.title}</h3>
                        <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    </section>
  );
};
