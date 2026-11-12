import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, type SavedLesson } from "@/lib/supabase";
import { INTERESTS as AVAILABLE_INTERESTS, EDUCATION_LEVELS } from "@/lib/constants";
import {
  Sparkles,
  Bookmark,
  History,
  User,
  Mail,
  GraduationCap,
  LogOut,
  Edit2,
  X,
  Trash2,
  ArrowRight,
  Clock,
} from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, profile, loading: authLoading, signOut, updateProfile } = useAuth();

  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<SavedLesson | null>(null);

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEducation, setEditEducation] = useState("High School");
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const loadSavedLessons = useCallback(async () => {
    if (!user) return;
    setLoadingLessons(true);
    try {
      const { data, error } = await supabase
        .from("saved_lessons")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not load saved lessons:", error.message);
      } else if (data) {
        setSavedLessons(data as SavedLesson[]);
      }
    } catch (err) {
      console.error("Error loading saved lessons:", err);
    } finally {
      setLoadingLessons(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSavedLessons();
    }
  }, [user, loadSavedLessons]);

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || "");
      setEditEducation(profile.education_level || "High School");
      setEditInterests(profile.learning_interests || []);
    }
  }, [profile]);

  // Auth protection
  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-violet-300">
          <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="font-semibold text-sm">Loading student dashboard...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  const studentName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Student";

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMessage("");

    const { error } = await updateProfile({
      full_name: editName.trim(),
      education_level: editEducation,
      learning_interests: editInterests,
    });

    if (error) {
      setProfileMessage("Failed to update profile: " + error.message);
    } else {
      setProfileMessage("Profile updated successfully!");
      setIsEditingProfile(false);
      setTimeout(() => setProfileMessage(""), 4000);
    }
    setSavingProfile(false);
  };

  const toggleInterest = (interestId: string) => {
    setEditInterests((prev) =>
      prev.includes(interestId) ? prev.filter((i) => i !== interestId) : [...prev, interestId]
    );
  };

  const handleDeleteLesson = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from("saved_lessons").delete().eq("id", id);
      if (!error) {
        setSavedLessons((prev) => prev.filter((item) => item.id !== id));
        if (selectedLesson?.id === id) setSelectedLesson(null);
      }
    } catch (err) {
      console.error("Error deleting saved lesson:", err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-violet-900/40 via-purple-900/30 to-slate-900/40 border border-violet-500/20 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs font-semibold">
            <span>🎓 Student Dashboard</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Welcome back, <span className="bg-gradient-to-r from-violet-300 to-pink-300 bg-clip-text text-transparent">{studentName}</span>! 👋
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Ready to explore school topics tailored to what you love? Generate new lessons, track your learning history, and review your bookmarks.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <Link
            href="/"
            className="px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Generate New Lesson
          </Link>
          <button
            onClick={signOut}
            className="px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-red-300 bg-white/5 hover:bg-red-500/10 border border-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>

      {profileMessage && (
        <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-200 text-sm text-center">
          {profileMessage}
        </div>
      )}

      {/* Main Grid: Profile Info & Learning Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Student Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <User className="w-5 h-5 text-violet-400" />
                <h2>Profile Information</h2>
              </div>
              <button
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="text-xs text-violet-300 hover:text-violet-200 flex items-center gap-1 cursor-pointer font-medium"
              >
                {isEditingProfile ? (
                  <>
                    <X className="w-3.5 h-3.5" /> Cancel
                  </>
                ) : (
                  <>
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </>
                )}
              </button>
            </div>

            {isEditingProfile ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Education Level</label>
                  <select
                    value={editEducation}
                    onChange={(e) => setEditEducation(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Favorite Interests</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {AVAILABLE_INTERESTS.map((item) => {
                      const selected = editInterests.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleInterest(item.id)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                            selected
                              ? "bg-violet-500/30 border-violet-400 text-violet-200"
                              : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                          }`}
                        >
                          <span>{item.emoji}</span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 text-white shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {savingProfile ? "Saving..." : "Save Profile Changes"}
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Full Name</span>
                  <span className="font-semibold text-white mt-0.5 block">{studentName}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Email</span>
                  <div className="flex items-center gap-1.5 text-slate-200 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{user?.email}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Education Level</span>
                  <div className="flex items-center gap-1.5 text-slate-200 mt-0.5">
                    <GraduationCap className="w-3.5 h-3.5 text-violet-400" />
                    <span>{profile?.education_level || "High School"}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">
                    Learning Interests
                  </span>
                  {profile?.learning_interests && profile.learning_interests.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.learning_interests.map((id) => {
                        const item = AVAILABLE_INTERESTS.find((i) => i.id === id);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 text-xs border border-violet-500/30"
                          >
                            <span>{item?.emoji ?? "✨"}</span>
                            <span>{item?.label ?? id}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">No interests specified yet. Click edit to choose your favorites.</span>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Member since {new Date(user?.created_at || Date.now()).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (2 cols): Saved Lessons & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Saved Lessons Section */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Bookmark className="w-5 h-5 text-violet-400" />
                <h2>Saved Lessons</h2>
                <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-semibold">
                  {savedLessons.length}
                </span>
              </div>
              <Link
                href="/"
                className="text-xs text-violet-300 hover:text-violet-200 flex items-center gap-1 font-medium"
              >
                Create lesson <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loadingLessons ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                <svg className="animate-spin w-5 h-5 mx-auto mb-2 text-violet-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading saved lessons...
              </div>
            ) : savedLessons.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-slate-400">
                  <Bookmark className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-white">No saved lessons yet</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  When you generate a lesson on the generator page, click "Save Lesson" to keep it here in your personal library.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-500/30 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Try Generating a Lesson
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedLessons.map((item) => {
                  const interestObj = AVAILABLE_INTERESTS.find(
                    (i) => i.id.toLowerCase() === item.interest.toLowerCase() || i.label.toLowerCase() === item.interest.toLowerCase()
                  );
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedLesson(item)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/20">
                            <span>{interestObj?.emoji ?? "✨"}</span>
                            <span>{interestObj?.label ?? item.interest}</span>
                          </span>
                          <button
                            onClick={(e) => handleDeleteLesson(item.id, e)}
                            className="text-slate-500 hover:text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-colors"
                            title="Delete saved lesson"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <h4 className="font-bold text-white text-sm group-hover:text-violet-300 transition-colors line-clamp-1">
                          {item.topic}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                          {item.lesson}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        <span className="text-violet-400 font-medium group-hover:underline flex items-center gap-1">
                          Read lesson <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Learning History Section */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10 text-white font-bold text-base">
              <History className="w-5 h-5 text-violet-400" />
              <h2>Learning History</h2>
            </div>

            {savedLessons.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-slate-500">
                  <History className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-400">
                  Your learning journey starts here. Explore and save topics to see your chronological history.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedLessons.slice(0, 5).map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedLesson(entry)}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-slate-300 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-violet-400" />
                      <span className="font-medium text-white">{entry.topic}</span>
                      <span className="text-slate-500">via</span>
                      <span className="text-violet-300">{entry.interest}</span>
                    </div>
                    <span className="text-slate-500">
                      {new Date(entry.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal / Dialog for Viewing Full Saved Lesson */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-violet-500/30 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">
                  {selectedLesson.interest} Lesson
                </span>
                <h3 className="text-xl font-bold text-white">{selectedLesson.topic}</h3>
              </div>
              <button
                onClick={() => setSelectedLesson(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
              {selectedLesson.lesson}
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs text-slate-400">
              <span>Saved on {new Date(selectedLesson.created_at).toLocaleString()}</span>
              <button
                onClick={() => setSelectedLesson(null)}
                className="px-4 py-2 rounded-xl bg-violet-500 text-white font-semibold hover:bg-violet-400 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
