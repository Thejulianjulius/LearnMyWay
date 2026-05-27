import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";

const INTERESTS = [
  { id: "anime", label: "Anime", emoji: "⚔️" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "beauty", label: "Beauty", emoji: "💄" },
  { id: "tiktok", label: "TikTok", emoji: "📱" },
];

function App() {
  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [lesson, setLesson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canGenerate = selectedInterest && topic.trim().length > 0 && !loading;

  async function generateLesson() {
    if (!canGenerate) return;
    setLoading(true);
    setLesson("");
    setError("");

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      setError("Groq API key is not configured. Please add VITE_GROQ_API_KEY to your environment.");
      setLoading(false);
      return;
    }

    const interestLabel = INTERESTS.find((i) => i.id === selectedInterest)?.label ?? selectedInterest;

    const systemPrompt = `You are a creative and engaging teacher who explains complex school topics through the world of ${interestLabel}. 
Your lessons are told as short, compelling stories where the school concept is woven naturally into an ${interestLabel}-themed narrative. 
Keep lessons to 250-350 words. Make the student feel like they are living inside the story as they learn.
Always end with a one-line "Key Takeaway" that summarizes the main concept.`;

    const userPrompt = `Teach me about "${topic}" using ${interestLabel} as the storytelling theme. Make it feel exciting and immersive!`;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 600,
          temperature: 0.85,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message ?? `API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      setLesson(text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") generateLesson();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-lg shadow-violet-500/30 mb-4">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent">
            LearnMyWay
          </h1>
          <p className="mt-3 text-slate-400 text-base max-w-md mx-auto leading-relaxed">
            Pick what you love, type a school topic, and get a personalized lesson told as a story — just for you.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl space-y-7">
          {/* Step 1 */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
              1. Choose your interest
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INTERESTS.map((interest) => (
                <button
                  key={interest.id}
                  onClick={() => setSelectedInterest(interest.id)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    selectedInterest === interest.id
                      ? "bg-violet-500/30 border-violet-400 text-violet-200 shadow-md shadow-violet-500/20"
                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <span className="text-lg">{interest.emoji}</span>
                  {interest.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
              2. Enter a school topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Photosynthesis, Cell Division, Gravity..."
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/60 focus:border-violet-400 transition-all"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={generateLesson}
            disabled={!canGenerate}
            className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 ${
              canGenerate
                ? "bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 cursor-pointer"
                : "bg-white/5 text-slate-600 cursor-not-allowed border border-white/5"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Crafting your lesson...
              </span>
            ) : (
              "Generate My Lesson"
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Lesson Output */}
          {lesson && (
            <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/5 border border-violet-400/20 rounded-xl p-5 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{INTERESTS.find((i) => i.id === selectedInterest)?.emoji}</span>
                <h2 className="text-base font-bold text-violet-200">Your Personalized Lesson</h2>
              </div>
              <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                {lesson}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-8">
          Powered by Groq AI
        </p>
      </div>
      <Toaster />
    </div>
  );
}

export default App;
