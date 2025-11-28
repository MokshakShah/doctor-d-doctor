"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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

  // Manage images state
  const [manageVisitNo, setManageVisitNo] = useState("");
  const [manageBranch, setManageBranch] = useState("");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [manageError, setManageError] = useState("");
  const [manageSuccess, setManageSuccess] = useState("");

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
        const candidate = new Date(now.getFullYear(), now.getMonth() + nextAppointmentMonths, now.getDate());

        // Normalize branch short code to human branch name used in closed_days
        const branchNameMap: Record<string, string> = { Bor: 'Borivali', Mal: 'Malad', Bhy: 'Bhayander' };
        const branchFull = branchNameMap[branch] || branch;

        // Fetch closed days and advance candidate if it falls on Sunday or a closed day for this branch or All
        try {
          const res = await fetch('/api/nurse/closed_days');
          if (res.ok) {
            const j = await res.json();
            const closedArr: Record<string, unknown>[] = j.closedDays || [];
            const isCandidateClosed = (d: Date) => {
              const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
              // Skip Sundays
              if (d.getDay() === 0) return true;
              for (const c of closedArr) {
                const branchVal = c.branch as string || '';
                if (!(branchVal === 'All' || branchVal === branchFull)) continue;
                if (c.date) {
                  const cd = new Date(c.date as string);
                  const cdDay = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate()).getTime();
                  if (cdDay === t) return true;
                } else if (c.dateFrom) {
                  const from = new Date(c.dateFrom as string);
                  const to = c.dateTo ? new Date(c.dateTo as string) : new Date(c.dateFrom as string);
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
    } catch (_err: unknown) {
      const err = _err as Error & { message?: string };
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

      {/* Manage/Delete Images Section */}
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6 border border-orange-200 mt-6">
        <h2 className="text-lg font-bold text-orange-800 mb-4 text-center">🗑️ Manage / Delete Images</h2>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Visit Number"
            className="border rounded px-3 py-2"
            value={manageVisitNo}
            onChange={e => setManageVisitNo(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2"
            value={manageBranch}
            onChange={e => setManageBranch(e.target.value)}
          >
            <option value="">Select Branch</option>
            {branchOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="w-full bg-orange-600 text-white py-2 rounded-lg font-semibold"
            onClick={async () => {
              if (!manageVisitNo || !manageBranch) {
                setManageError("Please enter visit number and select branch");
                return;
              }
              setManageError("");
              setManageSuccess("");
              setLoadingImages(true);
              try {
                const res = await fetch(`/api/nurse/prescription_img?visitNo=${encodeURIComponent(manageVisitNo)}&branch=${encodeURIComponent(manageBranch)}`);
                const data = await res.json();
                setExistingImages(data.images || []);
                if ((data.images || []).length === 0) {
                  setManageError("No images found for this patient");
                }
              } catch {
                setManageError("Failed to fetch images");
              } finally {
                setLoadingImages(false);
              }
            }}
            disabled={loadingImages}
          >
            {loadingImages ? "Loading..." : "Load Images"}
          </button>

          {manageError && <div className="text-red-500 text-center text-sm">{manageError}</div>}
          {manageSuccess && <div className="text-green-600 text-center text-sm">{manageSuccess}</div>}

          {existingImages.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Click the ❌ to delete an image:</p>
              <div className="grid grid-cols-2 gap-3">
                {existingImages.map((url, idx) => (
                  <div key={idx} className="relative border rounded-lg p-2 bg-gray-50">
                    <Image
                      src={url}
                      alt={`Prescription ${idx + 1}`}
                      width={150}
                      height={150}
                      className="rounded object-contain w-full h-32"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                      onClick={async () => {
                        if (!confirm("Are you sure you want to delete this image?")) return;
                        setDeletingUrl(url);
                        setManageError("");
                        setManageSuccess("");
                        try {
                          const res = await fetch("/api/nurse/prescription_img", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ url, visitNo: manageVisitNo, branch: manageBranch }),
                          });
                          if (res.ok) {
                            setExistingImages(prev => prev.filter(u => u !== url));
                            setManageSuccess("Image deleted successfully!");
                          } else {
                            const data = await res.json();
                            setManageError(data.error || "Failed to delete image");
                          }
                        } catch {
                          setManageError("Failed to delete image");
                        } finally {
                          setDeletingUrl(null);
                        }
                      }}
                      disabled={deletingUrl === url}
                    >
                      {deletingUrl === url ? "..." : "❌"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 