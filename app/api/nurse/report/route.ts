import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = "Patient";
const collectionName = "cloudinary_report";

let cachedClient: MongoClient | null = null;
async function connectToDB() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

// POST: Save report PDF URLs for a visitNo and branch
export async function POST(req: NextRequest) {
  try {
    const { visitNo, branch, reports, reportNote } = await req.json();
    if (!visitNo || !branch || !reports || !Array.isArray(reports) || reports.length === 0) {
      return NextResponse.json({ error: "Missing visitNo, branch, or reports" }, { status: 400 });
    }
    const client = await connectToDB();
    const db = client.db(dbName);
    const cloudinaryReport = db.collection(collectionName);
    const now = new Date();
    // Insert each report as a single document with note included
    const docs = reports.map((url: string) => {
      const doc: any = { visitNo, branch, url, uploadedAt: now };
      // Add note to the same document if provided
      if (reportNote && reportNote.trim()) {
        doc.note = reportNote.trim();
        doc.noteAddedAt = now;
      }
      return doc;
    });
    await cloudinaryReport.insertMany(docs);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save report reference" }, { status: 500 });
  }
}

// GET: Return last 3 report PDFs for a visitNo and branch
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const visitNo = searchParams.get("visitNo");
    const branch = searchParams.get("branch");
    if (!visitNo || !branch) {
      return NextResponse.json({ error: "Missing visitNo or branch" }, { status: 400 });
    }
    const client = await connectToDB();
    const db = client.db(dbName);
    const cloudinaryReport = db.collection(collectionName);
    // Find last 3 reports for this visitNo and branch, sorted by uploadedAt descending
    const reports = await cloudinaryReport
      .find({ visitNo, branch, url: { $exists: true } })
      .sort({ uploadedAt: -1 })
      .limit(3)
      .toArray();
    // Notes are now embedded in each report document
    // Return URLs and notes
    return NextResponse.json({ reports: reports.map(r => ({ url: r.url, note: r.note || null })) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
} 