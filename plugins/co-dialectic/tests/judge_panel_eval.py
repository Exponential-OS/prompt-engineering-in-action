#!/usr/bin/env python3
"""Judge-panel eval harness.

Runs the cascade against a seeded-flaw corpus. Reports:
  - agreement rate (how often both small judges converged)
  - escalation rate (how often the tiebreaker fired)
  - F1 on final verdict vs ground truth
  - cost delta vs naive parallel jury
  - per-case juror breakdown

Usage:
    python3 tests/judge_panel_eval.py                # full corpus
    python3 tests/judge_panel_eval.py --case 01      # single case
    python3 tests/judge_panel_eval.py --output results.json

Output: human-readable summary on stdout + machine-readable results JSON.
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORPUS_DIR = ROOT / "tests" / "corpus"
HARNESS = ROOT / "skills" / "judge-panel" / "scripts" / "judge_panel.py"


def load_corpus(filter_id: str | None = None) -> list[dict]:
    cases = []
    for path in sorted(CORPUS_DIR.glob("*.json")):
        case = json.loads(path.read_text())
        if filter_id and not case["id"].startswith(filter_id):
            continue
        cases.append(case)
    return cases


def run_case(case: dict) -> dict:
    start = time.time()
    proc = subprocess.run(
        [
            "python3", str(HARNESS),
            "--rubric", case["rubric"],
            "--artifact", case["artifact"],
            "--silent",
        ],
        capture_output=True, text=True, check=False,
    )
    elapsed = int((time.time() - start) * 1000)
    if proc.returncode != 0:
        return {
            "case_id": case["id"],
            "error": proc.stderr.strip() or f"exit {proc.returncode}",
            "elapsed_ms": elapsed,
        }
    try:
        result = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        return {
            "case_id": case["id"],
            "error": f"json decode: {e} — stdout[:200]={proc.stdout[:200]}",
            "elapsed_ms": elapsed,
        }
    result["case_id"] = case["id"]
    result["ground_truth"] = case["ground_truth_verdict"]
    result["elapsed_ms"] = elapsed
    return result


def compute_metrics(results: list[dict]) -> dict:
    total = len(results)
    valid = [r for r in results if "final_verdict" in r]
    errors = total - len(valid)

    # Agreement + escalation
    agreed = sum(1 for r in valid if r["cascade"]["agreement"] == "agree")
    escalated = sum(1 for r in valid if r["cascade"]["escalated"])

    # Verdict accuracy vs ground truth
    tp = fp = tn = fn = 0
    correct = 0
    for r in valid:
        pred = r["final_verdict"]
        gt = r["ground_truth"]
        if pred == gt:
            correct += 1
        # Treat "fail" as positive class (flaw detected)
        if pred == "fail" and gt == "fail":
            tp += 1
        elif pred == "fail" and gt == "pass":
            fp += 1
        elif pred == "pass" and gt == "pass":
            tn += 1
        elif pred == "pass" and gt == "fail":
            fn += 1

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    accuracy = correct / len(valid) if valid else 0.0

    # Cost
    total_cost = sum(r.get("cost_usd_estimate", 0) for r in valid)
    ratios = [r["cost_vs_naive_parallel_jury_ratio"]
              for r in valid
              if r.get("cost_vs_naive_parallel_jury_ratio") is not None]
    avg_ratio = sum(ratios) / len(ratios) if ratios else None

    return {
        "total_cases": total,
        "valid_runs": len(valid),
        "errored_runs": errors,
        "agreement_rate": round(agreed / len(valid), 3) if valid else 0.0,
        "escalation_rate": round(escalated / len(valid), 3) if valid else 0.0,
        "accuracy": round(accuracy, 3),
        "precision_fail_class": round(precision, 3),
        "recall_fail_class": round(recall, 3),
        "f1_fail_class": round(f1, 3),
        "confusion_matrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "total_cost_usd": round(total_cost, 6),
        "avg_cost_vs_naive_parallel_jury": round(avg_ratio, 3) if avg_ratio is not None else None,
    }


def print_summary(results: list[dict], metrics: dict) -> None:
    print("=" * 78)
    print(f"  Judge-Panel Eval — v3.0.0")
    print("=" * 78)
    print()
    print(f"{'case':28}  {'gt':6}  {'pred':6}  {'agree':8}  {'conf':6}  {'esc':5}")
    print("-" * 78)
    for r in results:
        if "error" in r:
            print(f"{r['case_id']:28}  {'ERROR':<16}  {r['error'][:30]}")
            continue
        case_id = r["case_id"]
        gt = r["ground_truth"]
        pred = r["final_verdict"]
        agreement = r["cascade"]["agreement"]
        conf = r["final_confidence"]
        esc = "yes" if r["cascade"]["escalated"] else "no"
        mark = "✓" if pred == gt else "✗"
        print(f"{case_id:28}  {gt:6}  {pred:6}  {agreement:8}  {conf:5}  {esc:5}  {mark}")
    print()
    print(f"Total cases:         {metrics['total_cases']}")
    print(f"Valid runs:          {metrics['valid_runs']}")
    print(f"Errored runs:        {metrics['errored_runs']}")
    print(f"Agreement rate:      {metrics['agreement_rate']:.1%}")
    print(f"Escalation rate:     {metrics['escalation_rate']:.1%}")
    print(f"Accuracy:            {metrics['accuracy']:.1%}")
    print(f"F1 (fail class):     {metrics['f1_fail_class']:.3f}  "
          f"(P={metrics['precision_fail_class']:.3f} R={metrics['recall_fail_class']:.3f})")
    print(f"Confusion matrix:    {metrics['confusion_matrix']}")
    print(f"Total cost:          ${metrics['total_cost_usd']:.6f}")
    if metrics['avg_cost_vs_naive_parallel_jury'] is not None:
        ratio = metrics['avg_cost_vs_naive_parallel_jury']
        print(f"Cost vs naive jury:  {ratio:.2%}  ({1/ratio:.1f}× cheaper than parallel Opus jury)")
    print()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--case", help="Run a single case by ID prefix (e.g. '01')")
    p.add_argument("--output", help="Write results JSON to this path")
    args = p.parse_args()

    cases = load_corpus(args.case)
    if not cases:
        print(f"No corpus cases found (filter: {args.case})", file=sys.stderr)
        return 2

    print(f"Running {len(cases)} case(s)...", file=sys.stderr)
    results = []
    for case in cases:
        print(f"  → {case['id']} ({case['rubric']})", file=sys.stderr)
        results.append(run_case(case))

    metrics = compute_metrics(results)
    print_summary(results, metrics)

    if args.output:
        Path(args.output).write_text(json.dumps({
            "metrics": metrics,
            "results": results,
        }, indent=2))
        print(f"Results written to {args.output}", file=sys.stderr)

    # Exit code reflects F1 — useful for CI integration
    return 0 if metrics["f1_fail_class"] >= 0.5 else 1


if __name__ == "__main__":
    sys.exit(main())
