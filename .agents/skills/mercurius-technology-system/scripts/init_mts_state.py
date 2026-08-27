#!/usr/bin/env python3
"""Initialize a project-local Mercurius Technology System state file."""

from pathlib import Path
import argparse
import datetime
import re


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "mts-project"


def yaml_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("project_name")
    parser.add_argument("--root", default=".")
    parser.add_argument("--mps-project-id")
    parser.add_argument("--mps-version")
    parser.add_argument("--mds-project-id")
    parser.add_argument("--mds-version")
    args = parser.parse_args()

    skill_root = Path(__file__).resolve().parents[1]
    template = skill_root / "assets" / "MTS-PROJECT-STATE.yaml"
    project_root = Path(args.root).resolve()
    out_dir = project_root / "mts"
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "MTS-PROJECT-STATE.yaml"

    if target.exists():
        raise SystemExit(f"Refusing to overwrite existing state: {target}")

    text = template.read_text(encoding="utf-8")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    replacements = [
        ("  project_id: null", f"  project_id: {yaml_string(slugify(args.project_name))}"),
        ("  project_name: null", f"  project_name: {yaml_string(args.project_name)}"),
        ("  created_at: null", f"  created_at: {yaml_string(now)}"),
        ("  updated_at: null", f"  updated_at: {yaml_string(now)}"),
        ("  name: null", f"  name: {yaml_string(args.project_name)}"),
    ]
    if args.mps_project_id:
        replacements.append(("  mps_project_id: null", f"  mps_project_id: {yaml_string(args.mps_project_id)}"))
    if args.mps_version:
        replacements.append(("  mps_version: null", f"  mps_version: {yaml_string(args.mps_version)}"))
    if args.mds_project_id:
        replacements.append(("  mds_project_id: null", f"  mds_project_id: {yaml_string(args.mds_project_id)}"))
    if args.mds_version:
        replacements.append(("  mds_version: null", f"  mds_version: {yaml_string(args.mds_version)}"))

    for old, new in replacements:
        text = text.replace(old, new, 1)

    target.write_text(text, encoding="utf-8")
    print(target)


if __name__ == "__main__":
    main()
