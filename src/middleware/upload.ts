import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

const storage = multer.memoryStorage();

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.includes(file.mimetype) || ALLOWED_EXTENSIONS.includes(ext)) {
    callback(null, true);
  } else {
    callback(new Error('FILE_TYPE_NOT_SUPPORTED'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 52428800,
  },
  fileFilter,
});

export const uploadSingleDocument = (req: Request, res: Response, next: NextFunction): void => {
  const uploadHandler = upload.single('file');
  uploadHandler(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.badRequest(null, req.__('FILE_SIZE_EXCEEDED'));
          return;
        }
        res.badRequest(null, err.message);
        return;
      }
      const error = err as Error;
      if (error.message === 'FILE_TYPE_NOT_SUPPORTED') {
        res.badRequest(null, req.__('FILE_TYPE_NOT_SUPPORTED'));
        return;
      }
      res.badRequest(null, error.message || req.__('GENERAL_ERROR'));
      return;
    }
    next();
  });
};

export default uploadSingleDocument;
