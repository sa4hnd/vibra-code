import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for iframe previews that strips X-Frame-Options headers
 * This allows Expo web apps to be embedded in iframes
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
  }

  try {
    // Validate URL
    const targetUrl = new URL(url);

    // Only allow certain domains for security
    const allowedPatterns = [
      /\.e2b\.dev$/,
      /\.northflank\.app$/,
      /localhost/,
      /127\.0\.0\.1/,
    ];

    const isAllowed = allowedPatterns.some(pattern => pattern.test(targetUrl.hostname));
    if (!isAllowed) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }

    // Fetch the content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream error: ${response.status}` }, { status: response.status });
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'text/html';

    // Get the body
    const body = await response.text();

    // Inject base tag to fix relative URLs
    let modifiedBody = body;
    if (contentType.includes('text/html')) {
      // Add base tag after <head> to fix relative URLs
      modifiedBody = body.replace(
        /<head([^>]*)>/i,
        `<head$1><base href="${targetUrl.origin}/">`
      );
    }

    // Create response with modified headers (no X-Frame-Options)
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Access-Control-Allow-Origin', '*');
    // Explicitly allow framing
    headers.set('X-Frame-Options', 'ALLOWALL');
    headers.set('Content-Security-Policy', "frame-ancestors *");

    return new NextResponse(modifiedBody, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Proxy error' },
      { status: 500 }
    );
  }
}
