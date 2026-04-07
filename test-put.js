const { prisma } = require("./lib/prisma");

async function run() {
  try {
    const product = await prisma.product.update({
      where: { id: "test" },
      data: { name: "test", ingredients: [{}] },
    });
  } catch (e) {
    console.error("PUT Error:", e.name, e.code, e.message);
  }
}
run();
