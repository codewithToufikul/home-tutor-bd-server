import { AppError } from '../../errors/AppError.js';
import { TuitionJob } from '../tuition/tuition.model.js';
import { Application } from './application.model.js';

const getMyApplications = async (tutorId: string) => {
  const applications = await Application.find({ tutorId })
    .populate({
      path: 'jobId',
      populate: { path: 'postedBy', select: 'name email phone avatar' },
    })
    .sort({ createdAt: -1 });

  return applications;
};

const getApplicationById = async (id: string) => {
  const application = await Application.findById(id)
    .populate('tutorId', 'name email phone avatar')
    .populate({
      path: 'jobId',
      populate: { path: 'postedBy', select: 'name email phone avatar' },
    });

  if (!application) {
    throw new AppError(404, 'Application not found!');
  }
  return application;
};

const acceptApplication = async (id: string, userId: string, userRole: string) => {
  const application = await Application.findById(id).populate('jobId');
  if (!application) {
    throw new AppError(404, 'Application not found!');
  }

  const job = application.jobId as unknown as { postedBy: string; _id: string };

  if (userRole !== 'admin' && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to accept this application!');
  }

  application.status = 'Accepted';
  await application.save();

  await TuitionJob.findByIdAndUpdate(job._id, { status: 'Matched' });

  return application;
};

const rejectApplication = async (id: string, userId: string, userRole: string) => {
  const application = await Application.findById(id).populate('jobId');
  if (!application) {
    throw new AppError(404, 'Application not found!');
  }

  const job = application.jobId as unknown as { postedBy: string };

  if (userRole !== 'admin' && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to reject this application!');
  }

  application.status = 'Rejected';
  await application.save();

  return application;
};

export const ApplicationService = {
  getMyApplications,
  getApplicationById,
  acceptApplication,
  rejectApplication,
};
