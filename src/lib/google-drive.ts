import { prisma } from "./prisma";
import { encrypt } from "./encryption";
import { getValidGoogleAccount } from "./google";

const APP_FOLDER_NAME = "MyManager_AppData";

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

/**
 * Ensure the dedicated application folder exists in the user's Google Drive.
 */
export async function ensureAppDataFolder(accessToken: string, folderName: string = APP_FOLDER_NAME): Promise<string> {
  // 1. Search for existing folder
  const query = encodeURIComponent(
    `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id, name, mimeType)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const err = await searchRes.text();
    throw new Error(`Google Drive folder search failed: ${searchRes.status} ${err}`);
  }

  const data = await searchRes.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // 2. Folder doesn't exist, create it
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      description: "Dedicated encrypted data and backup storage for My Manager App",
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create Google Drive folder: ${createRes.status} ${err}`);
  }

  const folder = await createRes.json();
  return folder.id;
}

/**
 * Upload or update a file in Google Drive inside a specific folder.
 */
export async function uploadOrUpdateDriveFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  content: string
): Promise<DriveFileItem> {
  // Check if file already exists in folder
  const query = encodeURIComponent(
    `name = '${fileName}' and '${folderId}' in parents and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name, mimeType)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let fileId: string | null = null;
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      fileId = data.files[0].id;
    }
  }

  if (fileId) {
    // Update existing file content
    const updateRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": mimeType,
        },
        body: content,
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      throw new Error(`Failed to update Drive file: ${updateRes.status} ${err}`);
    }

    return updateRes.json();
  } else {
    // Create new file with multipart upload
    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: mimeType,
    };

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      content +
      closeDelimiter;

    const createRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create Drive file: ${createRes.status} ${err}`);
    }

    return createRes.json();
  }
}

/**
 * List spreadsheets from user's Google Drive.
 */
export async function listDriveSpreadsheets(accessToken: string): Promise<DriveFileItem[]> {
  const query = encodeURIComponent(
    "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=30&fields=files(id, name, mimeType, modifiedTime, webViewLink)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list spreadsheets from Drive: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Performs a full encrypted backup of application data directly into the user's Google Drive folder.
 */
export async function createEncryptedDriveBackup(userId: string = "admin") {
  const account = await getValidGoogleAccount(userId);
  if (!account) {
    throw new Error("Google account is not connected. Please connect Google Drive first.");
  }

  const folderId = account.driveFolderId || (await ensureAppDataFolder(account.accessToken));

  // If folderId was not stored, update it
  if (!account.driveFolderId) {
    await prisma.googleAccount.update({
      where: { id: account.id },
      data: { driveFolderId: folderId },
    });
  }

  // 1. Gather backup snapshot data from DB
  const [users, leadFolders, leadFiles, sheetLinks, envProjects] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true } }),
    prisma.leadFolder.findMany(),
    prisma.leadFile.findMany({ include: { columns: true, tabs: true } }),
    prisma.googleSheetLink.findMany(),
    prisma.envProject.findMany({ include: { environments: { include: { variables: true } } } }),
  ]);

  const backupPayload = {
    appName: "My Manager",
    version: "1.0.0",
    backedUpAt: new Date().toISOString(),
    userEmail: account.email,
    data: {
      users,
      leadFolders,
      leadFiles,
      sheetLinks,
      envProjects,
    },
  };

  const rawJson = JSON.stringify(backupPayload, null, 2);
  const encryptedPayload = encrypt(rawJson);

  const finalBackupFileContent = JSON.stringify({
    format: "MY_MANAGER_ENCRYPTED_BACKUP_V1",
    algorithm: "AES-256-GCM",
    timestamp: new Date().toISOString(),
    encryptedData: encryptedPayload,
  }, null, 2);

  // 2. Upload latest backup file
  await uploadOrUpdateDriveFile(
    account.accessToken,
    folderId,
    "mymanager_backup_latest.enc.json",
    "application/json",
    finalBackupFileContent
  );

  // 3. Upload a timestamped audit copy
  const timestampName = `backup_${new Date().toISOString().replace(/[:.]/g, "-")}.enc.json`;
  await uploadOrUpdateDriveFile(
    account.accessToken,
    folderId,
    timestampName,
    "application/json",
    finalBackupFileContent
  );

  const now = new Date();
  await prisma.googleAccount.update({
    where: { id: account.id },
    data: {
      lastBackupAt: now,
      lastSyncAt: now,
      driveFolderId: folderId,
    },
  });

  return {
    success: true,
    folderId,
    backupFile: timestampName,
    backedUpAt: now.toISOString(),
  };
}
