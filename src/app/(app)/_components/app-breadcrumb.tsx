"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { mainNav } from "@/config/nav";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

const titles = new Map(
  mainNav.flatMap((item) => [
    [item.href, item.title] as const,
    ...(item.items ?? []).map((sub) => [sub.href, sub.title] as const),
  ]),
);

export function AppBreadcrumb() {
  const pathname = usePathname();
  const title = titles.get(pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            <Link href={routes.dashboard()}>{siteConfig.name}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {title && (
          <>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
