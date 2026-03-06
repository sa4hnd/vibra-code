import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const storageId = searchParams.get('storageId');

    if (!storageId) {
      return NextResponse.json(
        { error: 'Storage ID is required' },
        { status: 400 }
      );
    }

    const url = await convex.query(api.files.getDownloadUrl, {
      storageId: storageId as Id<'_storage'>,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error getting file URL:', error);
    return NextResponse.json(
      { error: 'Failed to get file URL' },
      { status: 500 }
    );
  }
}
