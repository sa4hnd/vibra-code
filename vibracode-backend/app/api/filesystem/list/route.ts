import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "e2b";

export async function POST(request: NextRequest) {
  try {
    const { path, depth = 1, sessionId } = await request.json() as {
      path: string;
      depth?: number;
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
    console.log(`Listing directory: ${path}`);

    // Connect to the E2B sandbox using the SDK
    const sandbox = await Sandbox.connect(sessionId);
    
    // Use the E2B SDK filesystem methods
    const files = await sandbox.files.list(path);
    console.log(`Found ${files.length} files/directories`);
    console.log('Sample file object:', files[0]);

    // Transform the files to match our expected format
    const entries = files.map((file: any) => {
      // Debug the file object structure
      console.log('File object:', {
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory,
        is_dir: file.is_dir,
        type: file.type,
        size: file.size,
        modifiedAt: file.modifiedAt
      });
      
      // Try different ways to detect directories based on E2B API versions
      const isDir = file.isDirectory ||           // v1.x API
                   file.is_dir ||                 // v2.x API  
                   file.type === 'directory' ||   // Some versions use string type
                   file.type === 'dir';           // Some versions use 'dir'
      
      return {
        name: file.name,
        path: file.path,
        type: isDir ? "dir" : "file",
        size: file.size || 0,
        lastModified: file.modifiedAt || new Date().toISOString(),
      };
    });

    return NextResponse.json({ entries });

  } catch (error) {
    console.error("Error listing directory:", error);
    return NextResponse.json(
      { 
        error: "Failed to list directory", 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
