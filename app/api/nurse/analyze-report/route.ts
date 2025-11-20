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

    const prompt = `You are a medical report analyzer. Analyze this medical report PDF and provide:
1. Key findings (main diagnoses/abnormalities)
2. Test values and their significance
3. Recommendations from the report
4. Any critical alerts or urgent findings

Provide a clear, structured summary that a doctor can quickly review.`;

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

    const analysisText = response.content.parts
      .map((part: any) => (typeof part.text === "string" ? part.text : ""))
      .join("");

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
  } catch (error: any) {
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

    // Get last 3 report analyses
    const analyses = await collection
      .find({ visitNo, branch })
      .sort({ uploadedAt: -1 })
      .limit(3)
      .toArray();

    return NextResponse.json({ analyses });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch analyses" },
      { status: 500 }
    );
  }
}
