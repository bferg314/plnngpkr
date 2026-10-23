import { NextRequest, NextResponse } from "next/server";
import * as roomManager from "../../../../server/rooms";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, deckType, customDeck, settings } = body;

    if (!id || !name || !deckType || !settings) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create room in room manager (persists to DB if configured)
    const room = roomManager.createRoom({
      id,
      name: String(name).trim().slice(0, 100),
      deckType,
      customDeck,
      settings,
      createdBy: "anonymous",
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("id");

  if (!roomId) {
    return NextResponse.json(
      { error: "Room ID is required" },
      { status: 400 }
    );
  }

  // Hydrate from DB if not in memory
  if (!roomManager.getRoom(roomId)) {
    await roomManager.hydrateRoomFromDb(roomId);
  }

  const roomState = roomManager.getRoomState(roomId);
  if (roomState) {
    return NextResponse.json({ room: roomState.room });
  }

  return NextResponse.json(
    { error: "Room not found" },
    { status: 404 }
  );
}
