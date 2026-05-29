"""Safe % LOV: marker engine.

Format expected in template:
    % LOV:summary
    Driven engineer with 8 years of...
    % LOV:end

Replace block contents between `% LOV:<name>` and `% LOV:end`. Never edits
LaTeX commands; only the text payload.
"""
import re
from typing import Iterable

MARK_RE = re.compile(r"%\s*LOV:([a-zA-Z0-9_\-]+)\s*\n(.*?)\n%\s*LOV:end", re.DOTALL)


def extract_markers(tex: str) -> list[dict[str, str]]:
    out = []
    for m in MARK_RE.finditer(tex):
        out.append({"name": m.group(1), "current": m.group(2).strip()})
    return out


def _escape_latex(s: str) -> str:
    repl = {"\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$",
            "#": r"\#", "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}",
            "^": r"\textasciicircum{}"}
    for k, v in repl.items():
        s = s.replace(k, v)
    return s


def apply_replacements(tex: str, repl: dict[str, str], *, allowed: Iterable[str] | None = None) -> str:
    allow = set(allowed) if allowed is not None else None

    def sub(m: re.Match) -> str:
        name = m.group(1)
        if allow is not None and name not in allow:
            return m.group(0)
        if name not in repl:
            return m.group(0)
        new = _escape_latex(repl[name])
        return f"% LOV:{name}\n{new}\n% LOV:end"

    return MARK_RE.sub(sub, tex)
