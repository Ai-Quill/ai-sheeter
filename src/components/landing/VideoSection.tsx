import React from 'react';

export const VideoSection: React.FC = () => {
  return (
    <section id="demo" className="py-24 px-4 bg-[#FAFAFA]">
        <div className="max-w-5xl mx-auto text-center">
            <p className="text-sm font-bold text-[#219EBB] uppercase tracking-widest mb-4">Sales Pipeline Intelligence Demo</p>
            <h2 className="font-serif text-3xl md:text-4xl text-[#023047] mb-4">See the agent in action</h2>
            <p className="text-gray-500 mb-8 max-w-xl mx-auto">Watch how AISheeter transforms messy CRM notes into actionable insights with a 3-step workflow — extract signals, score deals, and get recommendations.</p>
            
            <div className="relative aspect-video bg-[#023047] rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                <iframe
                    className="absolute inset-0 w-full h-full"
                    src="https://www.youtube.com/embed/ZLjzE5s75Bg"
                    title="AISheeter Demo - Sales Pipeline Intelligence"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                />
            </div>
            
            <p className="text-gray-500 text-sm mt-4">Multi-step task chains • Conversation memory • Output format control</p>
        </div>
    </section>
  );
};
