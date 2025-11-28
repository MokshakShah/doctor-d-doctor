"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface ReportAnalysis {
  _id: string;
  fileName: string;
  analysis: string;
  uploadedAt: string;
  note?: string;
}

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

  // Manage reports state
  const [manageVisitNo, setManageVisitNo] = useState("");
  const [manageBranch, setManageBranch] = useState("");
  const [existingReports, setExistingReports] = useState<ReportAnalysis[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manageError, setManageError] = useState("");
  const [manageSuccess, setManageSuccess] = useState("");

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
        
        const data: Record<string, unknown> = await res.json();
        if (!res.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : "Analysis failed");
        }
        
        if (typeof data.analysis === 'string') {
          setAnalysis(data.analysis);
        }
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

      {/* Manage/Delete Reports Section */}
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6 border border-orange-200 mt-6">
        <h2 className="text-lg font-bold text-orange-800 mb-4 text-center">🗑️ Manage / Delete Reports</h2>
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
              setLoadingReports(true);
              try {
                const res = await fetch(`/api/nurse/analyze-report?visitNo=${encodeURIComponent(manageVisitNo)}&branch=${encodeURIComponent(manageBranch)}`);
                const data = await res.json();
                setExistingReports(data.analyses || []);
                if ((data.analyses || []).length === 0) {
                  setManageError("No reports found for this patient");
                }
              } catch {
                setManageError("Failed to fetch reports");
              } finally {
                setLoadingReports(false);
              }
            }}
            disabled={loadingReports}
          >
            {loadingReports ? "Loading..." : "Load Reports"}
          </button>

          {manageError && <div className="text-red-500 text-center text-sm">{manageError}</div>}
          {manageSuccess && <div className="text-green-600 text-center text-sm">{manageSuccess}</div>}

          {existingReports.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-600">Click ❌ to delete a report:</p>
              {existingReports.map((report) => (
                <div key={report._id} className="relative border rounded-lg p-3 bg-purple-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-8">
                      <div className="text-xs font-semibold text-purple-600 mb-1">
                        {new Date(report.uploadedAt).toLocaleDateString('en-GB')} - {report.fileName}
                      </div>
                      <div className="text-xs text-purple-800 line-clamp-3 whitespace-pre-wrap">
                        {report.analysis.slice(0, 150)}...
                      </div>
                      {report.note && (
                        <div className="text-xs text-gray-500 mt-1">Note: {report.note}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                      onClick={async () => {
                        if (!confirm("Are you sure you want to delete this report analysis?")) return;
                        setDeletingId(report._id);
                        setManageError("");
                        setManageSuccess("");
                        try {
                          const res = await fetch("/api/nurse/analyze-report", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: report._id, visitNo: manageVisitNo, branch: manageBranch }),
                          });
                          if (res.ok) {
                            setExistingReports(prev => prev.filter(r => r._id !== report._id));
                            setManageSuccess("Report deleted successfully!");
                          } else {
                            const data = await res.json();
                            setManageError(data.error || "Failed to delete report");
                          }
                        } catch {
                          setManageError("Failed to delete report");
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                      disabled={deletingId === report._id}
                    >
                      {deletingId === report._id ? "..." : "❌"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 