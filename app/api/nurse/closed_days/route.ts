import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = 'Patient';

let cachedClient: MongoClient | null = null;
async function connectToDB() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

export async function GET(req: NextRequest) {
  try {
    const client = await connectToDB();
    const db = client.db(dbName);
    const col = db.collection('closed_days');
    const docs = await col.find({}).sort({ date: -1 }).toArray();
    return NextResponse.json({ closedDays: docs });
  } catch (err) {
    console.error('GET closed_days error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, dateFrom, dateTo, branch, reason } = await req.json();
    // dateFrom/dateTo preferred (range). For backwards compatibility accept single `date`.
    if ((!dateFrom && !date) || !branch) return NextResponse.json({ error: 'dateFrom/date and branch required' }, { status: 400 });
    const client = await connectToDB();
    const db = client.db(dbName);
    const col = db.collection('closed_days');
    let doc: any;
    if (dateFrom) {
      const from = new Date(dateFrom);
      const to = dateTo ? new Date(dateTo) : new Date(dateFrom);
      doc = { dateFrom: from, dateTo: to, branch, reason: reason || '', createdAt: new Date() };
    } else {
      doc = { date: new Date(date), branch, reason: reason || '', createdAt: new Date() };
    }
    const res = await col.insertOne(doc);
    return NextResponse.json({ success: true, id: res.insertedId });
  } catch (err) {
    console.error('POST closed_days error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const client = await connectToDB();
    const db = client.db(dbName);
    const col = db.collection('closed_days');
    await col.deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE closed_days error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
