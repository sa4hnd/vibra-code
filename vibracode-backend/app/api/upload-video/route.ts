import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from '@e2b/code-interpreter';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Limits
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per video file

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Accept video/* mime types or common video extensions
    const isVideo = file.type.startsWith('video/') ||
      file.name.endsWith('.mp4') ||
      file.name.endsWith('.mov') ||
      file.name.endsWith('.avi') ||
      file.name.endsWith('.webm') ||
      file.name.endsWith('.mkv');

    if (!isVideo) {
      return NextResponse.json({ error: 'File must be a video file' }, { status: 400 });
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
        headers: { 'Content-Type': file.type || 'video/mp4' },
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
    const fileName = `video-${Date.now()}-${sanitizedName}`;
    const filePath = `/app/assets/${fileName}`;

    // Ensure assets directory exists
    try {
      await sandbox.files.makeDir('/app/assets');
    } catch {
      // Directory might already exist
    }

    await sandbox.files.write(filePath, new Uint8Array(buffer));

    console.log(`Video uploaded to E2B sandbox: ${filePath} (${file.size} bytes)`);

    return NextResponse.json({
      path: filePath,
      fileName: file.name,
      size: file.size,
      storageId: storageId
    });

  } catch (error) {
    console.error('Error uploading video:', error);
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
