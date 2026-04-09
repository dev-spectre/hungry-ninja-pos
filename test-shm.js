const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jose = require('jose');
const url = "http://localhost:3000";
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'SHOP_MANAGER' }, include: { branch: true }});
  if (!admin) { console.log('No shop manager found'); return; }

  const sessionjwt = await new jose.SignJWT({ id: admin.id, role: admin.role, branchId: admin.branchId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);

  const res = await fetch(`${url}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${sessionjwt}`
      },
      body: JSON.stringify({
          id: Date.now().toString(),
          name: "Test Bug Product",
          categoryId: "test-cat",
          price: 15,
          active: true,
      })
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", data);
}
main().catch(console.error).finally(()=>prisma.$disconnect());
