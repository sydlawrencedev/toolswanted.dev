#!/usr/bin/env bash
# Is the board back?
#
# The daily read limit resets at midnight UTC. After the fix that
# stopped the board counting the registry mirror on every render, one
# board render reads seven rows instead of 55,300, so the limit is
# 714,285 renders a day rather than ninety.
#
# This checks whether the board is serving again. Run it after
# midnight UTC:
#
#   bash scripts/check-recovery.sh
#
# It exits 0 when the board is up and 1 when it is not.

set -u
BASE="${1:-https://toolswanted.dev}"

failed=0

check() {
  local path="$1" expect="$2" label="$3"
  local code
  code=$(curl -sS -m 20 -o /dev/null -w "%{http_code}" "${BASE}${path}?nocache=$(date +%s%N)" 2>/dev/null)
  if [ "$code" = "$expect" ]; then
    printf "  ok    %-34s %s\n" "$path" "$code"
  else
    printf "  FAIL  %-34s %s (wanted %s)\n" "$path" "$code" "$expect"
    failed=1
  fi
}

echo "the board at ${BASE}:"

check "/"            200 "the board"
check "/weekly"      200 "the weekly list"
check "/about"       200 "about"
check "/agents"      200 "for agents"
check "/build"       200 "build one"
check "/api/stats"   200 "the stats"
check "/api/top"     200 "the most wanted"
check "/llms.txt"    200 "llms.txt"
check "/og/default.png" 200 "the default poster"

echo ""
if [ "$failed" -eq 0 ]; then
  echo "the board is up."
  echo ""
  echo "Next: run the refresh script, so the documents carry the numbers the"
  echo "board is actually reporting, and commit the result."
  echo ""
  echo "  node scripts/refresh-numbers.mjs"
  exit 0
fi

echo "The board is not back yet."
echo ""
echo "If it is past midnight UTC, the read limit has reset and something"
echo "else is wrong. Check the Worker logs:"
echo ""
echo "  npx wrangler tail toolswanted"
echo ""
echo "If it is before midnight UTC, the limit has not reset yet. The count"
echo "is in the API's own message."
exit 1
