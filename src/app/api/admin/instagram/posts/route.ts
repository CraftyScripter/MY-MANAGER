import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  fetchInstagramMedia,
  publishInstagramMedia,
  fetchInstagramProfile,
  fetchInstagramMediaChildren,
} from "@/lib/instagram";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const mediaId = searchParams.get("mediaId");

    const workspaceId = getEffectiveWorkspaceAdminId(user);
    const account = accountId
      ? await prisma.instagramAccount.findFirst({ where: { id: accountId, userId: workspaceId } })
      : await prisma.instagramAccount.findFirst({ where: { userId: workspaceId }, orderBy: { updatedAt: "desc" } });

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

    // If mediaId is specified, fetch children of that media item
    if (mediaId) {
      const children = await fetchInstagramMediaChildren(mediaId, account.accessToken);
      return NextResponse.json({
        success: true,
        mediaId,
        children,
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
    const deletedLogs = allLocalLogs.filter((p) => p.status === "deleted" || p.status === "hidden");
    const deletedMediaIds = new Set(
      deletedLogs.map((p) => p.mediaId || p.id).filter(Boolean) as string[]
    );

    // 0. Recover any posts stuck in "publishing" for more than 5 minutes (e.g. server crash)
    await prisma.instagramPostLog.updateMany({
      where: {
        instagramAccountId: account.id,
        status: "publishing",
        updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
      },
      data: {
        status: "failed",
      },
    }).catch(() => {});

    // Auto-process any scheduled posts that have reached their scheduled time
    const dueScheduled = rawScheduled.filter(
      (p) => p.scheduledFor && new Date(p.scheduledFor).getTime() <= Date.now()
    );

    for (const due of dueScheduled) {
      // 1. ATOMIC LOCK: Only ONE request can transition from "scheduled" to "publishing"
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
        // Already claimed by a concurrent worker/request! Skip!
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
        } else {
          await prisma.instagramPostLog.update({
            where: { id: due.id },
            data: { status: "failed" },
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Failed to auto-publish scheduled post:", err);
        await prisma.instagramPostLog.update({
          where: { id: due.id },
          data: { status: "failed" },
        }).catch(() => {});
      }
    }

    // Refresh remaining pending scheduled posts
    const activeScheduledPosts = allLocalLogs.filter(
      (p) =>
        (p.status === "scheduled" && (!p.scheduledFor || new Date(p.scheduledFor).getTime() > Date.now())) ||
        p.status === "publishing"
    );

    // All live posts returned by Instagram Graph API are active and must be visible
    const visibleLivePosts = livePosts;
    const liveMediaIds = new Set(visibleLivePosts.map((p: any) => p.id));
    const mergedPosts = [...visibleLivePosts];

    // Clean up any stale tombstone records if the post actually exists live on Instagram
    if (liveMediaIds.size > 0 && deletedLogs.length > 0) {
      const activeTombstones = deletedLogs.filter((d) => d.mediaId && liveMediaIds.has(d.mediaId));
      for (const t of activeTombstones) {
        prisma.instagramPostLog.delete({ where: { id: t.id } }).catch(() => {});
      }
    }

    // Merge any locally published posts that might still be propagating to Instagram's feed
    for (const log of publishedLogs) {
      if (log.mediaId && !liveMediaIds.has(log.mediaId)) {
        const publishedAgeMs = Date.now() - new Date(log.publishedAt || log.createdAt).getTime();

        // If post was published more than 2 minutes ago and is not in live feed, it was deleted on Instagram
        if (publishedAgeMs > 120000) {
          prisma.instagramPostLog.update({
            where: { id: log.id },
            data: { status: "deleted" },
          }).catch(() => {});
          continue;
        }

        // If published within the last 2 minutes, check if it actually exists on Instagram (still propagating)
        let stillExists = false;
        try {
          const isInstagramToken = account.accessToken.startsWith("IG");
          const checkEndpoints = isInstagramToken
            ? [
                `https://graph.instagram.com/v19.0/${log.mediaId}`,
                `https://graph.instagram.com/${log.mediaId}`,
              ]
            : [
                `https://graph.facebook.com/v19.0/${log.mediaId}`,
                `https://graph.instagram.com/v19.0/${log.mediaId}`,
              ];

          for (const ep of checkEndpoints) {
            const checkUrl = new URL(ep);
            checkUrl.searchParams.set("fields", "id");
            checkUrl.searchParams.set("access_token", account.accessToken);
            const checkRes = await fetch(checkUrl.toString(), { cache: "no-store" });
            const checkData = await checkRes.json().catch(() => ({}));
            if (checkRes.ok && checkData.id) {
              stillExists = true;
              break;
            }
          }
        } catch {}

        if (!stillExists) {
          // Object does not exist on Instagram -> marked as deleted
          prisma.instagramPostLog.update({
            where: { id: log.id },
            data: { status: "deleted" },
          }).catch(() => {});
          continue;
        }

        const postUrls = (Array.isArray(log.mediaUrls) && log.mediaUrls.length > 0)
          ? log.mediaUrls
          : [log.mediaUrl];

        const isCarousel = log.mediaType === "CAROUSEL" || postUrls.length > 1;

        mergedPosts.unshift({
          id: log.mediaId,
          caption: log.caption || undefined,
          media_type: isCarousel ? "CAROUSEL_ALBUM" : log.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
          media_url: log.mediaUrl,
          thumbnail_url: log.mediaUrl,
          permalink: log.permalink || undefined,
          timestamp: (log.publishedAt || log.createdAt).toISOString(),
          like_count: 0,
          comments_count: 0,
          children: isCarousel && postUrls.length > 0 ? {
            data: postUrls.map((u, idx) => ({
              id: `${log.mediaId}_${idx}`,
              media_type: u.match(/\.(mp4|mov|webm)$/i) ? "VIDEO" : "IMAGE",
              media_url: u,
            })),
          } : undefined,
        });
      }
    }

    return NextResponse.json(
      {
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
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
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

    const workspaceId = getEffectiveWorkspaceAdminId(user);
    const account = accountId
      ? await prisma.instagramAccount.findFirst({ where: { id: accountId, userId: workspaceId } })
      : await prisma.instagramAccount.findFirst({ where: { userId: workspaceId }, orderBy: { updatedAt: "desc" } });

    if (!account) {
      return NextResponse.json(
        { error: "No connected Instagram account found. Please connect an account first." },
        { status: 404 }
      );
    }

    // Action: Publish a scheduled post right now
    if (action === "publish_now" && postId) {
      // 1. ATOMIC CLAIM: Only ONE request can transition from "scheduled" to "publishing"
      const claim = await prisma.instagramPostLog.updateMany({
        where: {
          id: postId,
          status: "scheduled",
          instagramAccountId: account.id,
        },
        data: {
          status: "publishing",
        },
      });

      if (claim.count === 0) {
        return NextResponse.json(
          { error: "This post is already being published or is no longer in the scheduled queue." },
          { status: 409 }
        );
      }

      const scheduledLog = await prisma.instagramPostLog.findFirst({
        where: { id: postId, instagramAccountId: account.id },
      });

      if (!scheduledLog) {
        return NextResponse.json({ error: "Scheduled post not found" }, { status: 404 });
      }

      try {
        const postUrls = (Array.isArray(scheduledLog.mediaUrls) && scheduledLog.mediaUrls.length > 0)
          ? scheduledLog.mediaUrls
          : (() => {
              try {
                const parsed = JSON.parse(scheduledLog.mediaUrl);
                return Array.isArray(parsed) ? parsed : [scheduledLog.mediaUrl];
              } catch {
                return [scheduledLog.mediaUrl];
              }
            })();

        const isCarousel = scheduledLog.mediaType === "CAROUSEL" || postUrls.length > 1;
        const targetMediaType = isCarousel
          ? "CAROUSEL"
          : scheduledLog.mediaType === "VIDEO" || scheduledLog.mediaType === "REELS"
          ? "VIDEO"
          : "IMAGE";

        const { mediaId, permalink } = await publishInstagramMedia({
          instagramId: account.instagramId,
          accessToken: account.accessToken,
          mediaUrl: postUrls[0] || scheduledLog.mediaUrl,
          mediaUrls: postUrls,
          caption: scheduledLog.caption || null,
          mediaType: targetMediaType,
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
      } catch (publishErr: any) {
        await prisma.instagramPostLog.update({
          where: { id: postId },
          data: { status: "failed" },
        }).catch(() => {});
        throw publishErr;
      }
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

      let postLog: any;
      try {
        postLog = await prisma.instagramPostLog.create({
          data: {
            instagramAccountId: account.id,
            caption: caption || null,
            mediaUrl: primaryUrl,
            mediaUrls: targetUrls,
            mediaType: finalMediaType,
            status: "scheduled",
            scheduledFor: scheduledDate,
            publishedBy: user.email,
          },
        });
      } catch (createErr: any) {
        if (createErr?.message?.includes("mediaUrls")) {
          // Fallback if running server has stale Prisma client in memory
          postLog = await prisma.instagramPostLog.create({
            data: {
              instagramAccountId: account.id,
              caption: caption || null,
              mediaUrl: targetUrls.length > 1 ? JSON.stringify(targetUrls) : primaryUrl,
              mediaType: finalMediaType,
              status: "scheduled",
              scheduledFor: scheduledDate,
              publishedBy: user.email,
            },
          });
        } else {
          throw createErr;
        }
      }

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

    let postLog: any;
    try {
      postLog = await prisma.instagramPostLog.create({
        data: {
          instagramAccountId: account.id,
          mediaId: publishedMediaId,
          caption: caption || null,
          mediaUrl: primaryUrl,
          mediaUrls: targetUrls,
          mediaType: finalMediaType,
          permalink: permalink || null,
          status: "published",
          publishedBy: user.email,
          publishedAt: new Date(),
        },
      });
    } catch (createErr: any) {
      if (createErr?.message?.includes("mediaUrls")) {
        postLog = await prisma.instagramPostLog.create({
          data: {
            instagramAccountId: account.id,
            mediaId: publishedMediaId,
            caption: caption || null,
            mediaUrl: targetUrls.length > 1 ? JSON.stringify(targetUrls) : primaryUrl,
            mediaType: finalMediaType,
            permalink: permalink || null,
            status: "published",
            publishedBy: user.email,
            publishedAt: new Date(),
          },
        });
      } else {
        throw createErr;
      }
    }

    await logActivity({
      action: "INSTAGRAM_POST_PUBLISHED",
      section: "instagram",
      details: `Published ${finalMediaType.toLowerCase()} to @${account.username}`,
      userEmail: user.email,
      userName: user.name,
    });

    // Auto-backup after Instagram post
    const { on_data_created } = await import("@/lib/autoBackup");
    on_data_created("instagramPost");

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
    const accountId = searchParams.get("accountId");

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const workspaceId = getEffectiveWorkspaceAdminId(user);

    // 1. Check if there's a local post log matching by id or mediaId within this workspace
    const localLog = await prisma.instagramPostLog.findFirst({
      where: {
        OR: [{ id }, { mediaId: id }],
        account: { userId: workspaceId },
      },
    });

    // 2. Identify the connected Instagram account
    const account = accountId
      ? await prisma.instagramAccount.findFirst({ where: { id: accountId, userId: workspaceId } })
      : localLog
      ? await prisma.instagramAccount.findFirst({ where: { id: localLog.instagramAccountId, userId: workspaceId } })
      : await prisma.instagramAccount.findFirst({ where: { userId: workspaceId }, orderBy: { updatedAt: "desc" } });

    const targetMediaId = localLog?.mediaId || id;
    const permalink = localLog?.permalink || null;

    // 3. Check if it is an unpublished scheduled or draft post
    if (localLog && (localLog.status === "scheduled" || localLog.status === "draft")) {
      await prisma.instagramPostLog.delete({
        where: { id: localLog.id },
      });

      await logActivity({
        action: "INSTAGRAM_POST_DELETED",
        section: "instagram",
        details: `Cancelled and deleted scheduled Instagram post (${id})`,
        userEmail: user.email,
        userName: user.name,
      });

      return NextResponse.json({
        success: true,
        isScheduled: true,
        realDeleted: true,
        message: "Scheduled post cancelled and removed from queue.",
      });
    }

    // 4. Attempt to delete from Meta Graph API if credentials are available
    let metaDeleteSuccess = false;
    let metaErrorMessage = "";

    if (account?.accessToken && targetMediaId) {
      try {
        const endpoints = [
          `https://graph.facebook.com/v21.0/${targetMediaId}`,
          `https://graph.facebook.com/v19.0/${targetMediaId}`,
          `https://graph.instagram.com/${targetMediaId}`,
        ];

        for (const ep of endpoints) {
          const delUrl = new URL(ep);
          delUrl.searchParams.set("access_token", account.accessToken);
          const res = await fetch(delUrl.toString(), { method: "DELETE" });
          const data = await res.json().catch(() => ({}));
          if (res.ok && (data.success === true || data.id)) {
            metaDeleteSuccess = true;
            break;
          } else if (data.error?.message) {
            metaErrorMessage = data.error.message;
          }
        }
      } catch (err: any) {
        metaErrorMessage = err?.message || "Failed to contact Meta API";
      }
    }

    // 5. Update or create local record (tombstone)
    if (localLog) {
      await prisma.instagramPostLog.update({
        where: { id: localLog.id },
        data: { status: "deleted" },
      });
    } else if (account) {
      // Create a tombstone record marking this media ID as deleted so it is excluded from the feed
      await prisma.instagramPostLog.create({
        data: {
          instagramAccountId: account.id,
          mediaId: targetMediaId,
          mediaUrl: "",
          mediaType: "IMAGE",
          status: "deleted",
          publishedBy: user.email,
        },
      });
    }

    await logActivity({
      action: "INSTAGRAM_POST_DELETED",
      section: "instagram",
      details: `Deleted Instagram post (${targetMediaId}) - Meta deleted: ${metaDeleteSuccess}`,
      userEmail: user.email,
      userName: user.name,
    });

    return NextResponse.json({
      success: true,
      realDeleted: metaDeleteSuccess,
      metaRestricted: !metaDeleteSuccess,
      permalink,
      message: metaDeleteSuccess
        ? "Post successfully deleted from Instagram!"
        : "Post removed from workspace dashboard.",
      metaErrorMessage: metaErrorMessage || undefined,
    });
  } catch (error: any) {
    console.error("Failed to delete post:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete post" },
      { status: 500 }
    );
  }
}
