"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
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
  ChevronDown,
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

// ==========================================
// ANIMATION VARIANTS & CONFIG
// ==========================================

const ease = [0.22, 1, 0.36, 1] as const;

const viewportOnce = { once: true, amount: 0.3 };

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

const fadeInDown = {
  hidden: { opacity: 0, y: -30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

const fadeInLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease } },
};

const fadeInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.7, ease } },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// ==========================================
// DATA
// ==========================================

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Results", href: "#results" },
  { label: "FAQ", href: "#faq" },
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

const FAQS = [
  {
    q: "What is FieldScore?",
    a: "FieldScore is an all-in-one sales CRM built specifically for real estate teams. It helps you capture leads, manage pipelines, track attendance, make calls, and close deals faster \u2014 all from your mobile device.",
  },
  {
    q: "Who is FieldScore designed for?",
    a: "FieldScore adapts to your role. Sales executives get tools for field work and lead follow-ups. Managers get performance tracking and team monitoring. Owners get complete visibility with analytics and reports.",
  },
  {
    q: "Is there a free trial available?",
    a: "Yes! You can start a 10-day free trial with no credit card required. Experience the full power of FieldScore before committing to a plan.",
  },
  {
    q: "Does FieldScore work on mobile?",
    a: "FieldScore is mobile-first. Our app is available on Google Play and is designed to work seamlessly in the field \u2014 with GPS tracking, one-tap calling, offline support, and real-time sync.",
  },
  {
    q: "How does GPS attendance tracking work?",
    a: "Team members check in and out with GPS verification. FieldScore automatically logs location, tracks active hours, detects late marks, and provides managers with real-time field visibility \u2014 no manual timesheets needed.",
  },
  {
    q: "Can I import my existing leads?",
    a: "Yes. You can import leads from spreadsheets, websites, property portals, ad campaigns, and walk-ins. FieldScore supports bulk import and automatic lead capture from multiple sources.",
  },
  {
    q: "How does the call management feature work?",
    a: "FieldScore includes an integrated dialer with one-tap calling. Every call is automatically logged to the lead timeline. AI-powered call summaries capture key details so your team never has to write manual notes.",
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. FieldScore uses industry-standard encryption, role-based access controls, and secure cloud infrastructure to ensure your data is protected at all times.",
  },
];

// ==========================================
// ANIMATED STAT COUNTER COMPONENT
// ==========================================

function AnimatedStat({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState("0");
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          animateValue(value, setDisplay);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, hasAnimated]);

  return (
    <motion.div
      ref={ref}
      variants={fadeInUp}
      className="text-center"
    >
      <p className="text-3xl lg:text-4xl font-black text-cyan-400">{display}</p>
      <p className="text-sm text-brand-dim mt-1 font-medium">{label}</p>
    </motion.div>
  );
}

