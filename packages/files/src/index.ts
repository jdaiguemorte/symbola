export { detectFileType, ALLOWED_MIME_TYPES, type DetectedFileType } from "./magic-bytes";
export { pingClamav, scanBuffer, type ScanResult } from "./clamav-client";
export {
  checkBucket,
  createStorageClient,
  deletePrivateObject,
  getPrivateObject,
  openPrivateObjectStream,
  PrivateObjectNotFoundError,
  readPrivateObject,
  statPrivateObject,
  type PrivateObject,
  getSignedDownloadUrl,
  listPrivateObjectKeys,
  uploadPrivateFile,
  uploadPrivateObject,
} from "./storage";
export { registerUploadGuard, uploadFile, type UploadFileInput, type UploadFileResult, type UploadRejection } from "./upload-service";
export { EICAR_TEST_STRING } from "./eicar";
export { openSealedFile, sealFile, type SealedFile } from "./sealed";
