import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Kbd, KbdSequence } from "@/components/Kbd";

const GROUPS: Array<{ heading: string; rows: Array<{ label: string; keys: string[] }> }> = [
  {
    heading: "General",
    rows: [
      { label: "Open command palette", keys: ["⌘", "K"] },
      { label: "Show this help", keys: ["?"] },
    ],
  },
  {
    heading: "Jump to",
    rows: [
      { label: "Dashboard", keys: ["G", "D"] },
      { label: "Jobs", keys: ["G", "J"] },
      { label: "Applications", keys: ["G", "A"] },
      { label: "Sources", keys: ["G", "S"] },
      { label: "Filters", keys: ["G", "F"] },
      { label: "Extension", keys: ["G", "E"] },
      { label: "Automation", keys: ["G", "O"] },
      { label: "Profile", keys: ["G", "P"] },
      { label: "Notifications", keys: ["G", "N"] },
      { label: "Logs", keys: ["G", "L"] },
    ],
  },
];

export function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg surface-frost">
        <DialogHeader>
          <DialogTitle className="font-heading">Keyboard shortcuts</DialogTitle>
          <DialogDescription>Move around JobPilot without leaving the keyboard.</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-5">
          {GROUPS.map((g) => (
            <div key={g.heading}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                {g.heading}
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {g.rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-surface-2">
                    <span className="text-sm">{r.label}</span>
                    <KbdSequence keys={r.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          Tip: shortcuts are ignored while you're typing in an input.
        </div>
      </DialogContent>
    </Dialog>
  );
}
