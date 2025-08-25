// app/admin/upload/page.tsx
"use client";

import { useState } from "react";
import clsx from "clsx";
import { uploadDocument } from "@/services/upload.service";
import type { UploadResponse } from "@/types/upload";

export default function AdminUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number | null>(null);
  const [topic, setTopic] = useState<string>("general");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<"success" | "error" | "">("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setVariant("");

    if (!file) {
      setVariant("error");
      setMessage("Please select a file (.pdf, .pptx, .ppt, .docx).");
      return;
    }
    if (startPage < 1) {
      setVariant("error");
      setMessage("Start page must be at least 1.");
      return;
    }
    if (endPage !== null && endPage < startPage) {
      setVariant("error");
      setMessage("End page must be greater than or equal to start page.");
      return;
    }

    try {
      setSubmitting(true);
      const res: UploadResponse = await uploadDocument({
        file,
        start_page: startPage,
        end_page: endPage,
        topic,
      });
      setVariant("success");
      setMessage(res.message ?? "Upload completed.");
    } catch (err: any) {
      setVariant("error");
      setMessage(err?.message ?? "Unexpected error during upload.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={clsx(
        "flex items-center justify-center",
        "w-full h-screen",
        "bg-cover bg-center bg-[url(/background/landing-page.svg)]"
      )}
    >
      {/* Centered card (like AuthFlow wrapper) */}
      <div className="w-full max-w-2xl rounded-2xl border bg-white/90 backdrop-blur p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6">
          <nav className="text-sm text-gray-600">
            <span className="hover:underline cursor-default">Admin</span>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">Upload</span>
          </nav>
          <h1 className="text-2xl font-semibold mt-2">Upload Document</h1>
          <p className="text-sm text-gray-600 mt-1">
            Allowed: <code>.pdf</code>, <code>.pptx</code>, <code>.ppt</code>,{" "}
            <code>.docx</code>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* File */}
          <div>
            <label className="block text-sm font-medium mb-1">File</label>
            <input
              type="file"
              accept=".pdf,.pptx,.ppt,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:bg-gray-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:hover:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max size depends on your server settings.
            </p>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium mb-1">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="general"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          {/* Start / End page */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start page</label>
              <input
                type="number"
                min={1}
                value={startPage}
                onChange={(e) => setStartPage(Number(e.target.value))}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                End page (optional)
              </label>
              <input
                type="number"
                min={1}
                value={endPage ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setEndPage(v === "" ? null : Number(v));
                }}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="Leave blank to process to last page"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Uploading..." : "Upload"}
            </button>
            {variant && (
              <span
                className={`text-sm ${variant === "success" ? "text-green-600" : "text-red-600"
                  }`}
              >
                {message}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
