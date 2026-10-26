export { detectFileType, ALLOWED_MIME_TYPES, type DetectedFileType } from "./magic-bytes";
export { scanBuffer, type ScanResult } from "./clamav-client";
export { createStorageClient, getSignedDownloadUrl, uploadPrivateObject } from "./storage";
export { uploadFile, type UploadFileInput, type UploadFileResult } from "./upload-service";
export { EICAR_TEST_STRING } from "./eicar";
