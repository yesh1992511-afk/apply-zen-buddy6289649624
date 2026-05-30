import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getNotificationSettings,
  saveNotificationSettings,
  saveGmailCredentials,
  deleteGmailCredentials,
  sendTestNotification,
} from "@/lib/notifications.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { SavedIndicator, type SaveState } from "@/components/SavedIndicator";
import { FieldError } from "@/components/FieldError";
import { toastError, toastSaved } from "@/lib/toast";
import { notificationsSchema, gmailSchema } from "@/lib/validation/settings";
import { CheckCircle2, XCircle, Mail, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — JobPilot" }] }),
  component: NotificationsPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

type NotificationSettingsRow = {
  recipient_email: string | null;
  notify_manual_review: boolean;
  notify_apply_failed: boolean;
  notify_worker_offline: boolean;
  notify_high_score: boolean;
  high_score_threshold: number;
  daily_summary_enabled: boolean;
  daily_summary_time: string;
};
type GmailCreds = { email: string; verified_at: string | null; last_error: string | null } | null;
type NotificationLogEntry = {
  id: string;
  kind: string;
  subject: string;
  status: string;
  last_error: string | null;
  created_at: string;
};

function NotificationsPage() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(getNotificationSettings);
  const saveSettings = useServerFn(saveNotificationSettings);
  const saveCreds = useServerFn(saveGmailCredentials);
  const deleteCreds = useServerFn(deleteGmailCredentials);
  const sendTest = useServerFn(sendTestNotification);

  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => fetchAll() });

  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [settings, setSettings] = useState<NotificationSettingsRow | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [credsErrors, setCredsErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data?.settings) setSettings(data.settings as NotificationSettingsRow);
    if (data?.creds?.email) setEmail((data.creds as { email: string }).email);
  }, [data]);

  const saveCredsMutation = useMutation({
    mutationFn: () => saveCreds({ data: { email, app_password: appPassword } }),
    onSuccess: () => {
      toastSaved("Gmail credentials saved. Click 'Send test' to verify.");
      setAppPassword("");
      setCredsErrors({});
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const deleteCredsMutation = useMutation({
    mutationFn: () => deleteCreds({}),
    onSuccess: () => {
      toastSaved("Credentials removed");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const testMutation = useMutation({
    mutationFn: () => sendTest({}),
    onSuccess: () => {
      toastSaved("Test queued — check your inbox in a few seconds");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["notifications"] }), 8000);
    },
    onError: (e: Error) => toastError(e),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (patch: Partial<NotificationSettingsRow>) => saveSettings({ data: patch }),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => {
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => {
      setSaveState("error");
      toastError(e);
    },
  });

  const validateAndUpdate = (patch: Partial<NotificationSettingsRow>) => {
    const next = { ...(settings ?? {}), ...patch } as NotificationSettingsRow;
    setSettings(next);
    const result = notificationsSchema.safeParse(next);
    if (!result.success) {
      const map: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "_");
        if (!map[key]) map[key] = issue.message;
      }
      setErrors(map);
      setSaveState("dirty");
      return;
    }
    setErrors({});
    setSaveState("dirty");
    saveSettingsMutation.mutate(patch);
  };

  const handleSaveCreds = () => {
    const result = gmailSchema.safeParse({ email, app_password: appPassword });
    if (!result.success) {
      const map: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "_");
        if (!map[key]) map[key] = issue.message;
      }
      setCredsErrors(map);
      return;
    }
    setCredsErrors({});
    saveCredsMutation.mutate();
  };

  const creds = data?.creds as GmailCreds;
  const isVerified = !!creds?.verified_at && !creds?.last_error;


  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Notifications"
        description="Email yourself when manual review is needed, a 95+ score job is found, or for daily summary."
      />


      {/* Gmail credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gmail App Password
            {creds && (
              <Badge variant={isVerified ? "default" : "destructive"} className="ml-2">
                {isVerified ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
                  </>
                ) : creds.last_error ? (
                  <>
                    <XCircle className="mr-1 h-3 w-3" /> Error
                  </>
                ) : (
                  "Unverified"
                )}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Generate an App Password at{" "}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary underline"
            >
              myaccount.google.com/apppasswords <ExternalLink className="h-3 w-3" />
            </a>
            . The worker uses it via IMAP (read OTPs) + SMTP (send notifications). Requires 2-Step Verification enabled on your Google account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Gmail address</Label>
              <Input
                type="email"
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>App Password (16 chars)</Label>
              <Input
                type="password"
                placeholder={creds ? "•••• •••• •••• ••••" : "xxxx xxxx xxxx xxxx"}
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
              />
            </div>
          </div>
          {creds?.last_error && (
            <p className="text-sm text-destructive">Last error: {creds.last_error}</p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => saveCredsMutation.mutate()}
              disabled={!email || !appPassword || saveCredsMutation.isPending}
            >
              {saveCredsMutation.isPending ? "Saving…" : creds ? "Update" : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={!creds || testMutation.isPending}
            >
              Send test email
            </Button>
            {creds && (
              <Button
                variant="ghost"
                className="ml-auto text-destructive"
                onClick={() => deleteCredsMutation.mutate()}
              >
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification toggles */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>When to notify me</CardTitle>
            <CardDescription>Where to send: {settings.recipient_email || "(your account email)"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Send notifications to</Label>
              <Input
                type="email"
                value={settings.recipient_email || ""}
                onChange={(e) => setSettings({ ...settings, recipient_email: e.target.value })}
                onBlur={() => saveSettingsMutation.mutate({ recipient_email: settings.recipient_email })}
                placeholder="alerts@example.com"
              />
            </div>

            <ToggleRow
              label="Manual review needed"
              desc="Captcha, 2FA, or odd question blocks the bot"
              checked={settings.notify_manual_review}
              onChange={(v) => validateAndUpdate({ notify_manual_review: v })}
            />
            <ToggleRow
              label="High-score job found"
              desc={`When a job scores ≥ ${settings.high_score_threshold}`}
              checked={settings.notify_high_score}
              onChange={(v) => validateAndUpdate({ notify_high_score: v })}
            >
              <Input
                type="number"
                min={50}
                max={100}
                className="w-20"
                value={settings.high_score_threshold}
                onChange={(e) => setSettings({ ...settings, high_score_threshold: +e.target.value })}
                onBlur={() => saveSettingsMutation.mutate({ high_score_threshold: settings.high_score_threshold })}
              />
            </ToggleRow>
            <ToggleRow
              label="Apply failed (after retries)"
              desc="Final failure after all retry attempts"
              checked={settings.notify_apply_failed}
              onChange={(v) => validateAndUpdate({ notify_apply_failed: v })}
            />
            <ToggleRow
              label="Worker offline >10 min"
              desc="VPS or worker process crashed"
              checked={settings.notify_worker_offline}
              onChange={(v) => validateAndUpdate({ notify_worker_offline: v })}
            />
            <ToggleRow
              label="Daily summary"
              desc={`Sent daily at ${(settings.daily_summary_time || "20:00").slice(0, 5)} UTC`}
              checked={settings.daily_summary_enabled}
              onChange={(v) => validateAndUpdate({ daily_summary_enabled: v })}
            >
              <Input
                type="time"
                className="w-32"
                value={(settings.daily_summary_time || "20:00").slice(0, 5)}
                onChange={(e) => setSettings({ ...settings, daily_summary_time: e.target.value + ":00" })}
                onBlur={() => saveSettingsMutation.mutate({ daily_summary_time: settings.daily_summary_time })}
              />
            </ToggleRow>
          </CardContent>
        </Card>
      )}
      {/* Daily digest preview */}
      {settings?.daily_summary_enabled && (
        <Card className="overflow-hidden lift">
          <CardHeader className="border-b border-border/40 bg-surface-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" /> Daily digest preview
            </CardTitle>
            <CardDescription>What lands in your inbox at {(settings.daily_summary_time || "20:00").slice(0, 5)} UTC.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-b border-border/30 bg-background/60 px-5 py-3 text-xs text-muted-foreground">
              <div><span className="text-muted-foreground/70">From: </span>JobPilot &lt;{creds?.email || "you@gmail.com"}&gt;</div>
              <div><span className="text-muted-foreground/70">Subject: </span><span className="text-foreground font-medium">Your JobPilot digest — 24 matched · 7 applied</span></div>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="font-heading text-base font-semibold">Yesterday in one glance</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Matched", value: "24", tone: "text-primary" },
                  { label: "Applied", value: "7", tone: "text-success" },
                  { label: "Needs review", value: "2", tone: "text-warning" },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-border/40 bg-surface-1 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{m.label}</div>
                    <div className={`mt-1 font-heading text-2xl font-bold tabular-nums ${m.tone}`}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground italic">+ top 5 high-score matches and any failures requiring attention.</div>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Recent notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.log && data.log.length > 0 ? (
            <div className="divide-y">
              {data.log.map((n: any) => (
                <div key={n.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant={n.status === "sent" ? "default" : "secondary"} className="text-xs">
                        {n.kind}
                      </Badge>
                      <span className="truncate font-medium">{n.subject}</span>
                    </div>
                    {n.last_error && <p className="text-xs text-destructive">{n.last_error}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  children,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
      </div>
      <div className="flex items-center gap-3">
        {children}
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}
