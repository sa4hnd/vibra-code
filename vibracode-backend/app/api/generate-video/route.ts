import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export async function POST(req: NextRequest) {
    try {
        const { videoId, prompt } = await req.json();

        if (!videoId || !prompt) {
            return NextResponse.json({ error: 'Video ID and prompt are required' }, { status: 400 });
        }

        // Trigger Inngest function
        await inngest.send({
            name: "vibracode/generate.video",
            data: {
                videoId,
                prompt,
            },
        });

        return NextResponse.json({ success: true, message: 'Video generation started' });

    } catch (error) {
        console.error('Failed to trigger video generation:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal server error'
        }, { status: 500 });
    }
}
