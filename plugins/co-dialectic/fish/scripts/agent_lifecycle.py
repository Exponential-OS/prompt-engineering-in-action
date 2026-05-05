#!/usr/bin/env python3
"""
agent_lifecycle.py — Background agent lifecycle manager.

Tracks spawned background agents. Enforces:
  - Timeout ceiling (default 10 min) → flags as stuck
  - File dedup → blocks spawning when existing agent owns same target files
  - Capacity-error detection → escalates on quota/rate-limit errors

State: ~/.co-dialectic/agent-lifecycle.json (atomic writes)

Commands:
  register   --agent-id <id> --files <f1> [<f2>...] [--description "..."]
  check-dedup --files <f1> [<f2>...]
  poll       [--timeout-min 10]
  status
  complete   --agent-id <id>

Exit: 0=PASS, 1=BLOCK, 2=WARN
All output JSON on stdout. Errors to stderr.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import pathlib
import sys

STATE_DIR = pathlib.Path.home() / ".co-dialectic"
STATE_FILE = STATE_DIR / "agent-lifecycle.json"
TASK_OUTPUT_DIR = STATE_DIR / "task-outputs"

CAPACITY_KEYWORDS = ("capacity", "quota", "rate_limit", "rate limit", "exhausted")


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _load() -> dict:
    if not STATE_FILE.exists():
        return {"agents": {}}
    try:
        return json.loads(STATE_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {"agents": {}}


def _save(state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    os.replace(tmp, STATE_FILE)


def _running_agents(state: dict) -> dict:
    return {k: v for k, v in state["agents"].items() if v.get("status") == "running"}


def _file_conflicts(files: list[str], running: dict) -> list[dict]:
    conflicts = []
    for agent_id, info in running.items():
        overlap = set(files) & set(info.get("target_files", []))
        if overlap:
            conflicts.append({"agent_id": agent_id, "conflicting_files": list(overlap)})
    return conflicts


def cmd_register(args: argparse.Namespace) -> int:
    state = _load()
    running = _running_agents(state)
    conflicts = _file_conflicts(args.files, running)
    if conflicts:
        result = {
            "verdict": "BLOCK",
            "reason": "file conflict — existing agent already targeting these files",
            "conflicting_agents": conflicts,
            "files": args.files,
        }
        print(json.dumps(result))
        return 1

    state["agents"][args.agent_id] = {
        "registered_at": _now_iso(),
        "description": args.description or "",
        "target_files": args.files,
        "status": "running",
        "last_polled": _now_iso(),
    }
    _save(state)
    print(json.dumps({"verdict": "PASS", "agent_id": args.agent_id}))
    return 0


def cmd_check_dedup(args: argparse.Namespace) -> int:
    state = _load()
    running = _running_agents(state)
    conflicts = _file_conflicts(args.files, running)
    if conflicts:
        print(json.dumps({"verdict": "BLOCK", "conflicting_agents": conflicts}))
        return 1
    print(json.dumps({"verdict": "PASS", "conflicting_agents": []}))
    return 0


def cmd_poll(args: argparse.Namespace) -> int:
    timeout_min = args.timeout_min
    state = _load()
    now = datetime.datetime.now(datetime.timezone.utc)
    stuck = []
    capacity_errors = []
    completed_count = 0

    for agent_id, info in state["agents"].items():
        if info.get("status") != "running":
            continue

        # Check timeout
        registered_at_str = info.get("registered_at", "")
        try:
            registered_at = datetime.datetime.fromisoformat(
                registered_at_str.replace("Z", "+00:00")
            )
            age_min = (now - registered_at).total_seconds() / 60
            if age_min > timeout_min:
                state["agents"][agent_id]["status"] = "stuck"
                stuck.append({"agent_id": agent_id, "age_min": round(age_min, 1)})
                continue
        except (ValueError, TypeError):
            pass

        # Check task output file for capacity errors
        output_file = TASK_OUTPUT_DIR / f"{agent_id}.txt"
        if output_file.exists():
            content = output_file.read_text().lower()
            if any(kw in content for kw in CAPACITY_KEYWORDS):
                state["agents"][agent_id]["status"] = "capacity-error"
                capacity_errors.append(agent_id)
                continue
            # Output exists and no errors → mark complete
            state["agents"][agent_id]["status"] = "completed"
            completed_count += 1

        state["agents"][agent_id]["last_polled"] = _now_iso()

    _save(state)
    result = {
        "running": len(_running_agents(state)),
        "stuck": stuck,
        "capacity_errors": capacity_errors,
        "completed_since_last_poll": completed_count,
    }
    verdict = "WARN" if (stuck or capacity_errors) else "PASS"
    result["verdict"] = verdict
    print(json.dumps(result))
    return 2 if (stuck or capacity_errors) else 0


def cmd_status(_args: argparse.Namespace) -> int:
    state = _load()
    print(json.dumps(state, indent=2))
    return 0


def cmd_complete(args: argparse.Namespace) -> int:
    state = _load()
    if args.agent_id not in state["agents"]:
        print(json.dumps({"verdict": "WARN", "reason": f"agent {args.agent_id} not found"}))
        return 2
    state["agents"][args.agent_id]["status"] = "completed"
    _save(state)
    print(json.dumps({"verdict": "PASS", "agent_id": args.agent_id, "status": "completed"}))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Background agent lifecycle manager")
    sub = parser.add_subparsers(dest="command")

    p_reg = sub.add_parser("register")
    p_reg.add_argument("--agent-id", required=True)
    p_reg.add_argument("--files", nargs="+", required=True)
    p_reg.add_argument("--description", default="")

    p_dedup = sub.add_parser("check-dedup")
    p_dedup.add_argument("--files", nargs="+", required=True)

    p_poll = sub.add_parser("poll")
    p_poll.add_argument("--timeout-min", type=float, default=10.0)

    sub.add_parser("status")

    p_complete = sub.add_parser("complete")
    p_complete.add_argument("--agent-id", required=True)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return 1

    dispatch = {
        "register": cmd_register,
        "check-dedup": cmd_check_dedup,
        "poll": cmd_poll,
        "status": cmd_status,
        "complete": cmd_complete,
    }
    return dispatch[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
