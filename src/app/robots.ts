import type { MetadataRoute } from "next";

const BASE_URL = "https://my-manager-eight.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/login", "/signup", "/accept-invitation/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
