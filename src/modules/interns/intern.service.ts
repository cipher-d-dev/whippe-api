import mongoose from 'mongoose';
import { Intern, IInternDocument } from './intern.model';
import { Supervisor } from '../supervisors/supervisor.model';
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
import { createNotification } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';
import { logAction } from '../timeline/audit-log.service';
import { AuditAction } from '../timeline/audit-log.types';

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createIntern(
  input: CreateInternInput,
  hrUserId: string,
): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(input.userId)) {
    throw createError('Invalid userId.', 400);
  }

  const user = await User.findById(input.userId);
  if (!user) throw createError('User not found.', 404);

  if (user.role !== Role.INTERN) {
    throw createError('An intern record can only be created for a user with the INTERN role.', 400);
  }

  if (user.status !== AccountStatus.ACTIVE) {
    throw createError('An intern record can only be created for an active (HR-verified) account.', 409);
  }

  const existing = await Intern.findOne({ user: input.userId });
  if (existing) throw createError('An intern record already exists for this user.', 409);

  return Intern.create({
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
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listInterns(
  query: ListInternsQuery,
  actorUserId?: string,
  actorRole?: Role,
): Promise<PaginatedResponse<IInternDocument>> {
  const { page, limit, status, internshipType, department, supervisor, search } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (status) filter['status'] = status;
  if (internshipType) filter['internshipType'] = internshipType;
  if (department && mongoose.isValidObjectId(department)) {
    filter['department'] = new mongoose.Types.ObjectId(department);
  }

  // If caller is a supervisor, restrict to only their assigned interns
  if (actorRole === Role.SUPERVISOR && actorUserId) {
    const supervisorRecord = await Supervisor.findOne({
      $or: [
        { user: new mongoose.Types.ObjectId(actorUserId) },
        { user: actorUserId },
      ],
    });
    if (!supervisorRecord) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }
    filter['supervisor'] = supervisorRecord._id;
  } else if (supervisor && mongoose.isValidObjectId(supervisor)) {
    filter['supervisor'] = new mongoose.Types.ObjectId(supervisor);
  }
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
      .populate('user', 'email role status')
      .populate('department', 'name subsidiary')
      .populate('supervisor', 'firstName lastName'),
    Intern.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getInternById(id: string): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid intern ID.', 400);

  const intern = await Intern.findById(id)
    .populate('user', 'email role status')
    .populate('department', 'name subsidiary')
    .populate('supervisor', 'firstName lastName');

  if (!intern) throw createError('Intern not found.', 404);
  return intern;
}

// ─── Get by user ID ───────────────────────────────────────────────────────────

export async function getInternByUserId(userId: string): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(userId)) throw createError('Invalid user ID.', 400);

  const intern = await Intern.findOne({ user: userId })
    .populate('user', 'email role status')
    .populate('department', 'name subsidiary')
    .populate('supervisor', 'firstName lastName');

  if (!intern) throw createError('Intern record not found for this account.', 404);
  return intern;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateIntern(
  id: string,
  input: UpdateInternInput,
  actorRole: Role,
): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid intern ID.', 400);

  const intern = await Intern.findById(id);
  if (!intern) throw createError('Intern not found.', 404);

  if (actorRole === Role.INTERN) {
    const attempted = Object.keys(input) as (keyof UpdateInternInput)[];
    const forbidden = attempted.filter((f) => !INTERN_PERMITTED_UPDATE_FIELDS.includes(f));
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

// ─── Assign department ────────────────────────────────────────────────────────

export async function assignDepartment(
  internId: string,
  departmentId: string,
  hrUserId: string,
): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);
  if (!mongoose.isValidObjectId(departmentId)) throw createError('Invalid department ID.', 400);

  const intern = await Intern.findByIdAndUpdate(
    internId,
    { department: new mongoose.Types.ObjectId(departmentId) },
    { new: true },
  ).populate('department', 'name subsidiary');

  if (!intern) throw createError('Intern not found.', 404);

  await logAction({
    action: AuditAction.DEPARTMENT_ASSIGNED,
    performedBy: hrUserId,
    targetIntern: internId,
    detail: `Department ${departmentId} assigned`,
  }).catch(() => {});

  return intern;
}

// ─── Assign supervisor ────────────────────────────────────────────────────────

export async function assignSupervisor(
  internId: string,
  supervisorId: string,
  hrUserId: string,
): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);
  if (!mongoose.isValidObjectId(supervisorId)) throw createError('Invalid supervisor ID.', 400);

  const intern = await Intern.findByIdAndUpdate(
    internId,
    { supervisor: new mongoose.Types.ObjectId(supervisorId) },
    { new: true },
  ).populate('supervisor', 'firstName lastName');

  if (!intern) throw createError('Intern not found.', 404);

  // Notify the intern that a supervisor has been assigned to them
  await createNotification(
    intern.user.toString(),
    NotificationType.SUPERVISOR_ASSIGNED,
    'Supervisor assigned',
    'A supervisor has been assigned to you. Check your profile for details.',
    { kind: 'Supervisor', id: supervisorId },
  ).catch(() => {});

  await logAction({
    action: AuditAction.SUPERVISOR_ASSIGNED,
    performedBy: hrUserId,
    targetIntern: internId,
    detail: `Supervisor ${supervisorId} assigned`,
  }).catch(() => {});

  return intern;
}

// ─── Remove department assignment ─────────────────────────────────────────────

export async function removeDepartment(internId: string, hrUserId: string): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);

  const intern = await Intern.findByIdAndUpdate(
    internId,
    { $unset: { department: 1 } },
    { new: true },
  );
  if (!intern) throw createError('Intern not found.', 404);

  await logAction({
    action: AuditAction.DEPARTMENT_REMOVED,
    performedBy: hrUserId,
    targetIntern: internId,
  }).catch(() => {});

  return intern;
}

// ─── Remove supervisor assignment ─────────────────────────────────────────────

export async function removeSupervisor(internId: string, hrUserId: string): Promise<IInternDocument> {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);

  const intern = await Intern.findByIdAndUpdate(
    internId,
    { $unset: { supervisor: 1 } },
    { new: true },
  );
  if (!intern) throw createError('Intern not found.', 404);

  await logAction({
    action: AuditAction.SUPERVISOR_REMOVED,
    performedBy: hrUserId,
    targetIntern: internId,
  }).catch(() => {});

  return intern;
}
