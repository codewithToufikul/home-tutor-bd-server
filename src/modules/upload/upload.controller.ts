import type { Response } from 'express';
import { uploadToCloudinary } from '../../config/cloudinary.js';
import { AppError } from '../../errors/AppError.js';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';

const uploadSingle = async (req: CustomRequest, res: Response) => {
  if (!req.file) {
    throw new AppError(400, 'No file uploaded!');
  }

  const folder = (req.body.folder as string) || 'home-tutor-bd/documents';

  const result = await uploadToCloudinary(req.file.buffer, folder, 'auto');

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'File uploaded to Cloudinary successfully.',
    data: {
      url: result.secure_url,
      publicId: result.public_id,
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
    uploadToCloudinary(file.buffer, folder, 'auto'),
  );

  const results = await Promise.all(uploadPromises);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Files uploaded to Cloudinary successfully.',
    data: results.map((r) => ({
      url: r.secure_url,
      publicId: r.public_id,
    })),
  });
};

export const UploadController = {
  uploadSingle,
  uploadMultiple,
};
