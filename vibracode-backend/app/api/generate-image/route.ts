import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// GPT Image 1.5 API Configuration
const API_URL = process.env.OPENAI_PROXY_URL || 'https://api.openai.com';
const API_KEY = process.env.OPENAI_API_KEY || '';

export async function POST(req: NextRequest) {
    try {
        const {
            prompt,
            size = '1024x1024',
            quality = 'auto',
            background = 'transparent',
            outputFormat = 'png'
        } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        console.log("Generating image with GPT Image 1.5:", prompt);
        console.log(`Size: ${size}, Quality: ${quality}, Background: ${background}`);

        // Call GPT Image 1.5 API directly
        const imageResponse = await fetch(`${API_URL}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                model: 'chatgpt-image-latest',
                prompt: prompt,
                n: 1,
                size: size,
                quality: quality,
                background: background,
                output_format: outputFormat,
            }),
        });

        if (!imageResponse.ok) {
            const errorData = await imageResponse.json().catch(() => null);
            console.error("API Error:", errorData || await imageResponse.text());
            return NextResponse.json({
                error: errorData?.error?.message || `Image generation failed: ${imageResponse.statusText}`
            }, { status: imageResponse.status });
        }

        const imageData = await imageResponse.json();

        if (imageData.error) {
            console.error("Generation Error:", imageData.error);
            return NextResponse.json({ error: imageData.error.message || 'Image generation failed' }, { status: 500 });
        }

        // Get the generated image data
        const data = imageData.data?.[0];
        if (!data || !data.b64_json) {
            console.error("No image data returned:", JSON.stringify(imageData));
            return NextResponse.json({ error: 'No image data returned' }, { status: 500 });
        }

        // Upload to Convex Storage
        const base64Data = data.b64_json;
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: `image/${outputFormat}` });

        // Generate an upload URL
        const uploadUrl = await convex.mutation(api.files.generateUploadUrl);

        // Upload the file
        const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": `image/${outputFormat}` },
            body: blob,
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
        }

        const { storageId } = await uploadResponse.json();

        // Get the file URL
        const fileUrl = await convex.query(api.files.getDownloadUrl, { storageId });

        console.log(`Image generated and uploaded. Storage ID: ${storageId}`);

        return NextResponse.json({
            imageUrl: fileUrl,
            storageId: storageId,
            revisedPrompt: data.revised_prompt
        });

    } catch (error) {
        console.error('Image generation error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal server error'
        }, { status: 500 });
    }
}
