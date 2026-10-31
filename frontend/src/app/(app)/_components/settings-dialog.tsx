"use client";

import { LockIcon, PaintbrushIcon, UserIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import {
  AccountSection,
  AppearanceSection,
  SecuritySection,
} from "@/app/(app)/_components/settings-sections";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "account", label: "Account", icon: UserIcon, content: AccountSection },
  { id: "appearance", label: "Appearance", icon: PaintbrushIcon, content: AppearanceSection },
  { id: "security", label: "Security", icon: LockIcon, content: SecuritySection },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const settingsParam = parseAsStringLiteral(SECTIONS.map((s) => s.id));

/**
 * The open section lives in the URL (?settings=appearance), so the dialog survives
 * a refresh and can be linked to (docs/11-state-and-url-params.md).
 */
export function useSettingsDialog() {
  const [section, setSection] = useQueryState("settings", settingsParam);
  return {
    section,
    open: (id: SectionId = "account") => setSection(id),
    close: () => setSection(null),
  };
}

/**
 * shadcn sidebar-13: a sidebar inside a dialog. The nav copies the sidebar's look
 * without a second SidebarProvider, which would also react to ⌘B and overwrite the
 * app sidebar's saved state.
 */
export function SettingsDialog() {
  const { section, open, close } = useSettingsDialog();
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <Dialog open={section !== null} onOpenChange={(isOpen) => !isOpen && close()}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your account, appearance and security.
        </DialogDescription>
        <div className="flex">
          <nav
            aria-label="Settings"
            className="hidden w-56 shrink-0 border-r bg-sidebar p-2 text-sidebar-foreground md:block"
          >
            <SectionList active={active.id} onSelect={open} />
          </nav>
          <div className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center px-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">Settings</BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{active.label}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <nav aria-label="Settings sections" className="px-4 pb-4 md:hidden">
              <SectionList active={active.id} onSelect={open} horizontal />
            </nav>
            <div className="flex-1 overflow-y-auto p-4 pt-0">
              <h2 className="sr-only">{active.label}</h2>
              <active.content />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SectionListProps = {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  horizontal?: boolean;
};

function SectionList({ active, onSelect, horizontal = false }: SectionListProps) {
  return (
    <ul className={cn("flex gap-1", horizontal ? "flex-row overflow-x-auto" : "flex-col")}>
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <li key={id}>
          <Button
            variant="ghost"
            size="sm"
            aria-current={id === active ? "page" : undefined}
            onClick={() => onSelect(id)}
            className={cn(
              "w-full justify-start font-normal",
              id === active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
            )}
          >
            <Icon aria-hidden />
            {label}
          </Button>
        </li>
      ))}
    </ul>
  );
}
