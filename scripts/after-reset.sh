#!/usr/bin/env bash
# Run after the daily D1 write limit resets at midnight UTC.
#
#   ./scripts/after-reset.sh          # waits, then runs
#   ./scripts/after-reset.sh --now    # don't wait, just run
#
# Does, in order:
#   1. applies any pending D1 migrations
#   2. checks the board can write again
#   3. cleans up the check
#   4. restarts the registry crawl with its new row budget
set -uo pipefail
cd "$(dirname "$0")/.."

log() { echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*"; }

if [[ "${1:-}" != "--now" ]]; then
  # Midnight UTC, plus two minutes for the limit to reset.
  now=$(date -u +%s)
  if [[ "$(uname)" == "Darwin" ]]; then
    target=$(date -u -v+1d -v0H -v2M -v0S +%s)
  else
    target=$(date -u -d "tomorrow 00:02" +%s)
  fi
  wait_for=$((target - now))
  log "waiting ${wait_for}s for the D1 write limit to reset at midnight UTC"
  sleep "$wait_for"
fi

log "applying migrations"
npx wrangler d1 migrations apply toolswanted --remote 2>&1 | tail -8

log "checking that writes work again"
TEST_NEED="Temporary verification wish, filed by the nightly check"
response=$(/usr/bin/curl -sS -X POST https://toolswanted.dev/api/wish \
  -H 'content-type: application/json' \
  -H 'user-agent: nightly-check' \
  -d "{\"need\":\"$TEST_NEED\",\"client\":\"other\"}" 2>&1)
echo "$response" | head -12

if echo "$response" | grep -q '"ok": true'; then
  log "writes are working again"
else
  log "writes are still failing"
fi

log "checking the GET endpoint"
/usr/bin/curl -sS -o /tmp/wish-get.txt -w "  GET /wish -> %{http_code}\n" \
  "https://toolswanted.dev/wish?need=Verification+check+from+the+nightly+run" || true
head -c 200 /tmp/wish-get.txt 2>/dev/null; echo

log "cleaning up the check"
npx wrangler d1 execute toolswanted --remote --command \
  "DELETE FROM wishes WHERE need LIKE 'Temporary verification wish%' OR need LIKE 'Verification check from the nightly run%'; DELETE FROM votes WHERE cluster_id IN (SELECT id FROM clusters WHERE title LIKE '%erification%'); DELETE FROM cluster_clients WHERE cluster_id IN (SELECT id FROM clusters WHERE title LIKE '%erification%'); DELETE FROM clusters WHERE title LIKE '%erification%';" \
  2>&1 | tail -3

log "restarting the registry crawl"
nohup node scripts/crawl-registry.ts 3000 > /tmp/crawl.log 2>&1 &
sleep 20
tail -2 /tmp/crawl.log

log "done"
