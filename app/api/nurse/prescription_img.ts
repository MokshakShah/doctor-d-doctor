import { NextRequest, NextResponse } from 'next/server';

// TODO: Replace with actual DB logic
// Use a composite key of visitNo and branch
const prescriptionImages: Record<string, string[]> = {};

export async function POST(req: NextRequest) {
  try {
    const { visitNo, branch, images } = await req.json();
    if (!visitNo || !branch || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Missing visitNo, branch, or images' }, { status: 400 });
    }
    const key = `${visitNo}__${branch}`;
    if (!prescriptionImages[key]) {
      prescriptionImages[key] = [];
    }
    prescriptionImages[key].push(...images);
    // In real implementation, save to DB here
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// For doctor: get last 3 prescription images for a visit number and branch
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const visitNo = searchParams.get('visitNo');
  const branch = searchParams.get('branch');
  if (!visitNo || !branch) {
    return NextResponse.json({ error: 'Missing visitNo or branch' }, { status: 400 });
  }
  const key = `${visitNo}__${branch}`;
  const imgs = prescriptionImages[key] || [];
  // Return last 3 images (most recent first)
  return NextResponse.json({ images: imgs.slice(-3).reverse() });
} 