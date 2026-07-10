"use server";

import { assertCanWrite } from "@/lib/authz";

import { db } from "@/lib/db";
import { randomBytes } from "crypto";

export async function generateUploadToken(workerId: string): Promise<string> {
  await assertCanWrite();
  // Revoke any existing valid tokens for this worker
  await db.workerUploadToken.deleteMany({ where: { workerId } });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const record = await db.workerUploadToken.create({
    // Token criptográfico: el cuid por defecto deriva del timestamp y es adivinable
    data: { workerId, expiresAt, token: randomBytes(32).toString("hex") },
  });

  return record.token;
}

export async function resolveUploadToken(token: string) {
  const record = await db.workerUploadToken.findUnique({
    where: { token },
    include: {
      worker: {
        include: {
          documents: true,
        },
      },
    },
  });

  if (!record) return null;
  if (record.expiresAt < new Date()) return null;

  return record;
}

export type UploadTokenData = NonNullable<Awaited<ReturnType<typeof resolveUploadToken>>>;
