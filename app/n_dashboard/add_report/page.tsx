"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddReport() {
  const router = useRouter();
  const [visitNo, setVisitNo] = useState("");
  const [branch, setBranch] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [analysis, setAnalysis] = useState("");

  const branchOptions = [
    { label: "Borivali", value: "Bor" },
    { label: "Malad", value: "Mal" },
    { label: "Bhayandar", value: "Bhy" },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setAnalysis("");
    
    if (!visitNo || !branch || !files || files.length === 0) {
      setError("Please enter a visit number, select a branch, and select a PDF report.");
      return;
    }
    
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        formData.append("visitNo", visitNo);
        formData.append("branch", branch);
        formData.append("reportNote", reportNote);

        // Send to Gemini analysis endpoint
        const res = await fetch("/api/nurse/analyze-report", {
          method: "POST",
          body: formData,
        });
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Analysis failed");
        }
        
        setAnalysis(data.analysis);
      }
      
      setSuccess(true);
      setVisitNo("");
      setBranch("");
      setFiles(null);
      setReportNote("");
      
      setTimeout(() => {
        setSuccess(false);
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6 border border-blue-200">
        <h1 className="text-xl font-bold text-blue-800 mb-4 text-center">Add Patient Report (PDF)</h1>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Visit Number"
            className="border rounded px-3 py-2"
            value={visitNo}
            onChange={e => setVisitNo(e.target.value)}
            required
          />
          <select
            className="border rounded px-3 py-2"
            value={branch}
            onChange={e => setBranch(e.target.value)}
            required
          >
            <option value="">Select Branch</option>
            {branchOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
            className="border rounded px-3 py-2"
            required
          />
          <textarea
            className="border rounded px-3 py-2"
            placeholder="Write summary of reports done on last visit (optional)"
            value={reportNote}
            onChange={e => setReportNote(e.target.value)}
            rows={3}
          />
          <button
            type="submit"
            className="w-full bg-blue-700 text-white py-2 rounded-lg font-semibold mt-2"
            disabled={uploading}
          >
            {uploading ? "Analyzing with Gemini..." : "Upload & Analyze"}
          </button>
          {success && <div className="text-green-600 text-center font-semibold">✓ Report analyzed successfully!</div>}
          {error && <div className="text-red-500 text-center">{error}</div>}
          {analysis && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-300 rounded-lg max-h-96 overflow-y-auto">
              <div className="font-semibold text-blue-900 mb-2">AI Analysis Summary:</div>
              <div className="text-sm text-blue-800 whitespace-pre-wrap">{analysis}</div>
            </div>
          )}
        </form>
        <button
          className="mt-4 w-full bg-gray-200 text-blue-700 py-2 rounded-lg font-semibold"
          onClick={() => router.push("/n_dashboard")}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
} 