/**
 * Shared API Error Handling Utilities
 * Consistent error handling patterns across the application
 */

import { NextResponse } from 'next/server';

export interface ApiError {
  error: string;
  details?: string;
  status: number;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  details?: string
): NextResponse {
  const errorResponse: ApiError = {
    error: message,
    status,
  };

  if (details) {
    errorResponse.details = details;
  }

  return NextResponse.json(errorResponse, { status });
}

/**
 * Handle common API errors
 */
export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('not authenticated')) {
      return createErrorResponse('Authentication required', 401);
    }
    
    if (error.message.includes('not found')) {
      return createErrorResponse('Resource not found', 404);
    }
    
    if (error.message.includes('validation')) {
      return createErrorResponse('Invalid request data', 400);
    }
    
    return createErrorResponse('Internal server error', 500, error.message);
  }

  return createErrorResponse('Unknown error occurred', 500);
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): string | null {
  for (const field of requiredFields) {
    if (!body[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

