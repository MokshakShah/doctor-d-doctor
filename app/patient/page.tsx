"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { User, Venus, Mars, Calendar, FileText } from "lucide-react";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export default function PatientPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const name = searchParams.get("name") || "";
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [prescriptionImages, setPrescriptionImages] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImg, setModalImg] = useState<string | null>(null);
  const [reportUrls, setReportUrls] = useState<string[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportNote, setReportNote] = useState<string | null>(null);

  useEffect(() => {
    if (!name) {
      router.replace("/dashboard");
      return;
    }
    setLoading(true);
    fetch(`/api/doctor/searchPatient?name=${encodeURIComponent(name)}`)
      .then((res) => res.json())
      .then((data) => {
        setPatients(data.patients || []);
        setLoading(false);
      });
  }, [name, router]);

  // Helper to get the latest past visit (by date)
  function getLatestPastVisit(visits: any[]) {
    if (!visits || visits.length === 0) return null;
    const now = new Date();
    // Filter only visits with a date in the past
    const pastVisits = visits.filter(v => {
      const d = new Date(v.appointments?.[0]?.date);
      return d <= now;
    });
    if (pastVisits.length === 0) return null;
    return pastVisits.reduce((latest, curr) => {
      const currDate = new Date(curr.appointments?.[0]?.date || 0);
      const latestDate = new Date(latest.appointments?.[0]?.date || 0);
      return currDate > latestDate ? curr : latest;
    }, pastVisits[0]);
  }

  // Fetch prescription images for the latest visit
  useEffect(() => {
    if (!loading && patients.length > 0) {
      const patient = patients[0];
      const latestVisit = getLatestPastVisit(patient.visits);
      let showVisit = latestVisit;
      if (!latestVisit && patient.visits && patient.visits.length > 0) {
        showVisit = patient.visits.reduce((earliest: any, curr: any) => {
          const currDate = new Date(curr.appointments?.[0]?.date || 0);
          const earliestDate = new Date(earliest.appointments?.[0]?.date || 0);
          return currDate < earliestDate ? curr : earliest;
        }, patient.visits[0]);
      }
      if (showVisit && showVisit.visitNo && showVisit.location) {
        // Map full branch name to short code for MongoDB lookup
        const branchMap: Record<string, string> = {
          "Malad": "Mal",
          "Borivali": "Bor",
          "Bhayander": "Bhy"
        };
        const branchShort = branchMap[showVisit.location] || showVisit.location;
        fetch(`/api/nurse/prescription_img?visitNo=${encodeURIComponent(showVisit.visitNo)}&branch=${encodeURIComponent(branchShort)}`)
          .then(res => res.json())
          .then(data => setPrescriptionImages(data.images || []));
      } else {
        setPrescriptionImages([]);
      }
    }
  }, [loading, patients]);

  // Fetch reports for the latest visit
  useEffect(() => {
    if (!loading && patients.length > 0) {
      const patient = patients[0];
      const latestVisit = getLatestPastVisit(patient.visits);
      let showVisit = latestVisit;
      if (!latestVisit && patient.visits && patient.visits.length > 0) {
        showVisit = patient.visits.reduce((earliest: any, curr: any) => {
          const currDate = new Date(curr.appointments?.[0]?.date || 0);
          const earliestDate = new Date(earliest.appointments?.[0]?.date || 0);
          return currDate < earliestDate ? curr : earliest;
        }, patient.visits[0]);
      }
      if (showVisit && showVisit.visitNo && showVisit.location) {
        const branchMap: Record<string, string> = {
          "Malad": "Mal",
          "Borivali": "Bor",
          "Bhayander": "Bhy"
        };
        const branchShort = branchMap[showVisit.location] || showVisit.location;
        setReportsLoading(true);
        fetch(`/api/nurse/report?visitNo=${encodeURIComponent(showVisit.visitNo)}&branch=${encodeURIComponent(branchShort)}`)
          .then(res => res.json())
          .then(data => {
            setReportUrls(data.reports || []);
            setReportNote(data.reportNote || null);
          })
          .finally(() => setReportsLoading(false));
      } else {
        setReportUrls([]);
        setReportNote(null);
      }
    }
  }, [loading, patients]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex flex-col items-center p-4">
      <div className="w-full max-w-2xl mt-8">
        <button
          className="mb-4 text-blue-600 hover:underline font-medium"
          onClick={() => router.back()}
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 text-center">Patient Details</h1>
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : patients.length === 0 ? (
          <div className="text-gray-500 text-center">No patient found with this name.</div>
        ) : (
          <div className="space-y-10">
            {patients.map((patient, idx) => {
              const latestVisit = getLatestPastVisit(patient.visits);
              // If no previous visit, use the earliest visit as 'first visit'
              let showVisit = latestVisit;
              let isFirstVisit = false;
              if (!latestVisit && patient.visits && patient.visits.length > 0) {
                showVisit = patient.visits.reduce((earliest: any, curr: any) => {
                  const currDate = new Date(curr.appointments?.[0]?.date || 0);
                  const earliestDate = new Date(earliest.appointments?.[0]?.date || 0);
                  return currDate < earliestDate ? curr : earliest;
                }, patient.visits[0]);
                isFirstVisit = true;
              }
              return (
                <div key={idx} className="bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4 border border-blue-100">
                  {/* Header with avatar and locations */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-blue-200 flex items-center justify-center text-2xl font-bold text-blue-700 shadow">
                        {getInitials(patient.name)}
                      </div>
                      <div>
                        <div className="text-xl font-bold text-blue-800">{patient.name}</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {patient.locations.map((loc: string) => (
                            <span key={loc} className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-1 font-semibold">
                              {loc}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Patient summary or first visit */}
                  {showVisit ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-8">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          <span>{isFirstVisit ? 'First Visit:' : 'Last Visit:'}</span>
                          <span className="font-semibold text-gray-900">{showVisit.appointments?.[0]?.date || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <User className="w-4 h-4 text-blue-400" />
                          <span>Age:</span>
                          <span className="font-semibold text-gray-900">{showVisit.age || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          {showVisit.gender === 'Male' ? <Mars className="w-4 h-4 text-blue-400" /> : <Venus className="w-4 h-4 text-pink-400" />}
                          <span>Gender:</span>
                          <span className="font-semibold text-gray-900">{showVisit.gender || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span>Medical History:</span>
                          <span className="font-semibold text-gray-900">{showVisit.medicalConditions || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span>Allergies:</span>
                          <span className="font-semibold text-gray-900">{showVisit.allergy || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span>Family History:</span>
                          <span className="font-semibold text-gray-900">{showVisit.familyHistory || '-'}</span>
                        </div>
                      </div>
                      {/* Prescription card */}
                      <div className="flex-1 flex flex-col items-center justify-center">
                        {/* Prescription Card */}
                        <div className="w-full max-w-xs bg-blue-50 rounded-xl p-4 flex flex-col items-center border border-blue-200 shadow mb-4">
                          <div className="font-semibold text-blue-700 mb-2">Prescription</div>
                          {prescriptionImages.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {prescriptionImages.map((url, idx) => (
                                <img
                                  key={idx}
                                  src={url}
                                  alt={`Prescription ${idx + 1}`}
                                  className="rounded-lg max-h-48 object-contain border cursor-pointer"
                                  onClick={() => { setModalImg(url); setModalOpen(true); }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="text-gray-400 italic">No prescription uploaded</div>
                          )}
                        </div>
                        {/* Reports Card */}
                        <div className="w-full max-w-xs bg-purple-50 rounded-xl p-4 flex flex-col items-center border border-purple-200 shadow">
                          <div className="font-semibold text-purple-700 mb-2">Reports (PDF)</div>
                          {reportsLoading ? (
                            <div className="flex items-center justify-center h-24">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                            </div>
                          ) : reportUrls.length > 0 ? (
                            <div className="flex flex-col gap-2 w-full">
                              {reportUrls.map((url, idx) => (
                                <div key={idx} className="flex flex-col items-center w-full">
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-700 underline text-base font-semibold py-2"
                                  >
                                    Report {idx + 1}
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-gray-400 italic">No reports uploaded</div>
                          )}
                          {/* Show nurse note if present */}
                          {reportNote && (
                            <div className="mt-4 w-full bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 p-3 rounded">
                              <div className="font-semibold mb-1">Last Time Reports:</div>
                              <div className="whitespace-pre-line">{reportNote}</div>
                            </div>
                          )}
                        </div>
                        {/* Modal for full-size prescription image preview */}
                        {modalOpen && modalImg && (
                          <div
                            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
                            onClick={() => setModalOpen(false)}
                          >
                            <div
                              className="bg-white rounded-lg p-4 max-w-3xl max-h-[90vh] flex flex-col items-center relative"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                className="absolute top-2 right-2 text-gray-600 hover:text-red-500 text-2xl font-bold"
                                onClick={() => setModalOpen(false)}
                                aria-label="Close"
                              >
                                ×
                              </button>
                              <img
                                src={modalImg}
                                alt="Prescription Preview"
                                className="rounded-lg object-contain max-h-[80vh] max-w-full"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 italic py-8">
                      No previous visits found for this patient.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 