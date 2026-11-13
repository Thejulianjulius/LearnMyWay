import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { generateLessonAI, askFollowUpQuestionAI } from "@/lib/ai";
import { formatModelDisplayName } from "@/lib/prompt";
import { trackEvent } from "@/lib/analytics";
import { INTERESTS } from "@/lib/constants";
import { InstallPWA } from "@/components/InstallPWA";
import {
  Bookmark,
  Check,
  ExternalLink,
  MessageCircle,
  Send,
  HelpCircle,
  Bot,
  User as UserIcon,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Generator() {
  const { user, profile } = useAuth();

  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [academicSubject, setAcademicSubject] = useState("");
  const [lesson, setLesson] = useState("");
  const [activeModel, setActiveModel] = useState("Llama 3.3 70B");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [savingLesson, setSavingLesson] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Follow-up Q&A state
  const [followUpMessages, setFollowUpMessages] = useState<ChatMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // If student has a preferred interest saved in their profile, pre-select it
  useEffect(() => {
    if (profile?.learning_interests && profile.learning_interests.length > 0 && !selectedInterest) {
      setSelectedInterest(profile.learning_interests[0]);
    }
  }, [profile, selectedInterest]);

  // Scroll to bottom of chat when new follow-up message arrives
  useEffect(() => {
    if (followUpMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [followUpMessages]);

  const canGenerate = selectedInterest && topic.trim().length > 0 && !loading;

  async function generateLesson() {
    if (!canGenerate) return;
    setLoading(true);
    setLesson("");
    setError("");
    setIsSaved(false);
    setFollowUpMessages([]);

    const interestLabel = INTERESTS.find((i) => i.id === selectedInterest)?.label ?? selectedInterest;

    try {
      const response = await generateLessonAI({
        topic: topic.trim(),
        interest: interestLabel,
        academicSubject: academicSubject.trim() || undefined,
        educationLevel: profile?.education_level || "High School",
        studentName: profile?.full_name || user?.user_metadata?.full_name || undefined,
      });

      setLesson(response.content);
      if (response.model) {
        setActiveModel(formatModelDisplayName(response.model));
      }
      trackEvent("lesson_generated", {
        user_id: user?.id || null,
        user_name: profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || null,
        topic: topic.trim(),
        interest: interestLabel,
        academic_subject: academicSubject.trim() || undefined,
        education_level: profile?.education_level || "High School",
        ai_model: response.model,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong generating the lesson.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendFollowUp(questionText?: string) {
    const q = (questionText || followUpInput).trim();
    if (!q || followUpLoading || !lesson) return;

    const interestLabel = INTERESTS.find((i) => i.id === selectedInterest)?.label ?? selectedInterest ?? "";
    const newMessages: ChatMessage[] = [
      ...followUpMessages,
      { role: "user", content: q },
    ];

    setFollowUpMessages(newMessages);
    setFollowUpInput("");
    setFollowUpLoading(true);

    try {
      // Build context history including the original lesson for grounding
      const contextMessages: ChatMessage[] = [
        {
          role: "user",
          content: `Here is the current lesson on "${topic}" with theme ${interestLabel}:\n\n${lesson}`,
        },
        {
          role: "assistant",
          content: "Understood! I am ready to answer any questions, provide hints, explain simpler analogies, or quiz you on this lesson.",
        },
        ...newMessages,
      ];

      const response = await askFollowUpQuestionAI({
        messages: contextMessages,
        topic: topic.trim(),
        interest: interestLabel,
        educationLevel: profile?.education_level || "High School",
        studentName: profile?.full_name || user?.user_metadata?.full_name || undefined,
      });

      setFollowUpMessages([
        ...newMessages,
        { role: "assistant", content: response.content },
      ]);
      trackEvent("followup_asked", {
        user_id: user?.id || null,
        user_name: profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || null,
        topic: topic.trim(),
        interest: interestLabel,
        ai_model: response.model,
      });
    } catch (err: unknown) {
      setFollowUpMessages([
        ...newMessages,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Sorry, I had trouble answering that. Please try again.",
        },
      ]);
    } finally {
      setFollowUpLoading(false);
    }
  }

  async function handleSaveLesson() {
    if (!user || !lesson || !selectedInterest || !topic.trim()) return;
    setSavingLesson(true);
    try {
      const interestLabel = INTERESTS.find((i) => i.id === selectedInterest)?.label ?? selectedInterest;
      const { error: saveError } = await supabase.from("saved_lessons").insert({
        user_id: user.id,
        interest: interestLabel,
        topic: topic.trim(),
        lesson: lesson,
      });

      if (saveError) {
        console.warn("Failed to save lesson:", saveError.message);
      } else {
        setIsSaved(true);
        trackEvent("lesson_saved", {
          user_id: user.id,
          user_name: profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || null,
          topic: topic.trim(),
          interest: interestLabel,
        });
      }
    } catch (err) {
      console.error("Error saving lesson:", err);
    } finally {
      setSavingLesson(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") generateLesson();
  }

  return (
    <div className="px-4 py-8 md:py-12">
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
            Pick what you love, type a school topic, and get a personalized lesson told as an immersive story — with an interactive AI tutor.
          </p>
        </div>

        {/* Generator Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl space-y-7">
          {/* Step 1: Choose Interest */}
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

          {/* Step 2: Enter School Topic */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-slate-300 uppercase tracking-wider">
                2. Enter a school topic
              </label>
              <input
                type="text"
                value={academicSubject}
                onChange={(e) => setAcademicSubject(e.target.value)}
                placeholder="Optional subject (e.g. Biology, Physics)"
                className="bg-transparent border-b border-white/15 px-2 py-0.5 text-xs text-slate-400 placeholder-slate-600 focus:outline-none focus:border-violet-400 max-w-[190px]"
              />
            </div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Photosynthesis, Cell Division, Gravity, Supply & Demand..."
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
                Crafting your intelligent lesson...
              </span>
            ) : (
              "Generate My Lesson"
            )}
          </button>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm leading-relaxed">
              {error}
            </div>
          )}

          {/* Lesson Output */}
          {lesson && (
            <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/5 border border-violet-400/20 rounded-xl p-5 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{INTERESTS.find((i) => i.id === selectedInterest)?.emoji}</span>
                  <div>
                    <h2 className="text-base font-bold text-violet-200">Personalized Lesson</h2>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Topic: <span className="text-white font-medium">{topic}</span>
                    </span>
                  </div>
                </div>

                {user && (
                  <button
                    onClick={handleSaveLesson}
                    disabled={savingLesson || isSaved}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSaved
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default"
                        : "bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-500/30"
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Saved
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5" />
                        {savingLesson ? "Saving..." : "Save Lesson"}
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Lesson Text */}
              <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {lesson}
              </div>

              {/* Guest prompt to save / register */}
              {!user && (
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
                  <span>Want to save this lesson and track your learning journey?</span>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/login"
                      className="text-violet-400 hover:text-violet-300 font-medium underline"
                    >
                      Log in
                    </Link>
                    <span>or</span>
                    <Link
                      href="/register"
                      className="px-2.5 py-1 rounded-md bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 font-semibold"
                    >
                      Sign up free
                    </Link>
                  </div>
                </div>
              )}

              {user && isSaved && (
                <div className="pt-2 text-xs text-emerald-300/90 flex items-center justify-between border-t border-white/5">
                  <span>Lesson saved to your profile library!</span>
                  <Link href="/dashboard" className="text-violet-400 hover:underline flex items-center gap-1 font-medium">
                    View in Dashboard <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* ============================================================== */}
              {/* INTERACTIVE FOLLOW-UP TUTOR SECTION                            */}
              {/* ============================================================== */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-violet-300 uppercase tracking-wider">
                  <MessageCircle className="w-4 h-4 text-violet-400" />
                  <span>Ask LearnMyWay Tutor (Follow-up)</span>
                </div>

                {/* Quick Prompts */}
                {followUpMessages.length === 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      onClick={() => handleSendFollowUp("Can you give me an easier analogy for this concept?")}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3 text-violet-400" />
                      Give me an easier analogy
                    </button>
                    <button
                      onClick={() => handleSendFollowUp("Quiz me on this concept with 2 practice questions!")}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3 text-violet-400" />
                      Quiz me on this
                    </button>
                    <button
                      onClick={() => handleSendFollowUp("Why does this concept matter in everyday life?")}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3 text-violet-400" />
                      Why does it matter?
                    </button>
                  </div>
                )}

                {/* Chat History */}
                {followUpMessages.length > 0 && (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {followUpMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-2.5 text-xs p-3 rounded-xl leading-relaxed ${
                          msg.role === "user"
                            ? "bg-violet-500/20 text-violet-100 ml-6 border border-violet-500/30"
                            : "bg-white/5 text-slate-200 mr-6 border border-white/10"
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {msg.role === "user" ? (
                            <UserIcon className="w-3.5 h-3.5 text-violet-300" />
                          ) : (
                            <Bot className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                        </div>
                        <div className="whitespace-pre-wrap flex-1">{msg.content}</div>
                      </div>
                    ))}
                    {followUpLoading && (
                      <div className="flex items-center gap-2 text-xs text-violet-300 p-2.5 bg-white/5 rounded-xl border border-white/5">
                        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Tutor is thinking...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}

                {/* Follow-up Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendFollowUp();
                  }}
                  className="flex items-center gap-2 pt-1"
                >
                  <input
                    type="text"
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    placeholder="Ask a question about this lesson or test your understanding..."
                    disabled={followUpLoading}
                    className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/60 focus:border-violet-400 transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!followUpInput.trim() || followUpLoading}
                    className="px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ask</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* PWA Download Banner */}
        <InstallPWA variant="banner" />

        <p className="text-center text-xs text-slate-500 mt-8">
          Powered by Groq AI • {activeModel}
        </p>
      </div>
    </div>
  );
}
