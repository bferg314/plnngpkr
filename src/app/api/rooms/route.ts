import { NextRequest, NextResponse } from "next/server";
import type { DeckType, RoomSettings, CardValue } from "@/types";
import * as roomManager from "../../../../server/rooms";

// Re-export roomsStore for backward compatibility during transition
export const roomsStore = new Map<
  string,
  {
    id: string;
    name: string;
    deckType: DeckType;
    customDeck?: CardValue[];
    settings: RoomSettings;
    createdAt: Date;
    createdBy: string;
  }
>();

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

    // Create room in room manager
    const room = roomManager.createRoom({
      id,
      name,
      deckType,
      customDeck,
      settings,
      createdBy: "anonymous",
    });

    // Also store in local map for API access
    roomsStore.set(id, {
      id: room.id,
      name: room.name,
      deckType: room.deckType as DeckType,
      customDeck: room.customDeck,
      settings: room.settings,
      createdAt: room.createdAt,
      createdBy: room.createdBy,
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

  // Try room manager first
  const roomState = roomManager.getRoomState(roomId);
  if (roomState) {
    return NextResponse.json({ room: roomState.room });
  }

  // Fall back to local store
  const room = roomsStore.get(roomId);
  if (!room) {
    return NextResponse.json(
      { error: "Room not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ room });
}
