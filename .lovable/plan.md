# Move Resume into its own sidebar route with split-view PDF preview

## Goal
- Resume gets its own top-level page (separate from Profile).
- Layout: editor/templates on the LEFT half, sticky PDF preview on the RIGHT half (full viewport height).

## Changes

### 1. New route — `src/routes/_authenticated/resume.tsx`
- Standard `_authenticated` route, `head()` with "Resume — JobPilot" meta.
- Layout: `grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-4rem)]`
  - **Left column** (scrollable, `overflow-y-auto`):
    - "Add a LaTeX template" card (name input + Open .tex + Save & compile)
    - "Templates" list card (select / set default / delete)
    - "Edit LaTeX" textarea card (only when a template is selected)
    - "Tailored preview (top job)" card
  - **Right column** (sticky, full height):
    - PDF preview iframe filling the column (`h-full w-full`)
    - Header shows currently-previewed template name + a small "Tailored / Template" toggle if a tailored preview also exists
    - Empty/compiling/blocked states stay the same

### 2. Extract the existing `ResumeUploader` from `profile.tsx`
- Move the component (lines 679–924 of `src/routes/_authenticated/profile.tsx`) into the new route file, then refactor the JSX into the two-column layout above. No business logic changes — same `useState`, same `getResumePdfUrl`, same `triggerCompileResume`, etc.
- Remove the `<TabsContent value="resume"><ResumeUploader /></TabsContent>` and the `<TabsTrigger value="resume">Resume</TabsTrigger>` from `profile.tsx`. Profile keeps Personal / Experience / Education / Skills / Projects tabs only.

### 3. Sidebar — `src/components/AppSidebar.tsx`
- Add `{ title: "Resume", to: "/resume", icon: FileText }` to the `profile` group (placed right after Profile).
- Use a different icon than Automation (which already uses FileText) — use `FileSignature` or `FileBadge` from lucide.

## Files touched
- `src/routes/_authenticated/resume.tsx` (new)
- `src/routes/_authenticated/profile.tsx` (remove Resume tab + ResumeUploader)
- `src/components/AppSidebar.tsx` (add nav item)

## Out of scope
- No schema changes.
- No worker changes.
- Resume compile/AI tailoring logic unchanged.
- Cover-letter / application PDF previews unchanged.
