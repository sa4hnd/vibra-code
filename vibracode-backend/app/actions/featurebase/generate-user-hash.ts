"use server";

import crypto from "crypto";

export async function generateFeaturebaseUserHash(
  userId: string
): Promise<string> {
  // Featurebase secret key - get this from your Featurebase dashboard
  const secretKey = process.env.FEATUREBASE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error("FEATUREBASE_SECRET_KEY environment variable is required");
  }

  // Generate HMAC-SHA256 hash using only userId (as per Featurebase docs)
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(userId)
    .digest("hex");
    
  return hash;
}
