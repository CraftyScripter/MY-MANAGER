import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { fetchInstagramMedia, publishInstagramMedia, fetchInstagramProfile } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    const account = accountId
      ? await prisma.instagramAccount.findUnique({ where: { id: accountId } })
      : await prisma.instagramAccount.findFirst({ orderBy: { updatedAt: "desc" } });

    if (!account) {
      return NextResponse.json({
        account: null,
        posts: [],
        scheduledPosts: [],
        localLogs: [],
        total: 0,
        message: "No connected Instagram account found",
      });
    }

    // Refresh live profile metrics
    let followersCount = account.followersCount;
    let followsCount = account.followsCount;
    let mediaCount = account.mediaCount;
    let username = account.username;
    let name = account.name;
    let profilePictureUrl = account.profilePictureUrl;
    let biography = account.biography;
    let website = account.website;
    let accountType = account.accountType;

    try {
      const freshProfile = await fetchInstagramProfile(account.instagramId, account.accessToken);
      if (freshProfile) {
        if (typeof freshProfile.followersCount === "number") followersCount = freshProfile.followersCount;
        if (typeof freshProfile.followsCount === "number") followsCount = freshProfile.followsCount;
        if (typeof freshProfile.mediaCount === "number") mediaCount = freshProfile.mediaCount;
        if (freshProfile.username) username = freshProfile.username;
        if (freshProfile.name) name = freshProfile.name;
        if (freshProfile.profilePictureUrl) profilePictureUrl = freshProfile.profilePictureUrl;
        if (freshProfile.biography) biography = freshProfile.biography;
        if (freshProfile.website) website = freshProfile.website;
        if (freshProfile.accountType) accountType = freshProfile.accountType;

        prisma.instagramAccount.update({
          where: { id: account.id },
          data: {
            followersCount,
            followsCount,
            mediaCount,
            username,
            name,
            profilePictureUrl,
            biography,
            website,
            accountType,
          },
        }).catch(() => {});
      }
    } catch {}

    // Fetch live media from Instagram Graph / Basic API
    const { data: livePosts, error: fetchError } = await fetchInstagramMedia(
      account.instagramId,
      account.accessToken
    );

    // Fetch local post logs
    const allLocalLogs = await prisma.instagramPostLog.findMany({
      where: { instagramAccountId: account.id },
      orderBy: { createdAt: "desc" },
    });

    const rawScheduled = allLocalLogs.filter((p) => p.status === "scheduled");
    const publishedLogs = allLocalLogs.filter((p) => p.status === "published");

    // Auto-process any scheduled posts that have reached their scheduled time
    const dueScheduled = rawScheduled.filter(
      (p) => p.scheduledFor && new Date(p.scheduledFor).getTime() <= Date.now()
    );

    for (const due of dueScheduled) {
      try {
        const publishRes = await publishInstagramMedia({
          instagramId: account.instagramId,
          accessToken: account.accessToken,
          mediaUrl: due.mediaUrl,
          caption: due.caption || "",
          mediaType: due.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
        });

        if (publishRes.mediaId) {
          const updated = await prisma.instagramPostLog.update({
            where: { id: due.id },
            data: {
              status: "published",
              mediaId: publishRes.mediaId,
              permalink: publishRes.permalink || null,
              publishedAt: new Date(),
            },
          });
          publishedLogs.unshift(updated);
        }
      } catch (err) {
        console.error("Failed to auto-publish scheduled post:", err);
      }
    }

    // Refresh remaining pending scheduled posts
    const activeScheduledPosts = rawScheduled.filter(
      (p) => !p.scheduledFor || new Date(p.scheduledFor).getTime() > Date.now()
    );

    // Live posts from Instagram Graph API are the authoritative source of truth
    const liveMediaIds = new Set(livePosts.map((p: any) => p.id));
    const mergedPosts = [...livePosts];

    // Only inject local post logs if they were created/published within the last 60 seconds (temporary propagation buffer)
    const NOW = Date.now();
    const PROPAGATION_WINDOW_MS = 60 * 1000; // 60 seconds

    for (const log of publishedLogs) {
      const publishedTime = log.publishedAt
        ? new Date(log.publishedAt).getTime()
        : new Date(log.createdAt).getTime();
      const isVeryRecent = NOW - publishedTime < PROPAGATION_WINDOW_MS;

      if (isVeryRecent && log.mediaId && !liveMediaIds.has(log.mediaId)) {
        mergedPosts.unshift({
          id: log.mediaId,
          caption: log.caption || undefined,
          media_type: log.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
          media_url: log.mediaUrl,
          thumbnail_url: log.mediaUrl,
          permalink: log.permalink || undefined,
          timestamp: (log.publishedAt || log.createdAt).toISOString(),
          like_count: 0,
          comments_count: 0,
        });
      } else if (!isVeryRecent && log.mediaId && !liveMediaIds.has(log.mediaId)) {
        // Automatically prune stale log from database since post was deleted on Instagram
        prisma.instagramPostLog.delete({ where: { id: log.id } }).catch(() => {});
      }
    }

    return NextResponse.json({
      account: {
        id: account.id,
        instagramId: account.instagramId,
        username,
        name,
        profilePictureUrl,
        accountType,
        biography,
        website,
        followersCount,
        followsCount,
        mediaCount: typeof mediaCount === "number" ? mediaCount : mergedPosts.length,
        pageName: account.pageName,
      },
      posts: mergedPosts,
      scheduledPosts: activeScheduledPosts,
      localLogs: allLocalLogs,
      fetchError,
      total: mergedPosts.length,
    });
  } catch (error: any) {
    console.error("Failed to retrieve Instagram posts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load Instagram posts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      accountId,
      mediaUrl,
      mediaUrls,
      caption,
      mediaType = "IMAGE",
      isScheduled,
      scheduledFor,
      action,
      postId,
    } = body;

    const account = accountId
      ? await prisma.instagramAccount.findUnique({ where: { id: accountId } })
      : await prisma.instagramAccount.findFirst({ orderBy: { updatedAt: "desc" } });

    if (!account) {
      return NextResponse.json(
        { error: "No connected Instagram account found. Please connect an account first." },
        { status: 404 }
      );
    }

    // Action: Publish a scheduled post right now
    if (action === "publish_now" && postId) {
      const scheduledLog = await prisma.instagramPostLog.findUnique({
        where: { id: postId },
      });

      if (!scheduledLog) {
        return NextResponse.json({ error: "Scheduled post not found" }, { status: 404 });
      }

      const { mediaId, permalink } = await publishInstagramMedia({
        instagramId: account.instagramId,
        accessToken: account.accessToken,
        mediaUrl: scheduledLog.mediaUrl,
        caption: scheduledLog.caption || null,
        mediaType: scheduledLog.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
      });

      const updatedLog = await prisma.instagramPostLog.update({
        where: { id: postId },
        data: {
          status: "published",
          mediaId,
          permalink: permalink || null,
          publishedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Scheduled post successfully published to Instagram!",
        postLog: updatedLog,
        permalink,
      });
    }

    const targetUrls = Array.isArray(mediaUrls) && mediaUrls.length > 0 ? mediaUrls : [mediaUrl || ""];
    const primaryUrl = targetUrls[0];

    if (!primaryUrl) {
      return NextResponse.json(
        { error: "Media URL is required to publish or schedule a post" },
        { status: 400 }
      );
    }

    const isVideo =
      mediaType === "VIDEO" ||
      mediaType === "REELS" ||
      Boolean(primaryUrl.match(/\.(mp4|mov|webm)$/i));

    const finalMediaType =
      mediaType === "CAROUSEL" || targetUrls.length > 1
        ? "CAROUSEL"
        : isVideo
        ? "VIDEO"
        : "IMAGE";

    // Case 1: Post is Scheduled for future
    if (isScheduled && scheduledFor) {
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "Scheduled date and time must be in the future." },
          { status: 400 }
        );
      }

      const postLog = await prisma.instagramPostLog.create({
        data: {
          instagramAccountId: account.id,
          caption: caption || null,
          mediaUrl: primaryUrl,
          mediaType: finalMediaType,
          status: "scheduled",
          scheduledFor: scheduledDate,
          publishedBy: user.email,
        },
      });

      await logActivity({
        action: "INSTAGRAM_POST_SCHEDULED",
        section: "instagram",
        details: `Scheduled Instagram post for @${account.username} on ${scheduledDate.toLocaleString()}`,
        userEmail: user.email,
        userName: user.name,
      });

      return NextResponse.json({
        success: true,
        isScheduled: true,
        message: `Post scheduled for ${scheduledDate.toLocaleString()}`,
        postLog,
      });
    }

    // Case 2: Publish immediately
    const { mediaId: publishedMediaId, permalink } = await publishInstagramMedia({
      instagramId: account.instagramId,
      accessToken: account.accessToken,
      mediaUrl: primaryUrl,
      mediaUrls: targetUrls,
      caption: caption || null,
      mediaType: finalMediaType,
    });

    const postLog = await prisma.instagramPostLog.create({
      data: {
        instagramAccountId: account.id,
        mediaId: publishedMediaId,
        caption: caption || null,
        mediaUrl: primaryUrl,
        mediaType: finalMediaType,
        permalink: permalink || null,
        status: "published",
        publishedBy: user.email,
        publishedAt: new Date(),
      },
    });

    await logActivity({
      action: "INSTAGRAM_POST_PUBLISHED",
      section: "instagram",
      details: `Published ${finalMediaType.toLowerCase()} to @${account.username}`,
      userEmail: user.email,
      userName: user.name,
    });

    return NextResponse.json({
      success: true,
      message: "Post successfully published to Instagram!",
      mediaId: publishedMediaId,
      permalink,
      postLog,
    });
  } catch (error: any) {
    console.error("Failed to process Instagram post:", error);
    return NextResponse.json(
      { error: error.message || "Failed to publish or schedule post to Instagram" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const log = await prisma.instagramPostLog.findUnique({
      where: { id },
    });

    if (!log) {
      return NextResponse.json({ error: "Post record not found" }, { status: 404 });
    }

    await prisma.instagramPostLog.delete({
      where: { id },
    });

    await logActivity({
      action: "INSTAGRAM_POST_LOG_DELETED",
      section: "instagram",
      details: `Deleted ${log.status} post log (${log.id})`,
      userEmail: user.email,
      userName: user.name,
    });

    return NextResponse.json({ success: true, message: "Post record deleted" });
  } catch (error: any) {
    console.error("Failed to delete post record:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete post record" },
      { status: 500 }
    );
  }
}
