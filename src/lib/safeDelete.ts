import { prisma } from "./prisma";

/**
 * SAFETY NET: Auto-backup before any destructive operation.
 * Call this before deleteMany() or delete() on important collections.
 * If Google Drive backup fails, we still proceed (don't block the user).
 */
export async function autoBackupBeforeDelete(context: string = "manual_delete") {
  try {
    // Dynamic import to avoid circular dependencies
    const { createEncryptedDriveBackup } = await import("./google-drive");
    await createEncryptedDriveBackup("admin");
    console.log(`[AUTO-BACKUP] Backup completed before: ${context}`);
    return true;
  } catch (error: any) {
    // Backup failed but we don't block the operation
    console.error(`[AUTO-BACKUP] Failed before ${context}:`, error.message);
    return false;
  }
}

/**
 * Safe delete with automatic backup.
 * Usage: await safeDeleteMany("payment", { where: {} })
 */
export async function safeDeleteMany(
  model: string,
  options: { where?: any; context?: string } = {}
) {
  const { where = {}, context = `${model}_deleteMany` } = options;

  // Auto-backup first
  await autoBackupBeforeDelete(context);

  // Then perform the delete
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

  // Auto-backup first
  await autoBackupBeforeDelete(context);

  // Then perform the delete
  const result = await (prisma as any)[model].delete({ where });
  return result;
}
