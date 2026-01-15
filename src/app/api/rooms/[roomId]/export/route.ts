import { NextRequest, NextResponse } from "next/server";
import * as roomManager from "../../../../../../server/rooms";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";

  if (format === "csv") {
    const csv = roomManager.exportStories(roomId);
    if (!csv) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${roomId}-stories.csv"`,
      },
    });
  }

  // Default to JSON
  const data = roomManager.exportStoriesJson(roomId);
  if (!data) {
    return NextResponse.json(
      { error: "Room not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
