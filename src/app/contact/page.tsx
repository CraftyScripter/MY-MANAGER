"use client";

import { useState } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/contact/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-zinc-800/70 bg-white/80 dark:bg-[#070709]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <img
                src="/myicon.png"
                alt="My Manager Logo"
                className="w-8 h-8 rounded-xl object-contain shadow-sm group-hover:scale-105 transition-transform duration-200"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#070709]" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white leading-tight">
                My Manager
              </span>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">
                Workspace OS
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-900/60 p-1 rounded-full border border-zinc-200/60 dark:border-zinc-800/60 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            <Link href="/" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
              Home
            </Link>
            <Link href="/features" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
              Features
            </Link>
            <Link href="/pricing" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
              Pricing
            </Link>
            <Link href="/book" className="px-3.5 py-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Book Demo</span>
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="btn-primary px-4 py-2 rounded-xl text-xs font-bold shadow-md active:scale-97 cursor-pointer"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-16 pb-12 sm:pt-24 sm:pb-16 text-center px-4 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-xs font-medium text-blue-700 dark:text-blue-300 mb-6 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>We&apos;d Love to Hear From You</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
          Get in Touch
        </h1>
        <p className="mt-6 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
          Have a question, feedback, or need help? Send us a message and we&apos;ll respond within 24 hours.
        </p>
      </section>

      {/* Contact Content */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left — Contact Info */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Contact Information</h3>

              <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">Email</p>
                    <a href="mailto:support@mymanager.io" className="hover:text-blue-500 transition">support@mymanager.io</a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">Response Time</p>
                    <p>Within 24 hours</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">Location</p>
                    <p>India (Serving agencies worldwide)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Quick Links</h3>
              <div className="space-y-2 text-xs">
                <Link href="/book" className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-blue-500 transition">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Book a Live Demo
                </Link>
                <Link href="/pricing" className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-blue-500 transition">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  View Pricing Plans
                </Link>
                <Link href="/features" className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-blue-500 transition">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Explore Features
                </Link>
              </div>
            </div>
          </div>

          {/* Right — Contact Form */}
          <div className="lg:col-span-2">
            <div className="p-8 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-xl">
              {submitted ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Message Sent!</h3>
                  <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                    Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setName("");
                      setEmail("");
                      setSubject("");
                      setMessage("");
                    }}
                    className="mt-4 px-5 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Send Us a Message</h3>
                    <p className="text-xs text-zinc-500">Fill out the form below and we&apos;ll get back to you shortly.</p>
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="john@agency.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Subject *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="How can we help?"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Message *
                    </label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Tell us about your project, question, or feedback..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {submitting ? "Sending Message..." : "Send Message →"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
