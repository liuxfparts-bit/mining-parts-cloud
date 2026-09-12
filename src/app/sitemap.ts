import { prisma } from "@/lib/db";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://mpc.example.com";

  const [brands, equipment, partNumbers, suppliers] = await Promise.all([
    prisma.brand.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.equipment.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
    prisma.partNumber.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.supplier.findMany({ select: { slug: true, updatedAt: true } }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), priority: 1 },
    { url: `${base}/equipment`, priority: 0.9 },
    { url: `${base}/part-number`, priority: 0.9 },
    { url: `${base}/suppliers`, priority: 0.8 },
    { url: `${base}/brands`, priority: 0.8 },
    { url: `${base}/rfq`, priority: 0.7 },
  ];

  const brandPages: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${base}/brands/${b.slug}`,
    lastModified: b.updatedAt,
    priority: 0.7,
  }));

  const equipmentPages: MetadataRoute.Sitemap = equipment.map((e) => ({
    url: `${base}/equipment/${e.slug}`,
    lastModified: e.updatedAt,
    priority: 0.8,
  }));

  const partPages: MetadataRoute.Sitemap = partNumbers.map((p) => ({
    url: `${base}/part-number/${p.slug}`,
    lastModified: p.updatedAt,
    priority: 0.9,
  }));

  const supplierPages: MetadataRoute.Sitemap = suppliers.map((s) => ({
    url: `${base}/suppliers/${s.slug}`,
    lastModified: s.updatedAt,
    priority: 0.7,
  }));

  return [...staticPages, ...brandPages, ...equipmentPages, ...partPages, ...supplierPages];
}
