import mongoose from 'mongoose';
import { Intern, IInternDocument } from './intern.model';
import { User } from '../users/user.model';
import { AccountStatus, Role } from '../auth/auth.types';
import { createError } from '../../middleware/error-handler';
import {
  CreateInternInput,
  UpdateInternInput,
  ListInternsQuery,
  INTERN_PERMITTED_UPDATE_FIELDS,
} from './intern.schema';
import { PaginatedResponse } from '../users/user.types';

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createIntern(
  input: CreateInternInput,
  hrUserId: string,
): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(input.userId)) {
    throw createError('Invalid userId.', 400);
  }

  // The linked user must exist and be an intern account
  const user = await User.findById(input.userId);
  if (!user) {
    throw createError('User not found.', 404);
  }

  if (user.role !== Role.INTERN) {
    throw createError('An intern record can only be created for a user with the INTERN role.', 400);
  }

  if (user.status !== AccountStatus.ACTIVE) {
    throw createError('An intern record can only be created for an active (HR-verified) account.', 409);
  }

  // Prevent duplicate intern records for the same user
  const existing = await Intern.findOne({ user: input.userId });
  if (existing) {
    throw createError('An intern record already exists for this user.', 409);
  }

  const intern = await Intern.create({
    user: new mongoose.Types.ObjectId(input.userId),
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    address: input.address,
    institution: input.institution,
    course: input.course,
    level: input.level,
    internshipType: input.internshipType,
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    createdBy: new mongoose.Types.ObjectId(hrUserId),
  });

  return intern;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listInterns(
  query: ListInternsQuery,
): Promise<PaginatedResponse<IInternDocument>> {
  const { page, limit, status, internshipType, department, supervisor, search } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (status) filter['status'] = status;
  if (internshipType) filter['internshipType'] = internshipType;
  if (department && mongoose.isValidObjectId(department)) {
    filter['department'] = new mongoose.Types.ObjectId(department);
  }
  if (supervisor && mongoose.isValidObjectId(supervisor)) {
    filter['supervisor'] = new mongoose.Types.ObjectId(supervisor);
  }

  // Basic name/institution search
  if (search) {
    const regex = new RegExp(search, 'i');
    filter['$or'] = [
      { firstName: regex },
      { lastName: regex },
      { institution: regex },
      { course: regex },
    ];
  }

  const [data, total] = await Promise.all([
    Intern.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'email role status'),
    Intern.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getInternById(id: string): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(id)) {
    throw createError('Invalid intern ID.', 400);
  }

  const intern = await Intern.findById(id).populate('user', 'email role status');
  if (!intern) {
    throw createError('Intern not found.', 404);
  }

  return intern;
}

// ─── Get by user ID ───────────────────────────────────────────────────────────
// Used when an intern looks up their own record via their account ID.

export async function getInternByUserId(userId: string): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(userId)) {
    throw createError('Invalid user ID.', 400);
  }

  const intern = await Intern.findOne({ user: userId }).populate(
    'user',
    'email role status',
  );

  if (!intern) {
    throw createError('Intern record not found for this account.', 404);
  }

  return intern;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateIntern(
  id: string,
  input: UpdateInternInput,
  actorRole: Role,
): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(id)) {
    throw createError('Invalid intern ID.', 400);
  }

  const intern = await Intern.findById(id);
  if (!intern) {
    throw createError('Intern not found.', 404);
  }

  // Interns may only update their own permitted fields
  if (actorRole === Role.INTERN) {
    const attemptedFields = Object.keys(input) as (keyof UpdateInternInput)[];
    const forbidden = attemptedFields.filter(
      (f) => !INTERN_PERMITTED_UPDATE_FIELDS.includes(f),
    );
    if (forbidden.length > 0) {
      throw createError(
        `Interns may only update: ${INTERN_PERMITTED_UPDATE_FIELDS.join(', ')}.`,
        403,
      );
    }
  }

  Object.assign(intern, input);
  await intern.save();

  return intern;
}
