import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { verifySuperAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-login")({
  validateSearch: (s: Record<string, unknown>) => ({
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
  head: () => ({ meta: [
    { title: "Admin sign in" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
    if (isSuper && !search.reason) throw redirect({ to: "/admin/observability" });
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const { reason } = Route.useSearch();
  const verify = useServerFn(verifySuperAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    reason === "forbidden" ? "Your account does not have super-admin access." : null,
  );

  useEffect(() => {
    if (reason === "forbidden") {
      supabase.auth.signOut();
    }
  }, [reason]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
      const result = await verify();
      if (!result.isSuperAdmin) {
        await supabase.auth.signOut();
        throw new Error("This account does not have super-admin access.");
      }
      toast.success("Welcome, super-admin");
      navigate({ to: "/admin/observability", replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    if (!email) return toast.error("Enter your email first");
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (e) toast.error(e.message);
    else toast.success("Reset link sent");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
      {/* Background flourish */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.25_0.08_160_/_0.25),transparent_60%)]" />

      <div className="relative w-full max-w-sm rounded-2xl border border-border/60 bg-card/80 p-7 shadow-2xl backdrop-blur">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-emerald shadow-glow">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold tracking-tight">Admin console</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Super-admin access only</p>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-gradient-emerald shadow-glow">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</> : "Sign in to admin"}
          </Button>

          <div className="flex items-center justify-between text-[11px]">
            <button type="button" onClick={onForgot} className="text-muted-foreground hover:text-foreground">
              Forgot password?
            </button>
            <Link to="/" className="text-muted-foreground hover:text-foreground">Back to app</Link>
          </div>
        </form>

        <p className="mt-5 border-t border-border/40 pt-4 text-center text-[10px] text-muted-foreground">
          Activity on this console is audited. Unauthorized attempts are logged.
        </p>
      </div>
    </div>
  );
}
