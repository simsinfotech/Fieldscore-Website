"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  BarChart3,
  Users,
  Target,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  TrendingUp,
  Menu,
  X,
  ChevronRight,
  Star,
  Activity,
  Building2,
  Bell,
  Layers,
  Sparkles,
  ArrowUpRight,
  Play,
  Check,
} from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Results", href: "#results" },
];

const FEATURES = [
  {
    icon: Target,
    title: "Lead Management",
    description: "Track every lead from first contact to deal. Smart categorization, auto-assignment, and real-time updates.",
    gradient: "from-cyan-500 to-blue-500",
    bg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
  },
  {
    icon: Layers,
    title: "Sales Pipeline",
    description: "Visual 6-stage pipeline from New to Won. Track deals, conversion rates, and spot bottlenecks instantly.",
    gradient: "from-violet-500 to-purple-500",
    bg: "bg-violet-500/10",
    iconColor: "text-violet-400",
  },
  {
    icon: Clock,
    title: "Attendance Tracking",
    description: "GPS-verified check-in/out with session tracking, active hours, and automated late-mark detection.",
    gradient: "from-pink-500 to-rose-500",
    bg: "bg-pink-500/10",
    iconColor: "text-pink-400",
  },
  {
    icon: Phone,
    title: "Call Management",
    description: "Integrated calling with auto-logging, recording, and transcription. Track every conversation.",
    gradient: "from-blue-500 to-cyan-500",
    bg: "bg-blue-500/10",
    iconColor: "text-blue-400",
  },
  {
    icon: Building2,
    title: "Property Listings",
    description: "Centralized inventory with RERA details, pricing, and availability. Match leads to properties.",
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-500/10",
    iconColor: "text-amber-400",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    description: "Real-time KPIs, performance scorecards, activity heatmaps, and earnings dashboards.",
    gradient: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Role-based access, team monitoring, leave management, and real-time field tracking.",
    gradient: "from-sky-500 to-blue-500",
    bg: "bg-sky-500/10",
    iconColor: "text-sky-400",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Real-time alerts for leads, visits, calls, tasks, and deals. Never miss a follow-up.",
    gradient: "from-rose-500 to-pink-500",
    bg: "bg-rose-500/10",
    iconColor: "text-rose-400",
  },
];

const STEPS = [
  { step: "01", title: "Capture Leads", description: "Import from websites, portals, ads, and walk-ins automatically.", icon: Target, color: "from-cyan-500 to-blue-600" },
  { step: "02", title: "Assign & Track", description: "Auto-assign to team members. Track every call, visit, and interaction.", icon: Users, color: "from-blue-500 to-blue-600" },
  { step: "03", title: "Nurture & Convert", description: "Use templates, dialers, and site visits to move leads forward.", icon: TrendingUp, color: "from-teal-500 to-cyan-500" },
  { step: "04", title: "Close & Analyze", description: "Close deals, track commissions, and improve with analytics.", icon: BarChart3, color: "from-cyan-400 to-blue-500" },
];

