import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getLangSettings } from "@/lib/translations";
import SetupFlow from "./SetupFlow";

export const dynamic = "force-dynamic";

// Deliberately uses requireUserId, not requireOnboarded — this is the page the
// gate redirects TO, so gating it would loop. Anyone who has already answered
// it is sent on rather than shown it again.
export default async function Setup() {
  const userId = await requireUserId();
  const { onboarded, language } = await getLangSettings(userId);
  if (onboarded) redirect("/");

  return (
    <main>
      <SetupFlow initialLang={language} />
    </main>
  );
}
