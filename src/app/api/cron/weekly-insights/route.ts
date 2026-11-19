import { NextRequest } from "next/server";
import { buildWeeklyInsights } from "@/lib/coach";
import { escapeHtml } from "@/lib/html";
import { clampHtml, sendHtml } from "@/lib/telegram-bot";
import { forEachCronUser } from "../auth";

export async function GET(request: NextRequest) {
  return forEachCronUser(request, "weekly_insights", "Weekly insights", async (user, ai) => {
    const insights = await buildWeeklyInsights(user, ai);
    if (insights === null) return false;

    // Telegram 400s past 4096 characters and this send has no fallback, so an
    // over-long model reply used to mean the user simply got no digest.
    await sendHtml(
      user.telegram_id,
      clampHtml(`\u{1F4CA} <b>Weekly Insights</b>\n\n${escapeHtml(insights)}`),
    );
    return true;
  });
}
