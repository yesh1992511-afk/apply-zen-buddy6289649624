import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plane, Activity, Sparkles, Shield } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — JobPilot" },
      { name: "description", content: "Sign in to your JobPilot job-hunt autopilot cockpit." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
      else setCheckingSession(false);
    });
  }, [navigate]);

  useEffect(() => {
    supabase.from("user_roles").select("id", { count: "exact", head: true }).then(({ count }) => {
      setHasUser((count ?? 0) > 0);
      if ((count ?? 0) > 0) setMode("signin");
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created. Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    if (!email) return toast.error("Enter your email first");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent. Check your email.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 bg-gradient-hero">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.55_0.11_162_/_0.25),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,oklch(0.78_0.13_87_/_0.12),transparent_50%)]" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-emerald shadow-glow">
            <Plane className="h-5 w-5 text-primary-foreground -rotate-45" />
          </div>
          <span className="font-heading text-lg font-semibold tracking-tight">JobPilot</span>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            <span className="text-xs font-medium text-foreground">Autopilot for your job search</span>
          </div>
          <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight">
            Apply while you sleep.
            <br />
            <span className="bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent">
              Wake up to interviews.
            </span>
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            JobPilot scrapes 5 portals, scores fit against your profile, tailors your resume, and
            submits qualified applications — fully on autopilot.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-4">
            {[
              { icon: Activity, label: "5 portals", hint: "Greenhouse · Lever · LinkedIn · Workday · Indeed" },
              { icon: Shield, label: "Your data", hint: "RLS-locked. Never shared." },
            ].map(({ icon: Icon, label, hint }) => (
              <div key={label} className="rounded-lg border border-border/60 bg-card/40 p-3 backdrop-blur-sm">
                <Icon className="h-4 w-4 text-primary" />
                <div className="mt-2 text-sm font-semibold">{label}</div>
                <div className="text-[11px] text-muted-foreground leading-snug">{hint}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Single-owner deployment · End-to-end encrypted at rest
        </div>
      </div>

      {/* Auth form */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-emerald shadow-glow">
              <Plane className="h-5 w-5 text-primary-foreground -rotate-45" />
            </div>
            <span className="font-heading text-lg font-semibold">JobPilot</span>
          </div>

          <div>
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signup"
                ? "Single-owner cockpit. You'll be the only user."
                : "Sign in to your autopilot cockpit."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-11 bg-surface-2 border-border/60"
                placeholder="you@domain.com"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <Input
                id="password" type="password" required minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="h-11 bg-surface-2 border-border/60"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" disabled={loading} className="h-11 w-full bg-gradient-emerald font-medium shadow-glow hover:opacity-95">
              {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>

            {hasUser === false && (
              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {mode === "signup" ? "Already have an account? Sign in" : "First time? Create your account"}
              </button>
            )}
            {hasUser === true && (
              <p className="text-center text-xs text-muted-foreground">
                This is a single-user app. Signup is closed.
              </p>
            )}
          </form>

          <p className="text-center text-[11px] text-muted-foreground/70">
            By signing in you agree to use this for your own job hunt only.
          </p>
        </div>
      </div>
    </div>
  );
}
