import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

const uri = "mongodb://127.0.0.1:27017";
const dbName = "Patient";
const collectionName = "cloudinary";

let cachedClient: MongoClient | null = null;
async function connectToDB() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

// POST: Save prescription image URLs for a visitNo and branch
export async function POST(req: NextRequest) {
  try {
    const { visitNo, branch, images, note, nextAppointmentDate } = await req.json();
    if (!visitNo || !branch || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "Missing visitNo, branch, or images" }, { status: 400 });
    }
    const client = await connectToDB();
    const db = client.db(dbName);
    const cloudinary = db.collection(collectionName);
    const now = new Date();
    // Insert only new images (prevent duplicates)
    let inserted = 0;
    for (const url of images) {
      const exists = await cloudinary.findOne({ visitNo, branch, url });
      if (!exists) {
        await cloudinary.insertOne({ visitNo, branch, url, uploadedAt: now });
        inserted++;
      }
    }
    // Save optional prescription note to a separate collection
    if (note && note.trim().length > 0) {
      const meta = db.collection('prescription_meta');
      await meta.insertOne({ visitNo, branch, note: note.trim(), createdAt: now });
    }

    // If nextAppointmentDate provided, create a followup document for reminders
    if (nextAppointmentDate) {
      try {
        const followups = db.collection('followups');
        const parsed = new Date(nextAppointmentDate);
        if (!isNaN(parsed.getTime())) {
          const remindAt = new Date(parsed.getTime() - 7 * 24 * 60 * 60 * 1000); // one week before

          // Try to fetch patient contact from patients history based on branch mapping
          const branchMap: Record<string, string> = { Bor: 'Patients_history_borivali', Mal: 'Patients_history_malad', Bhy: 'Patients_history_bhayander' };
          const patientsCollectionName = branchMap[branch] || null;
          let contact = null;
          if (patientsCollectionName) {
            try {
              const patients = db.collection(patientsCollectionName);
              const patient = await patients.findOne({ visitNo });
              if (patient && patient.contact) contact = patient.contact;
            } catch (err) {
              console.error('Error fetching patient for followup contact:', err);
            }
          }

          await followups.insertOne({ visitNo, branch, nextAppointmentDate: parsed, remindAt, contact: contact || null, createdAt: now, sentAt: null });
        }
      } catch (err) {
        console.error('Error creating followup:', err);
      }
    }
    return NextResponse.json({ success: true, inserted });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save image reference" }, { status: 500 });
  }
}

// GET: Return last 3 prescription images for a visitNo and branch
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
    const cloudinary = db.collection(collectionName);
    // Find last 3 images for this visitNo and branch, sorted by uploadedAt descending
    const images = await cloudinary
      .find({ visitNo, branch })
      .sort({ uploadedAt: -1 })
      .limit(3)
      .toArray();
    // Return only the URLs
    return NextResponse.json({ images: images.map(img => img.url) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
} 