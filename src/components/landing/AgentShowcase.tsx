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
      { type: 'user', content: "Sales reps write these notes but nobody has time to read them all. Help me understand which deals need attention.", delay: 0 },
      { type: 'agent', content: "I'll create a 3-step workflow:\n1. Extract signals & blockers from notes\n2. Score win probability (High/Medium/Low)\n3. Generate specific next actions\n\nProcessing 8 deals...", delay: 1500 },
      { type: 'result', content: "✅ Complete! Found:\n• 3 High probability deals ($567K)\n• 2 Medium probability ($545K)\n• 3 At-risk deals ($2.1M)\n\nTop action: Get Datadog commitment before Feb 20", delay: 4000 }
    ],
    beforeData: [
      ['Company', 'Notes', 'Stage'],
      ['Stripe', 'CFO loves ROI, CTO worried about API...', 'Negotiation'],
      ['Notion', 'Champion pushing, legal review...', 'Proposal'],
      ['Datadog', 'Technical win, Feb 20 deadline...', 'Negotiation']
    ],
    afterData: [
      ['Company', 'Notes', 'Stage', 'Signals', 'Probability', 'Next Action'],
      ['Stripe', 'CFO loves ROI...', 'Negotiation', 'Budget Q2, ROI+', 'Medium', 'Schedule DevOps call'],
      ['Notion', 'Champion pushing...', 'Proposal', 'Champion, deadline', 'High', 'Send SSO docs'],
      ['Datadog', 'Technical win...', 'Negotiation', 'Tech win, urgent', 'High', 'Close before Feb 20']
    ]
  },
  {
    id: 'feedback',
    title: 'Feedback Mining',
    icon: '💬',
    description: 'Extract themes from customer reviews',
    conversation: [
      { type: 'user', content: "We have 500 product reviews. What are customers saying and what should we prioritize?", delay: 0 },
      { type: 'agent', content: "I'll analyze sentiment and extract themes:\n1. Classify sentiment (Positive/Negative/Neutral)\n2. Extract recurring themes\n3. Score priority by frequency × impact\n\nProcessing reviews...", delay: 1500 },
      { type: 'result', content: "✅ Analysis complete!\n\nTop issues:\n1. Mobile app crashes (45 mentions) - HIGH\n2. Missing dark mode (67 requests) - MEDIUM\n3. Slow sync (23 complaints) - HIGH\n\nQuick win: Fix iOS 17 crash (2hr fix)", delay: 4000 }
    ],
    beforeData: [
      ['Review', 'Rating', 'Date'],
      ['Love it but app crashes on my iPhone', '3', '2026-01-15'],
      ['Great features, wish it had dark mode', '4', '2026-01-14'],
      ['Sync is painfully slow sometimes', '2', '2026-01-13']
    ],
    afterData: [
      ['Review', 'Rating', 'Sentiment', 'Theme', 'Priority'],
      ['Love it but app crashes...', '3', 'Mixed', 'App Stability', 'High'],
      ['Great features, wish it had...', '4', 'Positive', 'Dark Mode', 'Medium'],
      ['Sync is painfully slow...', '2', 'Negative', 'Performance', 'High']
    ]
  },
  {
    id: 'localization',
    title: 'Content Localization',
    icon: '🌍',
    description: 'Translate and localize marketing content',
    conversation: [
      { type: 'user', content: "Translate our landing page copy to Spanish, French, and German. Make it sound natural, not robotic.", delay: 0 },
      { type: 'agent', content: "I'll create a localization workflow:\n1. Translate preserving brand voice\n2. Adapt for cultural context\n3. Quality check with confidence scores\n\nWhich Spanish? LATAM or Spain?", delay: 1500 },
      { type: 'user', content: "LATAM Spanish please", delay: 3000 },
      { type: 'result', content: "✅ Localization complete!\n\n• Spanish (LATAM): 96% confidence\n• French: 94% confidence\n• German: 95% confidence\n\n2 items flagged for human review", delay: 4500 }
    ],
    beforeData: [
      ['English', 'Context'],
      ['Hit the ground running', 'Headline'],
      ['24/7 support available', 'Feature'],
      ['Free trial, no strings attached', 'CTA']
    ],
    afterData: [
      ['English', 'Spanish', 'French', 'German'],
      ['Hit the ground running', 'Empieza con el pie derecho', 'Démarrez sur les chapeaux...', 'Durchstarten ohne...'],
      ['24/7 support available', 'Soporte disponible 24/7', 'Support disponible 24h/24', '24/7 Support verfügbar'],
      ['Free trial, no strings...', 'Prueba gratis, sin...', 'Essai gratuit, sans...', 'Kostenlose Testversion...']
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
