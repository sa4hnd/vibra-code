import { inngest } from "../client";
import { updateSessionStatus, addMessage, getSessionData, getSessionMessages } from "../middleware";
import { Template } from "@/config";
import { Id } from "@/convex/_generated/dataModel";
import { getSystemPrompt } from "@/lib/prompts";
import { E2BManager } from "@/lib/e2b/config";

export const runAgent = inngest.createFunction(
  {
    id: "run-agent",
    retries: 0,
    concurrency: 25,
    onFailure: async ({ error, event }) => {
      // This runs AFTER the function fails/times out, in a NEW execution context
      // So it can still send messages even if the original function was killed
      console.log('🔴 RUN AGENT FAILURE HANDLER:', error?.message);

      const { id } = event.data as { id: Id<"sessions"> };

      try {
        // Check if this is a timeout error
        const errorMessage = error?.message || String(error);
        const isTimeout = errorMessage.includes('FUNCTION_INVOCATION_TIMEOUT') ||
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('Timeout') ||
                          errorMessage.includes('timed out') ||
                          errorMessage.includes('ETIMEDOUT') ||
                          errorMessage.includes('deadline exceeded');

        // Check if sandbox was terminated unexpectedly (E2B infrastructure issue)
        const isSandboxTerminated = errorMessage.includes('terminated') ||
                                    errorMessage.includes('[unknown]') ||
                                    errorMessage.includes('SandboxError') ||
                                    errorMessage.includes('unavailable') ||
                                    errorMessage.includes('sandbox not found');

        // Reset session status
        await updateSessionStatus(id, "RUNNING");

        if (isTimeout) {
          // Friendly timeout message
          const timeoutMessage = `⏱️ **Request Timed Out**\n\nThe AI took too long to respond. This can happen with complex tasks.\n\n**To continue:**\n• Send a new message to resume where we left off\n• Try breaking your request into smaller steps\n• Type "continue" to pick up from here\n\nYour progress has been saved.`;
          await addMessage(id, timeoutMessage, "assistant");
        } else if (isSandboxTerminated) {
          // Sandbox was terminated unexpectedly - this is recoverable
          const sandboxMessage = `🔄 **Session Interrupted**\n\nThe development environment was temporarily unavailable. This can happen due to server maintenance or high demand.\n\n**To continue:**\n• Send a new message and I'll pick up where we left off\n• Your code and progress have been saved\n• Type "continue" to resume\n\nIf this keeps happening, try starting a new session.`;
          await addMessage(id, sandboxMessage, "assistant");
        } else {
          // Sanitize and show generic error
          let sanitizedError = errorMessage;
          const secretPatterns = [
            /sk-ant-[a-zA-Z0-9-]+/g,
            /sk-[a-zA-Z0-9-]{20,}/g,
            /ctx7sk-[a-zA-Z0-9-]+/g,
            /ghp_[a-zA-Z0-9]+/g,
            /gho_[a-zA-Z0-9]+/g,
            /xai-[a-zA-Z0-9-]+/g,
            /Bearer\s+[a-zA-Z0-9._-]+/gi,
            /Authorization:\s*[^\s,}]+/gi,
            /api[_-]?key["\s:=]+[a-zA-Z0-9._-]+/gi,
            /token["\s:=]+[a-zA-Z0-9._-]+/gi,
            /secret["\s:=]+[a-zA-Z0-9._-]+/gi,
            /password["\s:=]+[^\s,}]+/gi,
            /atk_[a-zA-Z0-9._-]+/gi,
            /https?:\/\/[a-zA-Z0-9-]+\.ngrok[a-zA-Z0-9.-]*\.[a-z]+[^\s'"]*/gi,
            /ngrok[a-zA-Z0-9.-]*\.[a-z]+/gi,
          ];
          for (const pattern of secretPatterns) {
            sanitizedError = sanitizedError.replace(pattern, '[REDACTED]');
          }
          await addMessage(id, `⚠️ **Agent Error**\n\nSomething went wrong. Please try again.\n\n\`\`\`\n${sanitizedError}\n\`\`\``, "assistant");
        }
      } catch (failureError) {
        console.error('❌ Failed to handle failure:', failureError);
      }
    },
  },
  { event: "vibracode/run.agent" },
  async ({ event, step }) => {
    console.log('🚀 RUN AGENT FUNCTION STARTED');
    console.log('📋 Event data:', event.data);

    const {
      sessionId,
      id,
      message,
      template,
      model,
    }: {
      sessionId: string;
      id: Id<"sessions">;
      message: string;
      template: Template;
      model?: string;
    } = event.data;

    console.log('📊 Extracted data:', {
      sessionId,
      id,
      message: message?.substring(0, 50) + '...',
      template: template?.name,
      model: model || 'default'
    });

    try {
      const result = await step.run("generate code", async () => {
      // Get session data to check for environment variables
      const sessionData = await getSessionData(id);

      // Reset agentStopped flag when starting a new agent run
      // This ensures the agent can run normally after being previously stopped
      const { fetchMutation } = await import("convex/nextjs");
      const { api } = await import("@/convex/_generated/api");
      await fetchMutation(api.sessions.update, {
        id,
        agentStopped: false,
      });
      console.log(`✅ [run-agent] Reset agentStopped flag to false`);

      // Connect to existing E2B sandbox using sessionId
      console.log('📦 E2B: Connecting to existing sandbox');
      const e2bManager = new E2BManager({
        templateId: template?.image || "YOUR_E2B_TEMPLATE_ID", // Use template ID
        envVars: template?.secrets || {}
      });

      // Connect to the existing sandbox instead of creating a new one
      await e2bManager.connectToSandbox(sessionId);

      await updateSessionStatus(id, "CUSTOM", "Working on task");

      // Track the last assistant message ID for cost tracking
      let lastAssistantMessageId: Id<"messages"> | null = null;
      // Track streaming content for delta updates
      let streamingContent = "";
      // Accumulate all stdout for cost extraction
      let accumulatedStdout = "";
      // Buffer for incomplete JSON lines (stdout may be chunked mid-JSON)
      let jsonBuffer = "";

      // Create stdout/stderr handlers for E2B
      const handleStdout = async (data: string) => {
        // Capture timestamp immediately when event is received
        // This ensures correct ordering even with OCC retries
        const eventTimestamp = Date.now();

        // Always accumulate stdout for cost tracking
        accumulatedStdout += data + "\n";

        // Handle chunked JSON: stdout may split JSON across multiple chunks
        // Accumulate in buffer and try to parse complete lines
        jsonBuffer += data;

        // Try to extract complete JSON objects from the buffer
        // JSON objects from Claude Code CLI are newline-delimited
        const lines = jsonBuffer.split('\n');

        // Keep the last (potentially incomplete) line in the buffer
        jsonBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          try {
            const parsedData = JSON.parse(trimmedLine);
            await processStdoutLine(parsedData, eventTimestamp);
          } catch (parseError) {
            // Line might still be incomplete or not JSON, log and skip
            console.error("Error parsing stdout line:", parseError);
            console.log("Raw line (first 200 chars):", trimmedLine.substring(0, 200));
          }
        }
      };

      // Process a parsed stdout JSON object
      const processStdoutLine = async (parsedData: any, eventTimestamp: number) => {
        try {
          // Handle new format: {"type":"message","role":"user|assistant","content":"...","delta":true}
          if (parsedData.type === "message") {
            if (parsedData.role === "user") {
              // Extract user message content
              const userContent = typeof parsedData.content === "string"
                ? parsedData.content
                : parsedData.content?.[0]?.content || "";
              try {
                await updateSessionStatus(id, "CUSTOM", userContent);
              } catch (statusError) {
                console.warn("⚠️ Non-fatal: Failed to update session status:", statusError);
              }
            } else if (parsedData.role === "assistant") {
              try {
                await updateSessionStatus(id, "CUSTOM", "Working on task");
              } catch (statusError) {
                console.warn("⚠️ Non-fatal: Failed to update session status:", statusError);
              }
              
              // Handle streaming responses (delta: true means partial content)
              // Extract content from all text blocks, not just the first one
              let content = "";
              if (typeof parsedData.content === "string") {
                content = parsedData.content;
              } else if (Array.isArray(parsedData.content)) {
                // Concatenate all text blocks to capture interleaved text
                content = parsedData.content
                  .filter((block: { type: string }) => block.type === "text")
                  .map((block: { text: string }) => block.text)
                  .join("\n");
              }
              
              if (!content) return; // Skip if no content
              
              if (parsedData.delta === true) {
                // This is a streaming delta - accumulate content
                streamingContent += content;

                // Update or create message with accumulated content
                try {
                  if (lastAssistantMessageId) {
                    // Update existing message with accumulated content
                    const { fetchMutation } = await import("convex/nextjs");
                    const { api } = await import("@/convex/_generated/api");
                    await fetchMutation(api.messages.update, {
                      id: lastAssistantMessageId,
                      content: streamingContent,
                    });
                  } else {
                    // Create new message with initial content
                    streamingContent = content;
                    lastAssistantMessageId = await addMessage(id, streamingContent, "assistant", undefined, eventTimestamp);
                  }
                } catch (msgError) {
                  console.warn("⚠️ Non-fatal: Failed to update/create message:", msgError);
                }
              } else {
                // This is a complete message (not streaming)
                streamingContent = content; // Reset streaming content
                try {
                  lastAssistantMessageId = await addMessage(id, content, "assistant", undefined, eventTimestamp);
                } catch (msgError) {
                  console.warn("⚠️ Non-fatal: Failed to create message:", msgError);
                }
              }
            }
          }
          // Handle result type (final response)
          else if (parsedData.type === "result") {
            console.log("🟢 RESULT TYPE DETECTED");
            console.log("🟢 Status:", parsedData.status || parsedData.subtype);
            console.log("🟢 Has result field:", !!parsedData.result);

            // Don't create message here - handleMessageTracking will do it
            // This ensures only ONE message is created and we have the ID for cost tracking

            // Reset streaming content after result
            streamingContent = "";
          }
          // Ignore init type messages
          else if (parsedData.type === "init") {
            // Just log, don't process
            console.log("Agent initialized:", parsedData);
          }
          // Handle old format for backward compatibility
          else if (parsedData.type === "user") {
            try {
              await updateSessionStatus(id, "CUSTOM", parsedData.message.content[0].content);
            } catch (statusError) {
              console.warn("⚠️ Non-fatal: Failed to update session status:", statusError);
            }
          }
          else if (parsedData.type === "assistant") {
            console.log("🔵 ASSISTANT TYPE DETECTED");
            try {
              await updateSessionStatus(id, "CUSTOM", "Working on task");
            } catch (statusError) {
              console.warn("⚠️ Non-fatal: Failed to update session status:", statusError);
            }

            // Process ALL content blocks, not just the first one
            // This captures text that appears between tool calls
            const contentBlocks = parsedData.message?.content || [];
            console.log("🔵 Content blocks count:", contentBlocks.length);

            for (let i = 0; i < contentBlocks.length; i++) {
              const block = contentBlocks[i];
              console.log(`🔵 Processing block ${i}: type=${block.type}`);

              // Use eventTimestamp + small offset for each block to preserve order within same event
              const blockTimestamp = eventTimestamp + i;

              try {
                if (block.type === "text" && block.text?.trim()) {
                  // Create message for text content (including intermediate text between tool calls)
                  console.log(`🔵 Creating text message: ${block.text.substring(0, 100)}...`);
                  const textMessageId = await addMessage(id, block.text, "assistant", undefined, blockTimestamp);
                  lastAssistantMessageId = textMessageId;
                } else if (block.type === "tool_use") {
                  // Handle tool use - wrap block in expected format for handleToolUse
                  const toolMessageId = await handleToolUse(
                    { message: { content: [block] } },
                    id,
                    blockTimestamp
                  );
                  if (toolMessageId) {
                    lastAssistantMessageId = toolMessageId;
                  }
                }
              } catch (blockError) {
                console.warn(`⚠️ Non-fatal: Failed to process block ${i}:`, blockError);
              }
            }
          }
          // Handle Cursor Agent tool calls
          else if (parsedData.type === "tool_call" && parsedData.subtype === "started") {
            try {
              await updateSessionStatus(id, "CUSTOM", "Using tools...");
            } catch (statusError) {
              console.warn("⚠️ Non-fatal: Failed to update session status:", statusError);
            }
          }
          else if (parsedData.type === "tool_call" && parsedData.subtype === "completed") {
            try {
              const toolMessageId = await handleToolUse(parsedData, id, eventTimestamp);
              if (toolMessageId) {
                lastAssistantMessageId = toolMessageId;
              }
            } catch (toolError) {
              console.warn("⚠️ Non-fatal: Failed to handle tool call:", toolError);
            }
          }
        } catch (error) {
          console.error("Error processing parsed stdout:", error);
          console.log("Parsed data type:", parsedData?.type);
        }
      };

      const handleStderr = async (data: string) => {
        console.error("Agent stderr:", data);
        // Capture important error indicators for debugging
        if (data.toLowerCase().includes('error') ||
            data.includes('terminated') ||
            data.includes('SIGTERM') ||
            data.includes('SIGKILL') ||
            data.includes('killed') ||
            data.includes('exit')) {
          console.error("🔴 CRITICAL STDERR:", data);
        }
      };

      // Check if this is the first message in the session
      const existingMessages = await getSessionMessages(id);
      const assistantMessages = existingMessages.filter(msg => msg.role === "assistant");
      const isFirstMessage = assistantMessages.length === 0;

      // Get the most recent user message to check for images field
      // Images are stored in a separate 'images' field, NOT embedded in content
      const userMessages = existingMessages.filter(msg => msg.role === "user");
      const mostRecentUserMessage = userMessages[userMessages.length - 1];

      // Handle file-based system prompts (ONLY include system prompt on first message)
      let systemPrompt = "";
      if (isFirstMessage) {
        systemPrompt = template?.systemPrompt || "";
        if (systemPrompt.startsWith("FILE:")) {
          const fileName = systemPrompt.replace("FILE:", "");
          systemPrompt = getSystemPrompt(fileName);
        }
      }

      // Extract file paths from the 'images', 'audios', and 'videos' fields (preferred - not visible to users)
      // These are stored in separate database fields, not embedded in content text
      let fileInfo = "";

      // Check 'images' field from the most recent user message
      const messageImages = (mostRecentUserMessage as any)?.images || [];
      // Check 'audios' field from the most recent user message (SEPARATE FIELD)
      const messageAudios = (mostRecentUserMessage as any)?.audios || [];
      // Check 'videos' field from the most recent user message (SEPARATE FIELD)
      const messageVideos = (mostRecentUserMessage as any)?.videos || [];

      // Process images (support both old format with type and new dedicated field)
      const images = messageImages.filter((m: any) => !m.type || m.type === 'image');
      // Legacy: also check for audios/videos inside images array (old format with type field)
      const legacyAudios = messageImages.filter((m: any) => m.type === 'audio');
      const legacyVideos = messageImages.filter((m: any) => m.type === 'video');

      // Combine with dedicated fields
      const audios = [...messageAudios, ...legacyAudios];
      const videos = [...messageVideos, ...legacyVideos];

      // Add image info
      if (images.length > 0) {
        fileInfo += `\n\n# IMAGES AVAILABLE\nThe following images have been uploaded to the sandbox:`;
        for (const img of images) {
          const fileName = img.fileName || 'image';
          const path = img.path;
          if (path) {
            fileInfo += `\n- File: ${fileName}\n  Path: ${path}`;
          }
        }
        fileInfo += `\n\nIMPORTANT: Use the Read tool to analyze these images. They are located in /vibe0/assets/`;
      }

      // Add audio info
      if (audios.length > 0) {
        fileInfo += `\n\n# AUDIO FILES AVAILABLE\nThe following audio files have been uploaded to the sandbox:`;
        for (const audio of audios) {
          const fileName = audio.fileName || 'audio';
          const path = audio.path;
          if (path) {
            fileInfo += `\n- File: ${fileName}\n  Path: ${path}`;
          }
        }
        fileInfo += `\n\nThese audio files can be used in your app. They are located in /vibe0/assets/`;
      }

      // Add video info
      if (videos.length > 0) {
        fileInfo += `\n\n# VIDEO FILES AVAILABLE\nThe following video files have been uploaded to the sandbox:`;
        for (const video of videos) {
          const fileName = video.fileName || 'video';
          const path = video.path;
          if (path) {
            fileInfo += `\n- File: ${fileName}\n  Path: ${path}`;
          }
        }
        fileInfo += `\n\nThese video files can be used in your app. They are located in /vibe0/assets/`;
      }

      // LEGACY: Also extract file paths from message content if present (for backward compatibility)
      // This handles old messages where paths were embedded in content
      // iOS format: [Type: /path/to/file]
      const iosImageMatches = [...message.matchAll(/\[Image: (\/[^\]]+)\]/g)];
      const iosAudioMatches = [...message.matchAll(/\[Audio: (\/[^\]]+)\]/g)];
      const iosVideoMatches = [...message.matchAll(/\[Video: (\/[^\]]+)\]/g)];

      // Web format: [Image: filename at /path]
      const webImageMatches = [...message.matchAll(/\[Image: (.+?) at (\/[^\]]+)\]/g)];
      const webAudioMatches = [...message.matchAll(/\[Audio: (.+?) at (\/[^\]]+)\]/g)];
      const webVideoMatches = [...message.matchAll(/\[Video: (.+?) at (\/[^\]]+)\]/g)];

      // Add image info (iOS format)
      if (iosImageMatches.length > 0) {
        fileInfo += `\n\n# IMAGES AVAILABLE\nThe following images have been uploaded to the sandbox:`;
        for (const match of iosImageMatches) {
          const path = match[1];
          const fileName = path.split('/').pop() || 'image';
          fileInfo += `\n- File: ${fileName}\n  Path: ${path}`;
        }
        fileInfo += `\n\nIMPORTANT: Use the Read tool to analyze these images. They are located in /vibe0/assets/`;
      }

      // Add image info (web format)
      if (webImageMatches.length > 0) {
        if (!fileInfo.includes('IMAGES AVAILABLE')) {
          fileInfo += `\n\n# IMAGES AVAILABLE\nThe following images have been uploaded to the sandbox:`;
        }
        for (const match of webImageMatches) {
          const fileName = match[1];
          const path = match[2];
          fileInfo += `\n- File: ${fileName}\n  Path: ${path}`;
        }
        if (!fileInfo.includes('Use the Read tool')) {
          fileInfo += `\n\nIMPORTANT: Use the Read tool to analyze these images. They are located in /vibe0/assets/`;
        }
      }

      // Add audio info (iOS format)
      if (iosAudioMatches.length > 0) {
        fileInfo += `\n\n# AUDIO FILES AVAILABLE\nThe following audio files have been uploaded to the sandbox:`;
        for (const match of iosAudioMatches) {
          const path = match[1];
          const fileName = path.split('/').pop() || 'audio';
          fileInfo += `\n- File: ${fileName}\n  Path: ${path}`;
        }
        fileInfo += `\n\nThese audio files can be used in your app. They are located in /vibe0/assets/`;
      }

      // Add audio info (web format)
      if (webAudioMatches.length > 0) {
        if (!fileInfo.includes('AUDIO FILES AVAILABLE')) {
          fileInfo += `\n\n# AUDIO FILES AVAILABLE\nThe following audio files have been uploaded to the sandbox:`;
        }
        for (const match of webAudioMatches) {
          const fileName = match[1];
          const path = match[2];
          fileInfo += `\n- File: ${fileName}\n  Path: ${path}`;
        }
        if (!fileInfo.includes('audio files can be used')) {
          fileInfo += `\n\nThese audio files can be used in your app. They are located in /vibe0/assets/`;
        }
      }

      // Add video info (iOS format)
      if (iosVideoMatches.length > 0) {
        fileInfo += `\n\n# VIDEO FILES AVAILABLE\nThe following video files have been uploaded to the sandbox:`;
        for (const match of iosVideoMatches) {
          const path = match[1];
          const fileName = path.split('/').pop() || 'video';
          fileInfo += `\n- File: ${fileName}\n  Path: ${path}`;
        }
        fileInfo += `\n\nThese video files can be used in your app. They are located in /vibe0/assets/`;
      }

      // Add video info (web format)
      if (webVideoMatches.length > 0) {
        if (!fileInfo.includes('VIDEO FILES AVAILABLE')) {
          fileInfo += `\n\n# VIDEO FILES AVAILABLE\nThe following video files have been uploaded to the sandbox:`;
        }
        for (const match of webVideoMatches) {
          const fileName = match[1];
          const path = match[2];
          fileInfo += `\n- File: ${fileName}\n  Path: ${path}`;
        }
        if (!fileInfo.includes('video files can be used')) {
          fileInfo += `\n\nThese video files can be used in your app. They are located in /vibe0/assets/`;
        }
      }

      // Include system prompt only on first message
      const prompt = isFirstMessage
        ? systemPrompt + `\n\n# INSTRUCTIONS\n${message}${fileInfo}`
        : `# INSTRUCTIONS\n${message}${fileInfo}`;

      console.log("=== PROMPT SENT TO CLAUDE CODE ===");
      console.log(`First message: ${isFirstMessage}`);
      console.log(`System prompt included: ${isFirstMessage ? 'YES (first message only)' : 'NO (subsequent message)'}`);
      console.log(prompt);
      console.log("=== END PROMPT ===");

      // Get agent type from Convex globalConfig for consistency
      // Import fetchQuery here (api already imported at top of step)
      const { fetchQuery } = await import("convex/nextjs");

      // Get the session creator's billing status to determine agent type
      const clerkId = sessionData?.createdBy || 'unknown';
      const billingStatus = await fetchQuery(api.billingSwitch.getBillingStatus, { clerkId });
      const agentType = billingStatus?.agentType || 'claude';
      console.log(`🤖 Agent Type (from globalConfig): ${agentType}`);

      // PRE-FLIGHT BILLING CHECK: Ensure user has enough credits/tokens before running agent
      const MIN_CREDITS_REQUIRED = 0.10; // User-configured minimum

      if (billingStatus?.billingMode === 'credits') {
        // Credit mode check
        const creditsRemaining = billingStatus?.creditsRemaining || 0;
        // Credit cost is 4x real cost, so $0.10 min credits allows ~$0.025 API cost
        if (creditsRemaining < MIN_CREDITS_REQUIRED * 4) {
          console.error(`❌ Insufficient credits: $${creditsRemaining.toFixed(2)} < $${(MIN_CREDITS_REQUIRED * 4).toFixed(2)} required`);

          // Send error message to chat so user knows why it stopped
          const errorMessage = `⚠️ **Insufficient Credits**\n\nYou have $${creditsRemaining.toFixed(2)} credits remaining, but you need at least $${(MIN_CREDITS_REQUIRED * 4).toFixed(2)} to continue.\n\n**Upgrade to unlock:**\n• Submit apps directly to the App Store\n• Integrate real payments with one click (RevenueCat)\n• Push to GitHub automatically\n• Unlimited AI-powered app building\n\n**Go to your Profile to upgrade and start making money with your apps!**`;
          await addMessage(id, errorMessage, "assistant");
          await updateSessionStatus(id, "RUNNING");

          return { exitCode: 1, stdout: '', stderr: 'Insufficient credits' };
        }
        console.log(`✅ Credit check passed: $${creditsRemaining.toFixed(2)} available`);
      } else {
        // Token mode check
        const tokensRemaining = billingStatus?.tokensRemaining || 0;
        if (tokensRemaining <= 0) {
          console.error(`❌ No tokens remaining`);

          // Send error message to chat so user knows why it stopped
          const errorMessage = `⚠️ **No Messages Remaining**\n\nYou've used all your messages for this billing period.\n\n**Upgrade to unlock:**\n• Submit apps directly to the App Store\n• Integrate real payments with one click (RevenueCat)\n• Push to GitHub automatically\n• Unlimited AI-powered app building\n\n**Go to your Profile to upgrade and start making money with your apps!**`;
          await addMessage(id, errorMessage, "assistant");
          await updateSessionStatus(id, "RUNNING");

          return { exitCode: 1, stdout: '', stderr: 'No tokens remaining' };
        }
        console.log(`✅ Token check passed: ${tokensRemaining} tokens available`);
      }

      let response;

      // Build MCP config for Claude agent
      let mcpConfig: Record<string, any> | undefined;
      if (agentType === 'claude') {
        const mcpServers: Record<string, any> = {};

        // Always add context7 MCP for documentation lookup
        mcpServers.context7 = {
          type: "http",
          url: "https://mcp.context7.com/mcp",
          headers: {
            "CONTEXT7_API_KEY": process.env.CONTEXT7_API_KEY || ""
          }
        };
        console.log('🔌 Added context7 MCP');

        // Add RevenueCat MCP if user has it connected
        const revenuecatCredentials = await fetchQuery(api.revenuecat.getByClerkId, { clerkId });
        if (revenuecatCredentials && revenuecatCredentials.expiresAt > Date.now()) {
          console.log('🔐 RevenueCat credentials found, adding MCP config');
          mcpServers.revenuecat = {
            type: "http",
            url: "https://mcp.revenuecat.ai/mcp",
            headers: {
              "Authorization": `Bearer ${revenuecatCredentials.accessToken}`
            }
          };
        } else if (revenuecatCredentials) {
          console.log('⚠️ RevenueCat credentials expired, skipping MCP');
        }

        mcpConfig = { mcpServers };
      }

      if (agentType === 'claude') {
        console.log('🤖 EXECUTING CLAUDE COMMAND...');
        console.log(`📊 isFirstMessage: ${isFirstMessage} (${isFirstMessage ? 'NO --continue flag' : 'WITH --continue flag'})`);
        console.log(`🧠 Model: ${model || 'claude-opus-4-5-20251101 (default)'}`);
        console.log(`🔌 MCP Config: ${mcpConfig ? 'Yes (RevenueCat)' : 'No'}`);
        response = await e2bManager.executeAgent(prompt, 'claude', {
          onStdout: handleStdout,
          onStderr: handleStderr,
          isFirstMessage: isFirstMessage,
          model: model,
          mcpConfig: mcpConfig
        });
        console.log('✅ CLAUDE COMMAND COMPLETED');
      } else if (agentType === 'gemini') {
        console.log('🤖 EXECUTING GEMINI COMMAND...');
        response = await e2bManager.executeAgent(prompt, 'gemini', {
          onStdout: handleStdout,
          onStderr: handleStderr
        });
        console.log('✅ GEMINI COMMAND COMPLETED');
      } else {
        console.log('🤖 EXECUTING CURSOR AGENT COMMAND...');
        console.log(`📊 isFirstMessage: ${isFirstMessage} (${isFirstMessage ? 'NO --resume flag' : 'WITH --resume flag'})`);
        response = await e2bManager.executeAgent(prompt, 'cursor', {
          onStdout: handleStdout,
          onStderr: handleStderr,
          isFirstMessage: isFirstMessage
        });
        console.log('✅ CURSOR AGENT COMMAND COMPLETED');
      }
      console.log('📊 Response received:', {
        exitCode: response.exitCode,
        stdout: !!response.stdout,
        stderr: !!response.stderr
      });

      // Handle message tracking - pass accumulatedStdout since response.stdout may be empty
      // (E2B streams stdout via callback, not in the response object)
      console.log('📨 STARTING MESSAGE TRACKING...');
      console.log('📏 Accumulated stdout length:', accumulatedStdout.length);
      await handleMessageTracking(accumulatedStdout, id, lastAssistantMessageId);
      console.log('✅ MESSAGE TRACKING COMPLETED');

      return response;
    });

    await step.run("update session", async () => {
      await updateSessionStatus(id, "RUNNING");
    });

    // Auto-push to GitHub if configured
    await step.run("auto-push to github", async () => {
      const sessionData = await getSessionData(id);

      // Only auto-push if GitHub repo exists and not already pushing
      // Token is now fetched from Convex in the push function
      if (
        sessionData?.githubRepository &&
        sessionData.githubPushStatus !== "in_progress"
      ) {
        console.log("🔄 AUTO-PUSH: Triggering GitHub push for", sessionData.githubRepository);

        await inngest.send({
          name: "vibracode/push.github",
          data: {
            sessionId,
            convexId: id,
            repository: sessionData.githubRepository,
            isInitialPush: false,
          },
        });
      }
    });

    return result;
    } catch (error) {
      // Log the error - onFailure handler will take care of user messaging
      // This catch handles errors thrown WITHIN the function
      // External timeouts (process killed) are handled by onFailure
      console.error('❌ RUN AGENT ERROR:', error);
      throw error; // Re-throw to trigger onFailure handler
    }
  }
);

