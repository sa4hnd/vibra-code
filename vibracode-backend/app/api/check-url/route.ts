import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url } = body;

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL format
  let validUrl: string;
  try {
    // If URL doesn't start with protocol, assume it's an E2B sandbox ID
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Check if it looks like an E2B sandbox ID
      if (url.includes('-') && url.includes('6532622b')) {
        validUrl = `https://3000-${url}.e2b.dev`;
      } else {
        // For other non-URL strings, return false without error
        return NextResponse.json({ 
          available: false, 
          error: "Invalid URL format" 
        }, { status: 400 });
      }
    } else {
      validUrl = url;
    }
  } catch (error) {
    return NextResponse.json({ 
      available: false, 
      error: "Invalid URL format" 
    }, { status: 400 });
  }

  console.log("Checking URL", validUrl);

  try {
    const response = await fetch(validUrl);
    console.log("Response", response.status);
    const available = response.status >= 200 && response.status < 400;
    return NextResponse.json({ available });
  } catch (error) {
    console.error("Error fetching URL:", error);
    return NextResponse.json(
      {
        available: false,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
