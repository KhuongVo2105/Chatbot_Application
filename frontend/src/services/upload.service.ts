// lib/uploadDocument.ts
import { UploadFileModel, UploadResponse } from "@/types/upload";
import axiosInstance from "@/lib/api";

const ALLOWED: Set<string> = new Set([".pdf", ".ppt", ".docx"]);

function getExt(name: string): string {
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function createUploadFormData(data: UploadFileModel): FormData {
    const fd = new FormData();
    fd.append("file", data.file);
    fd.append("start_page", String(data.start_page ?? 1));
    if (data.end_page !== undefined && data.end_page !== null) {
        fd.append("end_page", String(data.end_page));
    }
    fd.append("topic", data.topic ?? "general");
    return fd;
}

export async function uploadDocument(
    data: UploadFileModel
): Promise<UploadResponse> {
    // Client-side validation to match backend rule
    const ext = getExt(data.file.name);
    if (!ALLOWED.has(ext)) {
        return { message: "Invalid file type. Only PDF, PPT, and DOCX files are allowed." };
    }

    const token = sessionStorage.getItem("access_token");
    if (!token) {
        throw new Error("No token found");
    }

    try {
        const response = await axiosInstance.post<UploadResponse>(
            "/rag/upload",          // endpoint
            createUploadFormData(data),              // form data (body)
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            }
        );

        return response.data; // FastAPI returns { message: "..." }
    } catch (error: any) {
        console.error("Upload error:", error);
        return { message: error.response?.data?.message ?? "Unexpected error occurred" };
    }
}
