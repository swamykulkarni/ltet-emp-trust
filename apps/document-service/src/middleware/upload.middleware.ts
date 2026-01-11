import multer from 'multer';
import { Request } from 'express';
import { DOCUMENT_CONSTANTS } from '@ltet/shared-constants';

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: multer.File, cb: multer.FileFilterCallback) => {
  // Check file type
  if (DOCUMENT_CONSTANTS.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${DOCUMENT_CONSTANTS.ALLOWED_TYPES.join(', ')} files are allowed.`));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: DOCUMENT_CONSTANTS.MAX_FILE_SIZE, // 5MB
    files: 1 // Single file upload
  }
});

// Error handling middleware for multer
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File size exceeds ${DOCUMENT_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)}MB limit`
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Only one file allowed per upload'
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  return res.status(500).json({
    success: false,
    error: 'File upload error'
  });
};