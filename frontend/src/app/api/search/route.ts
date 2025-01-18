import { NextResponse } from 'next/server';

// TODO: Import actual search function from backend
const mockSearch = async (vector: number[]): Promise<Array<{ vector: number[], similarity: number }>> => {
  // This is a mock implementation that will be replaced with actual backend integration
  return Array.from({ length: 5 }, (_, i) => ({
    vector: Array.from({ length: vector.length }, () => Math.random() * 2 - 1),
    similarity: Math.pow(0.9, i) // Decreasing similarity scores
  }));
};

export async function POST(request: Request) {
  try {
    const { vector } = await request.json();

    if (!Array.isArray(vector) || vector.some(v => typeof v !== 'number')) {
      return NextResponse.json(
        { error: 'Invalid vector format. Expected array of numbers.' },
        { status: 400 }
      );
    }

    // TODO: Replace with actual backend call
    const results = await mockSearch(vector);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
