/**
 * Instagram API Helper
 * Supports direct Instagram Login (No Facebook page required) & Meta Graph API
 * Complete Instagram Graph & Business API suite from A to Z
 */

export interface InstagramProfile {
  id: string;
  username: string;
  name?: string | null;
  profilePictureUrl?: string | null;
  accountType?: string | null;
  biography?: string | null;
  website?: string | null;
  mediaCount?: number | null;
  followersCount?: number | null;
  followsCount?: number | null;
}

export interface InstagramComment {
  id: string;
  text: string;
  timestamp: string;
  username?: string;
  like_count?: number;
  hidden?: boolean;
  replies?: {
    data: {
      id: string;
      text: string;
      timestamp: string;
      username?: string;
      like_count?: number;
      hidden?: boolean;
    }[];
  };
}

export interface InstagramMediaInsight {
  name: string;
  period: string;
  values: { value: number }[];
  title?: string;
  description?: string;
}

export function getInstagramConfig(requestHost?: string, requestProtocol?: string) {
  const instagramAppId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID || "";
  const instagramAppSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || "";
  const metaAppId = process.env.META_APP_ID || instagramAppId;
  const metaAppSecret = process.env.META_APP_SECRET || instagramAppSecret;

  // Prefer explicit INSTAGRAM_REDIRECT_URI from .env, or calculate from request
  let redirectUri = process.env.INSTAGRAM_REDIRECT_URI || "";

  if (!redirectUri && requestHost) {
    const proto = requestProtocol || (requestHost.includes("localhost") ? "http" : "https");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${requestHost}`;
    redirectUri = `${baseUrl.replace(/\/$/, "")}/auth/instagram/callback`;
  }

  return {
    appId: instagramAppId,
    appSecret: instagramAppSecret,
    metaAppId,
    metaAppSecret,
    redirectUri,
    isConfigured: Boolean(instagramAppId || metaAppId),
  };
}

/**
 * Generates direct Instagram authorization URL via Instagram Login for Business
 * Uses www.instagram.com (does NOT require a Facebook page)
 */
export function getDirectInstagramAuthUrl(redirectUri: string, state?: string): string {
  const { appId } = getInstagramConfig();

  // Full Instagram Login for Business permissions
  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_insights",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
  ].join(",");

  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("enable_fb_login", "0");
  authUrl.searchParams.set("force_authentication", "1");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  if (state) {
    authUrl.searchParams.set("state", state);
  }

  return authUrl.toString();
}

/**
 * Generates Meta / Facebook OAuth Dialog URL
 */
export function getMetaAuthUrl(redirectUri: string, state?: string): string {
  const { metaAppId } = getInstagramConfig();

  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
    "instagram_manage_messages",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "business_management",
    "public_profile",
  ].join(",");

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", metaAppId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_type", "code");
  if (state) {
    authUrl.searchParams.set("state", state);
  }

  return authUrl.toString();
}

/**
 * Robust Instagram Profile Fetcher supporting multiple hosts & field degradation
 */
export async function fetchInstagramProfile(
  instagramId: string,
  accessToken: string
): Promise<InstagramProfile | null> {
  const isInstagramToken = accessToken.startsWith("IG");
  console.log(`[Instagram Profile] Fetching: instagramId=${instagramId}, tokenType=${isInstagramToken ? "IG" : "FB"}`);

  const fieldSets = [
    "id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website,account_type",
    "id,username,name,profile_picture_url,followers_count,follows_count,media_count,account_type",
    "id,username,name,profile_picture_url,media_count,account_type",
    "id,username,account_type,media_count,profile_picture_url",
  ];

  const baseEndpoints = isInstagramToken
    ? [
        "https://graph.instagram.com/v19.0/me",
        "https://graph.instagram.com/me",
        `https://graph.instagram.com/v19.0/${instagramId}`,
        `https://graph.facebook.com/v19.0/${instagramId}`,
      ]
    : [
        `https://graph.facebook.com/v19.0/${instagramId}`,
        "https://graph.instagram.com/v19.0/me",
        "https://graph.instagram.com/me",
      ];

  for (const endpoint of baseEndpoints) {
    for (const fields of fieldSets) {
      try {
        const url = new URL(endpoint);
        url.searchParams.set("fields", fields);
        url.searchParams.set("access_token", accessToken);

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data && (data.username || data.id)) {
            console.log(`[Instagram Profile] Success: ${endpoint}`);
            return {
              id: data.id || instagramId,
              username: data.username || "",
              name: data.name || null,
              profilePictureUrl: data.profile_picture_url || null,
              accountType: data.account_type || null,
              biography: data.biography || null,
              website: data.website || null,
              mediaCount: typeof data.media_count === "number" ? data.media_count : null,
              followersCount: typeof data.followers_count === "number" ? data.followers_count : null,
              followsCount: typeof data.follows_count === "number" ? data.follows_count : null,
            };
          }
        } else {
          console.warn(`[Instagram Profile] ${endpoint} returned ${res.status}`);
        }
      } catch (err: any) {
        console.warn(`[Instagram Profile] ${endpoint} failed:`, err?.message);
      }
    }
  }

  // Fallback for Meta Graph accounts list
  if (!isInstagramToken) {
    try {
      const fbMeUrl = new URL("https://graph.facebook.com/v19.0/me");
      fbMeUrl.searchParams.set(
        "fields",
        "id,name,accounts{instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website}}"
      );
      fbMeUrl.searchParams.set("access_token", accessToken);
      const res = await fetch(fbMeUrl.toString(), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const pages = data.accounts?.data || [];
        for (const page of pages) {
          if (page.instagram_business_account) {
            const ig = page.instagram_business_account;
            return {
              id: ig.id,
              username: ig.username || page.name,
              name: ig.name || page.name,
              profilePictureUrl: ig.profile_picture_url || null,
              biography: ig.biography || null,
              website: ig.website || null,
              followersCount: ig.followers_count ?? null,
              followsCount: ig.follows_count ?? null,
              mediaCount: ig.media_count ?? null,
            };
          }
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Exchange code for long-lived Instagram Access Token & fetch Profile
 */
export async function handleInstagramCodeExchange(code: string, redirectUri: string) {
  const { appId, appSecret, metaAppId, metaAppSecret } = getInstagramConfig();
  const cleanCode = code.replace(/#_$/, "").trim();

  let tokenData: any = null;
  let shortLivedToken: string | null = null;
  let userId: string | null = null;
  let activeSecret = appSecret;
  let activeAppId = appId;

  // 1. Try api.instagram.com (Direct Instagram OAuth)
  try {
    const formData = new URLSearchParams();
    formData.append("client_id", appId);
    formData.append("client_secret", appSecret);
    formData.append("grant_type", "authorization_code");
    formData.append("redirect_uri", redirectUri);
    formData.append("code", cleanCode);

    const res = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    tokenData = await res.json();
    if (res.ok && tokenData.access_token) {
      shortLivedToken = tokenData.access_token;
      userId = String(tokenData.user_id || "");
    }
  } catch (err) {
    console.warn("api.instagram.com token exchange attempt error:", err);
  }

  // 2. Try graph.facebook.com with INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET
  if (!shortLivedToken) {
    try {
      const fbTokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      fbTokenUrl.searchParams.set("client_id", appId);
      fbTokenUrl.searchParams.set("client_secret", appSecret);
      fbTokenUrl.searchParams.set("redirect_uri", redirectUri);
      fbTokenUrl.searchParams.set("code", cleanCode);

      const res = await fetch(fbTokenUrl.toString());
      const data = await res.json();
      if (res.ok && data.access_token) {
        shortLivedToken = data.access_token;
        activeSecret = appSecret;
        activeAppId = appId;
      }
    } catch {}
  }

  // 3. Try graph.facebook.com with META_APP_ID / META_APP_SECRET
  if (!shortLivedToken && metaAppId && metaAppSecret) {
    try {
      const fbTokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      fbTokenUrl.searchParams.set("client_id", metaAppId);
      fbTokenUrl.searchParams.set("client_secret", metaAppSecret);
      fbTokenUrl.searchParams.set("redirect_uri", redirectUri);
      fbTokenUrl.searchParams.set("code", cleanCode);

      const res = await fetch(fbTokenUrl.toString());
      const data = await res.json();
      if (res.ok && data.access_token) {
        shortLivedToken = data.access_token;
        activeSecret = metaAppSecret;
        activeAppId = metaAppId;
      } else if (data.error?.message) {
        tokenData = data;
      }
    } catch {}
  }

  if (!shortLivedToken) {
    throw new Error(
      tokenData?.error_message ||
      tokenData?.error?.message ||
      "Failed to exchange code for access token. Please verify redirect URI and App Secret."
    );
  }

  // 4. Exchange short-lived token for long-lived access token (60 days)
  let longLivedToken = shortLivedToken;
  let expiresIn = 60 * 24 * 60 * 60; // 60 days default

  // Try ig_exchange_token
  try {
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", activeSecret);
    longUrl.searchParams.set("access_token", shortLivedToken);

    const longRes = await fetch(longUrl.toString());
    if (longRes.ok) {
      const longData = await longRes.json();
      if (longData.access_token) {
        longLivedToken = longData.access_token;
        expiresIn = longData.expires_in || expiresIn;
      }
    }
  } catch {}

  // Fallback to fb_exchange_token
  if (longLivedToken === shortLivedToken) {
    try {
      const fbLongUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      fbLongUrl.searchParams.set("grant_type", "fb_exchange_token");
      fbLongUrl.searchParams.set("client_id", activeAppId);
      fbLongUrl.searchParams.set("client_secret", activeSecret);
      fbLongUrl.searchParams.set("fb_exchange_token", shortLivedToken);

      const fbLongRes = await fetch(fbLongUrl.toString());
      if (fbLongRes.ok) {
        const fbLongData = await fbLongRes.json();
        if (fbLongData.access_token) {
          longLivedToken = fbLongData.access_token;
          expiresIn = fbLongData.expires_in || expiresIn;
        }
      }
    } catch {}
  }

  // 5. Fetch Full Profile
  const fetchedProfile = await fetchInstagramProfile(userId || "me", longLivedToken);

  const profile: InstagramProfile = fetchedProfile || {
    id: userId || "ig_user",
    username: "instagram_user",
  };

  return {
    accessToken: longLivedToken,
    tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    profile,
  };
}

/**
 * Fetch Media from Instagram Graph / Basic Display
 */
export async function fetchInstagramMedia(instagramId: string, accessToken: string) {
  const candidateFieldSets = [
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,like_count,comments_count,children{id,media_type,media_url,thumbnail_url}",
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,children{id,media_type,media_url,thumbnail_url}",
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username",
  ];

  const isInstagramToken = accessToken.startsWith("IG");
  const endpoints = isInstagramToken
    ? [
        "https://graph.instagram.com/v19.0/me/media",
        "https://graph.instagram.com/me/media",
        `https://graph.instagram.com/v19.0/${instagramId}/media`,
        `https://graph.facebook.com/v19.0/${instagramId}/media`,
      ]
    : [
        `https://graph.facebook.com/v19.0/${instagramId}/media`,
        "https://graph.instagram.com/v19.0/me/media",
        "https://graph.instagram.com/me/media",
      ];

  for (const endpoint of endpoints) {
    for (const fields of candidateFieldSets) {
      try {
        const url = new URL(endpoint);
        url.searchParams.set("fields", fields);
        url.searchParams.set("limit", "50");
        url.searchParams.set("access_token", accessToken);

        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.data)) {
          return { data: data.data, error: null };
        }
      } catch {}
    }
  }

  return { data: [], error: null };
}

/**
 * Fetch Children of a Carousel Album from Instagram Graph API
 */
export async function fetchInstagramMediaChildren(
  mediaId: string,
  accessToken: string
): Promise<{ id: string; media_type: string; media_url: string; thumbnail_url?: string }[]> {
  const isInstagramToken = accessToken.startsWith("IG");
  const endpoints = isInstagramToken
    ? [
        `https://graph.instagram.com/v19.0/${mediaId}/children`,
        `https://graph.instagram.com/${mediaId}/children`,
        `https://graph.facebook.com/v19.0/${mediaId}/children`,
      ]
    : [
        `https://graph.facebook.com/v19.0/${mediaId}/children`,
        `https://graph.instagram.com/v19.0/${mediaId}/children`,
        `https://graph.instagram.com/${mediaId}/children`,
      ];

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("fields", "id,media_type,media_url,thumbnail_url");
      url.searchParams.set("access_token", accessToken);
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.data) && data.data.length > 0) {
        return data.data;
      }
    } catch {}
  }
  return [];
}

