import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storageId = searchParams.get('storageId');

    if (!storageId) {
      return NextResponse.json({ error: 'Storage ID is required' }, { status: 400 });
    }

    // Get the URL from Convex storage
    const url = await convex.query(api.messages.getStorageUrl, {
      storageId: storageId as Id<"_storage">
    });

    if (!url) {
      return NextResponse.json({ error: 'Storage URL not found' }, { status: 404 });
    }

    return NextResponse.json({ url });

  } catch (error) {
    console.error('Error getting storage URL:', error);
    return NextResponse.json(
      { error: 'Failed to get storage URL' },
      { status: 500 }
    );
  }
}
