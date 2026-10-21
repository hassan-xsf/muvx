#!/bin/bash
set -a
if [ -f /home/ubuntu/muvx/.env.local ]; then
  # Ensure any stray JS comments don't break bash sourcing
  source <(sed 's|^//|#|g' /home/ubuntu/muvx/.env.local)
elif [ -f ./.env.local ]; then
  source <(sed 's|^//|#|g' ./.env.local)
fi
set +a

export PORT=3000
export HOSTNAME=0.0.0.0
export NODE_ENV=production

# Next.js standalone execution
if [ -f "./.next/standalone/server.js" ]; then
  exec node ./.next/standalone/server.js
else
  exec bun next start -p 3000
fi
