#!/bin/bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const sm = await prisma.user.findFirst({ where: { role: 'SHOP_MANAGER' } });
  if (sm) console.log(sm.username);
  await prisma.\$disconnect();
}
run();
" > sm_username.txt

USERNAME=$(tail -n 1 sm_username.txt)
echo "Found manager: $USERNAME"

COOKIE=$(curl -s -v -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$USERNAME\"}" 2>&1 | grep -i "set-cookie: session=" | awk -F '=' '{print $2}' | awk -F ';' '{print $1}')

echo "GOT COOKIE: $COOKIE"

curl -s -X POST http://localhost:3000/api/products \
  -H "Cookie: session=$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"id":"xyz123","name":"Test Bug Product","categoryId":"test-cat","price":15,"active":true}' | jq
