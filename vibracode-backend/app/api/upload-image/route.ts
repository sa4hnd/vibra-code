import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from '@e2b/code-interpreter';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per image
const MAX_IMAGES_PER_MESSAGE = 7;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Check file size (10MB limit per image)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Get the current session's sandbox ID from headers or session
    const sessionId = request.headers.get('x-session-id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Step 1: Generate upload URL for Convex storage
    const uploadUrl = await convex.mutation(api.messages.generateUploadUrl);

    // Step 2: Upload to Convex storage
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Convex upload failed:', uploadResponse.status, errorText);
      return NextResponse.json({ error: 'Failed to upload to Convex storage' }, { status: 500 });
    }

    const uploadResult = await uploadResponse.json();
    const { storageId } = uploadResult;

    if (!storageId) {
      console.error('No storageId returned from Convex upload');
      return NextResponse.json({ error: 'No storage ID returned from upload' }, { status: 500 });
    }

    // Step 3: Upload to E2B sandbox for Claude Code to access
    const sandbox = await Sandbox.connect(sessionId);
    const buffer = await file.arrayBuffer();

    // Create a sanitized filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `image-${Date.now()}-${sanitizedName}`;
    const filePath = `/vibe0/assets/${fileName}`;

    // Ensure assets directory exists inside the Expo project
    try {
      await sandbox.files.makeDir('/vibe0/assets');
    } catch {
      // Directory might already exist
    }

    await sandbox.files.write(filePath, new Uint8Array(buffer));

    console.log(`Image uploaded to E2B sandbox: ${filePath} (${file.size} bytes)`);

    return NextResponse.json({
      path: filePath,
      fileName: file.name,
      size: file.size,
      storageId: storageId
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to handle FormData manually
  },
};
