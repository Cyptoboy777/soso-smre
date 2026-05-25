"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Star,
  ChevronDown,
  BarChart3,
  BookOpen,
  Users,
  Rocket,
  CheckCircle,
  Circle,
  ArrowRight,
  Zap,
  Shield,
  Globe,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "analyse" | "train" | "testing" | "deploy";

// ─── Overlay Components ────────────────────────────────────────────────────────
function AnalyseOverlay() {
  return (
    <div className="animate-fade-in-overlay absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="animate-slide-up-overlay bg-white rounded-2xl p-6 w-80 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Set Up Your AI Workspace</p>
            <p className="text-xs text-gray-500">Step 1 of 4</p>
          </div>
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>25%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: "25%" }} />
          </div>
        </div>
        <div className="space-y-2">
          {["Connect data sources", "Configure AI models", "Set analysis rules", "Launch workspace"].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {i === 0 ? (
                <CheckCircle className="w-4 h-4 text-purple-500 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
              )}
              <span className={i === 0 ? "text-gray-900 font-medium" : "text-gray-400"}>{step}</span>
            </div>
          ))}
        </div>
        <button className="mt-4 w-full bg-purple-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-purple-700 transition-colors">
          Continue Setup →
        </button>
      </div>
    </div>
  );
}

function TrainOverlay() {
  return (
    <div className="animate-fade-in-overlay absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="animate-slide-up-overlay bg-white rounded-2xl p-6 w-80 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">AI Model Training</p>
            <p className="text-xs text-orange-500 font-medium">● Running</p>
          </div>
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Epoch 12 / 18</span>
            <span>67%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" style={{ width: "67%" }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Accuracy", value: "94.2%", color: "text-green-600" },
            { label: "Loss", value: "0.043", color: "text-orange-600" },
            { label: "Samples", value: "124K", color: "text-blue-600" },
            { label: "ETA", value: "4m 12s", color: "text-gray-600" },
          ].map((m) => (
            <div key={m.label} className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
        <button className="mt-4 w-full border border-orange-200 text-orange-600 text-sm font-medium py-2 rounded-lg hover:bg-orange-50 transition-colors">
          View Training Logs
        </button>
      </div>
    </div>
  );
}

function TestingOverlay() {
  return (
    <div className="animate-fade-in-overlay absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="animate-slide-up-overlay bg-white rounded-2xl p-6 w-80 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Test Suite Results</p>
            <p className="text-xs text-green-500 font-medium">All tests passed</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-center">
          <p className="text-4xl font-bold text-green-600">127/127</p>
          <p className="text-xs text-green-600 mt-1">Tests Passed</p>
        </div>
        <div className="space-y-1.5">
          {[
            { suite: "Unit Tests", passed: 64, total: 64 },
            { suite: "Integration", passed: 38, total: 38 },
            { suite: "E2E Tests", passed: 25, total: 25 },
          ].map((s) => (
            <div key={s.suite} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{s.suite}</span>
              <span className="text-green-600 font-medium">
                {s.passed}/{s.total}
              </span>
            </div>
          ))}
        </div>
        <button className="mt-4 w-full bg-green-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-700 transition-colors">
          Deploy Now →
        </button>
      </div>
    </div>
  );
}

