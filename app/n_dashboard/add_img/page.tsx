"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddPrescriptionImage() {
  const router = useRouter();
  const [visitNo, setVisitNo] = useState("");
  const [branch, setBranch] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [note, setNote] = useState("");
  const [nextAppointmentMonths, setNextAppointmentMonths] = useState<number>(0);
  const [nextAppointmentDate, setNextAppointmentDate] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // TODO: Replace with your Cloudinary upload preset and cloud name
  const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

  // Branch options
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
      setError("Please enter a visit number, select a branch, and select at least one image.");
      return;
    }
    setUploading(true);
    try {
      // Fetch current images to determine next suffix
      const res = await fetch(`/api/nurse/prescription_img?visitNo=${encodeURIComponent(visitNo)}&branch=${encodeURIComponent(branch)}`);
      const data = await res.json();
      const currentCount = (data.images || []).length;
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        // Set public_id for Cloudinary: D-<visitNo>_<branchShort>_<suffix>
        const branchShort = branch; // branch value is already short (Bor, Mal, Bhy)
        const suffix = (currentCount + i + 1).toString().padStart(2, '0');
        const publicId = `D-${visitNo}_${branchShort}_${suffix}`;
        formData.append("public_id", publicId);
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.secure_url) {
          uploadedUrls.push(uploadData.secure_url);
        } else {
          throw new Error("Upload failed");
        }
      }
      // Calculate nextAppointmentDate if months selected (auto from current date)
      let nextDateStr = nextAppointmentDate;
      if (!nextDateStr && nextAppointmentMonths > 0) {
        // safer month addition without mutating now
        const now = new Date();
        let candidate = new Date(now.getFullYear(), now.getMonth() + nextAppointmentMonths, now.getDate());

        // Normalize branch short code to human branch name used in closed_days
        const branchNameMap: Record<string, string> = { Bor: 'Borivali', Mal: 'Malad', Bhy: 'Bhayander' };
        const branchFull = branchNameMap[branch] || branch;

        // Fetch closed days and advance candidate if it falls on Sunday or a closed day for this branch or All
        try {
          const res = await fetch('/api/nurse/closed_days');
          if (res.ok) {
            const j = await res.json();
            const closedArr: any[] = j.closedDays || [];
            const isCandidateClosed = (d: Date) => {
              const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
              // Skip Sundays
              if (d.getDay() === 0) return true;
              for (const c of closedArr) {
                const branchVal = c.branch || '';
                if (!(branchVal === 'All' || branchVal === branchFull)) continue;
                if (c.date) {
                  const cd = new Date(c.date);
                  const cdDay = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate()).getTime();
                  if (cdDay === t) return true;
                } else if (c.dateFrom) {
                  const from = new Date(c.dateFrom);
                  const to = c.dateTo ? new Date(c.dateTo) : new Date(c.dateFrom);
                  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
                  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
                  if (t >= fromDay && t <= toDay) return true;
                }
              }
              return false;
            };

            // Advance day until we find a non-closed, non-Sunday date
            let safety = 0;
            while (isCandidateClosed(candidate) && safety < 60) {
              candidate.setDate(candidate.getDate() + 1);
              safety++;
            }
          }
        } catch (err) {
          console.error('Failed to fetch closed days for next appointment calc', err);
        }

        nextDateStr = candidate.toISOString().slice(0, 10);
        // update the UI input so user sees the calculated date
        setNextAppointmentDate(nextDateStr);
      }

      // Save URLs and metadata to backend with visitNo and branch
      const saveRes = await fetch("/api/nurse/prescription_img", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitNo, branch, images: uploadedUrls, note, nextAppointmentDate: nextDateStr }),
      });
      if (!saveRes.ok) throw new Error("Failed to save image reference");
      setSuccess(true);
      setVisitNo("");
      setBranch("");
      setFiles(null);
      setNote("");
      setNextAppointmentMonths(0);
      setNextAppointmentDate("");
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
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="border rounded px-3 py-2"
            required
          />
          <textarea
            className="border rounded px-3 py-2"
            placeholder="Prescription note / summary (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2 items-center">
            <label className="text-sm">Next appointment (optional):</label>
            <select
              value={nextAppointmentMonths}
              onChange={e => setNextAppointmentMonths(parseInt(e.target.value || '0', 10))}
              className="border rounded px-2 py-1"
            >
              <option value={0}>None</option>
              <option value={1}>1 month</option>
              <option value={2}>2 months</option>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
            <input
              type="date"
              value={nextAppointmentDate}
              onChange={e => setNextAppointmentDate(e.target.value)}
              className="border rounded px-3 py-1"
            />
          </div>
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