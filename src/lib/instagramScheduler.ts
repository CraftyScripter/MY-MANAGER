import { prisma } from "@/lib/prisma";
import { publishInstagramMedia } from "@/lib/instagram";

export interface ProcessScheduledResult {
  totalDue: number;
  published: number;
  failed: number;
  details: Array<{
    id: string;
    mediaId?: string;
    status: "published" | "failed";
    error?: string;
  }>;
}

/**
 * Process all due scheduled posts across one or all Instagram accounts.
 * Safe to be called from a Cron job or from an API route.
 * Uses atomic locking (status: "publishing") to prevent double posting.
 */
export async function processDueScheduledPosts(targetAccountId?: string): Promise<ProcessScheduledResult> {
  const result: ProcessScheduledResult = {
    totalDue: 0,
    published: 0,
    failed: 0,
    details: [],
  };

  try {
    // 1. Recover any posts stuck in "publishing" for more than 5 minutes
    await prisma.instagramPostLog.updateMany({
      where: {
        ...(targetAccountId ? { instagramAccountId: targetAccountId } : {}),
        status: "publishing",
        updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
      },
      data: {
        status: "failed",
      },
    }).catch(() => {});

    // 2. Find all scheduled posts whose scheduled time has passed
    const duePosts = await prisma.instagramPostLog.findMany({
      where: {
        ...(targetAccountId ? { instagramAccountId: targetAccountId } : {}),
        status: "scheduled",
        scheduledFor: { lte: new Date() },
      },
      include: {
        account: true,
      },
      orderBy: { scheduledFor: "asc" },
      take: 20, // Process in batches of up to 20 to prevent serverless timeout
    });

    result.totalDue = duePosts.length;
    if (duePosts.length === 0) {
      return result;
    }

    for (const due of duePosts) {
      const account = due.account;
      if (!account || !account.accessToken || !account.instagramId) {
        console.error(`[Instagram Scheduler] Missing account or token for post ${due.id}`);
        await prisma.instagramPostLog.update({
          where: { id: due.id },
          data: { status: "failed" },
        }).catch(() => {});
        result.failed++;
        result.details.push({ id: due.id, status: "failed", error: "Missing account or access token" });
        continue;
      }

      // 3. ATOMIC LOCK: Only ONE worker can transition from "scheduled" to "publishing"
      const claim = await prisma.instagramPostLog.updateMany({
        where: {
          id: due.id,
          status: "scheduled",
        },
        data: {
          status: "publishing",
        },
      });

      if (claim.count === 0) {
        // Already claimed by another concurrent worker / request
        continue;
      }

      try {
        const postUrls = (Array.isArray(due.mediaUrls) && due.mediaUrls.length > 0)
          ? due.mediaUrls
          : (() => {
              try {
                const parsed = JSON.parse(due.mediaUrl);
                return Array.isArray(parsed) ? parsed : [due.mediaUrl];
              } catch {
                return [due.mediaUrl];
              }
            })();

        const isCarousel = due.mediaType === "CAROUSEL" || postUrls.length > 1;
        const targetMediaType = isCarousel
          ? "CAROUSEL"
          : due.mediaType === "VIDEO" || due.mediaType === "REELS"
          ? "VIDEO"
          : "IMAGE";

        const publishRes = await publishInstagramMedia({
          instagramId: account.instagramId,
          accessToken: account.accessToken,
          mediaUrl: postUrls[0] || due.mediaUrl,
          mediaUrls: postUrls,
          caption: due.caption || "",
          mediaType: targetMediaType,
        });

        if (publishRes.mediaId) {
          await prisma.instagramPostLog.update({
            where: { id: due.id },
            data: {
              status: "published",
              mediaId: publishRes.mediaId,
              permalink: publishRes.permalink || null,
              publishedAt: new Date(),
            },
          });
          result.published++;
          result.details.push({ id: due.id, mediaId: publishRes.mediaId, status: "published" });
        } else {
          await prisma.instagramPostLog.update({
            where: { id: due.id },
            data: { status: "failed" },
          }).catch(() => {});
          result.failed++;
          result.details.push({ id: due.id, status: "failed", error: "Publish response missing mediaId" });
        }
      } catch (err: any) {
        console.error(`[Instagram Scheduler] Error publishing post ${due.id}:`, err);
        await prisma.instagramPostLog.update({
          where: { id: due.id },
          data: { status: "failed" },
        }).catch(() => {});
        result.failed++;
        result.details.push({ id: due.id, status: "failed", error: err?.message || String(err) });
      }
    }

    return result;
  } catch (error) {
    console.error("[Instagram Scheduler] Unexpected error processing scheduled posts:", error);
    return result;
  }
}
