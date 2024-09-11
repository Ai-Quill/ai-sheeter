'use client'

import React, { useState } from 'react'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronRight, Star, Shield, Calculator } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function AisheetLandingPage() {
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitMessage('')

    try {
      const response = await fetch('/api/join-waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        throw new Error('Failed to join waitlist')
      }

      setSubmitMessage('Thank you for joining our waitlist!')
      setEmail('')
    } catch (error) {
      console.error('Error joining waitlist:', error)
      setSubmitMessage('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex-1">
      <section className="w-full py-20 md:py-32 lg:py-40 xl:py-48 bg-red-50">
        <div className="container px-6 md:px-8 max-w-6xl mx-auto">
          <div className="flex flex-col items-center space-y-8 text-center">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl text-red-600 leading-tight">
                Sheet Smarter, Not Harder, With Any LLM
              </h1>
              <p className="mx-auto max-w-2xl text-xl text-gray-600 leading-relaxed">
                Harness the power of ChatGPT, Claude, Groq, and Gemini™ directly in your spreadsheets. Currently free to use!
              </p>
            </div>
            <div className="space-x-6">
              <Button className="bg-red-600 text-white hover:bg-red-700 text-lg px-8 py-3" onClick={() => setIsPopupOpen(true)}>Get Started</Button>
              <Button className="text-red-600 border border-red-600 hover:bg-red-50 text-lg px-8 py-3">Watch Demo</Button>
            </div>
          </div>
        </div>
      </section>
      <section id="features" className="w-full py-20 md:py-32 lg:py-40">
        <div className="container px-6 md:px-8 max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-center mb-16 text-red-600">
            Features
          </h2>
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col items-center text-center space-y-4">
              <ChevronRight className="h-16 w-16 text-red-600" />
              <h3 className="text-2xl font-semibold">Simple Formulas</h3>
              <p className="text-lg text-gray-600">
                Use AI with formulas like =ChatGPT(prompt,model)
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <ChevronRight className="h-16 w-16 text-red-600" />
              <h3 className="text-2xl font-semibold">Multiple AI Models</h3>
              <p className="text-lg text-gray-600">
                Access ChatGPT, Claude, Groq, and Gemini™
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <Calculator className="h-16 w-16 text-red-600" />
              <h3 className="text-2xl font-semibold">Token Calculation</h3>
              <p className="text-lg text-gray-600">
                Automatically calculate and track token usage for credit savings
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <Shield className="h-16 w-16 text-red-600" />
              <h3 className="text-2xl font-semibold">Encrypted Keys</h3>
              <p className="text-lg text-gray-600">
                All API keys are encrypted for maximum security and privacy
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full py-20 md:py-32 lg:py-40 bg-red-50">
        <div className="container px-6 md:px-8 max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-center mb-16 text-red-600">
            How It Works
          </h2>
          <div className="mx-auto max-w-4xl">
            <iframe
              className="w-full aspect-video rounded-xl shadow-2xl"
              src="https://www.youtube.com/embed/fAIKG5PzVzg"
              title="AISheeter Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      </section>
      <section id="testimonials" className="w-full py-20 md:py-32 lg:py-40">
        <div className="container px-6 md:px-8 max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-center mb-16 text-red-600">
            What Our Early Users Say
          </h2>
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="flex flex-col p-8 bg-white rounded-xl shadow-lg border border-red-100">
              <div className="flex items-center space-x-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-6 h-6 fill-current text-red-500" />
                ))}
              </div>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                &ldquo;As a data analyst, AISheeter has been a game-changer. The ability to use AI directly in my spreadsheets has sped up my workflow tremendously. It&apos;s still in beta, but I&apos;m already seeing great potential!&rdquo;
              </p>
              <p className="text-base font-semibold">Sarah Chen, Data Analyst</p>
            </div>
            <div className="flex flex-col p-8 bg-white rounded-xl shadow-lg border border-red-100">
              <div className="flex items-center space-x-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-6 h-6 fill-current text-red-500" />
                ))}
              </div>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                &ldquo;I&apos;ve been testing AISheeter for my content planning, and it&apos;s been incredibly helpful. The multiple AI model support is fantastic. There are a few bugs here and there, but the team is very responsive.&rdquo;
              </p>
              <p className="text-base font-semibold">Mike Johnson, Content Creator</p>
            </div>
            <div className="flex flex-col p-8 bg-white rounded-xl shadow-lg border border-red-100">
              <div className="flex items-center space-x-2 mb-6">
                {[1, 2, 3, 4].map((star) => (
                  <Star key={star} className="w-6 h-6 fill-current text-red-500" />
                ))}
              </div>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                &ldquo;The token calculation feature in AISheeter is brilliant! It helps me keep track of my AI usage costs. The UI could use some polishing, but overall, it&apos;s a promising tool for my research work.&rdquo;
              </p>
              <p className="text-base font-semibold">Dr. Emily Rodriguez, Researcher</p>
            </div>
            <div className="flex flex-col p-8 bg-white rounded-xl shadow-lg border border-red-100">
              <div className="flex items-center space-x-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-6 h-6 fill-current text-red-500" />
                ))}
              </div>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                &ldquo;As an early adopter, I&apos;m impressed with AISheeter&apos;s potential. The simple formulas make it easy to integrate AI into my financial models. Looking forward to seeing how it evolves!&rdquo;
              </p>
              <p className="text-base font-semibold">Alex Patel, Financial Analyst</p>
            </div>
          </div>
        </div>
      </section>
      <section id="faq" className="w-full py-20 md:py-32 lg:py-40 bg-red-50">
        <div className="container px-6 md:px-8 max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-center mb-16 text-red-600">
            Frequently Asked Questions
          </h2>
          <div className="mx-auto max-w-3xl space-y-8">
            {[
              {
                q: "How do I get started with AISheeter?",
                a: "Simply install our Google Sheets™ add-on and start using AI formulas in your spreadsheets."
              },
              {
                q: "Which AI models are supported?",
                a: "We currently support ChatGPT, Claude, Groq, and Gemini™."
              },
              {
                q: "How does the token calculation feature work?",
                a: "Our system automatically calculates the number of tokens used in each AI request, helping you track and optimize your usage for maximum credit savings."
              },
              {
                q: "Is my API key secure?",
                a: "Yes, all API keys are encrypted using industry-standard encryption methods to ensure the highest level of security and privacy."
              }
            ].map((item, i) => (
              <div key={i} className="space-y-3">
                <h3 className="text-2xl font-semibold text-red-600">{item.q}</h3>
                <p className="text-lg text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="w-full py-20 md:py-32 lg:py-40 bg-red-400 text-slate-800">
        <div className="container px-6 md:px-8 max-w-6xl mx-auto">
          <div className="flex flex-col items-center space-y-8 text-center">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Ready to supercharge your spreadsheets?
              </h2>
              <p className="mx-auto max-w-2xl text-xl leading-relaxed">
                Join our waitlist to be notified when AISheeter is available in the Google Workspace™ Marketplace.
              </p>
            </div>
            <div className="w-full max-w-md space-y-4">
              <form onSubmit={handleSubmit} className="flex space-x-4">
                <Input
                  className="flex-1 bg-white text-black text-lg py-3"
                  placeholder="Enter your email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  className=" text-red-600 hover:bg-red-100 text-lg px-8 py-3 border border-red-600"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Joining...' : 'Join Waitlist'}
                </Button>
              </form>
              {submitMessage && (
                <p className="text-sm font-medium">{submitMessage}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold mb-4">Coming Soon!</DialogTitle>
            <DialogDescription className="text-lg text-gray-600">
              Our Google Sheets™ add-on is currently under review for the Google Workspace™ Marketplace. We&apos;ll notify you as soon as it&apos;s available. Thank you for your interest!
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setIsPopupOpen(false)} className="mt-6 bg-red-600 text-white hover:bg-red-700 text-lg px-6 py-2">Close</Button>
        </DialogContent>
      </Dialog>
    </main>
  )
}