export interface Interest {
  id: string;
  label: string;
  emoji: string;
}

export const INTERESTS: Interest[] = [
  { id: "anime", label: "Anime", emoji: "⚔️" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "beauty", label: "Beauty", emoji: "💄" },
  { id: "tiktok", label: "TikTok", emoji: "📱" },
];

export const EDUCATION_LEVELS = [
  "Middle School",
  "High School",
  "College / University",
  "Lifelong Learner",
];
