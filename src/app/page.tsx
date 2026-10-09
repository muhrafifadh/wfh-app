import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <main id="main" className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{siteConfig.name}</h1>
      <p className="text-muted-foreground">
        Next.js, TypeScript, Tailwind CSS and shadcn/ui. Start with <code>docs/README.md</code>.
      </p>
    </main>
  );
}