async function handleToolUse(data: any, sessionId: Id<"sessions">, createdAt?: number): Promise<Id<"messages"> | null> {
  // Handle Cursor Agent tool format
  if (data.tool_call) {
    const toolCall = data.tool_call;
    const toolName = Object.keys(toolCall)[0]; // Get the first (and usually only) key

    switch (toolName) {
      case "updateTodosToolCall":
        const todos = toolCall[toolName].args.todos.map((todo: any, index: number) => ({
          content: todo.content,
          id: todo.id || `todo-${index + 1}`,
          priority: "medium",
          status: todo.status === "TODO_STATUS_COMPLETED" ? "completed" :
                  todo.status === "TODO_STATUS_IN_PROGRESS" ? "in_progress" : "pending",
        }));

        return await addMessage(sessionId, "", "assistant", { todos }, createdAt);

      case "writeToolCall":
        return await addMessage(sessionId, "", "assistant", {
          edits: {
            filePath: toolCall[toolName].args.path,
            oldString: "",
            newString: toolCall[toolName].args.fileText,
          },
        }, createdAt);

      case "editToolCall":
        return await addMessage(sessionId, "", "assistant", {
          edits: {
            filePath: toolCall[toolName].args.path,
            oldString: toolCall[toolName].args.oldText || "",
            newString: toolCall[toolName].args.newText || "",
          },
        }, createdAt);

      case "readToolCall":
        return await addMessage(sessionId, "", "assistant", {
          read: {
            filePath: toolCall[toolName].args.path,
          },
        }, createdAt);

      case "shellToolCall":
        return await addMessage(sessionId, "", "assistant", {
          bash: {
            command: toolCall[toolName].args.command,
            output: toolCall[toolName].result?.success?.stdout || toolCall[toolName].result?.rejected?.reason || "",
            exitCode: toolCall[toolName].result?.success?.exitCode ?? 0,
          },
        }, createdAt);

      case "lsToolCall":
        return await addMessage(sessionId, "", "assistant", {
          bash: {
            command: `ls ${toolCall[toolName].args.path}`,
            output: JSON.stringify(toolCall[toolName].result?.success?.directoryTreeRoot || {}),
            exitCode: 0,
          },
        }, createdAt);

      case "grepToolCall":
        return await addMessage(sessionId, "", "assistant", {
          grep: {
            pattern: toolCall[toolName].args.pattern,
            filePath: toolCall[toolName].args.path,
            matches: (toolCall[toolName].result?.success?.output?.split('\n') || []).filter((line: string) => line.trim()),
            lineCount: toolCall[toolName].result?.success?.output?.split('\n').length || 0,
          },
        }, createdAt);

      case "globToolCall":
        return await addMessage(sessionId, "", "assistant", {
          tool: {
            toolName: "glob",
            command: `find . -name "${toolCall[toolName].args.globPattern}"`,
            output: toolCall[toolName].result?.success?.files?.join('\n') || toolCall[toolName].result?.error?.errorMessage || "",
            exitCode: toolCall[toolName].result?.success ? 0 : 1,
            status: toolCall[toolName].result?.success ? "success" : "error",
          },
        }, createdAt);

      case "semSearchToolCall":
        return await addMessage(sessionId, "", "assistant", {
          codebaseSearch: {
            query: toolCall[toolName].args.query,
            results: toolCall[toolName].result?.success?.results || toolCall[toolName].result?.error?.errorMessage || "Semantic search not available",
            targetDirectories: toolCall[toolName].args.targetDirectories || [],
          },
        }, createdAt);

      case "deleteToolCall":
        return await addMessage(sessionId, "", "assistant", {
          tool: {
            toolName: "delete",
            command: `rm ${toolCall[toolName].args.path}`,
            output: toolCall[toolName].result?.success ? "File deleted successfully" : toolCall[toolName].result?.rejected?.reason || "Failed to delete file",
            exitCode: toolCall[toolName].result?.success ? 0 : 1,
            status: toolCall[toolName].result?.success ? "success" : "error",
          },
        }, createdAt);

      // Handle additional tools that might come from Cursor Agent
      case "codebaseSearchToolCall":
        return await addMessage(sessionId, "", "assistant", {
          codebaseSearch: {
            query: toolCall[toolName].args.query || toolCall[toolName].args.searchQuery || "",
            results: toolCall[toolName].result?.success?.results || toolCall[toolName].result?.error?.errorMessage || "",
            targetDirectories: toolCall[toolName].args.targetDirectories || [],
          },
        }, createdAt);

      case "searchReplaceToolCall":
        return await addMessage(sessionId, "", "assistant", {
          searchReplace: {
            filePath: toolCall[toolName].args.filePath || toolCall[toolName].args.path || "",
            oldString: toolCall[toolName].args.oldString || toolCall[toolName].args.oldText || "",
            newString: toolCall[toolName].args.newString || toolCall[toolName].args.newText || "",
            replacements: toolCall[toolName].result?.success?.replacements || 1,
          },
        }, createdAt);

      default:
        return null;
    }
  }

  // Handle Claude format (fallback)
  const toolName = data.message.content[0].name;

  switch (toolName) {
    case "TodoWrite":
      const todosWithRequiredFields = data.message.content[0].input.todos.map((todo: { content: string; status: string; activeForm?: string }, index: number) => ({
        content: todo.content,
        id: `todo-${index + 1}`,
        priority: "medium",
        status: todo.status,
      }));

      return await addMessage(sessionId, "", "assistant", { todos: todosWithRequiredFields }, createdAt);
    case "Write":
      return await addMessage(sessionId, "", "assistant", {
        edits: {
          filePath: data.message.content[0].input.file_path,
          oldString: "",
          newString: data.message.content[0].input.content,
        },
      }, createdAt);
    case "Edit":
      return await addMessage(sessionId, "", "assistant", {
        edits: {
          filePath: data.message.content[0].input.file_path,
          oldString: data.message.content[0].input.old_string,
          newString: data.message.content[0].input.new_string,
        },
      }, createdAt);
    case "Read":
      return await addMessage(sessionId, "", "assistant", {
        read: {
          filePath: data.message.content[0].input.file_path,
        },
      }, createdAt);
    case "Bash":
    case "bash":
      return await addMessage(sessionId, "", "assistant", {
        bash: {
          command: data.message.content[0].input.command,
          output: data.message.content[0].input.description || "",
          exitCode: 0,
        },
      }, createdAt);
    case "WebSearch":
    case "webSearch":
      return await addMessage(sessionId, "", "assistant", {
        webSearch: {
          query: data.message.content[0].input.query,
          results: data.message.content[0].input.results || "",
        },
      }, createdAt);
    default:
      // Handle MCP tool calls (any tool name not in the known list)
      // MCP tools have format: mcp_servername__toolname or just unknown tool names
      const mcpToolName = data.message.content[0].name;
      const mcpInput = data.message.content[0].input;

      console.log(`🔌 MCP Tool detected: ${mcpToolName}`);

      return await addMessage(sessionId, "", "assistant", {
        mcpTool: {
          toolName: mcpToolName,
          input: mcpInput,
          output: null, // Will be updated when tool result comes back
          status: "running",
        },
      }, createdAt);
  }
}