/**
 * Helper to delay execution
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Publish Media to Instagram (Photo, Reel/Video, or Carousel Album)
 */
export async function publishInstagramMedia({
  instagramId,
  accessToken,
  mediaUrl,
  mediaUrls,
  caption,
  mediaType = "IMAGE",
}: {
  instagramId: string;
  accessToken: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  caption?: string | null;
  mediaType?: "IMAGE" | "VIDEO" | "REELS" | "CAROUSEL";
}): Promise<{ mediaId: string; permalink: string | null }> {
  const isInstagramToken = accessToken.startsWith("IG");
  const hostEndpoints = isInstagramToken
    ? [
        `https://graph.instagram.com/v19.0/${instagramId}`,
        `https://graph.instagram.com/v19.0/me`,
        `https://graph.facebook.com/v19.0/${instagramId}`,
      ]
    : [
        `https://graph.facebook.com/v19.0/${instagramId}`,
        `https://graph.instagram.com/v19.0/${instagramId}`,
        `https://graph.instagram.com/v19.0/me`,
      ];

  const targetMediaUrls = mediaUrls && mediaUrls.length > 0 ? mediaUrls : [mediaUrl || ""];
  const isCarousel = mediaType === "CAROUSEL" || targetMediaUrls.length > 1;

  let creationId: string | null = null;
  let successfulBaseUrl: string | null = null;
  let lastErrorMessage = "";

  // CASE A: Carousel Album Publishing
  if (isCarousel) {
    const childContainerIds: string[] = [];

    console.log(`[Instagram] Creating carousel with ${targetMediaUrls.length} items`);

    // Create item containers for each media item
    for (let i = 0; i < targetMediaUrls.length; i++) {
      const urlItem = targetMediaUrls[i];
      const isItemVideo = urlItem.match(/\.(mp4|mov|webm)$/i);
      let itemContainerId: string | null = null;

      // Validate URL
      if (!urlItem || !urlItem.startsWith("http")) {
        console.error(`[Instagram] Invalid media URL at index ${i}: ${urlItem?.substring(0, 100)}`);
        lastErrorMessage = `Invalid media URL at index ${i}: must be a publicly accessible HTTP/HTTPS URL`;
        continue;
      }

      console.log(`[Instagram] Creating child container ${i + 1}/${targetMediaUrls.length} (type: ${isItemVideo ? "VIDEO" : "IMAGE"}, url: ${urlItem.substring(0, 80)}...)`);

      for (const baseEndpoint of hostEndpoints) {
        try {
          // Use POST body instead of query params to avoid URL length limits
          const requestBody = new URLSearchParams();
          requestBody.set("access_token", accessToken);
          requestBody.set("is_carousel_item", "true");

          if (isItemVideo) {
            requestBody.set("media_type", "VIDEO");
            requestBody.set("video_url", urlItem);
          } else {
            requestBody.set("image_url", urlItem);
          }

          const res = await fetch(`${baseEndpoint}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: requestBody.toString(),
          });
          const data = await res.json();

          if (res.ok && data.id) {
            itemContainerId = data.id;
            successfulBaseUrl = baseEndpoint;
            console.log(`[Instagram] Child container ${i + 1} created: ${data.id} (endpoint: ${baseEndpoint})`);
            break;
          } else {
            const apiError = data.error?.message || data.error?.type || JSON.stringify(data);
            console.error(`[Instagram] Child container ${i + 1} failed at ${baseEndpoint}: ${apiError}`);
            lastErrorMessage = apiError;
          }
        } catch (e: any) {
          console.error(`[Instagram] Child container ${i + 1} exception at ${baseEndpoint}:`, e.message);
          lastErrorMessage = e.message;
        }
      }

      if (itemContainerId) {
        childContainerIds.push(itemContainerId);
      } else {
        console.error(`[Instagram] FAILED to create child container ${i + 1} for URL: ${urlItem.substring(0, 100)}`);
      }
    }

    console.log(`[Instagram] Carousel child containers created: ${childContainerIds.length}/${targetMediaUrls.length}`);

    if (childContainerIds.length === 0 || !successfulBaseUrl) {
      console.error(`[Instagram] ABORT: No child containers created. Last error: ${lastErrorMessage}`);
      throw new Error(lastErrorMessage || "Failed to create carousel media containers — all child container creation attempts failed");
    }

    // Now create the parent Carousel container
    console.log(`[Instagram] Creating parent carousel container with children: ${childContainerIds.join(",")}`);
    for (const baseEndpoint of hostEndpoints) {
      try {
        // Use POST body instead of query params
        const requestBody = new URLSearchParams();
        requestBody.set("access_token", accessToken);
        requestBody.set("media_type", "CAROUSEL");
        requestBody.set("children", childContainerIds.join(","));
        if (caption) requestBody.set("caption", caption);

        const res = await fetch(`${baseEndpoint}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: requestBody.toString(),
        });
        const data = await res.json();
        if (res.ok && data.id) {
          creationId = data.id;
          successfulBaseUrl = baseEndpoint;
          console.log(`[Instagram] Parent carousel container created: ${data.id}`);
          break;
        } else {
          const apiError = data.error?.message || data.error?.type || JSON.stringify(data);
          console.error(`[Instagram] Parent carousel failed at ${baseEndpoint}: ${apiError}`);
          lastErrorMessage = apiError;
        }
      } catch (err: any) {
        console.error(`[Instagram] Parent carousel exception at ${baseEndpoint}:`, err.message);
        lastErrorMessage = err.message;
      }
    }
  } else {
    // CASE B: Single Image or Reel / Video
    const singleUrl = targetMediaUrls[0];
    const isVideo =
      mediaType === "VIDEO" ||
      mediaType === "REELS" ||
      Boolean(singleUrl.match(/\.(mp4|mov|webm)$/i));

    console.log(`[Instagram] Creating single ${isVideo ? "VIDEO/REELS" : "IMAGE"} container (url: ${singleUrl.substring(0, 80)}...)`);

    for (const baseEndpoint of hostEndpoints) {
      try {
        // Use POST body instead of query params
        const requestBody = new URLSearchParams();
        requestBody.set("access_token", accessToken);

        if (isVideo) {
          requestBody.set("media_type", "REELS");
          requestBody.set("video_url", singleUrl);
        } else {
          requestBody.set("image_url", singleUrl);
        }

        if (caption) {
          requestBody.set("caption", caption);
        }

        const res = await fetch(`${baseEndpoint}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: requestBody.toString(),
        });
        const data = await res.json();

        if (res.ok && data.id) {
          creationId = data.id;
          successfulBaseUrl = baseEndpoint;
          console.log(`[Instagram] Single media container created: ${data.id}`);
          break;
        } else {
          const apiError = data.error?.message || data.error?.type || JSON.stringify(data);
          console.error(`[Instagram] Single media failed at ${baseEndpoint}: ${apiError}`);
          lastErrorMessage = apiError;
        }
      } catch (err: any) {
        console.error(`[Instagram] Single media exception at ${baseEndpoint}:`, err.message);
        lastErrorMessage = err.message || "Network error during container creation";
      }
    }
  }

  if (!creationId || !successfulBaseUrl) {
    throw new Error(lastErrorMessage || "Failed to create media container on Instagram");
  }

  const rootApiUrl = successfulBaseUrl.split(`/${instagramId}`)[0].split("/me")[0];

  // Wait for processing if video or carousel
  const isVideoOrCarousel =
    mediaType === "VIDEO" ||
    mediaType === "REELS" ||
    isCarousel ||
    Boolean(targetMediaUrls[0]?.match(/\.(mp4|mov|webm)$/i));

  if (isVideoOrCarousel) {
    console.log(`[Instagram] Waiting for media processing (ID: ${creationId})...`);
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!isReady && attempts < maxAttempts) {
      await delay(3000);
      attempts++;

      try {
        const statusUrl = new URL(`${rootApiUrl}/${creationId}`);
        statusUrl.searchParams.set("fields", "status_code,status");
        statusUrl.searchParams.set("access_token", accessToken);

        const statusRes = await fetch(statusUrl.toString());
        const statusData = await statusRes.json();

        if (statusData.status_code === "FINISHED") {
          console.log(`[Instagram] Media processing complete after ${attempts} attempts`);
          isReady = true;
          break;
        } else if (statusData.status_code === "ERROR" || statusData.status_code === "EXPIRED") {
          console.error(`[Instagram] Media processing FAILED: ${statusData.status || statusData.status_code}`);
          throw new Error(
            `Media processing failed on Instagram: ${statusData.status || statusData.status_code}`
          );
        } else {
          console.log(`[Instagram] Processing status: ${statusData.status_code} (attempt ${attempts}/${maxAttempts})`);
        }
      } catch (e: any) {
        console.error(`[Instagram] Status check error (attempt ${attempts}):`, e.message);
        if (attempts >= maxAttempts) throw e;
      }
    }

    if (!isReady) {
      console.error(`[Instagram] Media processing timed out after ${maxAttempts} attempts`);
    }
  } else {
    await delay(1500);
  }

  // Publish Container
  let publishedMediaId: string | null = null;
  const publishEndpoints = [
    `${successfulBaseUrl}/media_publish`,
    `${rootApiUrl}/${instagramId}/media_publish`,
  ];

  for (const publishEndpoint of publishEndpoints) {
    try {
      const publishUrl = new URL(publishEndpoint);
      publishUrl.searchParams.set("creation_id", creationId);
      publishUrl.searchParams.set("access_token", accessToken);

      const pubRes = await fetch(publishUrl.toString(), { method: "POST" });
      const pubData = await pubRes.json();

      if (pubRes.ok && pubData.id) {
        publishedMediaId = pubData.id;
        break;
      } else {
        lastErrorMessage = pubData.error?.message || "Publish container failed";
      }
    } catch (err: any) {
      lastErrorMessage = err.message || "Network error during media publishing";
    }
  }

  if (!publishedMediaId) {
    throw new Error(lastErrorMessage || "Failed to publish media to Instagram");
  }

  // Fetch Permalink
  let permalink: string | null = null;
  try {
    const postUrl = new URL(`${rootApiUrl}/${publishedMediaId}`);
    postUrl.searchParams.set("fields", "permalink");
    postUrl.searchParams.set("access_token", accessToken);
    const postRes = await fetch(postUrl.toString());
    if (postRes.ok) {
      const postData = await postRes.json();
      permalink = postData.permalink || null;
    }
  } catch {}

  return {
    mediaId: publishedMediaId,
    permalink,
  };
}

/**
 * Fetch Comments for a specific Instagram Post
 */
export async function fetchInstagramComments(
  mediaId: string,
  accessToken: string
): Promise<InstagramComment[]> {
  const isInstagramToken = accessToken.startsWith("IG");
  const endpoints = isInstagramToken
    ? [
        `https://graph.instagram.com/v19.0/${mediaId}/comments`,
        `https://graph.instagram.com/${mediaId}/comments`,
        `https://graph.facebook.com/v19.0/${mediaId}/comments`,
        `https://graph.facebook.com/${mediaId}/comments`,
      ]
    : [
        `https://graph.facebook.com/v19.0/${mediaId}/comments`,
        `https://graph.facebook.com/${mediaId}/comments`,
        `https://graph.instagram.com/v19.0/${mediaId}/comments`,
        `https://graph.instagram.com/${mediaId}/comments`,
      ];

  const fieldSets = [
    "id,text,timestamp,username,like_count,hidden,replies{id,text,timestamp,username,like_count,hidden}",
    "id,text,timestamp,username,like_count,replies{id,text,timestamp,username}",
    "id,text,timestamp,username,replies{id,text,timestamp,username}",
    "id,text,timestamp,username,like_count",
    "id,text,timestamp,username",
    "id,text,timestamp",
    "",
  ];

  for (const endpoint of endpoints) {
    for (const fields of fieldSets) {
      try {
        const commentsUrl = new URL(endpoint);
        if (fields) commentsUrl.searchParams.set("fields", fields);
        commentsUrl.searchParams.set("access_token", accessToken);

        const res = await fetch(commentsUrl.toString(), { cache: "no-store" });
        const data = await res.json();

        if (res.ok && Array.isArray(data.data) && data.data.length > 0) {
          return data.data;
        }
      } catch {}
    }
  }

  // Fallback: Query comments nested on the media object itself
  const mediaEndpoints = isInstagramToken
    ? [
        `https://graph.instagram.com/v19.0/${mediaId}`,
        `https://graph.instagram.com/${mediaId}`,
        `https://graph.facebook.com/v19.0/${mediaId}`,
      ]
    : [
        `https://graph.facebook.com/v19.0/${mediaId}`,
        `https://graph.instagram.com/v19.0/${mediaId}`,
        `https://graph.instagram.com/${mediaId}`,
      ];

  for (const mediaEndpoint of mediaEndpoints) {
    try {
      const mediaUrl = new URL(mediaEndpoint);
      mediaUrl.searchParams.set("fields", "comments{id,text,timestamp,username,like_count}");
      mediaUrl.searchParams.set("access_token", accessToken);

      const res = await fetch(mediaUrl.toString(), { cache: "no-store" });
      const data = await res.json();

      if (res.ok && data.comments && Array.isArray(data.comments.data) && data.comments.data.length > 0) {
        return data.comments.data;
      }
    } catch {}
  }

  return [];
}

/**
 * Post a Comment or Reply on an Instagram Post
 */
export async function postInstagramComment({
  mediaId,
  commentId,
  message,
  accessToken,
}: {
  mediaId?: string;
  commentId?: string;
  message: string;
  accessToken: string;
}): Promise<{ id: string }> {
  const isInstagramToken = accessToken.startsWith("IG");
  const targetPath = commentId ? `${commentId}/replies` : `${mediaId}/comments`;
  const endpoints = isInstagramToken
    ? [
        `https://graph.instagram.com/v19.0/${targetPath}`,
        `https://graph.instagram.com/${targetPath}`,
        `https://graph.facebook.com/v19.0/${targetPath}`,
        `https://graph.facebook.com/${targetPath}`,
      ]
    : [
        `https://graph.facebook.com/v19.0/${targetPath}`,
        `https://graph.facebook.com/${targetPath}`,
        `https://graph.instagram.com/v19.0/${targetPath}`,
        `https://graph.instagram.com/${targetPath}`,
      ];

  let lastError = "";

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("message", message);
      url.searchParams.set("access_token", accessToken);

      const res = await fetch(url.toString(), { method: "POST" });
      const data = await res.json();

      if (res.ok && data.id) {
        return { id: data.id };
      } else if (data.error?.message) {
        lastError = data.error.message;
      }
    } catch (err: any) {
      lastError = err.message;
    }
  }

  throw new Error(lastError || "Failed to post comment on Instagram");
}

/**
 * Delete a Comment from an Instagram Post
 */
export async function deleteInstagramComment(
  commentId: string,
  accessToken: string
): Promise<boolean> {
  const isInstagramToken = accessToken.startsWith("IG");
  const endpoints = isInstagramToken
    ? [
        `https://graph.instagram.com/v19.0/${commentId}`,
        `https://graph.instagram.com/${commentId}`,
        `https://graph.facebook.com/v19.0/${commentId}`,
        `https://graph.facebook.com/${commentId}`,
      ]
    : [
        `https://graph.facebook.com/v19.0/${commentId}`,
        `https://graph.facebook.com/${commentId}`,
        `https://graph.instagram.com/v19.0/${commentId}`,
        `https://graph.instagram.com/${commentId}`,
      ];

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("access_token", accessToken);

      const res = await fetch(url.toString(), { method: "DELETE" });
      const data = await res.json();

      if (res.ok && (data.success || data.id)) {
        return true;
      }
    } catch {}
  }

  return false;
}

