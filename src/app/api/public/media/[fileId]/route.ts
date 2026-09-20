import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidGoogleAccount, getWorkspaceAdminGoogleAccount } from "@/lib/google";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    if (!fileId) {
      return new NextResponse("File ID required", { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId");

    // Gather candidate accounts: prioritize the specific workspace admin if provided
    const candidateAccounts: any[] = [];

    if (adminId) {
      const primaryAdminAcc = await getWorkspaceAdminGoogleAccount(adminId);
      if (primaryAdminAcc?.accessToken) {
        candidateAccounts.push(primaryAdminAcc);
      }
    }

    // Also include all other valid Google accounts as backup
    const googleAccounts = await prisma.googleAccount.findMany({
      orderBy: { updatedAt: "desc" },
    });

    for (const acc of googleAccounts) {
      if (!candidateAccounts.some((c) => c.id === acc.id)) {
        const valid = await getValidGoogleAccount(acc.userId);
        if (valid?.accessToken) {
          candidateAccounts.push(valid);
        }
      }
    }

    if (candidateAccounts.length === 0) {
      return new NextResponse("No active Google Account available to stream media", { status: 503 });
    }

    // Forward Range header if present (crucial for video streaming)
    const range = request.headers.get("range");

    let lastErrorStatus = 500;

    // Try candidates in order
    for (const activeAccount of candidateAccounts) {
      const driveHeaders: Record<string, string> = {
        Authorization: `Bearer ${activeAccount.accessToken}`,
      };
      if (range) {
        driveHeaders["Range"] = range;
      }

      // Fetch file stream from Google Drive v3
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: driveHeaders,
        }
      );

      if (driveRes.ok) {
        const contentType = driveRes.headers.get("content-type") || "application/octet-stream";
        const contentLength = driveRes.headers.get("content-length");
        const contentRange = driveRes.headers.get("content-range");
        const acceptRanges = driveRes.headers.get("accept-ranges") || "bytes";

        const responseHeaders: Record<string, string> = {
          "Content-Type": contentType,
          "Accept-Ranges": acceptRanges,
          "Cache-Control": "public, max-age=31536000, immutable",
        };

        if (contentLength) {
          responseHeaders["Content-Length"] = contentLength;
        }
        if (contentRange) {
          responseHeaders["Content-Range"] = contentRange;
        }

        return new NextResponse(driveRes.body, {
          status: driveRes.status,
          headers: responseHeaders,
        });
      }

      lastErrorStatus = driveRes.status;
    }

    return new NextResponse(`Google Drive media not found or inaccessible (${lastErrorStatus})`, {
      status: lastErrorStatus === 404 ? 404 : 502,
    });
  } catch (err: any) {
    console.error("Failed to stream Google Drive media:", err);
    return new NextResponse(err?.message || "Internal Server Error", { status: 500 });
  }
}