function animateValue(
  target: string,
  setter: (v: string) => void
) {
  // Parse the target: "10K+", "500+", "99.9%", "4.9/5"
  const duration = 1500;
  const startTime = performance.now();

  if (target === "4.9/5") {
    const endVal = 4.9;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * endVal;
      setter(current.toFixed(1) + "/5");
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return;
  }

  if (target === "99.9%") {
    const endVal = 99.9;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * endVal;
      setter(current.toFixed(1) + "%");
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return;
  }

  // "10K+" or "500+"
  const numMatch = target.match(/^([\d.]+)/);
  const suffix = target.replace(/^[\d.]+/, "");
  const endVal = numMatch ? parseFloat(numMatch[1]) : 0;
  const isFloat = endVal % 1 !== 0;

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = eased * endVal;
    setter((isFloat ? current.toFixed(1) : Math.round(current).toLocaleString()) + suffix);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  // Scroll tracking for navbar
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => {
    setHasScrolled(latest > 50);
  });

  // Hero parallax
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOrb1Y = useTransform(heroProgress, [0, 1], [0, -200]);
  const heroOrb2Y = useTransform(heroProgress, [0, 1], [0, -120]);
  const heroOrb3Y = useTransform(heroProgress, [0, 1], [0, -80]);

  // How it works parallax
  const howRef = useRef<HTMLElement>(null);
  const { scrollYProgress: howProgress } = useScroll({
    target: howRef,
    offset: ["start end", "end start"],
  });
  const howBgY = useTransform(howProgress, [0, 1], [0, -40]);

  // Screenshots parallax
  const screenshotsRef = useRef<HTMLElement>(null);
  const { scrollYProgress: screenshotsProgress } = useScroll({
    target: screenshotsRef,
    offset: ["start end", "end start"],
  });
  const screenshotsY = useTransform(screenshotsProgress, [0, 1], [30, -30]);

  return (
    <div className="min-h-screen bg-brand-bg overflow-hidden">
      {/* ========== NAVIGATION ========== */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          hasScrolled
            ? "bg-brand-bg/85 backdrop-blur-xl border-b border-brand-border/60 shadow-lg shadow-black/20"
            : "bg-transparent border-b border-transparent"
        }`}
      >
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

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease }}
              className="md:hidden bg-brand-card border-t border-brand-border overflow-hidden"
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ========== HERO ========== */}
      <section ref={heroRef} className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background cityscape image with parallax */}
        <motion.div style={{ y: heroOrb1Y }} className="absolute inset-0 z-0">
          <Image
            src="/Futuristic Real Estate CRM Cityscape.png"
            alt=""
            fill
            className="object-cover object-center"
            priority
            quality={90}
          />
        </motion.div>

        {/* Top fade — hides image artifacts behind nav area */}
        <div className="absolute top-0 left-0 right-0 h-40 z-[1] bg-gradient-to-b from-brand-bg via-brand-bg/80 to-transparent" />
        {/* Left-side gradient for text readability — fades out toward right to keep image visible */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-brand-bg/70 via-brand-bg/40 to-transparent" />
        {/* Bottom fade — seamless blend into next section */}
        <div className="absolute bottom-0 left-0 right-0 h-32 z-[1] bg-gradient-to-t from-brand-bg to-transparent" />

        <div className="relative z-10 w-full pt-28 pb-16 lg:pt-36 lg:pb-24 px-6 sm:px-10 lg:px-16">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="max-w-2xl"
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-semibold mb-8 shadow-soft backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
              Built for Real Estate Sales Teams
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.08] mb-6 text-white drop-shadow-lg">
              Close Deals{" "}
              <span className="gradient-text">Faster</span>
              <br />
              <span className="text-white/80 font-bold text-3xl sm:text-4xl lg:text-5xl">with FieldScore CRM</span>
            </motion.h1>

            <motion.p variants={fadeInUp} className="text-base sm:text-lg text-white/90 max-w-xl mb-4 leading-relaxed drop-shadow-sm">
              The all-in-one platform that helps real estate teams capture leads, track pipelines, monitor attendance, and close more deals.
            </motion.p>

            <motion.p variants={fadeInUp} className="text-sm text-white/70 max-w-xl mb-8 leading-relaxed drop-shadow-sm">
              FieldScore adapts to your role — whether you&apos;re a sales executive on the field, a manager tracking performance, or an owner looking for complete visibility. Get the right tools to succeed from day one.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link href="/dashboard" className="btn-secondary text-sm inline-flex items-center justify-center gap-2 !py-3.5 !px-6 rounded-xl backdrop-blur-sm">
                <Play className="w-4 h-4" /> Book a Demo
              </Link>
              <Link href="/signup" className="btn-primary text-sm inline-flex items-center justify-center gap-2 !py-3.5 !px-6 rounded-xl shadow-glow">
                Start 10-day Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <motion.p variants={fadeInUp} className="text-xs text-white/50">No Credit Card Required</motion.p>

            {/* Social proof */}
            <motion.div variants={fadeInUp} className="flex items-center gap-6 mt-8 pt-8 border-t border-white/10">
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
                <p className="text-xs text-white/70 mt-0.5">Trusted by 500+ sales teams</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ========== STATS BAR ========== */}
      <section className="py-12 bg-gradient-to-r from-[#060B18] via-cyan-900/40 to-[#0D1B2A] border-y border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {[
              { value: "10K+", label: "Leads Managed" },
              { value: "500+", label: "Deals Closed" },
              { value: "99.9%", label: "Uptime" },
              { value: "4.9/5", label: "App Rating" },
            ].map((stat) => (
              <AnimatedStat key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== PRODUCT SHOWCASE ========== */}
      <section className="pt-20 lg:pt-28 pb-0 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="text-center mb-12"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" /> The FieldScore Advantage
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              Track. Measure. <span className="gradient-text">Win.</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-brand-dim max-w-2xl mx-auto">
              From closing deals to managing every call — FieldScore gives your team the edge.
            </motion.p>
          </motion.div>
        </div>

        {/* Full-bleed image with edge fades */}
        <motion.div
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="relative"
        >
          {/* Edge gradients to blend image into site background */}
          <div className="absolute inset-y-0 left-0 w-24 sm:w-40 z-10 bg-gradient-to-r from-brand-bg to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 sm:w-40 z-10 bg-gradient-to-l from-brand-bg to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-16 z-10 bg-gradient-to-b from-brand-bg to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-24 z-10 bg-gradient-to-t from-brand-bg to-transparent pointer-events-none" />

          <Image
            src="/FieldScore_ Track, Measure, Win.png"
            alt="FieldScore product showcase — Close more deals and track every call"
            width={1920}
            height={960}
            className="w-full h-auto"
            unoptimized
          />
        </motion.div>
      </section>

      {/* ========== APP SCREENSHOTS SHOWCASE ========== */}
      <section ref={screenshotsRef} className="py-20 lg:py-28 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="text-center mb-12"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-semibold mb-4">
              <Play className="w-4 h-4" /> See It in Action
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              Designed for the <span className="gradient-text">Field</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-brand-dim max-w-2xl mx-auto">
              A mobile-first CRM that works where your team works — on the ground, in the field, closing deals.
            </motion.p>
          </motion.div>

          {/* Phone mockups row */}
          <motion.div
            style={{ y: screenshotsY }}
            className="flex gap-6 justify-center items-end flex-wrap lg:flex-nowrap"
          >
            {[
              { src: "/ss-lead-mgmt.png", alt: "Lead Management", label: "Lead Management" },
              { src: "/ss-dashboard.png", alt: "Sales Dashboard", label: "Dashboard" },
              { src: "/ss-field-tracking.png", alt: "Field Tracking", label: "Field Tracking" },
              { src: "/ss-call-mgmt.png", alt: "Call Management", label: "Call Tracking" },
              { src: "/ss-team-mgmt.png", alt: "Team Management", label: "Team Management" },
            ].map((screen, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewportOnce}
                transition={{ duration: 0.5, delay: i * 0.1, ease }}
                whileHover={{ y: -8 }}
                className={`group flex flex-col items-center gap-3 ${i === 1 ? "lg:-mt-4" : ""}`}
              >
                <div className="relative rounded-2xl border border-brand-border overflow-hidden shadow-elevated bg-brand-card transition-shadow duration-300 hover:shadow-glow">
                  <Image src={screen.src} alt={screen.alt} width={240} height={427} className="w-44 lg:w-48 h-auto" unoptimized />
                </div>
                <span className="text-xs font-semibold text-brand-dim group-hover:text-cyan-400 transition-colors">{screen.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== FEATURES - BENTO GRID ========== */}
      <section id="features" className="py-20 lg:py-28 relative">
        <div className="orb w-[400px] h-[400px] bg-cyan-500/10 top-20 -right-20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="text-center mb-16"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-semibold mb-4">
              <Zap className="w-4 h-4" /> Powerful Features
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              Everything Your Team <span className="gradient-text">Needs</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-brand-dim max-w-2xl mx-auto">
              From lead capture to deal closure, FieldScore covers every step of your sales journey.
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                whileHover={{ y: -4 }}
                className={`group relative bg-brand-card border border-brand-border rounded-2xl p-6 transition-shadow duration-300 hover:shadow-elevated animated-gradient-border ${
                  i === 0 || i === 5 ? "lg:col-span-2" : ""
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold mb-2 text-brand-text">{feature.title}</h3>
                <p className="text-sm text-brand-dim leading-relaxed">{feature.description}</p>
                <div className={`absolute bottom-0 left-6 right-6 h-0.5 bg-gradient-to-r ${feature.gradient} rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section ref={howRef} id="how-it-works" className="py-20 lg:py-28 bg-brand-surface relative overflow-hidden">
        <motion.div style={{ y: howBgY }} className="absolute inset-0 grid-pattern opacity-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="text-center mb-16"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 text-violet-400 text-sm font-semibold mb-4">
              <Activity className="w-4 h-4" /> Simple Process
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              How <span className="gradient-text">FieldScore</span> Works
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-brand-dim max-w-2xl mx-auto">
              Get your sales team up and running in minutes.
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {STEPS.map((step, i) => (
              <motion.div key={step.step} variants={fadeInUp} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[calc(100%+0.25rem)] w-[calc(100%-2rem)]">
                    <div className="h-px bg-gradient-to-r from-brand-border to-transparent" />
                    <ChevronRight className="absolute -top-2 right-0 w-4 h-4 text-brand-muted" />
                  </div>
                )}
                <div className="bg-brand-card rounded-2xl p-6 border border-brand-border shadow-soft hover:shadow-elevated transition-shadow">
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={viewportOnce}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: i * 0.12 }}
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 shadow-md`}
                  >
                    <step.icon className="w-7 h-7 text-white" />
                  </motion.div>
                  <div className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2">Step {step.step}</div>
                  <h3 className="text-lg font-bold mb-2 text-brand-text">{step.title}</h3>
                  <p className="text-sm text-brand-dim leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== FEATURE HIGHLIGHT ========== */}
      <section className="py-20 lg:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
            >
              <motion.div variants={fadeInLeft} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-semibold mb-6">
                <TrendingUp className="w-4 h-4" /> Real-time Insights
              </motion.div>
              <motion.h2 variants={fadeInLeft} className="text-3xl lg:text-4xl font-black mb-6 text-brand-text">
                Your Complete Sales Command Center
              </motion.h2>
              <motion.p variants={fadeInLeft} className="text-brand-dim mb-8 leading-relaxed text-lg">
                Get a bird&apos;s-eye view of everything happening across your sales operation. Make decisions backed by real data.
              </motion.p>
              <motion.div variants={staggerContainer} className="space-y-4">
                {[
                  "Real-time dashboard with key performance indicators",
                  "Visual pipeline with deal tracking by stage",
                  "GPS-verified attendance and field tracking",
                  "Integrated calling with auto-logging",
                  "Smart notifications that prioritize follow-ups",
                ].map((item) => (
                  <motion.div key={item} variants={fadeInUp} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-brand-body">{item}</span>
                  </motion.div>
                ))}
              </motion.div>
              <motion.div variants={fadeInLeft}>
                <Link href="/dashboard" className="inline-flex items-center gap-2 mt-8 text-cyan-400 font-semibold hover:gap-3 transition-all text-sm">
                  Explore the Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              variants={scaleIn}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="relative flex justify-center"
            >
              <div className="orb w-[300px] h-[300px] bg-cyan-500/10 -top-16 -right-16" />
              <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.3 }} className="relative rounded-2xl border border-brand-border overflow-hidden shadow-elevated transition-shadow hover:shadow-glow">
                <Image src="/ss-dashboard.png" alt="FieldScore Sales Dashboard" width={300} height={600} className="w-64 lg:w-72 h-auto" unoptimized />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== FEATURE: LEAD MANAGEMENT ========== */}
      <section className="py-20 lg:py-28 bg-brand-surface relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              variants={scaleIn}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="relative flex justify-center lg:order-1"
            >
              <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.3 }} className="relative rounded-2xl border border-brand-border overflow-hidden shadow-elevated transition-shadow hover:shadow-glow">
                <Image src="/ss-lead-mgmt.png" alt="FieldScore Lead Management" width={300} height={600} className="w-64 lg:w-72 h-auto" unoptimized />
              </motion.div>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="lg:order-2"
            >
              <motion.div variants={fadeInRight} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-semibold mb-6">
                <Target className="w-4 h-4" /> Lead Management
              </motion.div>
              <motion.h2 variants={fadeInRight} className="text-3xl lg:text-4xl font-black mb-6 text-brand-text">
                Never Lose a Lead <span className="gradient-text">Again</span>
              </motion.h2>
              <motion.p variants={fadeInRight} className="text-brand-dim mb-8 leading-relaxed text-lg">
                Manage leads, make calls, schedule follow-ups and close more deals — all in one place.
              </motion.p>
              <motion.div variants={staggerContainer} className="space-y-4">
                {[
                  "Capture leads from multiple sources automatically",
                  "Smart categorization with custom tags and filters",
                  "One-tap calling with auto-logged history",
                  "Set follow-up reminders that never slip",
                  "Track lead journey from first contact to close",
                ].map((item) => (
                  <motion.div key={item} variants={fadeInUp} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-brand-body">{item}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== FEATURE: FIELD TRACKING ========== */}
      <section className="py-20 lg:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
            >
              <motion.div variants={fadeInLeft} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-semibold mb-6">
                <MapPin className="w-4 h-4" /> Field Tracking
              </motion.div>
              <motion.h2 variants={fadeInLeft} className="text-3xl lg:text-4xl font-black mb-6 text-brand-text">
                On the Ground. <span className="gradient-text">Always in Sync.</span>
              </motion.h2>
              <motion.p variants={fadeInLeft} className="text-brand-dim mb-8 leading-relaxed text-lg">
                Track field visits, GPS location and site activities in real-time. Know exactly where your team is and what they&apos;re doing.
              </motion.p>
              <motion.div variants={staggerContainer} className="space-y-4">
                {[
                  "Live GPS tracking with check-in/check-out",
                  "Site visit logging with photo verification",
                  "Real-time field activity feed",
                  "Automated attendance with geo-fencing",
                  "Route optimization for field agents",
                ].map((item) => (
                  <motion.div key={item} variants={fadeInUp} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-brand-body">{item}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
            <motion.div
              variants={scaleIn}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="relative flex justify-center"
            >
              <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.3 }} className="relative rounded-2xl border border-brand-border overflow-hidden shadow-elevated transition-shadow hover:shadow-glow">
                <Image src="/ss-field-tracking.png" alt="FieldScore GPS Field Tracking" width={300} height={600} className="w-64 lg:w-72 h-auto" unoptimized />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== FEATURE: CALL MANAGEMENT ========== */}
      <section className="py-20 lg:py-28 bg-brand-surface relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              variants={scaleIn}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="relative flex justify-center lg:order-1"
            >
              <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.3 }} className="relative rounded-2xl border border-brand-border overflow-hidden shadow-elevated transition-shadow hover:shadow-glow">
                <Image src="/ss-call-mgmt.png" alt="FieldScore Call Management" width={300} height={600} className="w-64 lg:w-72 h-auto" unoptimized />
              </motion.div>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="lg:order-2"
            >
              <motion.div variants={fadeInRight} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-400 text-sm font-semibold mb-6">
                <Phone className="w-4 h-4" /> Call Management
              </motion.div>
              <motion.h2 variants={fadeInRight} className="text-3xl lg:text-4xl font-black mb-6 text-brand-text">
                Every Call Becomes <span className="gradient-text">Progress</span>
              </motion.h2>
              <motion.p variants={fadeInRight} className="text-brand-dim mb-8 leading-relaxed text-lg">
                AI-powered call summaries automatically captured into your CRM. No more manual call notes.
              </motion.p>
              <motion.div variants={staggerContainer} className="space-y-4">
                {[
                  "Integrated dialer with one-tap calling",
                  "AI call summaries and transcription",
                  "Automatic call logging to lead timeline",
                  "Call analytics with team performance metrics",
                  "Smart follow-up suggestions after every call",
                ].map((item) => (
                  <motion.div key={item} variants={fadeInUp} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-brand-body">{item}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== FEATURE: TEAM MANAGEMENT ========== */}
      <section className="py-20 lg:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
            >
              <motion.div variants={fadeInLeft} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 text-violet-400 text-sm font-semibold mb-6">
                <Users className="w-4 h-4" /> Team Management
              </motion.div>
              <motion.h2 variants={fadeInLeft} className="text-3xl lg:text-4xl font-black mb-6 text-brand-text">
                Empower Your <span className="gradient-text">Team</span>
              </motion.h2>
              <motion.p variants={fadeInLeft} className="text-brand-dim mb-8 leading-relaxed text-lg">
                Track performance, manage activity and drive better results. Give your team the tools they need to succeed.
              </motion.p>
              <motion.div variants={staggerContainer} className="space-y-4">
                {[
                  "Role-based access for sales teams, managers, and owners",
                  "Real-time performance leaderboards",
                  "Goal setting and tracking per team member",
                  "Leave management and shift scheduling",
                  "Detailed activity reports and analytics",
                ].map((item) => (
                  <motion.div key={item} variants={fadeInUp} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-brand-body">{item}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
            <motion.div
              variants={scaleIn}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="relative flex justify-center"
            >
              <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.3 }} className="relative rounded-2xl border border-brand-border overflow-hidden shadow-elevated transition-shadow hover:shadow-glow">
                <Image src="/ss-team-mgmt.png" alt="FieldScore Team Management" width={300} height={600} className="w-64 lg:w-72 h-auto" unoptimized />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== TESTIMONIALS ========== */}
      <section className="py-20 lg:py-28 bg-brand-surface relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              Loved by <span className="gradient-text">Sales Teams</span>
            </h2>
          </motion.div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid md:grid-cols-3 gap-6"
          >
            {TESTIMONIALS.map((t) => (
              <motion.div
                key={t.name}
                variants={fadeInUp}
                whileHover={{ y: -4 }}
                className="bg-brand-card rounded-2xl p-6 border border-brand-border shadow-soft transition-shadow duration-300 hover:shadow-elevated"
              >
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={viewportOnce}
                      transition={{ type: "spring", stiffness: 300, damping: 15, delay: i * 0.06 }}
                    >
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    </motion.div>
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== RESULTS & IMPACT ========== */}
      <section id="results" className="py-20 lg:py-28 relative">
        <div className="orb w-[400px] h-[400px] bg-cyan-500/10 bottom-20 -left-20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="text-center mb-16"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-semibold mb-4">
              <TrendingUp className="w-4 h-4" /> Proven Results
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              Teams See Results <span className="gradient-text">in Weeks</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-brand-dim max-w-2xl mx-auto">
              Real estate teams using FieldScore see measurable improvements across every metric that matters.
            </motion.p>
          </motion.div>

          {/* Before / After comparison */}
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-16">
            {/* Before */}
            <motion.div
              variants={fadeInLeft}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="bg-brand-card border border-brand-border rounded-2xl p-8 shadow-soft relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/60 to-amber-500/60" />
              <h3 className="text-lg font-bold text-brand-dim mb-1">Before FieldScore</h3>
              <p className="text-xs text-brand-muted mb-6">Common challenges faced by sales teams</p>
              <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={viewportOnce} className="space-y-4">
                {[
                  { label: "Lead Response Time", value: "4+ hours", icon: Clock },
                  { label: "Lead-to-Visit Conversion", value: "8%", icon: Target },
                  { label: "Missed Follow-ups / Week", value: "35+", icon: Phone },
                  { label: "Team Accountability", value: "Manual tracking", icon: Users },
                  { label: "Pipeline Visibility", value: "Spreadsheets", icon: Layers },
                ].map((item) => (
                  <motion.div key={item.label} variants={fadeInUp} className="flex items-center justify-between py-3 border-b border-brand-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <item.icon className="w-4 h-4 text-red-400" />
                      </div>
                      <span className="text-sm text-brand-body">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold text-red-400">{item.value}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            {/* After */}
            <motion.div
              variants={fadeInRight}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="bg-brand-card border border-cyan-500/20 rounded-2xl p-8 shadow-glow relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-600" />
              <h3 className="text-lg font-bold text-cyan-400 mb-1">After FieldScore</h3>
              <p className="text-xs text-brand-muted mb-6">Results within the first 90 days</p>
              <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={viewportOnce} className="space-y-4">
                {[
                  { label: "Lead Response Time", value: "Under 15 min", icon: Clock },
                  { label: "Lead-to-Visit Conversion", value: "24%", icon: Target },
                  { label: "Missed Follow-ups / Week", value: "< 3", icon: Phone },
                  { label: "Team Accountability", value: "GPS + Live tracking", icon: Users },
                  { label: "Pipeline Visibility", value: "Real-time dashboard", icon: Layers },
                ].map((item) => (
                  <motion.div key={item.label} variants={fadeInUp} className="flex items-center justify-between py-3 border-b border-brand-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <item.icon className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-sm text-brand-body">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold text-cyan-400">{item.value}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>

          {/* Impact metrics */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto"
          >
            {[
              { value: "+34%", label: "Lead Conversion", sub: "average improvement", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
              { value: "3x", label: "Faster Response", sub: "to new leads", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
              { value: "60%", label: "Less Manual Work", sub: "with automation", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
              { value: "2.5x", label: "More Site Visits", sub: "per agent per month", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                variants={scaleIn}
                whileHover={{ scale: 1.05 }}
                className={`bg-brand-card border ${stat.border} rounded-2xl p-6 text-center shadow-soft transition-shadow duration-300 hover:shadow-elevated`}
              >
                <p className={`text-3xl lg:text-4xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-sm font-semibold text-brand-text mt-2">{stat.label}</p>
                <p className="text-xs text-brand-muted mt-1">{stat.sub}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section id="faq" className="py-20 lg:py-28 bg-brand-surface relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="text-center mb-16"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-semibold mb-4">
              <CheckCircle2 className="w-4 h-4" /> FAQ
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-3xl lg:text-5xl font-black mb-4 text-brand-text">
              Frequently Asked <span className="gradient-text">Questions</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-lg text-brand-dim">
              Everything you need to know about FieldScore.
            </motion.p>
          </motion.div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-soft transition-shadow hover:shadow-card"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="text-sm font-semibold text-brand-text pr-4">{faq.q}</span>
                  <motion.div
                    animate={{ rotate: openFaq === i ? 180 : 0 }}
                    transition={{ duration: 0.25, ease }}
                  >
                    <ChevronDown className={`w-5 h-5 shrink-0 ${openFaq === i ? "text-cyan-400" : "text-brand-dim"}`} />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 -mt-1">
                        <p className="text-sm text-brand-dim leading-relaxed">{faq.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#060B18] via-cyan-900/40 to-[#0D1B2A]" />
        <div className="absolute inset-0 dot-pattern opacity-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="text-center lg:text-left"
            >
              <motion.h2 variants={fadeInLeft} className="text-3xl lg:text-5xl font-black mb-6 text-brand-text">
                Ready to Transform Your Sales?
              </motion.h2>
              <motion.p variants={fadeInLeft} className="text-lg text-brand-dim mb-10 max-w-xl">
                Choose your role and get started. FieldScore adapts to sales teams, managers, and owners — giving everyone the right tools to succeed.
              </motion.p>
              <motion.div variants={fadeInLeft} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                  <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-base px-10 py-4 rounded-2xl hover:shadow-glow-strong transition-shadow shadow-glow">
                    Get Started for Free <ArrowRight className="w-5 h-5" />
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                  <a href="https://play.google.com/store/apps/details?id=com.simsinfotech.workspace" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-brand-card border border-brand-border text-brand-text font-bold text-base px-8 py-4 rounded-2xl hover:border-cyan-500/30 transition-all">
                    <Play className="w-4 h-4" /> Download App
                  </a>
                </motion.div>
              </motion.div>
            </motion.div>
            <motion.div
              variants={scaleIn}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="flex justify-center"
            >
              <div className="relative rounded-2xl border border-brand-border overflow-hidden shadow-elevated">
                <Image src="/ss-role-select.png" alt="Choose Your Role - FieldScore" width={300} height={600} className="w-64 lg:w-72 h-auto" unoptimized />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.8, ease }}
        className="bg-brand-surface border-t border-brand-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main footer grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-6 py-16">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-3 lg:col-span-2 lg:pr-8">
              <div className="flex items-center gap-2 mb-4">
                <Image src="/IMG_9578.PNG" alt="FieldScore icon" width={44} height={44} className="h-11 w-11 rounded-xl" />
                <Image src="/image.png" alt="FieldScore" width={120} height={28} className="h-5 w-auto" />
              </div>
              <p className="text-sm text-brand-dim leading-relaxed mb-6 max-w-xs">
                The all-in-one sales CRM built for real estate teams. Capture leads, track pipelines, and close more deals.
              </p>
              {/* Social links */}
              <div className="flex items-center gap-3">
                {[
                  { label: "X", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
                  { label: "LinkedIn", path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
                  { label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
                ].map((social) => (
                  <a key={social.label} href="#" aria-label={social.label} className="w-9 h-9 rounded-lg bg-brand-card border border-brand-border flex items-center justify-center text-brand-dim hover:text-cyan-400 hover:border-cyan-500/30 transition-all">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={social.path} /></svg>
                  </a>
                ))}
              </div>
              {/* App store badges */}
              <div className="flex flex-col gap-3 mt-6">
                <a href="https://play.google.com/store/apps/details?id=com.simsinfotech.workspace" target="_blank" rel="noopener noreferrer" aria-label="Download on App Store and Google Play" className="block hover:opacity-80 transition-opacity">
                  <Image src="/image copy.png" alt="Download on App Store and Google Play" width={280} height={84} className="w-36 h-auto" />
                </a>
              </div>
            </div>

            {/* Features column */}
            <div>
              <h4 className="font-bold mb-4 text-sm text-brand-text">Features</h4>
              <div className="space-y-2.5">
                {["Lead Management", "Sales Pipeline", "Call Management", "Property Listings", "Team Management", "Smart Analytics"].map((item) => (
                  <a key={item} href="#features" className="block text-sm text-brand-dim hover:text-cyan-400 transition-colors">{item}</a>
                ))}
              </div>
            </div>

            {/* Tools column */}
            <div>
              <h4 className="font-bold mb-4 text-sm text-brand-text">Tools</h4>
              <div className="space-y-2.5">
                {["Attendance Tracking", "Task Management", "Notifications", "GPS Tracking", "Auto Dialer", "Reports"].map((item) => (
                  <a key={item} href="#features" className="block text-sm text-brand-dim hover:text-cyan-400 transition-colors">{item}</a>
                ))}
              </div>
            </div>

            {/* Company column */}
            <div>
              <h4 className="font-bold mb-4 text-sm text-brand-text">Company</h4>
              <div className="space-y-2.5">
                {["About Us", "Blog", "Careers", "Contact", "Partners"].map((item) => (
                  <a key={item} href="#" className="block text-sm text-brand-dim hover:text-cyan-400 transition-colors">{item}</a>
                ))}
              </div>
            </div>

            {/* Legal column */}
            <div>
              <h4 className="font-bold mb-4 text-sm text-brand-text">Legal</h4>
              <div className="space-y-2.5">
                {["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"].map((item) => (
                  <a key={item} href="#" className="block text-sm text-brand-dim hover:text-cyan-400 transition-colors">{item}</a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="py-6 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-brand-muted">
              &copy; {new Date().getFullYear()} FieldScore. All rights reserved.
            </p>
            <p className="text-sm text-brand-muted">
              Built with purpose for real estate teams across India.
            </p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
