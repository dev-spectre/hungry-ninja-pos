export async function publish(branchId: string, message: object) {
  const baseUrl = process.env.WS_PUBLISH_URL;
  const secret = process.env.WS_PUBLISH_SECRET;

  if (!baseUrl || !secret) return;

  await fetch(`${baseUrl.replace(/\/+$/, "")}/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ branchId, message }),
  });
}

