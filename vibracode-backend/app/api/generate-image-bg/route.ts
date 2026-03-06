import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export async function POST(req: NextRequest) {
    try {
        const { imageId, prompt, referenceImageIds } = await req.json();

        if (!imageId || !prompt) {
            return NextResponse.json({ error: 'Image ID and prompt are required' }, { status: 400 });
        }

        // Trigger Inngest function
        await inngest.send({
            name: "vibracode/generate.image",
            data: {
                imageId,
                prompt,
                referenceImageIds: referenceImageIds || [],
            },
        });

        return NextResponse.json({ success: true, message: 'Image generation started' });

    } catch (error) {
        console.error('Failed to trigger image generation:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal server error'
        }, { status: 500 });
    }
}
