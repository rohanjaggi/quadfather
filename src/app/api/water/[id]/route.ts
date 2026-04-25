import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser(request);
    const { id } = await params;
    const logId = parseInt(id, 10);

    const log = await prisma.waterLog.findFirst({
      where: { id: logId, user_id: user.id },
    });
    if (!log) {
      return NextResponse.json(
        { detail: "Water log not found" },
        { status: 404 },
      );
    }

    await prisma.waterLog.delete({ where: { id: logId } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message === "User not found") {
      return NextResponse.json({ detail: message }, { status: 404 });
    }
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
