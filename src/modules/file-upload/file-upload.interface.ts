export interface IFileUploadService {
  uploadFile(file: Express.Multer.File): Promise<FileUploadResponse>
}

export interface FileUploadResponse {
  url: string
  key: string
  originalName: string
  size: number
  mimetype: string
}
