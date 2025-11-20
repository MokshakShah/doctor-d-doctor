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
  const name = searchParams.get('name');
  if (!name) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }
  const client = await connectToDB();
  const db = client.db(dbName);
  const regex = new RegExp(name, 'i');
  const results: Record<string, { name: string, visits: any[], locations: Set<string> }> = {};

  for (const [location, collectionName] of Object.entries(locationCollections)) {
    const patients = db.collection(collectionName);
    const matches = await patients.find({ name: regex }).toArray();
    for (const match of matches) {
      if (!results[match.name]) {
        results[match.name] = { name: match.name, visits: [], locations: new Set() };
      }
      results[match.name].visits.push({ ...match, location });
      results[match.name].locations.add(location);
    }
  }

  // Convert locations Set to Array for each patient
  const response = Object.values(results).map(p => ({
    name: p.name,
    locations: Array.from(p.locations),
    visits: p.visits,
  }));

  return NextResponse.json({ patients: response });
} 