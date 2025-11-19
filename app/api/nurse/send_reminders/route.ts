import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = 'mongodb://127.0.0.1:27017';
const dbName = 'Patient';

let cachedClient: MongoClient | null = null;
async function connectToDB() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

// This endpoint finds followups where remindAt <= now and sentAt is null and sends SMS via Twilio
export async function POST(req: NextRequest) {
  try {
    // If REMINDER_TOKEN is set in env, require callers to pass it via header 'x-reminder-token'
    const requiredToken = process.env.REMINDER_TOKEN;
    if (requiredToken) {
      const provided = req.headers.get('x-reminder-token') || '';
      if (!provided || provided !== requiredToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    const client = await connectToDB();
    const db = client.db(dbName);
    const followups = db.collection('followups');

    const now = new Date();
    const due = await followups.find({ remindAt: { $lte: now }, sentAt: null }).toArray();

    if (due.length === 0) return NextResponse.json({ sent: 0, message: 'No reminders due' });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM;

    const results: any[] = [];

    for (const f of due) {
      const to = f.contact;
      // Verify patient exists in Patients_history for the branch and visitNo before sending.
      const branchMap: Record<string, string> = { Bor: 'Patients_history_borivali', Mal: 'Patients_history_malad', Bhy: 'Patients_history_bhayander' };
      const patientsCollectionName = branchMap[f.branch] || null;
      if (!patientsCollectionName) {
        await followups.updateOne({ _id: f._id }, { $set: { sentAt: new Date(), sentResult: 'invalid-branch' } });
        results.push({ visitNo: f.visitNo, result: 'invalid-branch' });
        continue;
      }
      // re-check patient contact at send time to avoid sending to random numbers
      const patientsCol = db.collection(patientsCollectionName);
      const patientRecord = await patientsCol.findOne({ visitNo: f.visitNo });
      if (!patientRecord || !patientRecord.contact) {
        await followups.updateOne({ _id: f._id }, { $set: { sentAt: new Date(), sentResult: 'no-registered-contact' } });
        results.push({ visitNo: f.visitNo, result: 'no-registered-contact' });
        continue;
      }
      // ensure the followup contact matches the registered patient contact
      if (String(patientRecord.contact).replace(/\s+/g,'') !== String(to).replace(/\s+/g,'')) {
        await followups.updateOne({ _id: f._id }, { $set: { sentAt: new Date(), sentResult: 'contact-mismatch' } });
        results.push({ visitNo: f.visitNo, result: 'contact-mismatch' });
        continue;
      }
      if (!to) {
        // mark as attempted with no contact
        await followups.updateOne({ _id: f._id }, { $set: { sentAt: new Date(), sentResult: 'no-contact' } });
        results.push({ visitNo: f.visitNo, result: 'no-contact' });
        continue;
      }

      if (!accountSid || !authToken || !fromNumber) {
        // Can't send; record missing config
        await followups.updateOne({ _id: f._id }, { $set: { sentAt: new Date(), sentResult: 'no-twilio-config' } });
        results.push({ visitNo: f.visitNo, result: 'no-twilio-config' });
        continue;
      }

      try {
        const body = new URLSearchParams();
        const appointmentDateStr = (f.nextAppointmentDate instanceof Date) ? f.nextAppointmentDate.toISOString().slice(0,10) : (new Date(f.nextAppointmentDate)).toISOString().slice(0,10);
        body.append('To', to);
        body.append('From', fromNumber);
        body.append('Body', `Reminder: You have an upcoming appointment on ${appointmentDateStr}. Please attend or call to reschedule.`);

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString(),
        });

        const data = await res.json();
        if (res.ok) {
          await followups.updateOne({ _id: f._id }, { $set: { sentAt: new Date(), sentResult: data } });
          results.push({ visitNo: f.visitNo, result: 'sent', sid: data.sid });
        } else {
          await followups.updateOne({ _id: f._id }, { $set: { sentAt: new Date(), sentResult: data } });
          results.push({ visitNo: f.visitNo, result: 'failed', error: data });
        }
      } catch (err) {
        console.error('Error sending Twilio SMS:', err);
        await followups.updateOne({ _id: f._id }, { $set: { sentAt: new Date(), sentResult: String(err) } });
        results.push({ visitNo: f.visitNo, result: 'error', error: String(err) });
      }
    }

    return NextResponse.json({ sent: results.length, results });
  } catch (err) {
    console.error('Error in send_reminders:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
