#!/bin/bash
cd /home/z/my-project
while true; do
  bun run dev 2>&1 | tee /home/z/my-project/dev.log
  sleep 5
done
