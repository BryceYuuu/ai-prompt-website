#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
if [[ "${1:-}" == "full" ]]; then
  npm run test:mutations
  npm run test:browser
fi
