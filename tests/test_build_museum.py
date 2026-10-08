"""Checks for build/build_museum.py.

1. A rebuild in an isolated sandbox reproduces the approved index.html
   byte-for-byte (and is deterministic across runs).
2. Every "<" coming from exhibit.json is escaped as \u003c, so exhibit data
   can never break out of the embedded <script> block.

Run: python tests/test_build_museum.py
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APPROVED = (ROOT / "index.html").read_bytes()


def prepare(sandbox: Path) -> None:
    """Copy the build inputs into a sandbox (once)."""
    (sandbox / "build").mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "build" / "build_museum.py", sandbox / "build" / "build_museum.py")
    shutil.copytree(ROOT / "build" / "vendor", sandbox / "build" / "vendor", dirs_exist_ok=True)
    shutil.copy2(ROOT / "exhibit.json", sandbox / "exhibit.json")


def run_builder(sandbox: Path) -> bytes:
    """Run the builder in the sandbox and return the produced index.html bytes."""
    subprocess.run(
        [sys.executable, str(sandbox / "build" / "build_museum.py")],
        check=True,
        cwd=sandbox,
    )
    return (sandbox / "index.html").read_bytes()


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        sandbox = Path(tmp)
        prepare(sandbox)

        first = run_builder(sandbox)
        assert first == APPROVED, "rebuild does not reproduce the approved index.html byte-for-byte"

        second = run_builder(sandbox)
        assert second == first, "rebuild is not deterministic across runs"

        # Safe embedding: craft exhibit data with several "<" characters,
        # including a "</script>" sequence, and check every one is escaped.
        data = json.loads((sandbox / "exhibit.json").read_text(encoding="utf-8"))
        data["items"][0]["description"] = "Synthetic <check> and </script><b>markup</b>"
        (sandbox / "exhibit.json").write_text(json.dumps(data), encoding="utf-8")

        built = run_builder(sandbox).decode("utf-8")
        expected_escapes = json.dumps(data).count("<")
        assert expected_escapes >= 4, "test fixture should contain several '<' characters"
        assert built.count("\\u003c") == expected_escapes, (
            f'expected {expected_escapes} escaped "<" characters, found {built.count("\\u003c")}'
        )
        assert built.count("</script>") == 3, (
            f'expected only the template script closes, found {built.count("</script>")}'
        )
        assert "<b>markup</b>" not in built, "raw exhibit markup leaked into the page"
        assert "<check>" not in built, "raw exhibit markup leaked into the page"

    print("Passed: museum rebuild is byte-reproducible and escapes embedded JSON.")


if __name__ == "__main__":
    main()
