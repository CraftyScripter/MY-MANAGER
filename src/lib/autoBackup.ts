/**
 * Auto-backup system: triggers Google Drive backup when important data changes.
 * Runs in background — never blocks the user's request.
 */

let backupTimeout: NodeJS.Timeout | null = null;
let lastBackupTime = 0;
const MIN_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum between backups

/**
 * Schedule an auto-backup. Debounced — if multiple changes happen quickly,
 * only one backup runs after the changes settle.
 */
export function scheduleAutoBackup(context: string = "data_change") {
  // Don't backup too frequently
  const now = Date.now();
  if (now - lastBackupTime < MIN_BACKUP_INTERVAL) {
    return;
  }

  // Clear existing timeout (debounce)
  if (backupTimeout) {
    clearTimeout(backupTimeout);
  }

  // Schedule backup after 10 seconds of inactivity
  backupTimeout = setTimeout(async () => {
    try {
      const { createEncryptedDriveBackup } = await import("./google-drive");
      await createEncryptedDriveBackup("admin");
      lastBackupTime = Date.now();
      console.log(`[AUTO-BACKUP] Completed after: ${context}`);
    } catch (error: any) {
      console.error(`[AUTO-BACKUP] Failed: ${error.message}`);
    }
  }, 10000);
}

/**
 * Trigger immediate auto-backup (for critical changes like deletes).
 */
export async function triggerImmediateBackup(context: string = "critical_delete") {
  try {
    const { createEncryptedDriveBackup } = await import("./google-drive");
    await createEncryptedDriveBackup("admin");
    lastBackupTime = Date.now();
    console.log(`[AUTO-BACKUP] Immediate backup completed: ${context}`);
    return true;
  } catch (error: any) {
    console.error(`[AUTO-BACKUP] Immediate backup failed: ${error.message}`);
    return false;
  }
}

/**
 * Call this after any CREATE operation on important collections.
 */
export function on_data_created(model: string) {
  scheduleAutoBackup(`${model}_created`);
}

/**
 * Call this after any UPDATE operation on important collections.
 */
export function on_data_updated(model: string) {
  scheduleAutoBackup(`${model}_updated`);
}

/**
 * Call this after any DELETE operation on important collections.
 * Uses immediate backup for deletes (critical).
 */
export function on_data_deleted(model: string) {
  triggerImmediateBackup(`${model}_deleted`);
}
