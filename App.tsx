"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Circle, Chrome, Github, Eye, EyeOff } from "lucide-react";

// --- Main App Component ---

export default function App() {
  const [showPassword, setShowPassword] = useState(false);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <main className="flex min-h-screen w-full bg-black selection:bg-white/30 p-2 transition-all duration-500 lg:h-screen lg:overflow-hidden lg:p-4">
      {/* --- Left Column (Hero) --- */}
      <section className="relative hidden lg:flex w-[52%] flex-col items-center justify-end pb-32 px-12 rounded-3xl overflow-hidden shadow-2xl h-full">
        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4"
            type="video/mp4"
          />
        </video>

        {/* Hero Content Container */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="z-10 w-full max-w-xs space-y-8"
        >
          {/* Brand/Logo */}
          <motion.div variants={itemVariants} className="flex items-center gap-2">
            <Circle className="fill-white text-white" size={24} />
            <span className="text-xl font-semibold tracking-tight">Aurora</span>
          </motion.div>

          {/* Heading Block */}
          <motion.div variants={itemVariants} className="space-y-3">
            <h1 className="text-4xl font-medium tracking-tight whitespace-nowrap">
              Join Aurora
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Follow these 3 quick phases to activate your space.
            </p>
          </motion.div>

          {/* Steps */}
          <motion.div variants={itemVariants} className="space-y-4">
            <StepItem number={1} text="Register your identity" active />
            <StepItem number={2} text="Configure your studio" />
            <StepItem number={3} text="Finalize your profile" />
          </motion.div>
        </motion.div>
      </section>

      {/* --- Right Column (Sign Up Form) --- */}
      <section className="flex-1 flex flex-col items-center justify-center py-12 lg:py-6 px-4 sm:px-12 lg:px-16 xl:px-24 overflow-y-auto lg:overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-xl space-y-8 lg:space-y-6 sm:space-y-10"
        >
          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-3xl font-medium tracking-tight">Create New Profile</h2>
            <p className="text-white/40 text-sm">
              Input your basic details to begin the journey.
            </p>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <SocialButton icon={<Chrome size={20} />} label="Google" />
            <SocialButton icon={<Github size={20} />} label="Github" />
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <span className="relative bg-black px-4 text-xs font-medium text-white/40 uppercase tracking-widest">
              Or
            </span>
          </div>

          {/* Form Layout */}
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup label="First Name" placeholder="Jane" type="text" />
              <InputGroup label="Last Name" placeholder="Doe" type="text" />
            </div>
            <InputGroup label="Email Address" placeholder="jane@aurora.io" type="email" />
            
            <div className="relative">
              <InputGroup
                label="Password"
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[38px] text-white/40 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <p className="mt-1.5 text-[10px] text-white/40">
                Requires at least 8 symbols.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full h-14 bg-white text-black font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] mt-4 transition-all"
            >
              Create Account
            </button>
          </form>

          {/* Footer Link */}
          <p className="text-center text-sm text-white/40">
            Member of the team?{" "}
            <a href="#" className="text-white hover:underline underline-offset-4">
              Log in
            </a>
          </p>
        </motion.div>
      </section>
    </main>
  );
}

// --- Reusable Components ---

function StepItem({ number, text, active = false }: { number: number; text: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${
        active
          ? "bg-white text-black border-white"
          : "bg-brand-gray text-white border-transparent"
      }`}
    >
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
          active ? "bg-black text-white" : "bg-white/10 text-white/40"
        }`}
      >
        {number}
      </div>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

function SocialButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center justify-center gap-3 w-full h-12 bg-black border border-white/10 rounded-xl hover:bg-white/5 transition-colors group">
      <span className="text-white/60 group-hover:text-white transition-colors">{icon}</span>
      <span className="text-sm font-medium text-white">{label}</span>
    </button>
  );
}

function InputGroup({ label, placeholder, type }: { label: string; placeholder: string; type: string }) {
  return (
    <div className="space-y-2 w-full">
      <label className="text-sm font-medium text-white">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 outline-none transition-all"
      />
    </div>
  );
}
