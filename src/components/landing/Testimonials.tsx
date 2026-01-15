import React from 'react';

const TESTIMONIALS = [
  {
    quote: "We used to spend 4 hours cleaning lead data every Monday. Now it takes 10 minutes. The ROI is insane.",
    author: "Elena Rodriguez",
    role: "Head of Growth",
    company: "SaaS Startup (Series A)",
    useCase: "Lead qualification",
    avatar: "https://i.pravatar.cc/100?img=5"
  },
  {
    quote: "BYOK model is genius. I processed 50,000 rows last month and my OpenAI bill was only $12. Way cheaper than alternatives.",
    author: "Marcus Chen",
    role: "Data Engineer",
    company: "E-commerce Company",
    useCase: "Product categorization",
    avatar: "https://i.pravatar.cc/100?img=11"
  },
  {
    quote: "Finally, AI that works WHERE my data lives. No more exporting to ChatGPT. The agent mode is like having a junior analyst.",
    author: "Sarah Kim",
    role: "Operations Manager",
    company: "Marketing Agency",
    useCase: "Client reporting",
    avatar: "https://i.pravatar.cc/100?img=9"
  }
];

export const Testimonials: React.FC = () => {
  return (
    <section className="py-24 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
                <p className="text-sm font-bold text-[#219EBB] uppercase tracking-widest mb-4">From real users</p>
                <h2 className="font-serif text-3xl md:text-4xl text-[#023047]">Loved by data pros</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {TESTIMONIALS.map((t, i) => (
                    <div key={i} className="p-8 bg-[#FAFAFA] rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow duration-300 flex flex-col">
                        {/* Use case tag */}
                        <div className="mb-4">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#219EBB] bg-[#219EBB]/10 px-2 py-1 rounded-full">
                                {t.useCase}
                            </span>
                        </div>
                        
                        <div className="flex gap-1 mb-4">
                            {[1,2,3,4,5].map(s => <span key={s} className="text-[#FFB701]">★</span>)}
                        </div>
                        
                        <p className="text-gray-600 mb-6 leading-relaxed flex-1">&quot;{t.quote}&quot;</p>
                        
                        <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                            <img src={t.avatar} alt={t.author} className="w-12 h-12 rounded-full" />
                            <div>
                                <p className="font-bold text-[#023047] text-sm">{t.author}</p>
                                <p className="text-xs text-gray-500">{t.role}</p>
                                <p className="text-xs text-gray-400">{t.company}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </section>
  );
};
