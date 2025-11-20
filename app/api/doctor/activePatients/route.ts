import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = 'Patient';
const locationCollections = {
  Bhayander: 'Patients_history_bhayander',
  Borivali: 'Patients_history_borivali',
  Malad: 'Patients_history_malad',
};

let cachedClient: MongoClient | null = null;
async function connectToDB() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get('branch');
  const client = await connectToDB();
  const db = client.db(dbName);

  if (branch && locationCollections[branch]) {
    // Return count for a specific branch
    const count = await db.collection(locationCollections[branch]).countDocuments();
    return NextResponse.json({ branch, count });
  } else {
    // Return total and per-branch counts
    const results: Record<string, number> = {};
    let total = 0;
    for (const [branchName, collectionName] of Object.entries(locationCollections)) {
      const count = await db.collection(collectionName).countDocuments();
      results[branchName] = count;
      total += count;
    }
    return NextResponse.json({ total, perBranch: results });
  }
} 