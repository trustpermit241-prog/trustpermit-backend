import crypto from "crypto";

export function createLedgerHash(clearance) {
  const data = `${clearance._id}${clearance.fullName}${clearance.type}${clearance.createdAt}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}
