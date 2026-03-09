import { MetadataRoute } from "next";

const BASE = "https://mardelux.pt";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/agendar",
    "/cliente",
    "/cliente/servicos",
    "/login",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : path === "/agendar" ? 0.9 : 0.7,
  }));

  return routes;
}