/**
 * Hide / Unhide a Comment on Instagram
 */
export async function hideInstagramComment(
  commentId: string,
  hide: boolean,
  accessToken: string
): Promise<boolean> {
  const isInstagramToken = accessToken.startsWith("IG");
  const endpoints = isInstagramToken
    ? [
        `https://graph.instagram.com/v19.0/${commentId}`,
        `https://graph.instagram.com/${commentId}`,
        `https://graph.facebook.com/v19.0/${commentId}`,
        `https://graph.facebook.com/${commentId}`,
      ]
    : [
        `https://graph.facebook.com/v19.0/${commentId}`,
        `https://graph.facebook.com/${commentId}`,
        `https://graph.instagram.com/v19.0/${commentId}`,
        `https://graph.instagram.com/${commentId}`,
      ];

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("hide", hide ? "true" : "false");
      url.searchParams.set("access_token", accessToken);

      const res = await fetch(url.toString(), { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        return true;
      }
    } catch {}
  }

  return false;
}

/**
 * Fetch Detailed Post Insights (Impressions, Reach, Saved, Engagement, Video Views)
 */
export async function fetchInstagramMediaInsights(
  mediaId: string,
  accessToken: string,
  mediaType: string = "IMAGE"
): Promise<InstagramMediaInsight[]> {
  const isInstagramToken = accessToken.startsWith("IG");
  const baseHost = isInstagramToken ? "https://graph.instagram.com/v19.0" : "https://graph.facebook.com/v19.0";

  const isVideo = mediaType === "VIDEO" || mediaType === "REELS";
  const metrics = isVideo
    ? "impressions,reach,saved,video_views,total_interactions"
    : "impressions,reach,saved,engagement,total_interactions";

  try {
    const url = new URL(`${baseHost}/${mediaId}/insights`);
    url.searchParams.set("metric", metrics);
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await res.json();

    if (res.ok && Array.isArray(data.data)) {
      return data.data;
    }
  } catch {}

  return [];
}

/**
 * Fetch Account-Level Insights (Reach, Impressions, Profile Views)
 */
export async function fetchInstagramAccountInsights(
  instagramId: string,
  accessToken: string
): Promise<any[]> {
  const isInstagramToken = accessToken.startsWith("IG");
  const baseHost = isInstagramToken ? "https://graph.instagram.com/v19.0" : "https://graph.facebook.com/v19.0";

  const endpoints = isInstagramToken
    ? [`${baseHost}/me/insights`, `${baseHost}/${instagramId}/insights`]
    : [`${baseHost}/${instagramId}/insights`, `${baseHost}/me/insights`];

  const metrics = "impressions,reach,profile_views";

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("metric", metrics);
      url.searchParams.set("period", "day");
      url.searchParams.set("access_token", accessToken);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();

      if (res.ok && Array.isArray(data.data)) {
        return data.data;
      }
    } catch {}
  }

  return [];
}
