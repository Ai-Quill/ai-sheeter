'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { 
  ChevronRight, 
  Star, 
  Shield, 
  Sparkles,
  Zap,
  Brain,
  Globe,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Database,
  MessageSquare
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function AisheetLandingPage() {
  const [isVideoOpen, setIsVideoOpen] = useState(false)

  return (
    <main className="flex-1 bg-[#F8FAFC]">
      {/* Hero Section - 8px grid spacing */}
      <section className="w-full py-32 md:py-40 lg:py-48 xl:py-56 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container px-4 md:px-8 max-w-7xl mx-auto">
          <div className="flex flex-col items-center space-y-8 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>Now with AI-Powered Agent</span>
            </div>
            
            {/* Main Heading */}
            <div className="space-y-6 max-w-4xl">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 leading-[1.1]">
                AI That Understands
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  Your Spreadsheets
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-xl md:text-2xl text-gray-600 leading-relaxed">
                Process thousands of rows with AI-powered intelligence. Automatic classification, 
                multi-language support, and smart table detection—all inside Google Sheets™.
              </p>
            </div>
            
            {/* CTA Buttons - 8px spacing */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Button 
                size="lg"
                className="bg-blue-600 text-white hover:bg-blue-700 text-lg px-8 py-6 shadow-lg shadow-blue-600/20" 
                onClick={() => window.open('https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853', '_blank')}
              >
                Download Free
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="text-gray-700 border-2 border-gray-300 hover:bg-gray-50 text-lg px-8 py-6" 
                onClick={() => setIsVideoOpen(true)}
              >
                Watch Demo
              </Button>
            </div>

            {/* Trust Indicators - 8px spacing */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>411+ Active Users</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>383K+ AI Queries</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Free Tier Available</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* New Agent Features Section - Highlight */}
      <section className="w-full py-24 bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 text-white">
        <div className="container px-4 md:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              <span>Just Released: January 2026</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Introducing AI Agent
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              The intelligent assistant that understands what you want—just describe your task in plain language
            </p>
          </div>

          {/* Agent Features Grid - 8px grid spacing */}
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <Brain className="w-12 h-12 mb-4 text-blue-200" />
              <h3 className="text-xl font-semibold mb-3">AI-Driven Classification</h3>
              <p className="text-blue-100">
                Automatically detects the right options for each column. Sentiment? Priority? Yes/No? 
                The AI figures it out in any language.
              </p>
              <div className="mt-4 text-sm text-blue-200">
                95% accuracy • Unlimited languages
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <Database className="w-12 h-12 mb-4 text-blue-200" />
              <h3 className="text-xl font-semibold mb-3">Smart Table Detection</h3>
              <p className="text-blue-100">
                Instantly recognizes your data structure. Filled columns, empty columns, headers—all 
                detected automatically.
              </p>
              <div className="mt-4 text-sm text-blue-200">
                Auto-detects • Multi-column support
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <RefreshCw className="w-12 h-12 mb-4 text-blue-200" />
              <h3 className="text-xl font-semibold mb-3">Always Fresh Context</h3>
              <p className="text-blue-100">
                Switch sheets? No problem. The agent always knows which sheet you're on and uses the 
                right data every time.
              </p>
              <div className="mt-4 text-sm text-blue-200">
                100% reliable • Sheet-aware
              </div>
            </div>
          </div>

          {/* Example Usage */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/20 p-8">
              <div className="flex items-start gap-4">
                <MessageSquare className="w-6 h-6 text-blue-200 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm text-blue-200 mb-2">You type:</div>
                  <div className="bg-white/10 rounded-lg p-4 mb-4 font-mono text-sm">
                    "Please fill in this data table for me"
                  </div>
                  <div className="text-sm text-blue-200 mb-2">AI Agent:</div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>Detected: 10 reviews in Vietnamese</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>Column D: Sentiment → "Tốt, Xấu, Bình thường"</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>Column E: Quality related? → "Có, Không"</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features - Modern Cards with 8px spacing */}
      <section id="features" className="w-full py-24">
        <div className="container px-4 md:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Everything You Need
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From simple formulas to intelligent bulk processing—all the power of modern AI in your spreadsheets
            </p>
          </div>

          {/* Features Grid - 8px spacing */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature Card 1 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Simple Formulas</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Use AI with familiar formulas like <code className="text-blue-600 bg-blue-50 px-1 rounded">=ChatGPT()</code> or <code className="text-blue-600 bg-blue-50 px-1 rounded">=Claude()</code>
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">4 AI Models</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                ChatGPT, Claude, Gemini™, and Groq—choose the best model for your task
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Cost Tracking</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Automatic token calculation and real-time cost estimates for every query
              </p>
            </div>

            {/* Feature Card 4 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Encrypted & Secure</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                All API keys encrypted with industry-standard security protocols
              </p>
            </div>
          </div>

          {/* Additional Features Row */}
          <div className="grid md:grid-cols-3 gap-6 mt-6">
            {/* Feature Card 5 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <RefreshCw className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Bulk Processing</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Process thousands of rows with real-time progress tracking and SSE updates
              </p>
            </div>

            {/* Feature Card 6 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Language</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Works seamlessly in 14+ languages with automatic language detection
              </p>
            </div>

            {/* Feature Card 7 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-cyan-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Prompts</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Context-aware prompts that understand your data structure automatically
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Video - 8px spacing */}
      <section id="how-it-works" className="w-full py-24 bg-white">
        <div className="container px-4 md:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              See It In Action
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Watch how AISheeter transforms your spreadsheet workflow in minutes
            </p>
          </div>
          <div className="mx-auto max-w-5xl">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
              <iframe
                className="w-full aspect-video"
                src="https://www.youtube.com/embed/HczW0F_tmvo?si=kLGR7W-HH7Vr_rBy"
                title="AISheeter Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials - 8px spacing */}
      <section id="testimonials" className="w-full py-24 bg-[#F8FAFC]">
        <div className="container px-4 md:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Loved by Data Teams
            </h2>
            <p className="text-xl text-gray-600">
              Join hundreds of professionals using AI to supercharge their workflows
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Testimonial 1 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-4 leading-relaxed">
                "The new AI Agent is a game-changer. I just type what I want and it figures out the rest. 
                Processed 500 reviews in minutes with perfect sentiment classification."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                  SC
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Sarah Chen</div>
                  <div className="text-sm text-gray-600">Data Analyst</div>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-4 leading-relaxed">
                "Multi-language support is incredible. I work with data in Vietnamese, English, and Spanish—
                AISheeter handles it all automatically. No more manual pattern coding!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold">
                  MJ
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Mike Johnson</div>
                  <div className="text-sm text-gray-600">Content Creator</div>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-4 leading-relaxed">
                "Token calculation saves me money. I can see exactly what each query costs before running it. 
                The cost estimates are spot-on."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                  ER
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Dr. Emily Rodriguez</div>
                  <div className="text-sm text-gray-600">Researcher</div>
                </div>
              </div>
            </div>

            {/* Testimonial 4 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-4 leading-relaxed">
                "Smart table detection is brilliant. It instantly understands my data structure and suggests 
                the right transformations. Saves hours every week."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold">
                  AP
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Alex Patel</div>
                  <div className="text-sm text-gray-600">Financial Analyst</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section - 8px spacing */}
      <section id="faq" className="w-full py-24 bg-white">
        <div className="container px-4 md:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="mx-auto max-w-3xl space-y-6">
            {[
              {
                q: "How does the AI Agent work?",
                a: "The AI Agent uses natural language processing to understand your request, automatically detects your data structure, and intelligently processes multiple columns with the right classification options. Just describe what you want in plain language!"
              },
              {
                q: "What makes the classification 'AI-driven'?",
                a: "Instead of hardcoded patterns, our AI analyzes each column header to determine what type of classification it needs (sentiment, yes/no, priority, etc.) and suggests appropriate options in the right language—automatically. 95% accuracy across unlimited languages."
              },
              {
                q: "Which AI models are supported?",
                a: "We support ChatGPT (GPT-4, GPT-3.5), Claude (Haiku, Sonnet), Gemini™ (Flash, Pro), and Groq (Llama models). Choose the best model for your task and budget."
              },
              {
                q: "Can I process large datasets?",
                a: "Yes! Our bulk processing system handles thousands of rows with real-time progress tracking, background processing, and automatic retries. Jobs persist across browser sessions."
              },
              {
                q: "How does the cost tracking work?",
                a: "We automatically calculate token usage for each request and show real-time cost estimates before you run queries. This helps you optimize for maximum savings while getting the results you need."
              },
              {
                q: "Is my data and API key secure?",
                a: "Absolutely. All API keys are encrypted using industry-standard encryption. Your data is processed securely and never stored on our servers beyond the active session."
              }
            ].map((item, i) => (
              <div key={i} className="bg-[#F8FAFC] rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{item.q}</h3>
                <p className="text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - 8px spacing */}
      <section className="w-full py-24 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white">
        <div className="container px-4 md:px-8 max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center">
            <div className="space-y-6 max-w-3xl">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold">
                Ready to Transform Your Spreadsheets?
              </h2>
              <p className="text-xl text-blue-100 leading-relaxed">
                Join 411+ professionals using AISheeter to process data faster and smarter. 
                Free tier available—no credit card required.
              </p>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-8 py-6 shadow-xl"
                onClick={() => window.open('https://workspace.google.com/marketplace/app/aisheeter_smarter_google_sheets_with_any/272111525853', '_blank')}
              >
                Download Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent text-white border-2 border-white hover:bg-white/10 text-lg px-8 py-6"
                onClick={() => setIsVideoOpen(true)}
              >
                Watch Demo
              </Button>
            </div>
            <p className="mt-6 text-sm text-blue-200">
              Free tier: 100 queries/month • Upgrade anytime for unlimited usage
            </p>
          </div>
        </div>
      </section>

      {/* Video Dialog */}
      <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
        <DialogContent className="max-w-5xl w-[90vw] p-0 overflow-hidden">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src="https://www.youtube.com/embed/HczW0F_tmvo?si=kLGR7W-HH7Vr_rBy&autoplay=1"
              title="AISheeter Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
