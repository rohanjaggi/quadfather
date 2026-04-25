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
    const foodId = parseInt(id, 10);

    const food = await prisma.savedFood.findFirst({
      where: { id: foodId, user_id: user.id },
    });
    if (!food) {
      return NextResponse.json(
        { detail: "Saved food not found" },
        { status: 404 },
      );
    }

    await prisma.savedFood.delete({ where: { id: foodId } });
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
