import type { Response } from 'express';
import { uploadToR2 } from '../../config/r2.js';
import { AppError } from '../../errors/AppError.js';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';

const uploadSingle = async (req: CustomRequest, res: Response) => {
  if (!req.file) {
    throw new AppError(400, 'No file uploaded!');
  }

  const folder = (req.body.folder as string) || 'home-tutor-bd/documents';

  const result = await uploadToR2(
    req.file.buffer,
    folder,
    req.file.originalname,
    req.file.mimetype,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'File uploaded to R2 successfully.',
    data: {
      url: result.url,
      key: result.key,
    },
  });
};

const uploadMultiple = async (req: CustomRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    throw new AppError(400, 'No files uploaded!');
  }

  const folder = (req.body.folder as string) || 'home-tutor-bd/documents';

  const uploadPromises = files.map((file) =>
    uploadToR2(file.buffer, folder, file.originalname, file.mimetype),
  );

  const results = await Promise.all(uploadPromises);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Files uploaded to R2 successfully.',
    data: results.map((r) => ({
      url: r.url,
      key: r.key,
    })),
  });
};

export const UploadController = {
  uploadSingle,
  uploadMultiple,
};
