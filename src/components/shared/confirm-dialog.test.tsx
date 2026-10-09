import { useState } from "react";

import { render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";

function Harness({ onConfirm }: { onConfirm: () => Promise<boolean | void> }) {
  const [open, setOpen] = useState(true);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Delete invoice INV-1?"
      description="This can't be undone."
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      destructive
      onConfirm={onConfirm}
    />
  );
}

describe("ConfirmDialog", () => {
  it("shows progress while confirming, then closes", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    render(<Harness onConfirm={() => new Promise<void>((resolve) => (finish = resolve))} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    const dialog = screen.getByRole("alertdialog");
    finish();
    await waitForElementToBeRemoved(dialog);
  });

  it("stays open when the action fails", async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={async () => false} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("button", { name: "Delete" })).toBeEnabled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
