import { redirect } from "next/navigation";

// Gammel adresse. Import ligger nå sammen med «Del prosjekt».
export default function ImportPage() {
  redirect("/ny?fra=github");
}
