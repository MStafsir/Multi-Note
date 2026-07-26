#!/bin/bash
cd /home/z/my-project
exec node --max-old-space-size=768 node_modules/.bin/next dev -p 3000
