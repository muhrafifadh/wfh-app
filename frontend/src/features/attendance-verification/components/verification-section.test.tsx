import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { VerificationSection } from "@/features/attendance-verification/components/verification-section";
import type { MyVerification } from "@/features/attendance-verification/schemas";

vi.mock("@/features/attendance-verification/actions", () => ({
  acknowledgeNoticeAction: vi.fn(),
  requestWorkLocationAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mine: MyVerification = {
  location: { enabled: true },
  selfie: { enabled: true },
  results: [],
  notice: { version: 3, acknowledged: true },
  workLocation: { approved: { label: "Home", radiusMeters: 1000 }, pending: null },
};

function renderSection(value: MyVerification) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VerificationSection mine={value} />
    </QueryClientProvider>,
  );
}

describe("VerificationSection", () => {
  it("offers no separate way to take a photo or share a location", () => {
    renderSection(mine);
    expect(screen.queryByRole("button", { name: /photo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /share my location/i })).not.toBeInTheDocument();
  });

  it("shows only the moments that recorded something", () => {
    renderSection({
      ...mine,
      results: [{ moment: "check_in", method: "selfie", result: "captured" }],
    });
    expect(screen.getByRole("region", { name: "Check-in" })).toHaveTextContent("Photo taken");
    expect(screen.queryByRole("region", { name: "Check-out" })).not.toBeInTheDocument();
  });

  it("asks for the notice before anything else", () => {
    renderSection({ ...mine, notice: { version: 3, acknowledged: false } });
    expect(screen.getByRole("button", { name: "Read the notice" })).toBeInTheDocument();
    expect(screen.queryByText(/Approved area/)).not.toBeInTheDocument();
  });
});
