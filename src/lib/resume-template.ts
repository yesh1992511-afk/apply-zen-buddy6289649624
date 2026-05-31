/**
 * LaTeX template constants + helpers shared between client and server.
 * Safe to import from anywhere (no server-only deps).
 */

export const TEX_PREAMBLE = String.raw`\documentclass[letterpaper,11pt]{article}

\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\usepackage{multicol}
\usepackage{xcolor}

%---------------- Page Setup ----------------
\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\addtolength{\oddsidemargin}{-0.6in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1.19in}
\addtolength{\topmargin}{-.7in}
\addtolength{\textheight}{1.4in}

\raggedright
\raggedbottom
\setlength{\tabcolsep}{0in}
\setlength{\multicolsep}{-3.0pt}
\setlength{\columnsep}{-1pt}

%---------------- Section Formatting ----------------
\titleformat{\section}{
  \vspace{-4pt}\scshape\large\bfseries
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

%---------------- Custom Commands ----------------
\newcommand{\resumeItem}[1]{
  \item\small{#1}
}

\newcommand{\resumeSubheading}[4]{
  \item
  \begin{tabular*}{1.0\textwidth}{l@{\extracolsep{\fill}}r}
    \textbf{#1} & \textbf{\small #2} \\
    \textit{\small #3} & \textit{\small #4} \\
  \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
  \item
  \begin{tabular*}{1.0\textwidth}{l@{\extracolsep{\fill}}r}
    \small#1 & \textbf{\small #2} \\
  \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.0in,label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}[leftmargin=0.15in]}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}
`;

/** Escape a plain string so it's safe inside LaTeX body text. */
export function escapeTex(input: string | null | undefined): string {
  if (input == null) return "";
  const s = String(input);
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtMonthYear(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

function fmtYear(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return String(dt.getUTCFullYear());
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  isCurrent?: boolean
): string {
  const s = fmtMonthYear(start);
  const e = isCurrent ? "Present" : fmtMonthYear(end);
  if (s && e) return `${s} -- ${e}`;
  return s || e || "";
}

export { fmtYear };

/** Slugify a name to safe filename: "Yeswanth Reddy" → "yeswanth_reddy" */
export function slugifyName(name: string): string {
  return (name || "resume")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "resume";
}
