import { and, eq, not } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  CallEndedEvent,
  CallTranscriptionReadyEvent,
  CallSessionParticipantLeftEvent,
  CallSessionStartedEvent,
  CallRecordingReadyEvent,
} from "@stream-io/video-react-sdk";

import { agents, meeting } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import { db } from "@/db";
import { inngest } from "@/inngest/client";

function verifySignatureWithSDK(body: string, signature: string): boolean {
  return streamVideo.verifyWebhook(body, signature);
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-signature");
  const apiKey = req.headers.get("x-api-key");

  if (!signature || !apiKey) {
    return NextResponse.json(
      { error: "Missing signature or API Key" },
      { status: 400 },
    );
  }

  const body = await req.text();

  if (!verifySignatureWithSDK(body, signature)) {
    return NextResponse.json({ error: "Invalid Signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = (payload as Record<string, unknown>)?.type;

  if (eventType === "call.session_started") {
    const event = payload as CallSessionStartedEvent;
    const meetingId = event.call.custom?.meetingId;

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    const [existingMeeting] = await db
      .select()
      .from(meeting)
      .where(
        and(
          eq(meeting.id, meetingId),
          not(eq(meeting.status, "completed")),
          not(eq(meeting.status, "active")),
          not(eq(meeting.status, "cancelled")),
          not(eq(meeting.status, "processing")),
        ),
      );

    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    await db
      .update(meeting)
      .set({
        status: "active",
        startedAt: new Date(),
      })
      .where(eq(meeting.id, existingMeeting.id));

    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existingMeeting.agentId));

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const call = streamVideo.video.call("default", meetingId);
    const realtimeClient = await streamVideo.video.connectOpenAi({
      call,
      openAiApiKey: process.env.OPENAI_API_KEY!,
      agentUserId: existingAgent.id,
    });

    realtimeClient.updateSession({
      instruction: existingAgent.instructions,
    });
  } else if (eventType === "call.session_participantLeft") {
    const event = payload as CallSessionParticipantLeftEvent;
    const meetingId = event.call_cid.split(":")[1]; //call_cid is formatted as "type:id"

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    const call = streamVideo.video.call("default", meetingId);
    await call.end();
  } else if (eventType === "call.session_ended") {
    const event = payload as CallEndedEvent;
    const meetingId = event.call.custom?.meetingId;

    if (!meetingId) {
      return NextResponse.json({ error: "missing meetingId" }, { status: 400 });
    }

    await db
      .update(meeting)
      .set({
        status: "processing",
        endedAt: new Date(),
      })
      .where(and(eq(meeting.id, meetingId), eq(meeting.status, "active")));
  } else if (eventType === "call.transcript_ready") {
    const event = payload as CallTranscriptionReadyEvent;
    const meetingId = event.call_cid.split(":")[1];

    const [updateMeeting] = await db
      .update(meeting)
      .set({
        transcriptUrl: event.call_transcription.url,
      })
      .where(eq(meeting.id, meetingId))
      .returning();

    if (!updateMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

     await inngest.send({
        name:"meetings/processing",
        data:{
            meetingId:updateMeeting.id,
            transcriptUrl:updateMeeting.transcriptUrl,
        }
     })

  } else if (eventType === "call.recording_ready") {
    const event = payload as CallRecordingReadyEvent;
    const meetingId = event.call_cid.split(":")[1];

    await db
      .update(meeting)
      .set({
        recordingUrl: event.call_recording.url,
      })
      .where(eq(meeting.id, meetingId));
  }

  return NextResponse.json({ status: "ok" });
}
