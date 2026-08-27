#!/usr/bin/env python3
"""Initialize a project-local Mercurius Design System state file."""
from pathlib import Path
import argparse
import datetime
import re
import shutil

def slugify(text):
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "mds-project"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("project_name")
    parser.add_argument("--root", default=".")
    args = parser.parse_args()

    skill_root = Path(__file__).resolve().parents[1]
    template = skill_root / "assets" / "MDS-PROJECT-STATE.yaml"

    project_root = Path(args.root).resolve()
    out_dir = project_root / "mds"
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "MDS-PROJECT-STATE.yaml"

    if target.exists():
        raise SystemExit(f"Refusing to overwrite existing state: {target}")

    text = template.read_text(encoding="utf-8")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    project_id = slugify(args.project_name)

    text = text.replace("project_id: null", f'project_id: "{project_id}"', 1)
    text = text.replace("project_name: null", f'project_name: "{args.project_name}"', 1)
    text = text.replace("created_at: null", f'created_at: "{now}"', 1)
    text = text.replace("updated_at: null", f'updated_at: "{now}"', 1)
    text = text.replace("  name: null", f'  name: "{args.project_name}"', 1)

    target.write_text(text, encoding="utf-8")
    print(target)

if __name__ == "__main__":
    main()
