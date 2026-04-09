import { headers } from "next/headers";

export async function getBranchId() {
  const headersList = await headers();
  return headersList.get("x-user-branch") || null;
}

export async function getUserRole() {
  const headersList = await headers();
  return headersList.get("x-user-role") || null;
}
