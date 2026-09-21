import { redirect } from "next/navigation";

/** The timetable lives on Home now. This route only exists so old links and bookmarks still land somewhere sensible. */
export default function TimetableRedirect() {
  redirect("/");
}
