#!/usr/bin/env python3
"""Named-mutation harness, v2.

Three outcomes, never two:
  KILLED   - the suite ran to completion and at least one test failed.
  SURVIVED - the suite ran to completion and every test passed.
  INVALID  - the suite could not run the same set of tests it ran clean
             (parse failure, timeout, or a different numTotalTests).
             An INVALID mutation is NOT evidence of coverage; it is a
             broken mutation and is reported separately.

Writes <out>.json with the per-mutation verdict and the exact list of test
names each mutation killed, so the inverse check can be recomputed without
re-running anything.
"""
import json, os, re, subprocess, sys, signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("MUT_ROOT") or os.path.dirname(os.path.dirname(HERE))
TIMEOUT = int(os.environ.get("MUT_TIMEOUT", "240"))


def run(specs):
    """-> (numTotalTests | None(timeout) | 'PARSE_FAIL', failed-names | detail)"""
    cmd = ["npx", "vitest", "run", "--retry=0", "--reporter=json", *specs]
    p = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         start_new_session=True, text=True)
    try:
        out, err = p.communicate(timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        os.killpg(os.getpgid(p.pid), signal.SIGKILL)
        p.wait()
        return None, "timeout"
    m = re.search(r'\{[\s\S]*"numTotalTests"[\s\S]*\}\s*$', out) or \
        re.search(r'\{[\s\S]*"testResults"[\s\S]*\}', out)
    if not m:
        return "PARSE_FAIL", (out[-1500:] + err[-1500:])
    data = json.loads(m.group(0))
    failed, names = [], []
    for f in data.get("testResults", []):
        for a in f.get("assertionResults", []):
            n = a.get("fullName") or a.get("title")
            names.append(n)
            if a.get("status") == "failed":
                failed.append(n)
    return data.get("numTotalTests"), (failed, names)


def main(cfg_path, out_path):
    cfg = json.load(open(cfg_path))
    specs = cfg["specs"]
    total, res = run(specs)
    if total in (None, "PARSE_FAIL"):
        print("BASELINE BROKEN:", total, res); return 1
    failed, all_names = res
    if failed:
        print("BASELINE RED:", failed); return 1
    all_tests = set(all_names)
    print(f"baseline: {total} testes, 0 falhas, {len(all_tests)} nomes distintos\n")

    results, killed = [], set()
    for mut in cfg["mutations"]:
        path = os.path.join(ROOT, mut["file"])
        src = open(path).read()
        old, new = mut["old"], mut["new"]
        if old not in src:
            print(f"{mut['id']:6s} PADRAO NAO ENCONTRADO -> {mut['desc']}")
            results.append({**mut, "verdict": "PATTERN_MISSING"})
            sys.stdout.flush()
            continue
        if src.count(old) != 1:
            print(f"{mut['id']:6s} PADRAO AMBIGUO ({src.count(old)}x) -> {mut['desc']}")
            results.append({**mut, "verdict": "PATTERN_AMBIGUOUS"})
            sys.stdout.flush()
            continue
        open(path, "w").write(src.replace(old, new, 1))
        try:
            total2, res2 = run(specs)
        finally:
            open(path, "w").write(src)

        if total2 is None:
            verdict, detail, kills = "INVALID", "suite estourou o timeout", []
        elif total2 == "PARSE_FAIL":
            verdict, detail, kills = "INVALID", "suite nao compila/nao produz relatorio", []
        elif total2 != total:
            verdict, detail, kills = "INVALID", f"suite rodou {total2} de {total} testes", []
        else:
            kills = res2[0]
            if kills:
                verdict, detail = "KILLED", f"{len(kills)} teste(s)"
                killed.update(kills)
            else:
                verdict, detail = "SURVIVED", "nenhum teste falhou"

        results.append({**mut, "verdict": verdict, "detail": detail, "kills": kills})
        mark = {"KILLED": "MORTA", "SURVIVED": "*** SOBREVIVEU ***",
                "INVALID": "!!! MUTACAO INVALIDA (nao conta como morta)"}[verdict]
        print(f"{mut['id']:6s} {mut['desc']}\n   -> {mark} ({detail})")
        for n in kills[:3]:
            print(f"      . {n}")
        sys.stdout.flush()

    tally = {"KILLED": 0, "SURVIVED": 0, "INVALID": 0,
             "PATTERN_MISSING": 0, "PATTERN_AMBIGUOUS": 0}
    for r in results:
        tally[r["verdict"]] += 1
    never = sorted(all_tests - killed)
    print(f"\nmutacoes: {len(results)} | " + " | ".join(f"{k}={v}" for k, v in tally.items() if v))
    print(f"testes: {len(all_tests)} | mortos por ao menos uma mutacao: {len(killed)}")
    print(f"NENHUMA MUTACAO MATOU ({len(never)}):")
    for n in never:
        print("  -", n)
    json.dump({"specs": specs, "baselineTotal": total, "tests": sorted(all_tests),
               "results": results, "neverKilled": never, "tally": tally},
              open(out_path, "w"), indent=1)
    print(f"\n-> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
