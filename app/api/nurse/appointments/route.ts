import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get('branch');
  const date = searchParams.get('date');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  
  if (!branch || !date) {
    return NextResponse.json({ error: 'Branch and date required' }, { status: 400 });
  }
  
  const collectionName = locationCollections[branch as keyof typeof locationCollections];
  if (!collectionName) {
    return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
  }
  
  try {
    const client = await connectToDB();
    const db = client.db(dbName);
    const patients = db.collection(collectionName);
    const paymentRecords = db.collection('payment_record');
    
    // Find all appointments for the given date
    const query = { 'appointments.date': date };
    const total = await patients.countDocuments(query);
    const results = await patients
      .find(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    
    // Flatten appointments for the date and get payment info
    const appointments = await Promise.all(results.map(async (doc) => {
      const appt = (doc.appointments || []).find((a: any) => a.date === date) || {};
      
      // Default to no payment info
      let payment = 'Payment not recorded';
      
      // Try to find payment record by visitNo.
      // Prefer an exact match for the same appointment (visitNo + date + time).
      // If not found, pick the most recent non-pending payment for the visitNo,
      // and finally fall back to the most recent record for the visitNo.
      if (doc.visitNo) {
        try {
          let paymentRecord: any = null;

          // preferred: exact match for this appointment
          paymentRecord = await paymentRecords.findOne({ visitNo: doc.visitNo, date: date, time: appt.time });

          // next: most recent non-pending record for this visitNo
          if (!paymentRecord) {
            paymentRecord = await paymentRecords.findOne(
              { visitNo: doc.visitNo, payment: { $ne: 'pending' } },
              { sort: { _id: -1 } }
            );
          }

          // last resort: most recent record for this visitNo
          if (!paymentRecord) {
            paymentRecord = await paymentRecords.findOne(
              { visitNo: doc.visitNo },
              { sort: { _id: -1 } }
            );
          }

          if (paymentRecord && paymentRecord.payment && paymentRecord.payment !== 'pending') {
            payment = paymentRecord.payment;
          } else if (paymentRecord && paymentRecord.payment === 'pending') {
            payment = 'Payment pending';
          }
        } catch (paymentError) {
          console.error('Error fetching payment record:', paymentError);
          payment = 'Payment lookup failed';
        }
      } else {
        payment = 'No visit number';
      }
      
      return {
        id: doc._id,
        visitNo: doc.visitNo || 'N/A',
        name: doc.name || 'Unknown',
        contact: doc.contact || 'N/A',
        time: appt.time || 'N/A',
        payment: payment,
      };
    }));
    
    return NextResponse.json({ total, appointments });
  } catch (error) {
    console.error('Error in GET /api/nurse/appointments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { visitNo, date, time, collected } = await req.json();
  if (!visitNo) {
    return NextResponse.json({ error: 'visitNo required' }, { status: 400 });
  }
  const client = await connectToDB();
  const db = client.db(dbName);
  const paymentRecords = db.collection('payment_record');

  // Decide target payment state
  const targetPayment = collected ? 'cash_collected' : 'cash';

  // Try to update the specific payment record by visitNo, date, and time
  let result = await paymentRecords.updateOne(
    { visitNo, date, time },
    { $set: { payment: targetPayment } }
  );

  // If no record found with date/time, try updating by visitNo only
  if (result.modifiedCount === 0) {
    result = await paymentRecords.updateOne(
      { visitNo },
      { $set: { payment: targetPayment } }
    );
  }

  if (result.modifiedCount >= 1) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ error: 'Payment record not found or not updated' }, { status: 404 });
  }
} 