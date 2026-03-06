import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "e2b";

export async function POST(request: NextRequest) {
  try {
    const { path, format = "text", sessionId } = await request.json() as {
      path: string;
      format?: string;
      sessionId: string;
    };

    if (!path) {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    console.log(`Connecting to E2B sandbox: ${sessionId}`);
    console.log(`Reading file: ${path} (format: ${format})`);

    // Connect to the E2B sandbox using the SDK
    const sandbox = await Sandbox.connect(sessionId);

    // Check if file is an image and format is base64
    const isImage = /\.(png|jpg|jpeg|gif|webp|bmp|ico)$/i.test(path);
    const isSvg = path.toLowerCase().endsWith('.svg');

    if (isImage && format === "base64" && !isSvg) {
      // Use bash command to read binary file as base64
      const result = await sandbox.commands.run(`base64 -w 0 "${path}"`);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to read image: ${result.stderr}`);
      }

      const base64 = result.stdout.trim();
      console.log(`Read image file as base64 (${base64.length} characters)`);
      return NextResponse.json({ content: base64, isBase64: true });
    } else {
      // Use the E2B SDK filesystem methods for text files (including SVG)
      const content = await sandbox.files.read(path);
      console.log(`Read file content (${content.length} characters)`);
      return NextResponse.json({ content });
    }

  } catch (error) {
    console.error("Error reading file:", error);
    return NextResponse.json(
      {
        error: "Failed to read file",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
