#!/bin/bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const sm = await prisma.user.findFirst({ where: { role: 'SHOP_MANAGER' } });
  if (sm) console.log(sm.username);
  
  // Find a product
  const p = await prisma.product.findFirst({ where: { branchId: sm.branchId } });
  if (p) console.log(p.id);

  await prisma.\$disconnect();
}
run();
" > sm_info.txt

USERNAME=$(head -n 1 sm_info.txt)
PRODUCT_ID=$(tail -n 1 sm_info.txt)

echo "Manager: $USERNAME"
echo "ProductID: $PRODUCT_ID"

COOKIE=$(curl -s -v -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$USERNAME\"}" 2>&1 | grep -i "set-cookie: session=" | awk -F '=' '{print $2}' | awk -F ';' '{print $1}')

echo "COOKIE: $COOKIE"

curl -s -v -X POST http://localhost:3000/api/transactions \
  -H "Cookie: session=$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "'$(date +%s)'",
    "date": "2026-04-09",
    "timestamp": '$(date +%s000)',
    "total": 100,
    "paymentMode": "cash",
    "items": [
      {
        "productId": "'$PRODUCT_ID'",
        "productName": "Test Bug",
        "price": 100,
        "quantity": 1,
        "subtotal": 100
      }
    ]
  }' | jq

curl -s -v -X GET "http://localhost:3000/api/transactions?date=2026-04-09" \
  -H "Cookie: session=$COOKIE" | jq

