/**
 * ATTENDANCE_VERIFICATION_PIA.md §9 — what employees are told before anything is
 * collected. Change NOTICE_VERSION (frontend and backend) when this changes.
 */
export function NoticeText({ location, selfie }: { location: boolean; selfie: boolean }) {
  return (
    <div className="grid gap-3 text-sm">
      <p>
        Your organization asks for{" "}
        {location && selfie ? "your location and a photo" : location ? "your location" : "a photo"}{" "}
        when you check in, to help confirm that attendance is recorded by the right person from your
        approved work location. Nothing is collected when you check out.
      </p>
      <p>
        <span className="font-medium">What is collected.</span>{" "}
        {location &&
          "Location: your position once, when you share it after checking in. It's compared with your approved area, then discarded. Only the result and a rough distance are kept. If the reading isn't accurate enough you'll see “Couldn't confirm”. That isn't a failed check, and you can try again. "}
        {selfie &&
          "Photo: one photo, taken when you choose to. Frame only yourself, and keep other people out of it."}
      </p>
      <p>
        <span className="font-medium">What is not collected.</span> You&apos;re never tracked
        between check-ins, and there&apos;s no face recognition.
      </p>
      <p>
        <span className="font-medium">Who can see it.</span> Your direct manager sees only the
        status.
        {selfie &&
          " Authorized Admin/HR staff can open a photo, and every view is recorded. You can't view photos in the app; to get your own, ask Admin/HR, who will confirm your identity first."}
      </p>
      <p>
        <span className="font-medium">How long it&apos;s kept.</span>{" "}
        {selfie ? "Photos 30 days, results 90 days." : "Results 90 days."}
      </p>
      <p>
        <span className="font-medium">How it&apos;s used.</span> Only to verify attendance, never
        for productivity or performance. It never changes your attendance status. A person reviews
        any flag, and you can respond.
      </p>
      <p>
        <span className="font-medium">If you can&apos;t or don&apos;t want to share.</span> You can
        still check in, and your attendance is recorded normally. Your record shows “Not shared”,
        which isn&apos;t treated as a failed check.
      </p>
    </div>
  );
}
