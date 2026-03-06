import { inngest } from "../client";
import { Id } from "@/convex/_generated/dataModel";

const API_URL = process.env.OPENAI_PROXY_URL || '';
const API_KEY = process.env.OPENAI_PROXY_API_KEY || '';

export const generateVideo = inngest.createFunction(
  {
    id: "generate-video",
    retries: 3,
    concurrency: 10,
  },
  { event: "vibracode/generate.video" },
  async ({ event, step }) => {
    const {
      videoId,
      prompt,
    }: {
      videoId: Id<"generatedVideos">;
      prompt: string;
    } = event.data;

    console.log(`🎬 Starting video generation for ID: ${videoId}`);
    console.log(`📝 Prompt: ${prompt}`);

    // Step 1: Create video generation request
    const soraVideoId = await step.run("create-video", async () => {
      console.log(`📡 Creating video with Sora 2...`);

      const createResponse = await fetch(`${API_URL}/v1/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          model: 'sora-2-2025-12-08',
          prompt: prompt,
          size: '1280x720',
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => null);
        throw new Error(errorData?.error?.message || `Video generation failed: ${createResponse.statusText}`);
      }

      const createData = await createResponse.json();
      const id = createData.id;

      if (!id) {
        throw new Error('No video ID returned from Sora API');
      }

      console.log(`✅ Sora video generation started. Sora ID: ${id}`);
      return id;
    });

    // Step 2: Poll for completion
    const videoUrl = await step.run("poll-status", async () => {
      const maxAttempts = 60; // 60 attempts * 5 seconds = 5 minutes
      let attempts = 0;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        console.log(`🔍 Polling status (attempt ${attempts + 1}/${maxAttempts})...`);

        const statusResponse = await fetch(`${API_URL}/v1/videos/${soraVideoId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (!statusResponse.ok) {
          console.error("❌ Status check failed:", statusResponse.statusText);
          attempts++;
          continue;
        }

        const statusData = await statusResponse.json();
        const progress = statusData.progress || 0;
        console.log(`⏳ Video status: ${statusData.status} | Progress: ${progress}% | Attempt: ${attempts + 1}/${maxAttempts}`);

        if (statusData.status === 'completed') {
          const url = `${API_URL}/v1/videos/${soraVideoId}/content`;
          console.log(`✅ Video generation completed!`);
          return url;
        } else if (statusData.status === 'failed' || statusData.status === 'error') {
          throw new Error(statusData.error || 'Video generation failed');
        }

        attempts++;
      }

      throw new Error('Video generation timed out after 5 minutes');
    });

    // Step 3: Download video
    const videoData = await step.run("download-video", async () => {
      console.log(`⬇️ Starting video download from: ${videoUrl}`);

      const downloadResponse = await fetch(videoUrl, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!downloadResponse.ok) {
        throw new Error(`Failed to download video: ${downloadResponse.statusText}`);
      }

      // Check Content-Type to ensure we got a video, not HTML
      const contentType = downloadResponse.headers.get('content-type');
      console.log(`📋 Content-Type: ${contentType}`);

      if (contentType && !contentType.includes('video') && !contentType.includes('octet-stream')) {
        throw new Error(`Invalid content type: ${contentType}. Expected video but got: ${contentType}`);
      }

      const buffer = await downloadResponse.arrayBuffer();
      console.log(`✅ Downloaded video: ${(buffer.byteLength / 1024).toFixed(2)} KB`);

      // Validate it's actually a video file (check MP4 magic number)
      const bytes = new Uint8Array(buffer);
      const isMp4 = bytes.length > 8 &&
                    bytes[4] === 0x66 && bytes[5] === 0x74 &&
                    bytes[6] === 0x79 && bytes[7] === 0x70; // 'ftyp'

      if (!isMp4) {
        console.error('❌ Downloaded file is not a valid MP4!');
        console.error('First 16 bytes:', Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        throw new Error('Downloaded file is not a valid MP4 video');
      }

      console.log('✅ Validated: File is a valid MP4 video');

      // Convert to base64 for serialization between Inngest steps
      const base64 = Buffer.from(buffer).toString('base64');
      return { base64, size: buffer.byteLength };
    });

    // Step 4: Upload to Convex
    const { storageId, fileUrl } = await step.run("upload-to-convex", async () => {
      console.log(`☁️ Uploading to Convex storage...`);

      const { ConvexHttpClient } = await import("convex/browser");
      const { api } = await import("@/convex/_generated/api");

      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

      const uploadUrl = await convex.mutation(api.files.generateUploadUrl);

      // Convert base64 back to ArrayBuffer for upload
      const videoBuffer = Buffer.from(videoData.base64, 'base64');
      console.log(`📤 Uploading ${(videoData.size / 1024).toFixed(2)} KB as video/mp4`);

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "video/mp4" },
        body: videoBuffer,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Failed to upload video: ${uploadResponse.statusText} - ${errorText}`);
      }

      const { storageId } = await uploadResponse.json();
      const fileUrl = await convex.query(api.files.getDownloadUrl, { storageId });

      console.log(`✅ Video uploaded to Convex. Storage ID: ${storageId}`);
      console.log(`🔗 Convex URL: ${fileUrl}`);

      return { storageId, fileUrl };
    });

    // Step 5: Delete video from Sora/ngrok (cleanup)
    await step.run("cleanup-sora-video", async () => {
      console.log(`🗑️ Deleting video from Sora API...`);

      try {
        const deleteResponse = await fetch(`${API_URL}/v1/videos/${soraVideoId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (deleteResponse.ok) {
          console.log(`✅ Video deleted from Sora API: ${soraVideoId}`);
        } else {
          console.warn(`⚠️ Failed to delete video from Sora: ${deleteResponse.statusText}`);
        }
      } catch (error) {
        // Don't fail the entire job if cleanup fails
        console.warn(`⚠️ Cleanup error (non-critical):`, error);
      }
    });

    // Step 6: Update video record
    await step.run("update-video-record", async () => {
      console.log(`💾 Updating video record...`);

      const { fetchMutation } = await import("convex/nextjs");
      const { api } = await import("@/convex/_generated/api");

      await fetchMutation(api.videos.updateAfterGeneration, {
        id: videoId,
        storageId: storageId as Id<"_storage">,
        url: fileUrl,
        status: "completed",
      });

      console.log(`✅ Video generation complete for ${videoId}`);
    });

    return { success: true, videoId, storageId, fileUrl };
  }
);
