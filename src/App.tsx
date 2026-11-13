import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { trackEvent } from "@/lib/analytics";
import Generator from "@/pages/Generator";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Analytics from "@/pages/Analytics";
import NotFound from "@/pages/not-found";
import { Toaster } from "@/components/ui/toaster";

function PageViewTracker() {
  const [location] = useLocation();
  const { user, profile } = useAuth();

  useEffect(() => {
    const userName =
      profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || null;
    trackEvent("page_view", {
      user_id: user?.id || null,
      user_name: userName,
      page_path: location,
    });
  }, [location, user?.id, profile?.full_name]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <PageViewTracker />
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white flex flex-col font-sans selection:bg-violet-500/30 selection:text-white">
        <Navbar />
        <main className="flex-1">
          <Switch>
            <Route path="/" component={Generator} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/analytics" component={Analytics} />
            <Route component={NotFound} />
          </Switch>
        </main>
        <Toaster />
        <UpdatePrompt />
      </div>
    </AuthProvider>
  );
}

export default App;
