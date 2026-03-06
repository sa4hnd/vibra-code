import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// ElevenLabs API Configuration
const API_URL = process.env.ELEVENLABS_PROXY_URL || 'https://api.elevenlabs.io';
const API_KEY = process.env.ELEVENLABS_API_KEY || '';

export async function POST(req: NextRequest) {
    try {
        const { text, durationSeconds = 5 } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        console.log("Generating sound effect with ElevenLabs:", text);

        // Call ElevenLabs Sound Generation API via ngrok proxy
        const audioResponse = await fetch(`${API_URL}/v1/sound-generation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': API_KEY,
                'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify({
                text: text,
                duration_seconds: durationSeconds,
                prompt_influence: 0.3,
            }),
        });

        if (!audioResponse.ok) {
            const errorData = await audioResponse.text();
            console.error("API Error:", errorData);
            return NextResponse.json({
                error: `Audio generation failed: ${audioResponse.statusText}`
            }, { status: audioResponse.status });
        }

        // Get audio as buffer
        const audioBuffer = await audioResponse.arrayBuffer();
        const buffer = Buffer.from(audioBuffer);
        const blob = new Blob([buffer], { type: 'audio/mpeg' });

        console.log(`Generated audio: ${buffer.length} bytes`);

        // Upload to Convex Storage
        const uploadUrl = await convex.mutation(api.files.generateUploadUrl);

        const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "audio/mpeg" },
            body: blob,
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload audio: ${uploadResponse.statusText}`);
        }

        const { storageId } = await uploadResponse.json();

        // Get the file URL
        const fileUrl = await convex.query(api.files.getDownloadUrl, { storageId });

        console.log(`Audio uploaded. Storage ID: ${storageId}`);

        return NextResponse.json({
            audioUrl: fileUrl,
            storageId: storageId,
        });

    } catch (error) {
        console.error('Audio generation error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal server error'
        }, { status: 500 });
    }
}
