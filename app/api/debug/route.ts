import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = 'mongodb://127.0.0.1:27017';
const dbName = 'Patient';

export async function GET(req: NextRequest) {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    
    // Check payment records
    const paymentRecords = db.collection('payment_record');
    const allPayments = await paymentRecords.find({}).toArray();
    
    // Check patient records in Borivali for date 2025-09-30 (since that's what nurse dashboard shows)
    const borivaliCollection = db.collection('Patients_history_borivali');
    const borivaliPatients = await borivaliCollection.find({ 
      'appointments.date': '2025-09-30' 
    }).toArray();
    
    // Also check for patients with name Neha
    const nehaPatients = await borivaliCollection.find({ 
      name: { $regex: /neha/i } 
    }).toArray();
    
    await client.close();
    
    return NextResponse.json({
      totalPaymentRecords: allPayments.length,
      paymentRecords: allPayments,
      borivaliPatientsOnDate: borivaliPatients.map(p => ({
        visitNo: p.visitNo,
        name: p.name,
        contact: p.contact,
        appointments: p.appointments || []
      })),
      nehaPatients: nehaPatients.map(p => ({
        visitNo: p.visitNo,
        name: p.name,
        contact: p.contact,
        appointments: p.appointments || []
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}