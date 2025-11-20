import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = 'DoctorD';
const collectionName = 'Nurse_register';
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
  try {
    let email = null;
    let payload = null;
    let auth = req.headers.get('authorization');
    const body = await req.json();
    if (body.email) {
      // Forgot password flow: use email from body
      email = body.email;
    } else if (auth && auth.startsWith('Bearer ')) {
      // Authenticated flow: use JWT
      const token = auth.slice(7);
      try {
        payload = jwt.verify(token, JWT_SECRET);
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      if (!payload || !payload.email || payload.role !== 'Nurse') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      email = payload.email;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { oldPassword, newPassword } = body;
    if (!oldPassword || !newPassword || !email) {
      return NextResponse.json({ error: 'Old and new password and email required' }, { status: 400 });
    }
    const client = await connectToDB();
    const db = client.db(dbName);
    const nurses = db.collection(collectionName);
    const user = await nurses.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // Check lockout
    const now = new Date();
    if (user.passwordChangeLockedUntil && user.passwordChangeLockedUntil > now) {
      return NextResponse.json({ error: 'Password change locked for 24 hours.', lockedUntil: user.passwordChangeLockedUntil }, { status: 403 });
    }
    // Check attempts
    if (user.passwordChangeLastAttempt && (now - user.passwordChangeLastAttempt) < 10 * 60 * 1000) {
      if (user.passwordChangeAttempts >= 3) {
        // Lock for 24 hours
        await nurses.updateOne(
          { _id: user._id },
          { $set: { passwordChangeLockedUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000) } }
        );
        return NextResponse.json({ error: 'Password change locked for 24 hours.', lockedUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, { status: 403 });
      }
    }
    // Check old password
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      await nurses.updateOne(
        { _id: user._id },
        {
          $inc: { passwordChangeAttempts: 1 },
          $set: { passwordChangeLastAttempt: now }
        }
      );
      return NextResponse.json({ error: 'Old password incorrect' }, { status: 400 });
    }
    // Success: reset attempts, update password
    const newHash = await bcrypt.hash(newPassword, 10);
    await nurses.updateOne(
      { _id: user._id },
      {
        $set: {
          password: newHash,
          passwordChangeAttempts: 0,
          passwordChangeLastAttempt: null,
          passwordChangeLockedUntil: null
        }
      }
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 