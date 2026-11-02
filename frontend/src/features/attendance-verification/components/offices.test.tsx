import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { addOfficeAction, removeOfficeAction } from "@/features/attendance-verification/actions";
import { Offices } from "@/features/attendance-verification/components/offices";

vi.mock("@/features/attendance-verification/actions", () => ({
  addOfficeAction: vi.fn(),
  removeOfficeAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const HQ = {
  id: "0b7a3c2e-8d61-4f0a-9c4e-5d2b1a7e6f30",
  label: "Jakarta HQ",
  latitude: -6.2088,
  longitude: 106.8456,
  radiusMeters: 200,
};

afterEach(() => vi.resetAllMocks());

describe("Offices", () => {
  it("says what happens without an office", () => {
    render(<Offices offices={[]} canLocate={false} />);
    expect(screen.getByText("No offices")).toBeInTheDocument();
  });

  it("removes the office chosen", async () => {
    vi.mocked(removeOfficeAction).mockResolvedValue({ ok: true, data: undefined });
    render(<Offices offices={[HQ]} canLocate={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Jakarta HQ" }));
    expect(removeOfficeAction).toHaveBeenCalledWith(HQ.id);
  });

  it("sends numbers, and shows the errors for each field", async () => {
    vi.mocked(addOfficeAction).mockResolvedValue({
      ok: false,
      error: "Fix the fields",
      fieldErrors: { latitude: ["Enter a latitude"] },
    });
    render(<Offices offices={[]} canLocate={false} />);
    await userEvent.type(screen.getByLabelText("Office name"), "Jakarta HQ");
    await userEvent.type(screen.getByLabelText("Longitude"), "106.8456");
    await userEvent.click(screen.getByRole("button", { name: "Add office" }));

    expect(addOfficeAction).toHaveBeenCalledWith({
      label: "Jakarta HQ",
      latitude: Number.NaN,
      longitude: 106.8456,
      radiusMeters: 200,
    });
    expect(await screen.findByText("Enter a latitude")).toBeInTheDocument();
    expect(screen.getByLabelText("Latitude")).toHaveAttribute("aria-invalid", "true");
  });

  it("only offers the current location where the browser may share it", () => {
    const name = "Use my current location";
    const { rerender } = render(<Offices offices={[]} canLocate={false} />);
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    rerender(<Offices offices={[]} canLocate />);
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });
});
