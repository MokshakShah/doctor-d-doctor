"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddPrescriptionImage() {
  const router = useRouter();
  const [visitNo, setVisitNo] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // TODO: Replace with your Cloudinary upload preset and cloud name
  const CLOUDINARY_UPLOAD_PRESET = "your_upload_preset";
  const CLOUDINARY_CLOUD_NAME = "your_cloud_name";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!visitNo || !files || files.length === 0) {
      setError("Please enter a visit number and select at least one image.");
      return;
    }
    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
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
      // Save URLs to backend with visitNo
      const saveRes = await fetch("/api/nurse/prescription_img", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitNo, images: uploadedUrls }),
      });
      if (!saveRes.ok) throw new Error("Failed to save image reference");
      setSuccess(true);
      setVisitNo("");
      setFiles(null);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6 border border-blue-200">
        <h1 className="text-xl font-bold text-blue-800 mb-4 text-center">Add Prescription Image</h1>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Visit Number"
            className="border rounded px-3 py-2"
            value={visitNo}
            onChange={e => setVisitNo(e.target.value)}
            required
          />
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="border rounded px-3 py-2"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-700 text-white py-2 rounded-lg font-semibold mt-2"
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
          {success && <div className="text-green-600 text-center">Images uploaded successfully!</div>}
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