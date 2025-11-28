import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
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
    // Consolidate images and note into single documents
    let inserted = 0;
    for (const url of images) {
      const exists = await cloudinary.findOne({ visitNo, branch, url });
      if (!exists) {
        const doc: Record<string, unknown> = { visitNo, branch, url, uploadedAt: now };
        // Add note to the same document if provided
        if (note && note.trim().length > 0) {
          doc.note = note.trim();
          doc.noteAddedAt = now;
        }
        await cloudinary.insertOne(doc);
        inserted++;
      }
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
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
    return NextResponse.json({ images: images.map((img: Record<string, unknown>) => img.url) });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

// DELETE: Remove a prescription image from MongoDB and Cloudinary
export async function DELETE(req: NextRequest) {
  try {
    const { url, visitNo, branch } = await req.json();
    if (!url || !visitNo || !branch) {
      return NextResponse.json({ error: "Missing url, visitNo, or branch" }, { status: 400 });
    }

    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{ext}
    const urlParts = url.split('/');
    const fileWithExt = urlParts[urlParts.length - 1]; // e.g., "D-D-00000001_Bor_01.jpg"
    const publicId = fileWithExt.split('.')[0]; // Remove extension

    // Delete from Cloudinary
    const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret) {
      try {
        const crypto = await import('crypto');
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = crypto
          .createHash('sha1')
          .update(`public_id=${publicId}&timestamp=${timestamp}${cloudinaryApiSecret}`)
          .digest('hex');

        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('timestamp', timestamp.toString());
        formData.append('api_key', cloudinaryApiKey);
        formData.append('signature', signature);

        await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/destroy`, {
          method: 'POST',
          body: formData,
        });
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
        // Continue to delete from MongoDB even if Cloudinary fails
      }
    }

    // Delete from MongoDB
    const client = await connectToDB();
    const db = client.db(dbName);
    const cloudinaryCollection = db.collection(collectionName);
    
    const result = await cloudinaryCollection.deleteOne({ visitNo, branch, url });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Image not found in database" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
} 