async function handleMessageTracking(stdout: string, sessionId: Id<"sessions">, messageId?: Id<"messages"> | null) {
  console.log('📨 MESSAGE TRACKING: Starting message tracking...');
  console.log('📊 Stdout length:', stdout.length);
  console.log('🆔 Provided message ID:', messageId);

  try {
    const sessionData = await getSessionData(sessionId);
    const clerkId = sessionData?.createdBy || 'unknown';

    console.log('👤 Clerk ID:', clerkId);

    // Import here to avoid circular dependencies
    const { fetchMutation, fetchQuery } = await import("convex/nextjs");
    const { api } = await import("@/convex/_generated/api");

    // Get billing status from Convex (uses globalConfig for agent type)
    // This ensures consistency with the billing system
    const billingStatus = await fetchQuery(api.billingSwitch.getBillingStatus, { clerkId });
    const agentType = billingStatus?.agentType || 'claude';
    const billingMode = billingStatus?.billingMode || 'tokens';
    console.log('🤖 Agent Type (from globalConfig):', agentType, 'Billing Mode:', billingMode);

    // For Claude mode, if no messageId was provided, create message from result
    let finalMessageId = messageId;
    if (agentType === 'claude' && !finalMessageId && stdout) {
      console.log('📝 Creating message from stdout result...');
      // Parse stdout to find the result line with content
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('"type":"result"') && line.includes('"result"')) {
          try {
            const result = JSON.parse(line);
            if (result.result && typeof result.result === "string" && result.result.trim()) {
              console.log('📝 Found result content:', result.result?.substring(0, 100));
              finalMessageId = await addMessage(sessionId, result.result, "assistant");
              console.log('📝 Created message ID:', finalMessageId);
            }
          } catch (parseError) {
            console.error('Error parsing result line for message:', parseError);
          }
          break;
        }
      }
    }

    if (billingMode === 'tokens') {
      // TOKEN MODE: Consume 1 token per message
      console.log('💳 TOKEN MODE: Consuming 1 token...');

      const remainingMessages = await fetchMutation(api.usage.consumeMessage, {
        clerkId: clerkId,
      });

      console.log('✅ Token consumed, remaining:', remainingMessages);

      // Still track costs for internal monitoring (but don't deduct credits)
      if (stdout && finalMessageId) {
        console.log('💰 Tracking costs for internal monitoring...');

        const costData = await fetchMutation(api.costs.updateMessageCost, {
          messageId: finalMessageId,
          stdout: stdout,
        });

        console.log('💵 Cost data tracked:', costData);
      }
    } else {
      // CREDIT MODE: Track cost and deduct credits based on actual Claude API cost
      console.log('💳 CREDIT MODE: Tracking cost and deducting credits...');

      // Fallback cost when extraction fails - ensures users always pay something
      const FALLBACK_COST_USD = 0.01;
      let costExtracted = false;

      if (stdout) {
        // Extract cost data from stdout
        console.log('💰 Extracting cost data from stdout...');

        if (finalMessageId) {
          // We have a message ID - update the message with cost data
          const costData = await fetchMutation(api.costs.updateMessageCost, {
            messageId: finalMessageId,
            stdout: stdout,
          });

          console.log('💵 Cost data extracted:', costData);

          // If we got cost data, deduct credits
          if (costData && costData.totalCostUSD > 0) {
            console.log(`💸 Deducting credits for cost: $${costData.totalCostUSD.toFixed(4)}`);
            costExtracted = true;

            const result = await fetchMutation(api.credits.deductCreditsForMessage, {
              clerkId: clerkId,
              messageCostUSD: costData.totalCostUSD,
              messageId: finalMessageId,
            });

            console.log('✅ Credits deducted:', result);
          }
        } else {
          // No message ID - extract cost manually and deduct credits at user level
          console.log('⚠️ No message ID, extracting cost manually...');

          // Parse stdout to find the result line with cost
          const lines = stdout.split('\n');
          for (const line of lines) {
            if (line.includes('"type":"result"') && line.includes('total_cost_usd')) {
              try {
                const result = JSON.parse(line);
                if (result.total_cost_usd && result.total_cost_usd > 0) {
                  console.log(`💵 Found cost in result: $${result.total_cost_usd}`);
                  costExtracted = true;

                  // Deduct credits without message ID
                  const deductResult = await fetchMutation(api.credits.deductCredits, {
                    clerkId: clerkId,
                    amountUSD: result.total_cost_usd,
                    reason: 'claude_api_cost',
                  });

                  console.log('✅ Credits deducted (no message):', deductResult);
                }
              } catch (parseError) {
                console.error('Error parsing result line:', parseError);
              }
              break;
            }
          }
        }
      }

      // FALLBACK: If no cost was extracted, charge a minimum fallback cost
      // This prevents users from getting free usage when cost extraction fails
      if (!costExtracted) {
        console.log(`⚠️ No cost data extracted, charging fallback cost: $${FALLBACK_COST_USD}`);
        try {
          const fallbackResult = await fetchMutation(api.credits.deductCredits, {
            clerkId: clerkId,
            amountUSD: FALLBACK_COST_USD,
            reason: 'fallback_cost_extraction_failed',
          });
          console.log('✅ Fallback cost charged:', fallbackResult);
        } catch (fallbackError) {
          console.error('❌ Failed to charge fallback cost:', fallbackError);
        }
      }
    }

  } catch (error) {
    console.error('💥 Message tracking error:', error);
    console.error('📋 Error details:', error instanceof Error ? error.message : 'Unknown error');
  }
}
