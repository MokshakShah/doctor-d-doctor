import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = 'mongodb://127.0.0.1:27017';
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

function generateVisitNo(lastNo: string | null) {
  let num = 1;
  if (lastNo && /^D-\d{8}$/.test(lastNo)) {
    num = parseInt(lastNo.slice(2), 10) + 1;
  }
  return `D-${num.toString().padStart(8, '0')}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const branch = body.branch;
  const collectionName = locationCollections[branch];
  if (!collectionName) {
    return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
  }
  const client = await connectToDB();
  const db = client.db(dbName);
  const patients = db.collection(collectionName);
  // Find last visit number in this collection
  const last = await patients.find().sort({ visitNo: -1 }).limit(1).toArray();
  const lastNo = last.length > 0 ? last[0].visitNo : null;
  const visitNo = generateVisitNo(lastNo);
  const patient = {
    visitNo,
    name: body.name,
    age: body.age,
    gender: body.gender,
    contact: body.contact,
    medicalConditions: body.medicalConditions,
    allergy: body.allergy,
    familyHistory: body.familyHistory,
    appointments: [
      {
        clinic: branch + ' Clinic',
        location: branch,
        date: body.date,
        time: body.time,
        payment: 'cash',
      },
    ],
    createdAt: new Date(),
  };
  await patients.insertOne(patient);
  // Add payment record
  await db.collection('payment_record').insertOne({
    visitNo,
    clinic: branch + ' Clinic',
    location: branch,
    date: body.date,
    time: body.time,
    payment: 'cash',
    createdAt: new Date(),
  });
  return NextResponse.json({ visitNo });
} 