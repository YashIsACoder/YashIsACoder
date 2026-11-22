"""Build the one-page CV from scripts/cv/cv.tex into docs/cv.pdf.

Usage: python3 scripts/make_cv.py   (needs pdflatex)
"""
import pathlib, shutil, subprocess, sys

root = pathlib.Path(__file__).resolve().parent
cv = root / "cv"
subprocess.run(["pdflatex", "-interaction=nonstopmode", "-halt-on-error", "cv.tex"],
               cwd=cv, check=True, stdout=subprocess.DEVNULL)
out = root.parent / "docs" / "cv.pdf"
shutil.copy(cv / "cv.pdf", out)
for ext in ("aux", "log", "out"):
    (cv / f"cv.{ext}").unlink(missing_ok=True)
pages = open(out, "rb").read().count(b"/Type /Page\n") or open(out, "rb").read().count(b"/Type/Page")
print(f"wrote {out}")
