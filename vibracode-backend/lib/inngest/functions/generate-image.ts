import { inngest } from "../client";
import { Id } from "@/convex/_generated/dataModel";

const API_URL = process.env.OPENAI_PROXY_URL || '';
const API_KEY = process.env.OPENAI_PROXY_API_KEY || '';

export const generateImage = inngest.createFunction(
  {
    id: "generate-image",
    retries: 3,
    concurrency: 20,
  },
  { event: "vibracode/generate.image" },
  async ({ event, step }) => {
    const {
      imageId,
      prompt,
      referenceImageIds = [],
    }: {
      imageId: Id<"generatedImages">;
      prompt: string;
      referenceImageIds?: Id<"generatedImages">[];
    } = event.data;

    console.log(`🎨 Starting image generation for ID: ${imageId}`);
    console.log(`📝 Prompt: ${prompt}`);
    if (referenceImageIds.length > 0) {
      console.log(`🖼️  Reference images: ${referenceImageIds.length}`);
    }

    // Step 1: Generate image AND upload to Convex in one step
    // (to avoid passing large base64 data between steps which hits Inngest's size limit)
    const { storageId, fileUrl, revisedPrompt } = await step.run("generate-and-upload", async () => {
      const { ConvexHttpClient } = await import("convex/browser");
      const { api } = await import("@/convex/_generated/api");
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

      let base64Data: string;
      let revisedPromptResult: string | undefined;

      const useEditEndpoint = referenceImageIds.length > 0;

      if (useEditEndpoint) {
        console.log(`🎨 Using edits endpoint with reference image...`);

        // Get the first reference image (for now, we'll use only one)
        const referenceImageId = referenceImageIds[0];
        const referenceImage = await convex.query(api.images.getById, { id: referenceImageId });

        if (!referenceImage || !referenceImage.url) {
          throw new Error('Reference image not found or has no URL');
        }

        console.log(`📥 Downloading reference image from: ${referenceImage.url}`);

        // Download the reference image
        const imageResponse = await fetch(referenceImage.url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download reference image: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

        // Create FormData for multipart request
        const formData = new FormData();
        formData.append('model', 'chatgpt-image-latest');
        formData.append('image', imageBlob, 'reference.png');
        formData.append('prompt', prompt);
        formData.append('n', '1');

        console.log(`🤖 Calling GPT Image 1.5 Edits API...`);

        const editResponse = await fetch(`${API_URL}/v1/images/edits`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: formData,
        });

        if (!editResponse.ok) {
          const errorData = await editResponse.json().catch(() => null);
          throw new Error(errorData?.error?.message || `Image edit failed: ${editResponse.statusText}`);
        }

        const responseData = await editResponse.json();

        if (responseData.error) {
          throw new Error(responseData.error.message || 'Image edit failed');
        }

        const data = responseData.data?.[0];
        if (!data || !data.b64_json) {
          throw new Error('No image data returned from edit API');
        }

        console.log(`✅ Image edited successfully`);
        console.log(`📝 Revised prompt: ${data.revised_prompt || 'N/A'}`);

        base64Data = data.b64_json;
        revisedPromptResult = data.revised_prompt;
      } else {
        console.log(`🤖 Calling GPT Image 1.5 API... (letting AI decide everything)`);

        const imageResponse = await fetch(`${API_URL}/v1/images/generations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({
            model: 'chatgpt-image-latest',
            prompt: prompt,
            n: 1,
          }),
        });

        if (!imageResponse.ok) {
          const errorData = await imageResponse.json().catch(() => null);
          throw new Error(errorData?.error?.message || `Image generation failed: ${imageResponse.statusText}`);
        }

        const responseData = await imageResponse.json();

        if (responseData.error) {
          throw new Error(responseData.error.message || 'Image generation failed');
        }

        const data = responseData.data?.[0];
        if (!data || !data.b64_json) {
          throw new Error('No image data returned from API');
        }

        console.log(`✅ Image generated successfully`);
        console.log(`📝 Revised prompt: ${data.revised_prompt || 'N/A'}`);

        base64Data = data.b64_json;
        revisedPromptResult = data.revised_prompt;
      }

      // Upload to Convex storage immediately (within the same step)
      console.log(`☁️ Uploading to Convex storage...`);

      const uploadUrl = await convex.mutation(api.files.generateUploadUrl);

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      console.log(`📤 Uploading ${(buffer.length / 1024).toFixed(2)} KB image`);

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: buffer,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Failed to upload image: ${uploadResponse.statusText} - ${errorText}`);
      }

      const { storageId } = await uploadResponse.json();
      const fileUrl = await convex.query(api.files.getDownloadUrl, { storageId });

      console.log(`✅ Image uploaded to Convex. Storage ID: ${storageId}`);
      console.log(`🔗 Convex URL: ${fileUrl}`);

      // Return only small data (no base64)
      return { storageId, fileUrl, revisedPrompt: revisedPromptResult };
    });

    // Step 2: Update image record
    await step.run("update-image-record", async () => {
      console.log(`💾 Updating image record...`);

      const { ConvexHttpClient } = await import("convex/browser");
      const { api } = await import("@/convex/_generated/api");
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

      await convex.mutation(api.images.updateAfterGeneration, {
        id: imageId,
        storageId: storageId as Id<"_storage">,
        url: fileUrl,
        revisedPrompt: revisedPrompt,
        status: "completed",
      });

      console.log(`✅ Image generation complete for ${imageId}`);
    });

    return { success: true, imageId, storageId, fileUrl };
  }
);
