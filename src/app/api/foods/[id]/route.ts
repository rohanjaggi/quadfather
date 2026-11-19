import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFound, requireInt, withUser } from "@/lib/api-handler";

export const DELETE = withUser<{ params: { id: string } }>(
  async (request, user, { params }) => {
    const logId = requireInt(params.id, "id", { min: 1 });

    const { count } = await prisma.foodLog.deleteMany({ where: { id: logId, user_id: user.id } });
    if (count === 0) throw notFound("Food log not found");
    return new NextResponse(null, { status: 204 });
  },
);
