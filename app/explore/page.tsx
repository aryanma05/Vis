import { redirect } from "next/navigation";

// Utforsk ligger på /sok. Beholdt så gamle lenker fortsatt virker.
export default function ExplorePage() {
  redirect("/sok");
}
