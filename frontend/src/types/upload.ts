export type allowedExt = ".pdf" | ".docx" | ".pptx" | ".ppt";

export interface UploadFileModel {
    file: File;
    start_page?: number;
    end_page?: number | null;
    topic?: string;
}

export type UploadSuccess = { message: string };
export type UploadError = { message: string };
export type UploadResponse = UploadSuccess | UploadError;