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

  const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
  const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;

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
    if (!visitNo || !branch || !files || files.length === 0) {
      setError("Please enter a visit number, select a branch, and select a PDF report.");
      return;
    }
    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        // Upload as raw for PDF
        formData.append("resource_type", "raw");
        const branchShort = branch;
        const publicId = `R-${visitNo}_${branchShort}_${Date.now()}`;
        formData.append("public_id", publicId);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.secure_url) {
          uploadedUrls.push(data.secure_url);
        } else {
          throw new Error("Upload failed");
        }
      }
      // Save URLs to backend with visitNo and branch
      const saveRes = await fetch("/api/nurse/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitNo, branch, reports: uploadedUrls, reportNote }),
      });
      if (!saveRes.ok) throw new Error("Failed to save report reference");
      setSuccess(true);
      setVisitNo("");
      setBranch("");
      setFiles(null);
      setReportNote("");
      setTimeout(() => {
        setSuccess(false);
        router.refresh();
      }, 1200);
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
            {uploading ? "Uploading..." : "Upload"}
          </button>
          {success && <div className="text-green-600 text-center">Reports uploaded successfully!</div>}
          {error && <div className="text-red-500 text-center">{error}</div>}
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