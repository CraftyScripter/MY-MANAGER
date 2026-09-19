import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { fetchInstagramProfile } from "@/lib/instagram";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metaConfigured = Boolean(
      (process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET) ||
      (process.env.META_APP_ID && process.env.META_APP_SECRET)
    );

    const accounts = await prisma.instagramAccount.findMany({
      orderBy: { updatedAt: "desc" },
    });

    // Update live profile counts from Instagram Graph API for active accounts
    const enrichedAccounts = await Promise.all(
      accounts.map(async (acc) => {
        let liveData = { ...acc };
        try {
          const freshProfile = await fetchInstagramProfile(acc.instagramId, acc.accessToken);
          if (freshProfile) {
            liveData = {
              ...acc,
              username: freshProfile.username || acc.username,
              name: freshProfile.name || acc.name,
              profilePictureUrl: freshProfile.profilePictureUrl || acc.profilePictureUrl,
              accountType: freshProfile.accountType || acc.accountType,
              biography: freshProfile.biography || acc.biography,
              website: freshProfile.website || acc.website,
              followersCount:
                freshProfile.followersCount !== null && freshProfile.followersCount !== undefined
                  ? freshProfile.followersCount
                  : acc.followersCount,
              followsCount:
                freshProfile.followsCount !== null && freshProfile.followsCount !== undefined
                  ? freshProfile.followsCount
                  : acc.followsCount,
              mediaCount:
                freshProfile.mediaCount !== null && freshProfile.mediaCount !== undefined
                  ? freshProfile.mediaCount
                  : acc.mediaCount,
            };

            // Non-blocking update back to DB if changed
            prisma.instagramAccount.update({
              where: { id: acc.id },
              data: {
                username: liveData.username,
                name: liveData.name,
                profilePictureUrl: liveData.profilePictureUrl,
                accountType: liveData.accountType,
                biography: liveData.biography,
                website: liveData.website,
                followersCount: liveData.followersCount,
                followsCount: liveData.followsCount,
                mediaCount: liveData.mediaCount,
              },
            }).catch(() => {});
          }
        } catch (e) {
          // Fall back to stored info
        }

        // Don't expose the raw full access token to frontend
        const { accessToken, ...safeAccount } = liveData;
        return {
          ...safeAccount,
          hasToken: Boolean(accessToken),
        };
      })
    );

    return NextResponse.json({
      metaConfigured,
      metaAppId: process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID || null,
      accounts: enrichedAccounts,
    });
  } catch (error: any) {
    console.error("Failed to fetch Instagram accounts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch accounts" },
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
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
    }

    const account = await prisma.instagramAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await prisma.instagramAccount.delete({
      where: { id },
    });

    await logActivity({
      action: "INSTAGRAM_DISCONNECTED",
      section: "instagram",
      details: `Disconnected Instagram account @${account.username}`,
      userEmail: user.email,
      userName: user.name,
    });

    return NextResponse.json({ success: true, message: `Account @${account.username} disconnected` });
  } catch (error: any) {
    console.error("Failed to disconnect Instagram account:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disconnect account" },
      { status: 500 }
    );
  }
}
