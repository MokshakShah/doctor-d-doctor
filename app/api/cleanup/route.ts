import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = 'Patient';

export async function POST(req: NextRequest) {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const paymentRecords = db.collection('payment_record');
    
    // Find all visitNos that have both pending and non-pending records
    const duplicateVisitNos = await paymentRecords.aggregate([
      {
        $group: {
          _id: '$visitNo',
          records: { $push: { _id: '$_id', payment: '$payment' } },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();
    
    let removedCount = 0;
    
    // For each duplicate visitNo, remove pending records if non-pending ones exist
    for (const group of duplicateVisitNos) {
      const hasPending = group.records.some((r: any) => r.payment === 'pending');
      const hasNonPending = group.records.some((r: any) => r.payment !== 'pending');
      
      if (hasPending && hasNonPending) {
        // Remove all pending records for this visitNo
        const result = await paymentRecords.deleteMany({ 
          visitNo: group._id, 
          payment: 'pending' 
        });
        removedCount += result.deletedCount;
      }
    }
    
    await client.close();
    
    return NextResponse.json({ 
      success: true, 
      removedPendingRecords: removedCount,
      duplicateGroups: duplicateVisitNos.length
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}