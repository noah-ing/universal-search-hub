import { NextResponse } from 'next/server';
import { performVectorSearch } from '../../../lib/search-service';

export async function POST(request: Request) {
  try {
    const { vector } = await request.json();

    if (!Array.isArray(vector) || vector.some(v => typeof v !== 'number')) {
      return NextResponse.json(
        { error: 'Invalid vector format. Expected array of numbers.' },
        { status: 400 }
      );
    }

    const maxResults = parseInt(process.env.MAX_SEARCH_RESULTS || '10');
    const results = await performVectorSearch(vector, maxResults);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