function DeployOverlay() {
  return (
    <div className="animate-fade-in-overlay absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="animate-slide-up-overlay bg-white rounded-2xl p-6 w-80 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Deploy to Production</p>
            <p className="text-xs text-gray-500">v2.4.1 ready</p>
          </div>
        </div>
        <div className="space-y-2 mb-4">
          {[
            { label: "Build complete", done: true },
            { label: "Tests passing", done: true },
            { label: "Security scan clear", done: true },
            { label: "Deploy to production", done: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
              )}
              <span className={item.done ? "text-gray-700" : "text-blue-600 font-medium"}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        <button className="w-full bg-black text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
          <Rocket className="w-3.5 h-3.5" />
          Deploy Now
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StellarPage() {
  const [activeTab, setActiveTab] = useState<Tab>("analyse");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "analyse", label: "Analyse", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "train",   label: "Train",   icon: <BookOpen className="w-4 h-4" /> },
    { id: "testing", label: "Testing", icon: <Users className="w-4 h-4" /> },
    { id: "deploy",  label: "Deploy",  icon: <Rocket className="w-4 h-4" /> },
  ];

  // Auto-cycle tabs every 4 seconds
  useEffect(() => {
    const order: Tab[] = ["analyse", "train", "testing", "deploy"];
    const interval = setInterval(() => {
      setActiveTab((prev) => {
        const i = order.indexOf(prev);
        return order[(i + 1) % order.length];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const overlayMap: Record<Tab, React.ReactNode> = {
    analyse: <AnalyseOverlay />,
    train:   <TrainOverlay />,
    testing: <TestingOverlay />,
    deploy:  <DeployOverlay />,
  };

  const logoSection = [
    {
      name: "INTERSCOPE",
      el: (
        <span className="text-xs font-bold tracking-[0.2em] text-gray-800 uppercase">
          INTERSCOPE
        </span>
      ),
    },
    {
      name: "SPOTIFY",
      el: (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </div>
          <span className="text-xs font-bold tracking-widest text-gray-800 uppercase">SPOTIFY</span>
        </div>
      ),
    },
    {
      name: "Nexera",
      el: (
        <div className="flex items-center gap-1.5">
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-gray-700" />
            ))}
          </div>
          <span className="text-xs font-semibold tracking-wide text-gray-800">Nexera</span>
        </div>
      ),
    },
    {
      name: "M3",
      el: (
        <span className="text-xl font-serif italic font-bold text-gray-800">M3</span>
      ),
    },
    {
      name: "LAURA COLE",
      el: (
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full border-2 border-gray-800 flex items-center justify-center">
            <span className="text-[8px] font-bold text-gray-800">LC</span>
          </div>
          <span className="text-xs font-semibold tracking-wide text-gray-800 uppercase">Laura Cole</span>
        </div>
      ),
    },
    {
      name: "vertex",
      el: (
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-gray-500"
                style={{ transform: i === 1 ? "translateY(-2px)" : "" }}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-gray-600">vertex</span>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav
        className="animate-fade-in-up sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100"
        style={{ animationDelay: "0.1s", opacity: 0 }}
      >
        <div className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 fill-black text-black" />
            <span className="text-lg font-semibold text-black">Stellar.ai</span>
          </div>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Solutions", hasChevron: true },
              { label: "For Teams", hasChevron: true },
              { label: "About Us", hasChevron: false },
              { label: "Learn Hub", hasChevron: false },
            ].map((item) => (
              <button
                key={item.label}
                className="flex items-center gap-1 text-sm text-gray-700 hover:text-black transition-colors"
              >
                {item.label}
                {item.hasChevron && <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            <a href="#" className="text-sm text-gray-700 hover:text-black transition-colors">
              Login
            </a>
            <button className="bg-black text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
              Get started free
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ────────────────────────────────────────────────────── */}
      <section className="px-6 pt-24 pb-32 max-w-7xl mx-auto text-center">

        {/* Reviews Badge */}
        <div
          className="animate-fade-in-up inline-flex items-center gap-2 mb-8"
          style={{ animationDelay: "0.2s", opacity: 0 }}
        >
          <div className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center">
            <Star className="w-3 h-3 fill-black text-black" />
          </div>
          <span className="text-sm font-medium text-black">
            4.9 rating from 18.3K+ users
          </span>
        </div>

        {/* Main Heading */}
        <h1
          className="animate-fade-in-up text-6xl md:text-7xl lg:text-[80px] font-normal leading-[1.1] tracking-tight mb-5"
          style={{ animationDelay: "0.3s", opacity: 0 }}
        >
          Work Smarter. Move Faster.
          <br />
          <span className="bg-gradient-to-r from-black via-gray-500 to-gray-400 bg-clip-text text-transparent">
            AI Powers You Up.
          </span>
        </h1>

        {/* Subheading */}
        <p
          className="animate-fade-in-up text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
          style={{ animationDelay: "0.4s", opacity: 0 }}
        >
          Intelligent automation syncs with the tools you love to streamline tasks,
          boost output, and save time.
        </p>

        {/* CTA Button */}
        <div
          className="animate-fade-in-up mb-12"
          style={{ animationDelay: "0.5s", opacity: 0 }}
        >
          <button className="bg-black text-white px-8 py-3 rounded-full text-base font-medium hover:bg-gray-800 transition-all hover:scale-105 active:scale-95">
            Begin Free Trial
          </button>
        </div>

        {/* Tab Bar */}
        <div
          className="animate-fade-in-up flex justify-center mb-6"
          style={{ animationDelay: "0.6s", opacity: 0 }}
        >
          {/* Mobile: 2x2 grid */}
          <div className="md:hidden bg-gray-100 rounded-xl p-1 grid grid-cols-2 gap-1 w-full max-w-xs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-black shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Desktop: Row with dividers */}
          <div className="hidden md:flex bg-gray-100 rounded-lg p-1 items-center">
            {tabs.map((tab, idx) => (
              <React.Fragment key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-black shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
                {idx < tabs.length - 1 && activeTab !== tab.id && activeTab !== tabs[idx + 1].id && (
                  <div className="w-px h-5 bg-gray-300 mx-0.5" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Video + Overlay Section */}
        <div
          className="animate-fade-in-up relative rounded-3xl overflow-hidden h-[400px] md:h-[500px] shadow-2xl"
          style={{ animationDelay: "0.7s", opacity: 0 }}
        >
          <video
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_165750_358b1e72-c921-48b7-aaac-f200994f32fb.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {/* Tab key ensures overlay re-mounts and re-animates on tab change */}
          <div key={activeTab}>{overlayMap[activeTab]}</div>
        </div>

        {/* Company Logos */}
        <div
          className="animate-fade-in-up mt-24"
          style={{ animationDelay: "0.8s", opacity: 0 }}
        >
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-8">
            Trusted by leading companies
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {logoSection.map((logo) => (
              <div
                key={logo.name}
                className="flex items-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              >
                {logo.el}
              </div>
            ))}
          </div>
        </div>

        {/* Feature Pills */}
        <div
          className="animate-fade-in-up mt-20 flex flex-wrap justify-center gap-3"
          style={{ animationDelay: "0.9s", opacity: 0 }}
        >
          {[
            { icon: <Zap className="w-3.5 h-3.5" />, label: "10x faster workflows" },
            { icon: <Shield className="w-3.5 h-3.5" />, label: "SOC2 compliant" },
            { icon: <Globe className="w-3.5 h-3.5" />, label: "100+ integrations" },
            { icon: <ArrowRight className="w-3.5 h-3.5" />, label: "Deploy in minutes" },
          ].map((pill) => (
            <div
              key={pill.label}
              className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full hover:border-gray-400 hover:text-black transition-all cursor-pointer"
            >
              {pill.icon}
              {pill.label}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
