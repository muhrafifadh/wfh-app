import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";

import { markNotificationReadAction } from "@/features/notifications/actions";
import { EmailPreferencesForm } from "@/features/notifications/components/email-preferences-form";
import { NotificationItems } from "@/features/notifications/components/notification-items";
import type { Notification } from "@/features/notifications/schemas";
import { MeContextProvider } from "@/features/profile/components/me-context-provider";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/features/notifications/actions", () => ({
  markNotificationReadAction: vi.fn().mockResolvedValue({ ok: true, data: null }),
  updateEmailPreferencesAction: vi.fn(),
}));

// Radix checkboxes measure themselves; jsdom has no ResizeObserver
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

async function violations(container: Element = document.body) {
  const result = await axe.run(container, {
    runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => v.id);
}

const context = {
  organization: {
    name: "Acme",
    timezone: "Asia/Jakarta",
    workDate: "2026-11-02",
    supportContact: null,
  },
  employee: null,
};

const items: Notification[] = [
  {
    id: "01a19a00-0000-7000-8000-000000000001",
    type: "correction_submitted",
    title: "Dewi Anggraini asked to correct Mon 2 Nov",
    link: "/corrections/c1",
    deliveredAt: "2026-11-03T03:00:00.000Z",
    readAt: null,
  },
  {
    id: "01a19a00-0000-7000-8000-000000000002",
    type: "reminder_check_in",
    title: "You haven't checked in for Mon 2 Nov",
    link: "/attendance",
    deliveredAt: "2026-11-02T02:00:00.000Z",
    readAt: "2026-11-02T02:30:00.000Z",
  },
];

const renderItems = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MeContextProvider context={context}>
        <NotificationItems items={items} />
      </MeContextProvider>
    </QueryClientProvider>,
  );

afterEach(() => vi.clearAllMocks());

describe("NotificationItems (DOMAIN_RULES.md §18.6)", () => {
  it("says which are unread in words and shows organization time", () => {
    renderItems();
    expect(screen.getByRole("button", { name: /^Unread:\s?Dewi Anggraini asked/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /^You haven't checked in/ })).toBeVisible();
    expect(screen.getByText("Tue, 3 Nov 2026, 10:00 WIB")).toBeVisible();
  });

  it("marks an unread one read, then opens its page", async () => {
    renderItems();
    await userEvent.click(screen.getByRole("button", { name: /Dewi Anggraini/ }));
    expect(markNotificationReadAction).toHaveBeenCalledWith(items[0]?.id);
    expect(push).toHaveBeenCalledWith("/corrections/c1");
  });

  it("opens a read one without marking it again", async () => {
    renderItems();
    await userEvent.click(screen.getByRole("button", { name: /checked in/ }));
    expect(markNotificationReadAction).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/attendance");
  });

  it("has no automatically detectable accessibility problems", async () => {
    const { container } = renderItems();
    expect(await violations(container)).toEqual([]);
  });
});

describe("EmailPreferencesForm (§18.7)", () => {
  const preferences = {
    reviewRequestsEmail: true,
    correctionUpdatesEmail: false,
    checkInReminderEmail: true,
    checkOutReminderEmail: true,
  };

  it("shows only the kinds that apply to the user", () => {
    render(
      <EmailPreferencesForm
        preferences={preferences}
        shown={{ reviewRequests: false, correctionUpdates: true, reminders: true }}
      />,
    );
    expect(screen.queryByRole("checkbox", { name: /to review/ })).toBeNull();
    expect(screen.getByRole("checkbox", { name: /Decisions on my corrections/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Check-in reminders/ })).toBeChecked();
  });

  it("explains when nothing applies", () => {
    render(
      <EmailPreferencesForm
        preferences={preferences}
        shown={{ reviewRequests: false, correctionUpdates: false, reminders: false }}
      />,
    );
    expect(screen.getByText("No email notifications apply to your account.")).toBeVisible();
  });

  it("has no automatically detectable accessibility problems", async () => {
    const { container } = render(
      <EmailPreferencesForm
        preferences={preferences}
        shown={{ reviewRequests: true, correctionUpdates: true, reminders: true }}
      />,
    );
    expect(await violations(container)).toEqual([]);
  });
});
