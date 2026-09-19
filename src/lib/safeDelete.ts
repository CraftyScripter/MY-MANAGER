import { prisma } from "./prisma";
import { triggerImmediateBackup } from "./autoBackup";

/**
 * Auto-backup BEFORE any destructive delete operation.
 * If Google Drive backup fails, we still proceed (don't block the user).
 */
export async function autoBackupBeforeDelete(context: string = "manual_delete") {
  try {
    await triggerImmediateBackup(context);
    return true;
  } catch (error: any) {
    console.error(`[AUTO-BACKUP] Failed before ${context}:`, error.message);
    return false;
  }
}

/**
 * Safe deleteMany with automatic backup.
 */
export async function safeDeleteMany(
  model: string,
  options: { where?: any; context?: string } = {}
) {
  const { where = {}, context = `${model}_deleteMany` } = options;
  await autoBackupBeforeDelete(context);
  const result = await (prisma as any)[model].deleteMany({ where });
  return result;
}

/**
 * Safe single delete with automatic backup.
 */
export async function safeDelete(
  model: string,
  options: { where: any; context?: string }
) {
  const { where, context = `${model}_delete` } = options;
  await autoBackupBeforeDelete(context);
  const result = await (prisma as any)[model].delete({ where });
  return result;
}
