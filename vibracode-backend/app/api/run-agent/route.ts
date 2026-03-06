import { NextRequest, NextResponse } from 'next/server';
import { runAgentAction } from "@/app/actions/vibrakit";
import { createErrorResponse, handleApiError, validateRequiredFields } from "@/lib/api/error-handler";
import { templates } from '@/config';
import { getGitHubToken } from '@/lib/auth/clerk';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('📝 Run-agent API request body:', JSON.stringify(body, null, 2));
    
    const { sessionId, id, message, templateId, repository, token, model } = body;

    // Validate required fields using shared utility
    const validationError = validateRequiredFields(body, ['sessionId', 'id', 'message']);
    if (validationError) {
      return createErrorResponse(validationError, 400);
    }

    // Resolve template from templateId or repository
    let template;
    if (templateId) {
      template = templates.find((t) => t.id === templateId);
      console.log('🔍 Looking for template with ID:', templateId, 'Found:', template?.name);
    } else {
      // For Expo Go app or when no templateId is provided, default to expo template
      template = templates.find((t) => t.id === 'expo');
      console.log('🔍 Using default expo template:', template?.name);
    }
    
    if (!template) {
      console.error('❌ Template not found for templateId:', templateId);
      return createErrorResponse(`Template not found for templateId: ${templateId}`, 400);
    }

    // Get GitHub token if not provided (for Expo Go app)
    let githubToken = token || '';
    if (!githubToken) {
      try {
        // Try to get token from Clerk - this will work if user is authenticated
        githubToken = await getGitHubToken();
        console.log('🔑 Retrieved GitHub token from Clerk');
      } catch (error) {
        console.log('⚠️ No GitHub token available, proceeding without token:', error);
        // Continue without token - the Inngest function will handle this
        githubToken = '';
      }
    }

    console.log('Running agent with sessionId:', sessionId, 'message:', message, 'model:', model);

    // Use Server Action for agent execution logic
    await runAgentAction({
      sessionId,
      id,
      message,
      template,
      repository,
      token: githubToken,
      model,
    });

    return NextResponse.json({
      success: true,
      sessionId,
      messageId: id,
      message: 'Agent execution started',
    });

  } catch (error) {
    console.error('Error in run-agent API:', error);
    return handleApiError(error);
  }
}