const TESTIMONIALS = [
  { name: "Vikram Mehta", role: "Sales Director, Prestige Group", text: "FieldScore transformed how our team operates. Lead conversion went up 34% in the first quarter.", avatar: "VM" },
  { name: "Anita Desai", role: "Team Lead, Brigade Realty", text: "The attendance tracking alone saved us hours of manual work every week. The pipeline view is brilliant.", avatar: "AD" },
  { name: "Sanjay Kulkarni", role: "CEO, Prime Properties", text: "Finally a CRM that understands real estate sales. The property matching and site visit features are game-changers.", avatar: "SK" },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-brand-bg overflow-hidden">
      {/* ========== NAVIGATION ========== */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Image src="/IMG_9578.PNG" alt="FieldScore icon" width={44} height={44} className="h-11 w-11 rounded-xl" />
              <Image src="/image.png" alt="FieldScore" width={120} height={28} className="h-5 w-auto" />
            </div>

            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <a key={link.label} href={link.href} className="text-sm font-medium text-brand-dim hover:text-brand-text transition-colors">
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="text-sm font-semibold text-brand-dim hover:text-brand-text transition-colors px-4 py-2">
                Sign In
              </Link>
              <Link href="/signup" className="btn-primary text-sm !py-2.5 !px-5 rounded-xl inline-flex items-center gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-brand-dim">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-brand-card border-t border-brand-border">
            <div className="px-4 py-4 space-y-3">
              {NAV_LINKS.map((link) => (
                <a key={link.label} href={link.href} className="block text-sm font-medium text-brand-dim hover:text-brand-text py-2" onClick={() => setMobileMenuOpen(false)}>
                  {link.label}
                </a>
              ))}
              <div className="pt-3 border-t border-brand-border flex flex-col gap-2">
                <Link href="/login" className="text-sm text-center py-2.5 text-brand-dim">Sign In</Link>
                <Link href="/signup" className="btn-primary text-sm text-center !py-2.5 rounded-xl">Get Started</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ========== HERO ========== */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 dot-pattern opacity-40" />
        <div className="orb w-[600px] h-[600px] bg-cyan-500/20 -top-60 -right-60" />
        <div className="orb w-[500px] h-[500px] bg-blue-600/20 -bottom-40 -left-40" style={{ animationDelay: "2s" }} />
        <div className="orb w-[300px] h-[300px] bg-teal-500/15 top-40 right-1/4" style={{ animationDelay: "4s" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-semibold mb-8 shadow-soft">
              <Sparkles className="w-4 h-4" />
              Built for Real Estate Sales Teams
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black tracking-tight leading-[1.05] mb-6">
              Close Deals{" "}
              <span className="gradient-text">Faster</span>
              <br />
              <span className="text-brand-dim font-bold text-4xl sm:text-5xl lg:text-6xl">with FieldScore CRM</span>
            </h1>

            <p className="text-lg sm:text-xl text-brand-dim max-w-2xl mx-auto mb-10 leading-relaxed">
              The all-in-one platform that helps real estate teams capture leads, track pipelines, monitor attendance, and close more deals.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="btn-primary text-base inline-flex items-center justify-center gap-2 !py-4 !px-8 rounded-2xl shadow-glow">
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/dashboard" className="btn-secondary text-base inline-flex items-center justify-center gap-2 !py-4 !px-8 rounded-2xl">
                <Play className="w-4 h-4" /> Live Demo
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center justify-center gap-6 mt-10">
              <div className="flex -space-x-2">
                {["VM", "AD", "SK", "RK", "PM"].map((init, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white border-2 border-brand-bg">
                    {init}
                  </div>
                ))}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-brand-dim mt-0.5">Trusted by 500+ sales teams</p>
              </div>
            </div>
          </div>

          {/* ========== DASHBOARD PREVIEW ========== */}
          <div className="mt-16 lg:mt-20 relative max-w-5xl mx-auto">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-teal-500/10 rounded-[2rem] blur-2xl" />
            <div className="relative rounded-2xl border border-brand-border bg-brand-card shadow-elevated overflow-hidden">
              {/* Browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-brand-surface border-b border-brand-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-brand-bg rounded-lg px-4 py-1 text-xs text-brand-muted border border-brand-border">
                    app.fieldscore.io/dashboard
                  </div>
                </div>
              </div>
              {/* Dashboard content */}
              <div className="p-5 lg:p-6 bg-brand-surface">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Total Leads", value: "1,247", change: "+12%", gradient: "from-cyan-500 to-blue-600" },
                    { label: "Active Deals", value: "389", change: "+8%", gradient: "from-blue-500 to-cyan-500" },
                    { label: "Won This Month", value: "67", change: "+23%", gradient: "from-emerald-500 to-teal-500" },
                    { label: "Revenue", value: "42.5 Cr", change: "+18%", gradient: "from-violet-500 to-blue-500" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-brand-card rounded-xl p-4 border border-brand-border shadow-soft">
                      <p className="text-[11px] text-brand-dim font-medium">{stat.label}</p>
                      <p className="text-xl font-bold mt-1 text-brand-text">{stat.value}</p>
                      <span className="inline-flex items-center gap-0.5 mt-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                        <ArrowUpRight className="w-3 h-3" /> {stat.change}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-brand-card rounded-xl p-4 border border-brand-border shadow-soft">
                  <p className="text-sm font-semibold text-brand-text mb-3">Sales Pipeline</p>
                  <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
                    {[
                      { flex: 142, color: "bg-cyan-400" },
                      { flex: 98, color: "bg-blue-400" },
                      { flex: 67, color: "bg-sky-400" },
                      { flex: 45, color: "bg-amber-400" },
                      { flex: 28, color: "bg-violet-400" },
                      { flex: 67, color: "bg-emerald-400" },
                    ].map((bar, i) => (
                      <div key={i} className={`${bar.color} rounded-sm`} style={{ flex: bar.flex }} />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2">
                    {["New (142)", "Contacted (98)", "Qualified (67)", "Visit (45)", "Negotiation (28)", "Won (67)"].map((label) => (
                      <span key={label} className="text-[10px] text-brand-muted hidden sm:block">{label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== STATS BAR ========== */}
      <section className="py-12 bg-gradient-to-r from-[#060B18] via-cyan-900/40 to-[#0D1B2A] border-y border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: "10K+", label: "Leads Managed" },
              { value: "500+", label: "Deals Closed" },
              { value: "99.9%", label: "Uptime" },
              { value: "4.9/5", label: "App Rating" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl lg:text-4xl font-black text-cyan-400">{stat.value}</p>
                <p className="text-sm text-brand-dim mt-1 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FEATURES - BENTO GRID ========== */}
      <section id="features" className="py-20 lg:py-28 relative">
        <div className="orb w-[400px] h-[400px] bg-cyan-500/10 top-20 -right-20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-semibold mb-4">
              <Zap className="w-4 h-4" /> Powerful Features
            </div>
            <h2 className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              Everything Your Team <span className="gradient-text">Needs</span>
            </h2>
            <p className="text-lg text-brand-dim max-w-2xl mx-auto">
              From lead capture to deal closure, FieldScore covers every step of your sales journey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className={`group relative bg-brand-card border border-brand-border rounded-2xl p-6 hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 ${
                  i === 0 || i === 5 ? "lg:col-span-2" : ""
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold mb-2 text-brand-text">{feature.title}</h3>
                <p className="text-sm text-brand-dim leading-relaxed">{feature.description}</p>
                <div className={`absolute bottom-0 left-6 right-6 h-0.5 bg-gradient-to-r ${feature.gradient} rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-brand-surface relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 text-violet-400 text-sm font-semibold mb-4">
              <Activity className="w-4 h-4" /> Simple Process
            </div>
            <h2 className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              How <span className="gradient-text">FieldScore</span> Works
            </h2>
            <p className="text-lg text-brand-dim max-w-2xl mx-auto">
              Get your sales team up and running in minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.step} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[calc(100%+0.25rem)] w-[calc(100%-2rem)]">
                    <div className="h-px bg-gradient-to-r from-brand-border to-transparent" />
                    <ChevronRight className="absolute -top-2 right-0 w-4 h-4 text-brand-muted" />
                  </div>
                )}
                <div className="bg-brand-card rounded-2xl p-6 border border-brand-border shadow-soft hover:shadow-elevated transition-all">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 shadow-md`}>
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2">Step {step.step}</div>
                  <h3 className="text-lg font-bold mb-2 text-brand-text">{step.title}</h3>
                  <p className="text-sm text-brand-dim leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FEATURE HIGHLIGHT ========== */}
      <section className="py-20 lg:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-semibold mb-6">
                <TrendingUp className="w-4 h-4" /> Real-time Insights
              </div>
              <h2 className="text-3xl lg:text-4xl font-black mb-6 text-brand-text">
                Your Complete Sales Command Center
              </h2>
              <p className="text-brand-dim mb-8 leading-relaxed text-lg">
                Get a bird&apos;s-eye view of everything happening across your sales operation. Make decisions backed by real data.
              </p>
              <div className="space-y-4">
                {[
                  "Real-time dashboard with key performance indicators",
                  "Visual pipeline with deal tracking by stage",
                  "GPS-verified attendance and field tracking",
                  "Integrated calling with auto-logging",
                  "Smart notifications that prioritize follow-ups",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-brand-body">{item}</span>
                  </div>
                ))}
              </div>
              <Link href="/dashboard" className="inline-flex items-center gap-2 mt-8 text-cyan-400 font-semibold hover:gap-3 transition-all text-sm">
                Explore the Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="relative">
              <div className="orb w-[300px] h-[300px] bg-cyan-500/10 -top-16 -right-16" />
              <div className="space-y-3 relative">
                {[
                  { icon: MapPin, label: "Field Team Tracking", sub: "19 of 24 checked in today", value: "79%", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                  { icon: Target, label: "Conversion Rate", sub: "This month's performance", value: "18.4%", color: "text-cyan-400", bg: "bg-cyan-500/10" },
                  { icon: TrendingUp, label: "Revenue This Quarter", sub: "+23% vs last quarter", value: "42.5 Cr", color: "text-violet-400", bg: "bg-violet-500/10" },
                  { icon: Phone, label: "Calls Today", sub: "Team average: 16 calls", value: "121", color: "text-blue-400", bg: "bg-blue-500/10" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 bg-brand-card rounded-2xl p-5 border border-brand-border shadow-soft hover:shadow-card transition-shadow">
                    <div className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center`}>
                      <item.icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-brand-text">{item.label}</p>
                      <p className="text-xs text-brand-dim">{item.sub}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black ${item.color}`}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== TESTIMONIALS ========== */}
      <section className="py-20 lg:py-28 bg-brand-surface relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              Loved by <span className="gradient-text">Sales Teams</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-brand-card rounded-2xl p-6 border border-brand-border shadow-soft hover:shadow-elevated transition-all">
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map((i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-brand-body leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-text">{t.name}</p>
                    <p className="text-xs text-brand-dim">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== RESULTS & IMPACT ========== */}
      <section id="results" className="py-20 lg:py-28 relative">
        <div className="orb w-[400px] h-[400px] bg-cyan-500/10 bottom-20 -left-20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-semibold mb-4">
              <TrendingUp className="w-4 h-4" /> Proven Results
            </div>
            <h2 className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              Teams See Results <span className="gradient-text">in Weeks</span>
            </h2>
            <p className="text-lg text-brand-dim max-w-2xl mx-auto">
              Real estate teams using FieldScore see measurable improvements across every metric that matters.
            </p>
          </div>

          {/* Before / After comparison */}
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-16">
            {/* Before */}
            <div className="bg-brand-card border border-brand-border rounded-2xl p-8 shadow-soft relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/60 to-amber-500/60" />
              <h3 className="text-lg font-bold text-brand-dim mb-1">Before FieldScore</h3>
              <p className="text-xs text-brand-muted mb-6">Common challenges faced by sales teams</p>
              <div className="space-y-4">
                {[
                  { label: "Lead Response Time", value: "4+ hours", icon: Clock },
                  { label: "Lead-to-Visit Conversion", value: "8%", icon: Target },
                  { label: "Missed Follow-ups / Week", value: "35+", icon: Phone },
                  { label: "Team Accountability", value: "Manual tracking", icon: Users },
                  { label: "Pipeline Visibility", value: "Spreadsheets", icon: Layers },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-brand-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <item.icon className="w-4 h-4 text-red-400" />
                      </div>
                      <span className="text-sm text-brand-body">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold text-red-400">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* After */}
            <div className="bg-brand-card border border-cyan-500/20 rounded-2xl p-8 shadow-glow relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-600" />
              <h3 className="text-lg font-bold text-cyan-400 mb-1">After FieldScore</h3>
              <p className="text-xs text-brand-muted mb-6">Results within the first 90 days</p>
              <div className="space-y-4">
                {[
                  { label: "Lead Response Time", value: "Under 15 min", icon: Clock },
                  { label: "Lead-to-Visit Conversion", value: "24%", icon: Target },
                  { label: "Missed Follow-ups / Week", value: "< 3", icon: Phone },
                  { label: "Team Accountability", value: "GPS + Live tracking", icon: Users },
                  { label: "Pipeline Visibility", value: "Real-time dashboard", icon: Layers },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-brand-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <item.icon className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-sm text-brand-body">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold text-cyan-400">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Impact metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              { value: "+34%", label: "Lead Conversion", sub: "average improvement", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
              { value: "3x", label: "Faster Response", sub: "to new leads", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
              { value: "60%", label: "Less Manual Work", sub: "with automation", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
              { value: "2.5x", label: "More Site Visits", sub: "per agent per month", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            ].map((stat) => (
              <div key={stat.label} className={`bg-brand-card border ${stat.border} rounded-2xl p-6 text-center shadow-soft hover:shadow-elevated transition-all`}>
                <p className={`text-3xl lg:text-4xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-sm font-semibold text-brand-text mt-2">{stat.label}</p>
                <p className="text-xs text-brand-muted mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#060B18] via-cyan-900/40 to-[#0D1B2A]" />
        <div className="absolute inset-0 dot-pattern opacity-10" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl lg:text-5xl font-black mb-6 text-brand-text">
            Ready to Transform Your Sales?
          </h2>
          <p className="text-lg text-brand-dim mb-10 max-w-2xl mx-auto">
            Join hundreds of real estate teams already closing more deals with FieldScore.
          </p>
          <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-base px-10 py-4 rounded-2xl hover:shadow-glow-strong transition-all shadow-glow active:scale-[0.98]">
            Get Started for Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-brand-surface border-t border-brand-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Image src="/IMG_9578.PNG" alt="FieldScore icon" width={40} height={40} className="h-10 w-10 rounded-xl" />
                <Image src="/image.png" alt="FieldScore" width={110} height={26} className="h-4 w-auto" />
              </div>
              <p className="text-sm text-brand-dim leading-relaxed">
                The all-in-one sales CRM built for real estate teams.
              </p>
            </div>
            {[
              { title: "Product", links: ["Features", "Results", "Integrations", "Changelog"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Cookie Policy"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-bold mb-4 text-sm text-brand-text">{col.title}</h4>
                <div className="space-y-2.5">
                  {col.links.map((item) => (
                    <a key={item} href="#" className="block text-sm text-brand-dim hover:text-brand-primary transition-colors">{item}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 pt-8 border-t border-brand-border text-center text-sm text-brand-muted">
            &copy; {new Date().getFullYear()} FieldScore. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
