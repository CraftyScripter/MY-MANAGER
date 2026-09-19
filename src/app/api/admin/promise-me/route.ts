import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeDashboardStats } from "@/lib/stats";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "forms", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const target = searchParams.get("target");
    const platform = searchParams.get("platform");

    // Case 1: Delete all invalid domains (optionally scoped to a platform)
    if (target === "invalid_domains") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deleteWhere: any = {
        OR: [
          { emailVerified: false },
          { emailVerified: null },
        ],
      };
      if (platform && platform !== "all") {
        deleteWhere.platform = platform;
      }

      const result = await prisma.contactEnquiry.deleteMany({
        where: deleteWhere,
      });

      recomputeDashboardStats().catch(console.error);

      await logActivity({
        action: "bulk_delete_invalid_enquiries",
        section: "forms",
        user,
        details: { count: result.count, target: "invalid_domains", platform: platform || "all" },
        req: request,
      });

      return NextResponse.json({ success: true, count: result.count });
    }

    // Case 2: Batch delete by IDs (passed in JSON body or query param ids)
    let idsToDelete: string[] = [];
    if (request.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await request.json();
        if (Array.isArray(body.ids)) {
          idsToDelete = body.ids;
        }
      } catch {
        // body might be empty, continue to query params
      }
    }

    if (idsToDelete.length === 0) {
      const idsParam = searchParams.get("ids");
      if (idsParam) {
        idsToDelete = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    if (idsToDelete.length > 0) {
      const result = await prisma.contactEnquiry.deleteMany({
        where: { id: { in: idsToDelete } },
      });

      // Also clean up any legacy entries if applicable
      await prisma.promiseMeEnquiry.deleteMany({
        where: { id: { in: idsToDelete } },
      }).catch(() => {});

      recomputeDashboardStats().catch(console.error);

      await logActivity({
        action: "bulk_delete_enquiries",
        section: "forms",
        user,
        details: { count: result.count, idsCount: idsToDelete.length },
        req: request,
      });

      return NextResponse.json({ success: true, count: result.count });
    }

    // Case 3: Single ID deletion
    if (!id) {
      return NextResponse.json(
        { error: "Enquiry ID or IDs required" },
        { status: 400 }
      );
    }

    const existing = await prisma.contactEnquiry.findUnique({
      where: { id },
    });

    if (existing) {
      await prisma.contactEnquiry.delete({ where: { id } });
    } else {
      const legacy = await prisma.promiseMeEnquiry.findUnique({ where: { id } });
      if (legacy) {
        await prisma.promiseMeEnquiry.delete({ where: { id } });
      } else {
        return NextResponse.json(
          { error: "Enquiry not found" },
          { status: 404 }
        );
      }
    }

    recomputeDashboardStats().catch(console.error);

    await logActivity({
      action: "delete_enquiry",
      section: "forms",
      user,
      details: { enquiryId: id, email: existing?.email, name: existing?.name },
      req: request,
    });

    return NextResponse.json({ success: true, count: 1 });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "forms")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const domainStatus = searchParams.get("domainStatus");
    const search = searchParams.get("search");
    const senderSearch = searchParams.get("senderSearch");
    const emailSearch = searchParams.get("emailSearch");
    const messageSearch = searchParams.get("messageSearch");
    const seen = searchParams.get("seen");
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") === "asc" ? "asc" : "desc") as "asc" | "desc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const andConditions: any[] = [];

    if (platform && platform !== "all") {
      andConditions.push({ platform });
    }

    if (domainStatus === "valid") {
      andConditions.push({ emailVerified: true });
    } else if (domainStatus === "invalid") {
      andConditions.push({
        OR: [
          { emailVerified: false },
          { emailVerified: null },
        ],
      });
    }

    if (seen === "true") {
      andConditions.push({ seen: true });
    } else if (seen === "false") {
      andConditions.push({ seen: false });
    }

    if (senderSearch) {
      andConditions.push({ name: { contains: senderSearch, mode: "insensitive" } });
    }

    if (emailSearch) {
      andConditions.push({ email: { contains: emailSearch, mode: "insensitive" } });
    }

    if (messageSearch) {
      andConditions.push({ message: { contains: messageSearch, mode: "insensitive" } });
    }

    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { message: { contains: search, mode: "insensitive" } },
          { platform: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = andConditions.length > 0 ? { AND: andConditions } : {};

    // Valid sort fields
    const allowedSortFields = ["createdAt", "name", "email", "platform", "emailVerified"];
    const orderByField = allowedSortFields.includes(sortField) ? sortField : "createdAt";
    const orderBy = { [orderByField]: sortOrder };

    // Base filter for stats (respect platform filter if applied)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statsWhere: any = platform && platform !== "all" ? { platform } : {};

    const [enquiries, total, platformRecords, validCount, invalidCount] = await Promise.all([
      prisma.contactEnquiry.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.contactEnquiry.count({ where }),
      prisma.contactEnquiry.findMany({
        select: { platform: true },
        distinct: ["platform"],
      }),
      prisma.contactEnquiry.count({
        where: { ...statsWhere, emailVerified: true },
      }),
      prisma.contactEnquiry.count({
        where: {
          ...statsWhere,
          OR: [{ emailVerified: false }, { emailVerified: null }],
        },
      }),
    ]);

    const platforms = platformRecords
      .map((p) => p.platform)
      .filter(Boolean);

    return NextResponse.json({
      enquiries,
      platforms,
      stats: {
        total: validCount + invalidCount,
        validCount,
        invalidCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch form submissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
