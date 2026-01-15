'use client';

import React, { useState, useEffect } from 'react';
import { HeroSection } from '@/components/landing/HeroSection';
import { LogoTicker } from '@/components/landing/LogoTicker';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { ComparisonSection } from '@/components/landing/ComparisonSection';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { UseCases } from '@/components/landing/UseCases';
import { VideoSection } from '@/components/landing/VideoSection';
import { Testimonials } from '@/components/landing/Testimonials';
import { PricingSection } from '@/components/landing/PricingSection';
import { FAQ } from '@/components/landing/FAQ';
import { CTASection } from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';
import { Navbar } from '@/components/landing/Navbar';
import Head from 'next/head';

export default function LandingPage() {
  const [loading, setLoading] = useState(true);

  // Simulate initial asset loading/animation lock
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 4500); // Syncs with the intro animation duration
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Head>
        <title>AISheeter - Smarter Google Sheets with AI</title>
        <meta name="description" content="Clean data, extract leads, and automate research directly inside Google Sheets. Use AI formulas like =ChatGPT(), =Claude(), =Gemini() in any cell." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className={`min-h-screen bg-[#FAFAFA] text-[#023047] selection:bg-[#FFB701] selection:text-white ${loading ? 'h-screen overflow-hidden' : ''}`}>
        <Navbar show={!loading} />
        
        <main>
          <HeroSection onAnimationComplete={() => setLoading(false)} />
          
          <div className="relative z-10 bg-[#FAFAFA]">
              <LogoTicker />
              <ProblemSolution />
              <ComparisonSection />
              <UseCases />
              <FeatureGrid />
              <VideoSection />
              <Testimonials />
              <PricingSection />
              <FAQ />
              <CTASection />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
