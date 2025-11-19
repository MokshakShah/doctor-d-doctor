import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const uri = 'mongodb://127.0.0.1:27017';
const dbName = 'DoctorD';
const allowedDoctor = 'mokshak18@gmail.com'; 
const allowedNurses = ['nurse@gmail.com', 'helpingnurse@gmail.com'];
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

let cachedClient: MongoClient | null = null;
async function connectToDB() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

export async function POST(req: NextRequest) {
  const { email, password, role } = await req.json();
  if (!email || !password || !role) {
    return NextResponse.json({ error: 'Email, password, and role required' }, { status: 400 });
  }
  // Restrict allowed emails
  if (
    (role === 'Doctor' && email !== allowedDoctor) ||
    (role === 'Nurse' && !allowedNurses.includes(email))
  ) {
    return NextResponse.json({ error: 'Unauthorized email address' }, { status: 403 });
  }
  const client = await connectToDB();
  const db = client.db(dbName);
  const collectionName = role === 'Doctor' ? 'Doctor_register' : 'Nurse_register';
  const users = db.collection(collectionName);
  const existing = await users.findOne({ email });
  if (!existing) {
    // Signup (only for allowed emails)
    const hashed = await bcrypt.hash(password, 10);
    await users.insertOne({ email, password: hashed, createdAt: new Date() });
    const token = jwt.sign({ email, role }, JWT_SECRET, { expiresIn: '7d' });
    return NextResponse.json({ token, signup: true });
  } else {
    // Login
    const valid = await bcrypt.compare(password, existing.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const token = jwt.sign({ email, role }, JWT_SECRET, { expiresIn: '7d' });
    return NextResponse.json({ token, signup: false });
  }
} 