import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadInstagramMedia } from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isVideo = file.type.startsWith("video/");
    const resourceType = isVideo ? "video" : "image";

    const uploadRes = await uploadInstagramMedia(buffer, file.name, resourceType);

    return NextResponse.json({
      url: uploadRes.url,
      publicId: uploadRes.publicId,
      resourceType: uploadRes.resourceType,
    });
  } catch (error: any) {
    console.error("Instagram media upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload media file" },
      { status: 500 }
    );
  }
}
