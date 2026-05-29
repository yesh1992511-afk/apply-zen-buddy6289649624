"""Compile .tex → .pdf using tectonic."""
import subprocess
import tempfile
from pathlib import Path


def compile_tex(tex: str) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "resume.tex"
        p.write_text(tex, encoding="utf-8")
        r = subprocess.run(
            ["tectonic", "--keep-logs", "--chatter", "minimal", str(p)],
            capture_output=True, cwd=d, timeout=120,
        )
        if r.returncode != 0:
            raise RuntimeError(f"tectonic failed: {r.stderr.decode()[-2000:]}")
        return (Path(d) / "resume.pdf").read_bytes()
