'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Sparkles, ChevronRight, Play, RotateCcw } from 'lucide-react';

interface ConversationStep {
  type: 'user' | 'agent' | 'result';
  content: string;
  delay: number;
}

interface DemoScenario {
  id: string;
  title: string;
  icon: string;
  description: string;
  conversation: ConversationStep[];
  beforeData: string[][];
  afterData: string[][];
}

const scenarios: DemoScenario[] = [
  {
    id: 'sales',
    title: 'Sales Pipeline',
    icon: '📊',
    description: 'Analyze CRM notes and score deals',
    conversation: [
      { type: 'user', content: "Extract the key buying signals and objections from Sales Notes column D to columns E and F", delay: 0 },
      { type: 'agent', content: "I see 8 deals in your selection. I'll analyze each Sales Notes entry and extract:\n• Column E: Buying Signals\n• Column F: Objections\n\nProcessing rows 2-9...", delay: 1500 },
      { type: 'result', content: "✅ Done! Extracted signals and objections for 8 deals.\n\nWant me to score win probability based on these signals?", delay: 3500 },
      { type: 'user', content: "Yes, score as High/Medium/Low with a reason to column G", delay: 4500 },
      { type: 'result', content: "✅ Scored all deals. Found:\n• 3 High probability ($567K)\n• 2 Medium ($545K)\n• 3 Low/At-risk ($2.1M)\n\nNoticed: Datadog has Feb 20 deadline - decision maker going on leave.", delay: 6500 }
    ],
    beforeData: [
      ['Company', 'Deal Size', 'Stage', 'Sales Notes'],
      ['Stripe', '$450K', 'Negotiation', 'CFO loves ROI, CTO worried about API...'],
      ['Notion', '$180K', 'Proposal', 'Champion pushing, legal reviewing...'],
      ['Datadog', '$320K', 'Negotiation', 'Technical win, Feb 20 deadline...']
    ],
    afterData: [
      ['Company', 'Deal Size', 'Stage', 'Signals', 'Objections', 'Probability'],
      ['Stripe', '$450K', 'Negotiation', 'Budget Q2, ROI+', 'API timeline', 'Medium'],
      ['Notion', '$180K', 'Proposal', 'Champion, Mar deadline', 'Legal review', 'High'],
      ['Datadog', '$320K', 'Negotiation', 'Tech win, urgent', 'Discount ask', 'High']
    ]
  },
  {
    id: 'feedback',
    title: 'Feedback Mining',
    icon: '💬',
    description: 'Extract themes from customer reviews',
    conversation: [
      { type: 'user', content: "Analyze sentiment for each review in column C - rate as Positive, Negative, or Mixed to column D", delay: 0 },
      { type: 'agent', content: "Analyzing 10 customer reviews. I'll classify sentiment considering:\n• Overall tone\n• Specific praise/complaints\n• Rating context from column B\n\nProcessing...", delay: 1500 },
      { type: 'result', content: "✅ Sentiment analysis complete for 10 reviews.\n\nBreakdown: 4 Positive, 3 Negative, 3 Mixed\n\nShould I extract specific feature requests mentioned?", delay: 3500 },
      { type: 'user', content: "Yes, extract feature requests to column E and prioritize as P0/P1/P2 based on customer type to column F", delay: 4500 },
      { type: 'result', content: "✅ Extracted and prioritized!\n\nTop issues found:\n• P0: SSO integration (blocking $30K enterprise deal)\n• P0: Mobile app (customer churned to Monday.com)\n• P1: Dashboard performance (enterprise complaint)", delay: 6500 }
    ],
    beforeData: [
      ['Source', 'Rating', 'Feedback'],
      ['G2 Review', '3/5', 'Love the API but dashboard is slow...'],
      ['Support', '—', 'How do I export to CSV? Buried in settings...'],
      ['NPS Survey', '9/10', 'Powerful but onboarding was rough...']
    ],
    afterData: [
      ['Source', 'Rating', 'Feedback', 'Sentiment', 'Request', 'Priority'],
      ['G2 Review', '3/5', 'Love the API but...', 'Mixed', 'Dashboard speed', 'P1'],
      ['Support', '—', 'How do I export...', 'Negative', 'CSV export UX', 'P2'],
      ['NPS Survey', '9/10', 'Powerful but...', 'Positive', 'Better docs', 'P2']
    ]
  },
  {
    id: 'localization',
    title: 'Content Localization',
    icon: '🌍',
    description: 'Translate and adapt marketing content',
    conversation: [
      { type: 'user', content: "Translate English Content in column C to the language for each Target Market in column D. Write to column E", delay: 0 },
      { type: 'agent', content: "I see 10 content pieces targeting: Germany, Japan, France, Brazil, Spain, Mexico, India, UAE, South Korea, Netherlands.\n\nI'll translate each to the appropriate language, preserving tone and intent.\n\nProcessing...", delay: 1500 },
      { type: 'result', content: "✅ Translations complete!\n\nUsed: German, Japanese, French, Portuguese (BR), Spanish (ES), Spanish (MX), Hindi, Arabic, Korean, Dutch\n\nWant me to flag content needing cultural adaptation?", delay: 3500 },
      { type: 'user', content: "Yes, flag cultural issues to column F", delay: 4500 },
      { type: 'result', content: "✅ Cultural review complete!\n\nFlagged 6 items:\n• Japan: 'Free Trial' may imply low quality\n• UAE: Urgency marketing less effective\n• Mexico: USD needs local currency context\n• Spain: 'Oops!' too casual for B2B", delay: 6500 }
    ],
    beforeData: [
      ['Type', 'English Content', 'Target Market'],
      ['Headline', 'Supercharge Your Workflow', 'Germany'],
      ['CTA', 'Start Free Trial', 'Japan'],
      ['Error', 'Oops! Something went wrong', 'Spain']
    ],
    afterData: [
      ['Type', 'English', 'Market', 'Translation', 'Cultural Flag'],
      ['Headline', 'Supercharge...', 'Germany', 'Beschleunigen Sie...', '✓ OK'],
      ['CTA', 'Start Free Trial', 'Japan', '無料トライアル...', '⚠️ Review'],
      ['Error', 'Oops! Something...', 'Spain', '¡Ups! Algo salió...', '⚠️ Too casual']
    ]
  }
];

