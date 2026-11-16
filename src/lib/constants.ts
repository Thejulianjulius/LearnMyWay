export interface InterestTheme {
  gradient: string;
  buttonGradient: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  glow: string;
  ambientGlow: string;
  badgeBg: string;
  takeawayBg: string;
}

export interface Interest {
  id: string;
  label: string;
  emoji: string;
  tagline: string;
  theme: InterestTheme;
}

export const INTERESTS: Interest[] = [
  {
    id: "anime",
    label: "Anime",
    emoji: "⚔️",
    tagline: "Shonen battles & powers",
    theme: {
      gradient: "from-rose-400 via-fuchsia-300 to-violet-300",
      buttonGradient: "from-rose-500 via-fuchsia-500 to-violet-600 hover:from-rose-400 hover:via-fuchsia-400 hover:to-violet-500",
      activeBg: "bg-fuchsia-500/25",
      activeBorder: "border-fuchsia-400",
      activeText: "text-fuchsia-100",
      glow: "shadow-fuchsia-500/30",
      ambientGlow: "from-fuchsia-600/25 via-rose-600/15 to-transparent",
      badgeBg: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/35",
      takeawayBg: "from-fuchsia-500/20 to-rose-500/10 border-fuchsia-400/40",
    },
  },
  {
    id: "gaming",
    label: "Gaming",
    emoji: "🎮",
    tagline: "Boss fights, XP & quests",
    theme: {
      gradient: "from-cyan-300 via-sky-300 to-indigo-300",
      buttonGradient: "from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-500",
      activeBg: "bg-cyan-500/25",
      activeBorder: "border-cyan-400",
      activeText: "text-cyan-100",
      glow: "shadow-cyan-500/30",
      ambientGlow: "from-cyan-500/25 via-blue-600/15 to-transparent",
      badgeBg: "bg-cyan-500/20 text-cyan-200 border-cyan-500/35",
      takeawayBg: "from-cyan-500/20 to-blue-500/10 border-cyan-400/40",
    },
  },
  {
    id: "football",
    label: "Football",
    emoji: "⚽",
    tagline: "Matchday tactics & goals",
    theme: {
      gradient: "from-emerald-300 via-green-300 to-teal-300",
      buttonGradient: "from-emerald-500 via-green-500 to-teal-600 hover:from-emerald-400 hover:via-green-400 hover:to-teal-500",
      activeBg: "bg-emerald-500/25",
      activeBorder: "border-emerald-400",
      activeText: "text-emerald-100",
      glow: "shadow-emerald-500/30",
      ambientGlow: "from-emerald-500/25 via-teal-600/15 to-transparent",
      badgeBg: "bg-emerald-500/20 text-emerald-200 border-emerald-500/35",
      takeawayBg: "from-emerald-500/20 to-teal-500/10 border-emerald-400/40",
    },
  },
  {
    id: "fashion",
    label: "Fashion",
    emoji: "👗",
    tagline: "Runway style & design",
    theme: {
      gradient: "from-amber-300 via-orange-300 to-pink-300",
      buttonGradient: "from-amber-500 via-orange-500 to-pink-500 hover:from-amber-400 hover:via-orange-400 hover:to-pink-400",
      activeBg: "bg-amber-500/25",
      activeBorder: "border-amber-400",
      activeText: "text-amber-100",
      glow: "shadow-amber-500/30",
      ambientGlow: "from-amber-500/25 via-pink-600/15 to-transparent",
      badgeBg: "bg-amber-500/20 text-amber-200 border-amber-500/35",
      takeawayBg: "from-amber-500/20 to-pink-500/10 border-amber-400/40",
    },
  },
  {
    id: "beauty",
    label: "Beauty",
    emoji: "💄",
    tagline: "Skincare & glow science",
    theme: {
      gradient: "from-pink-300 via-rose-300 to-purple-300",
      buttonGradient: "from-pink-500 via-rose-500 to-purple-600 hover:from-pink-400 hover:via-rose-400 hover:to-purple-500",
      activeBg: "bg-pink-500/25",
      activeBorder: "border-pink-400",
      activeText: "text-pink-100",
      glow: "shadow-pink-500/30",
      ambientGlow: "from-pink-500/25 via-rose-500/15 to-transparent",
      badgeBg: "bg-pink-500/20 text-pink-200 border-pink-500/35",
      takeawayBg: "from-pink-500/20 to-purple-500/10 border-pink-400/40",
    },
  },
  {
    id: "tiktok",
    label: "TikTok",
    emoji: "📱",
    tagline: "Viral trends & creators",
    theme: {
      gradient: "from-pink-400 via-violet-300 to-cyan-300",
      buttonGradient: "from-pink-500 via-violet-500 to-cyan-500 hover:from-pink-400 hover:via-violet-400 hover:to-cyan-400",
      activeBg: "bg-violet-500/25",
      activeBorder: "border-cyan-400",
      activeText: "text-cyan-100",
      glow: "shadow-pink-500/30",
      ambientGlow: "from-pink-500/25 via-cyan-500/15 to-transparent",
      badgeBg: "bg-cyan-500/20 text-cyan-200 border-cyan-500/35",
      takeawayBg: "from-pink-500/20 to-cyan-500/10 border-cyan-400/40",
    },
  },
];

export interface QuickTopic {
  label: string;
  subject: string;
  emoji: string;
}

export const QUICK_TOPICS: QuickTopic[] = [
  { label: "Photosynthesis", subject: "Biology", emoji: "🌱" },
  { label: "Gravity & Black Holes", subject: "Physics", emoji: "🌌" },
  { label: "DNA & Mitosis", subject: "Biology", emoji: "🧬" },
  { label: "Supply & Demand", subject: "Economics", emoji: "📈" },
  { label: "Newton's Laws of Motion", subject: "Physics", emoji: "🚀" },
  { label: "Chemical Bonding", subject: "Chemistry", emoji: "⚗️" },
  { label: "Pythagorean Theorem", subject: "Math", emoji: "📐" },
  { label: "French Revolution", subject: "History", emoji: "🏛️" },
];

export const EDUCATION_LEVELS = [
  "Middle School",
  "High School",
  "College / University",
  "Lifelong Learner",
];

// Official LearnMyWay WhatsApp Channel invite link
export const WHATSAPP_CHANNEL_URL =
  import.meta.env.VITE_WHATSAPP_CHANNEL_URL || "https://whatsapp.com/channel/0029VbDzBWOGpLHHeOh3gB3u";

