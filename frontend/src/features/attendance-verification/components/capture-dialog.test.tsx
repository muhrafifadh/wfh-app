import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { startPhotoUploadAction } from "@/features/attendance-verification/actions";
import { CaptureDialog } from "@/features/attendance-verification/components/capture-dialog";
import { readLocation } from "@/features/attendance-verification/components/geolocation";
import { ok } from "@/lib/actions";

vi.mock("@/features/attendance-verification/actions", () => ({
  startPhotoUploadAction: vi.fn(),
}));
vi.mock("@/features/attendance-verification/components/geolocation", () => ({
  readLocation: vi.fn(),
}));

const READING = { latitude: -6.2, longitude: 106.8, accuracyMeters: 20 };

function renderDialog(props: { photo?: boolean; location?: boolean } = {}) {
  const onCaptured = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <CaptureDialog
      open
      onOpenChange={onOpenChange}
      moment="check_out"
      photo={props.photo ?? true}
      location={props.location ?? true}
      onCaptured={onCaptured}
    />,
  );
  return { onCaptured, onOpenChange };
}

beforeEach(() => {
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() }),
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    configurable: true,
    value: 640,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
    configurable: true,
    value: 480,
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) =>
    callback(new Blob(["photo"], { type: "image/jpeg" })),
  );
  vi.mocked(startPhotoUploadAction).mockResolvedValue(
    ok({ uploadUrl: "https://storage.test/x", uploadHeaders: {} }),
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const takePhoto = async () =>
  userEvent.click(await screen.findByRole("button", { name: "Take photo" }));

describe("CaptureDialog", () => {
  it("reads the location when the photo is taken, not before", async () => {
    vi.mocked(readLocation).mockResolvedValue(READING);
    const { onCaptured } = renderDialog();
    await screen.findByRole("button", { name: "Take photo" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled());
    expect(readLocation).not.toHaveBeenCalled();

    await takePhoto();
    expect(readLocation).toHaveBeenCalledTimes(1);
    expect(onCaptured).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole("button", { name: "Use this photo" }));
    await waitFor(() => expect(onCaptured).toHaveBeenCalledWith({ location: READING }));
    expect(startPhotoUploadAction).toHaveBeenCalledWith(
      expect.objectContaining({ moment: "check_out" }),
    );
  });

  it("keeps no photo and records nothing when the location is refused", async () => {
    vi.mocked(readLocation).mockResolvedValue(null);
    const { onCaptured } = renderDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled());
    await takePhoto();

    expect(await screen.findByRole("alert")).toHaveTextContent(/Allow location/);
    expect(screen.queryByRole("button", { name: "Use this photo" })).not.toBeInTheDocument();
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it("can't take a photo when the camera is refused", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const { onCaptured } = renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent(/Allow the camera/);
    expect(screen.getByRole("button", { name: "Take photo" })).toBeDisabled();
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it("records nothing when the upload fails", async () => {
    vi.mocked(readLocation).mockResolvedValue(READING);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const { onCaptured } = renderDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled());
    await takePhoto();
    await userEvent.click(await screen.findByRole("button", { name: "Use this photo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't upload/);
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it("asks only for the location while photos are off", async () => {
    vi.mocked(readLocation).mockResolvedValue(READING);
    const { onCaptured } = renderDialog({ photo: false });
    expect(screen.queryByLabelText("Camera preview")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Share my location" }));
    await waitFor(() => expect(onCaptured).toHaveBeenCalledWith({ location: READING }));
  });
});