const MiniSpreadsheet: React.FC<{ data: string[][]; highlight?: boolean }> = ({ data, highlight }) => (
  <motion.div 
    className={`bg-white rounded-xl border-2 ${highlight ? 'border-emerald-300 shadow-emerald-100/50 shadow-lg' : 'border-gray-100'} overflow-hidden text-xs transition-all duration-500`}
    animate={highlight ? { scale: [1, 1.01, 1] } : {}}
    transition={{ duration: 0.3 }}
  >
    <div className="overflow-x-auto">
      <table className="w-full">
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className={rowIdx === 0 ? 'bg-gradient-to-r from-gray-50 to-gray-100/50 font-semibold text-[#023047]' : 'hover:bg-gray-50/50 transition-colors'}>
              {row.map((cell, cellIdx) => (
                <motion.td
                  key={cellIdx}
                  initial={highlight && rowIdx > 0 && cellIdx >= data[0].length - 3 ? { backgroundColor: 'transparent' } : {}}
                  animate={highlight && rowIdx > 0 && cellIdx >= data[0].length - 3 ? { backgroundColor: 'rgb(236 253 245)' } : {}}
                  transition={{ duration: 0.5, delay: rowIdx * 0.1 }}
                  className={`px-3 py-2 border-b border-r border-gray-100/80 truncate max-w-[100px]`}
                >
                  {cell}
                </motion.td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </motion.div>
);

const ConversationMessage: React.FC<{ step: ConversationStep }> = ({ step }) => {
  if (step.type === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="flex justify-end"
      >
        <div className="bg-gradient-to-br from-[#023047] to-[#034a6e] text-white px-5 py-3 rounded-2xl rounded-br-md max-w-[80%] shadow-lg shadow-[#023047]/20">
          <p className="text-sm leading-relaxed">{step.content}</p>
        </div>
      </motion.div>
    );
  }

  if (step.type === 'agent') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="flex justify-start"
      >
        <div className="bg-white border-2 border-gray-100 text-gray-700 px-5 py-3 rounded-2xl rounded-bl-md max-w-[80%] shadow-md">
          <div className="flex items-center gap-2 text-[#209EBB] mb-2">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Sparkles size={14} />
            </motion.div>
            <span className="text-xs font-semibold uppercase tracking-wide">Agent</span>
          </div>
          <div className="whitespace-pre-line text-sm leading-relaxed">{step.content}</div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex justify-start"
    >
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 text-emerald-800 px-5 py-3 rounded-2xl max-w-[80%] shadow-md shadow-emerald-100">
        <div className="whitespace-pre-line text-sm leading-relaxed font-medium">{step.content}</div>
      </div>
    </motion.div>
  );
};

export const AgentShowcase: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState(scenarios[0]);
  const [visibleSteps, setVisibleSteps] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAfter, setShowAfter] = useState(false);

  const resetDemo = () => {
    setVisibleSteps(0);
    setIsPlaying(false);
    setShowAfter(false);
  };

  const playDemo = () => {
    resetDemo();
    setIsPlaying(true);

    activeScenario.conversation.forEach((step, idx) => {
      setTimeout(() => {
        setVisibleSteps(idx + 1);
        if (idx === activeScenario.conversation.length - 1) {
          setTimeout(() => setShowAfter(true), 500);
        }
      }, step.delay);
    });
  };

  useEffect(() => {
    resetDemo();
  }, [activeScenario]);

  return (
    <section className="py-28 px-4 bg-gradient-to-b from-white via-gray-50/50 to-white relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 dot-pattern opacity-50" />
      
      {/* Decorative blurs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[#8ECAE6]/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#FFB701]/10 rounded-full blur-3xl" />
      
      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <motion.span 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="inline-block px-4 py-1.5 bg-[#209EBB]/10 text-[#209EBB] text-sm font-medium rounded-full mb-6"
          >
            Interactive Demo
          </motion.span>
          <h2 className="font-serif text-4xl md:text-5xl text-[#023047] mb-6 tracking-tight">
            See the <span className="italic gradient-text">agent</span> in action
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg leading-relaxed">
            One conversation. Multiple steps. Real results in your spreadsheet.
          </p>
        </motion.div>

        {/* Scenario Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {scenarios.map((scenario, idx) => (
            <motion.button
              key={scenario.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => setActiveScenario(scenario)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-6 py-3.5 rounded-2xl flex items-center gap-3 transition-all duration-300 font-medium ${
                activeScenario.id === scenario.id
                  ? 'bg-[#023047] text-white shadow-xl shadow-[#023047]/20'
                  : 'bg-white text-gray-600 border-2 border-gray-100 hover:border-[#209EBB]/30 hover:shadow-lg'
              }`}
            >
              <span className="text-xl">{scenario.icon}</span>
              <span>{scenario.title}</span>
            </motion.button>
          ))}
        </div>

        {/* Demo Area */}
        <motion.div
          key={activeScenario.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid md:grid-cols-2 gap-8"
        >
          {/* Conversation Panel */}
          <div className="bg-white rounded-3xl border-2 border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden hover-lift">
            <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#209EBB] to-[#8ECAE6] flex items-center justify-center">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <span className="font-semibold text-[#023047]">Agent Conversation</span>
              </div>
              <div className="flex items-center gap-2">
                {visibleSteps > 0 && (
                  <motion.button
                    whileHover={{ rotate: -180 }}
                    transition={{ duration: 0.3 }}
                    onClick={resetDemo}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <RotateCcw size={16} className="text-gray-400" />
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={playDemo}
                  disabled={isPlaying && visibleSteps < activeScenario.conversation.length}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#209EBB] to-[#8ECAE6] text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#209EBB]/30 transition-all disabled:opacity-50 shimmer-btn"
                >
                  <Play size={14} fill="white" />
                  {visibleSteps === 0 ? 'Play Demo' : 'Replay'}
                </motion.button>
              </div>
            </div>
            
            <div className="h-[350px] overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-white to-gray-50/30">
              {visibleSteps === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles size={48} className="mb-4 text-[#209EBB]/30" />
                  </motion.div>
                  <p className="font-medium">Click &quot;Play Demo&quot; to see the agent in action</p>
                </div>
              ) : (
                <AnimatePresence>
                  {activeScenario.conversation.slice(0, visibleSteps).map((step, idx) => (
                    <ConversationMessage key={idx} step={step} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Spreadsheet Panel */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-600">Before</span>
              </div>
              <MiniSpreadsheet data={activeScenario.beforeData} />
            </div>
            
            <div className="flex justify-center">
              <ChevronRight size={24} className="text-gray-300 rotate-90" />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-600">After</span>
                {showAfter && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
                  >
                    New columns added
                  </motion.span>
                )}
              </div>
              <MiniSpreadsheet data={activeScenario.afterData} highlight={showAfter} />
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-14 text-center"
        >
          <motion.a 
            href="https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex bg-gradient-to-r from-[#023047] to-[#034a6e] text-white px-10 py-5 rounded-2xl hover:shadow-2xl hover:shadow-[#023047]/30 transition-all font-semibold text-lg items-center gap-3 shimmer-btn group"
          >
            Try It With Your Data
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </motion.span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};
