import { NextRequest } from "next/server";
import { buildWeeklyInsights, buildWeeklyTraining } from "@/lib/coach";
import { escapeHtml } from "@/lib/html";
import { clampHtml, sendHtml } from "@/lib/telegram-bot";
import { forEachCronUser } from "../auth";

/** The Monday weekly letter: the AI insight on the week's eating, then a Training section when the user trained. */
export async function GET(request: NextRequest) {
  return forEachCronUser(request, "weekly_insights", "Weekly letter", async (user, ai) => {
    if (!ai) return false;

    // Each section fails alone, as the two separate digests used to, so one AI error doesn't cost the whole letter.
    const section = (name: string, build: Promise<string | null>) =>
      build.catch((err) => {
        console.error(`Weekly letter ${name} failed for user ${user.id}:`, err);
        return null;
      });
    const [insights, training] = await Promise.all([
      section("insights", buildWeeklyInsights(user, ai)),
      section("training", buildWeeklyTraining(user, ai)),
    ]);
    if (insights === null && training === null) return false;

    const parts: string[] = [];
    if (insights !== null) parts.push(escapeHtml(insights));
    if (training !== null) parts.push(`<b>Training</b>\n${escapeHtml(training)}`);

    // Telegram 400s past 4096 characters and this send has no fallback.
    await sendHtml(
      user.telegram_id,
      clampHtml(`\u{1F4CA} <b>Your week</b>\n\n${parts.join("\n\n")}`),
    );
    return true;
  });
}
