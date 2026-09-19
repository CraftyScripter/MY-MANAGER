import https from "https";

// Force IPv4 — Cloudinary times out on IPv6 on some networks
const origCreateConnection = https.Agent.prototype.createConnection;
https.Agent.prototype.createConnection = function (options, oncreate) {
  if (!options.family) options.family = 4;
  return origCreateConnection.call(this, options, oncreate);
};

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadReceipt(
  file: Buffer,
  filename: string
): Promise<{ url: string; publicId: string }> {
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const publicId = `${timestamp}_${safeName}`;

  const result = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder: "payments/receipts",
          resource_type: "auto",
        },
        (error, result) => {
          if (error || !result) return reject(error || new Error("Upload failed"));
          resolve(result as { secure_url: string; public_id: string });
        }
      );
      uploadStream.end(file);
    }
  );

  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteReceipt(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Failed to delete receipt from Cloudinary:", error);
  }
}

export async function uploadInstagramMedia(
  file: Buffer,
  filename: string,
  resourceType: "image" | "video" | "auto" = "auto"
): Promise<{ url: string; publicId: string; resourceType: string }> {
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const publicId = `${timestamp}_${safeName}`;

  const result = await new Promise<any>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: "instagram/media",
        resource_type: resourceType,
      },
      (error, res) => {
        if (error || !res) return reject(error || new Error("Cloudinary upload failed"));
        resolve(res);
      }
    );
    uploadStream.end(file);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type || resourceType,
  };
}

