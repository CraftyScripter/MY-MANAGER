import { prisma } from "./prisma";
import { getWorkspaceAdminGoogleAccount } from "./google";

export type FolderCategory = "finance" | "instagram" | "documents" | "backup";

export interface UploadedDriveFile {
  fileId: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  folderCategory: FolderCategory;
}

/**
 * Searches for a folder by name inside a parent folder, or creates it if not found.
 */
export async function getOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  const parentQuery = parentFolderId ? `'${parentFolderId}' in parents and ` : "";
  const query = encodeURIComponent(
    `${parentQuery}name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id, name, mimeType)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder
  const createPayload: { name: string; mimeType: string; parents?: string[] } = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentFolderId) {
    createPayload.parents = [parentFolderId];
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create folder ${folderName} in Google Drive: ${createRes.status} ${err}`);
  }

  const folder = await createRes.json();
  return folder.id;
}

/**
 * Automatically creates and maintains the workspace folder structure inside the Admin's Google Drive:
 * MyManager_AppData/
 *   ├── Finance_Proofs/
 *   ├── Instagram_Media/
 *   └── Documents/
 */
export async function ensureWorkspaceFolderTree(account: {
  id: string;
  accessToken: string;
  driveFolderId?: string | null;
  driveFinanceFolderId?: string | null;
  driveInstagramFolderId?: string | null;
  driveDocsFolderId?: string | null;
}): Promise<{
  rootFolderId: string;
  financeFolderId: string;
  instagramFolderId: string;
  docsFolderId: string;
}> {
  // 1. Root folder
  let rootFolderId = account.driveFolderId;
  if (!rootFolderId) {
    rootFolderId = await getOrCreateFolder(account.accessToken, "MyManager_AppData");
  }

  // 2. Subfolders
  const [financeFolderId, instagramFolderId, docsFolderId] = await Promise.all([
    account.driveFinanceFolderId
      ? Promise.resolve(account.driveFinanceFolderId)
      : getOrCreateFolder(account.accessToken, "Finance_Proofs", rootFolderId),
    account.driveInstagramFolderId
      ? Promise.resolve(account.driveInstagramFolderId)
      : getOrCreateFolder(account.accessToken, "Instagram_Media", rootFolderId),
    account.driveDocsFolderId
      ? Promise.resolve(account.driveDocsFolderId)
      : getOrCreateFolder(account.accessToken, "Documents", rootFolderId),
  ]);

  // Update root folderId in DB if newly created
  if (account.driveFolderId !== rootFolderId && account.id !== "temp") {
    try {
      await prisma.googleAccount.update({
        where: { id: account.id },
        data: { driveFolderId: rootFolderId },
      });
    } catch (_) {}
  }



  return {
    rootFolderId,
    financeFolderId,
    instagramFolderId,
    docsFolderId,
  };
}

/**
 * Uploads a file (Buffer or Base64 or string) to the Workspace Admin's Google Drive.
 * Team members upload seamlessly through the admin's background tokens.
 */
export async function uploadToAdminDrive({
  fileName,
  mimeType,
  buffer,
  folderCategory = "documents",
  makePublicReadable = true,
  preferredUserId,
}: {
  fileName: string;
  mimeType: string;
  buffer: Buffer | Uint8Array | string;
  folderCategory?: FolderCategory;
  makePublicReadable?: boolean;
  preferredUserId?: string;
}): Promise<UploadedDriveFile> {
  const adminAccount = await getWorkspaceAdminGoogleAccount(preferredUserId);
  if (!adminAccount) {
    throw new Error(
      "No Workspace Google Account connected. The Workspace Admin must connect Google Drive during onboarding."
    );
  }

  // Ensure folder structure exists
  const folders = await ensureWorkspaceFolderTree(adminAccount);

  let targetFolderId: string;
  switch (folderCategory) {
    case "finance":
      targetFolderId = folders.financeFolderId;
      break;
    case "instagram":
      targetFolderId = folders.instagramFolderId;
      break;
    case "documents":
      targetFolderId = folders.docsFolderId;
      break;
    case "backup":
    default:
      targetFolderId = folders.rootFolderId;
      break;
  }

  // Convert buffer to binary Uint8Array
  let fileBytes: Uint8Array;
  if (typeof buffer === "string") {
    // Check if base64 data uri
    if (buffer.startsWith("data:")) {
      const base64Content = buffer.split(",")[1];
      fileBytes = Buffer.from(base64Content, "base64");
    } else {
      fileBytes = Buffer.from(buffer, "utf-8");
    }
  } else if (Buffer.isBuffer(buffer)) {
    fileBytes = buffer;
  } else {
    fileBytes = new Uint8Array(buffer);
  }

  // Multipart upload to Google Drive v3
  const boundary = "-------MyManagerBlobBoundary" + Date.now();
  const metadata = {
    name: fileName,
    parents: [targetFolderId],
    mimeType: mimeType || "application/octet-stream",
  };

  const metadataPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}\r\n`
  );
  const mediaHeader = Buffer.from(
    `--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`
  );
  const mediaFooter = Buffer.from(`\r\n--${boundary}--`);

  const multipartBody = Buffer.concat([metadataPart, mediaHeader, Buffer.from(fileBytes), mediaFooter]);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminAccount.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": multipartBody.length.toString(),
      },
      body: multipartBody,
    }
  );

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Google Drive file upload failed: ${uploadRes.status} ${errorText}`);
  }

  const uploadedData = await uploadRes.json();

  // If public readability is enabled (for payment receipts / media view)
  if (makePublicReadable && uploadedData.id) {
    try {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${uploadedData.id}/permissions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminAccount.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: "reader",
            type: "anyone",
          }),
        }
      );
    } catch (permErr) {
      console.warn("Could not set anyone-reader permission on Drive file:", permErr);
    }
  }

  return {
    fileId: uploadedData.id,
    name: uploadedData.name || fileName,
    mimeType: uploadedData.mimeType || mimeType,
    size: uploadedData.size ? parseInt(uploadedData.size, 10) : fileBytes.length,
    webViewLink: uploadedData.webViewLink,
    webContentLink: uploadedData.webContentLink,
    thumbnailLink: uploadedData.thumbnailLink,
    folderCategory,
  };
}

/**
 * Deletes a file from the workspace Google Drive.
 */
export async function deleteFromAdminDrive(
  fileId: string,
  preferredUserId?: string
): Promise<boolean> {
  const adminAccount = await getWorkspaceAdminGoogleAccount(preferredUserId);
  if (!adminAccount) return false;

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${adminAccount.accessToken}`,
    },
  });

  return res.ok || res.status === 404;
}
