import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { GoogleGenerativeAI } from "@google/generative-ai";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = "Patient";
const collectionName = "report_analysis";

let cachedClient: MongoClient | null = null;
async function connectToDB() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const visitNo = formData.get("visitNo") as string;
    const branch = formData.get("branch") as string;
    const reportNote = formData.get("reportNote") as string;

    if (!file || !visitNo || !branch) {
      return NextResponse.json(
        { error: "Missing file, visitNo, or branch" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // Determine MIME type
    let mimeType = "application/pdf";
    if (file.type) {
      mimeType = file.type;
    } else if (file.name.endsWith(".pdf")) {
      mimeType = "application/pdf";
    }

    // Call Gemini API to analyze the report
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Extract ONLY the measured/calculated values from this lab report. Be very concise.

Format each test as: TestName: Value Unit

Example:
- Fasting Glucose: 98 mg/dL
- Post-Meal Glucose: 142 mg/dL
- HbA1c: 6.2%
- TSH: 3.5 mIU/L

Rules:
- Show ONLY the patient's actual test values
- Do NOT include normal ranges or reference values
- Highlight any abnormal values with (High) or (Low)
- Skip test descriptions, just values
- Maximum 15 lines`;

    const response = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64,
        },
      },
      {
        text: prompt,
      },
    ]);

    // Handle response properly
    let analysisText = "";
    
    console.log("Gemini response:", JSON.stringify(response, null, 2));
    
    if (response.response && response.response.candidates && response.response.candidates.length > 0) {
      const candidate = response.response.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        analysisText = candidate.content.parts
          .map((part: { text?: string }) => part.text || "")
          .join("");
      }
    }

    if (!analysisText) {
      console.error("Could not extract analysis text from response");
      throw new Error("No analysis generated from Gemini");
    }

    // Save analysis to MongoDB
    const client = await connectToDB();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const now = new Date();

    const result = await collection.insertOne({
      visitNo,
      branch,
      fileName: file.name,
      analysis: analysisText,
      note: reportNote || null,
      uploadedAt: now,
      fileSize: file.size,
    });

    return NextResponse.json({
      success: true,
      analysis: analysisText,
      id: result.insertedId,
    });
  } catch (_error: unknown) {
    const error = _error as Error;
    console.error("Report analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Analysis failed" },
      { status: 500 }
    );
  }
}

// GET: Fetch report analysis for a patient
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const visitNo = searchParams.get("visitNo");
    const branch = searchParams.get("branch");

    if (!visitNo || !branch) {
      return NextResponse.json(
        { error: "Missing visitNo or branch" },
        { status: 400 }
      );
    }

    const client = await connectToDB();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Get all report analyses (with _id for deletion)
    const analyses = await collection
      .find({ visitNo, branch })
      .sort({ uploadedAt: -1 })
      .toArray();

    return NextResponse.json({ analyses });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error: unknown) {
    return NextResponse.json(
      { error: "Failed to fetch analyses" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a report analysis from MongoDB
export async function DELETE(req: NextRequest) {
  try {
    const { id, visitNo, branch } = await req.json();
    
    if (!id || !visitNo || !branch) {
      return NextResponse.json(
        { error: "Missing id, visitNo, or branch" },
        { status: 400 }
      );
    }

    const client = await connectToDB();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const { ObjectId } = await import('mongodb');
    const result = await collection.deleteOne({ 
      _id: new ObjectId(id), 
      visitNo, 
      branch 
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Report deleted successfully" });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { error: "Failed to delete report" },
      { status: 500 }
    );
  }
}
