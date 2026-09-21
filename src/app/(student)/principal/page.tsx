import { redirect } from "next/navigation";

/** Students no longer have an Office screen: an exec runs the Principal's Office in person. Old links land home. */
export default function PrincipalRedirect() {
  redirect("/");
}
