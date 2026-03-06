import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { templates } from '@/config';
import { getGitHubToken } from '@/lib/auth/clerk';
import { createErrorResponse, handleApiError, validateRequiredFields } from '@/lib/api/error-handler';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { sessionId, message, templateId, repository, userId } = body;

    // Validate required fields using shared utility
    const validationError = validateRequiredFields(body, ['sessionId', 'userId']);
    if (validationError) {
      return createErrorResponse(validationError, 400);
    }

    // Resolve template from templateId (same as v0-clone does)
    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      return createErrorResponse(`Template with id "${templateId}" not found`, 400);
    }

    console.log('Creating session for user:', userId, 'with sessionId:', sessionId, 'template:', template.name);

    // Get GitHub OAuth access token from Clerk using shared utility
    let githubToken = "";
    try {
      githubToken = await getGitHubToken(userId);
      console.log('GitHub token found:', githubToken ? 'Yes' : 'No');
    } catch (error) {
      console.error("Error getting GitHub OAuth token:", error);
      // Continue without token - will be handled in the Inngest function
    }

    // Send the Inngest event directly (same as createSessionAction does)
    // This bypasses the createSessionAction function that relies on server-side auth
    const { inngest } = await import('@/lib/inngest');
    
    await inngest.send({
      name: "vibracode/create.session",
      data: {
        sessionId,
        message,
        repository,
        token: githubToken,
        template,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Session creation started',
    });

  } catch (error) {
    console.error('Error in create-session API:', error);
    return handleApiError(error);
  }
}
