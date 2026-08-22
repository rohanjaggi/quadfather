import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFound, requireInt, withUser } from "@/lib/api-handler";

export const DELETE = withUser<{ params: { id: string } }>(
  async (request, user, { params }) => {
    const logId = requireInt(params.id, "id", { min: 1 });

    const log = await prisma.waterLog.findFirst({
      where: { id: logId, user_id: user.id },
    });
    if (!log) throw notFound("Water log not found");

    await prisma.waterLog.delete({ where: { id: logId } });
    return new NextResponse(null, { status: 204 });
  },
);
