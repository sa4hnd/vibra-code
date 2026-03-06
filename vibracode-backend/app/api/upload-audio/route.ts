import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from '@e2b/code-interpreter';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Limits
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per audio file

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Accept audio/* mime types or common audio extensions
    const isAudio = file.type.startsWith('audio/') ||
      file.name.endsWith('.mp3') ||
      file.name.endsWith('.wav') ||
      file.name.endsWith('.m4a') ||
      file.name.endsWith('.aac') ||
      file.name.endsWith('.ogg');

    if (!isAudio) {
      return NextResponse.json({ error: 'File must be an audio file' }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Get the current session's sandbox ID from headers
    const sessionId = request.headers.get('x-session-id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Step 1: Generate upload URL for Convex storage (for persistence)
    let storageId: string | null = null;
    try {
      const uploadUrl = await convex.mutation(api.messages.generateUploadUrl);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'audio/mpeg' },
        body: file,
      });

      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        storageId = uploadResult.storageId;
      }
    } catch (e) {
      console.warn('Convex upload failed, continuing with E2B only:', e);
    }

    // Step 2: Upload to E2B sandbox for Claude Code to access
    const sandbox = await Sandbox.connect(sessionId);
    const buffer = await file.arrayBuffer();

    // Create a sanitized filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `audio-${Date.now()}-${sanitizedName}`;
    const filePath = `/vibe0/assets/${fileName}`;

    // Ensure assets directory exists inside the Expo project
    try {
      await sandbox.files.makeDir('/vibe0/assets');
    } catch {
      // Directory might already exist
    }

    await sandbox.files.write(filePath, new Uint8Array(buffer));

    console.log(`Audio uploaded to E2B sandbox: ${filePath} (${file.size} bytes)`);

    return NextResponse.json({
      path: filePath,
      fileName: file.name,
      size: file.size,
      storageId: storageId
    });

  } catch (error) {
    console.error('Error uploading audio:', error);
    return NextResponse.json(
      { error: 'Failed to upload audio' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
