#!/usr/bin/env bash
# Jalankan semua pemeriksaan lokal dan simpan log ke baseline/test_results.txt
cd "$(dirname "$0")/.." || exit 1
snap() { (cd public && find . -type f | sort | xargs sha256sum | sha256sum | cut -c1-16); }
{
  echo "# test_results — $(date -u '+%F %T') UTC (semua hasil = PASS-LOKAL / emulasi; BUKAN browser nyata)"
  python3 scripts/build.py >/dev/null && A=$(snap) && python3 scripts/build.py >/dev/null && B=$(snap)
  echo; echo "## build deterministik: hash 1=$A hash 2=$B $([ "$A" = "$B" ] && echo PASS || echo FAIL)"
  for c in "python3 scripts/check_integrity.py" "python3 scripts/verify_parity.py" "node scripts/smoke_test.js" "node scripts/test_legacy_redirect.js"; do
    echo; echo "## $c"; $c 2>&1 | grep -v '^INFO ukuran' | tail -n 75; echo "exit=${PIPESTATUS[0]}"
  done
  for f in node; do :; done
  echo; echo "## node --check"; for j in public/assets/*.js; do node --check "$j" && echo "OK $j"; done
} | tee baseline/test_results.txt | grep -E "^## |RINGKASAN|SEMUA|TOTAL|exit=|FAIL"
