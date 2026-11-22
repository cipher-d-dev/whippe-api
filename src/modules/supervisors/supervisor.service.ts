import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Supervisor, ISupervisorDocument } from './supervisor.model';
import { User, IUserDocument } from '../users/user.model';
import { Intern } from '../interns/intern.model';
import { Department } from '../departments/department.model';
import { Role, AccountStatus, AuthMethod } from '../auth/auth.types';
import { createError } from '../../middleware/error-handler';
import {
  CreateSupervisorInput,
  UpdateSupervisorInput,
  ListSupervisorsQuery,
} from './supervisor.schema';
import { PaginatedResponse } from '../users/user.types';
import { IInternDocument } from '../interns/intern.model';
import { staffPortalUrl } from '../../lib/urls';
import { sendEmail } from '../../lib/email';
import { renderSupervisorInviteEmail } from '../../lib/email-templates';

const BCRYPT_ROUNDS = 12;

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createSupervisor(
  input: CreateSupervisorInput,
  hrUserId: string,
): Promise<ISupervisorDocument> {
  let user: IUserDocument | null = null;
  let rawPassword = input.password;

  if (input.userId) {
    if (!mongoose.isValidObjectId(input.userId)) {
      throw createError('Invalid userId.', 400);
    }
    user = await User.findById(input.userId);
    if (!user) throw createError('User not found.', 404);

    if (user.role !== Role.SUPERVISOR) {
      throw createError('A supervisor profile can only be created for a user with the SUPERVISOR role.', 400);
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw createError('A supervisor profile can only be created for an active account.', 409);
    }

    const existing = await Supervisor.findOne({ user: input.userId });
    if (existing) throw createError('A supervisor profile already exists for this user.', 409);
  } else if (input.email) {
    // Check if an account already exists with this email
    const existingUser = await User.findOne({ email: input.email.toLowerCase() });
    if (existingUser) {
      // If user already exists as active supervisor without a profile, attach to it
      const existingProfile = await Supervisor.findOne({ user: existingUser._id });
      if (existingProfile) {
        throw createError('A supervisor profile already exists for this email.', 409);
      }
      if (existingUser.role !== Role.SUPERVISOR) {
        throw createError(`An account with this email already exists with role ${existingUser.role}.`, 409);
      }
      user = existingUser;
    } else {
      // Create new User account directly for this supervisor
      rawPassword = input.password || crypto.randomBytes(6).toString('hex'); // e.g. "a1b2c3d4e5f6"
      const passwordHash = await bcrypt.hash(rawPassword, BCRYPT_ROUNDS);

      user = await User.create({
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: Role.SUPERVISOR,
        status: AccountStatus.ACTIVE,
        authMethod: AuthMethod.PASSWORD,
        verifiedAt: new Date(),
        verifiedBy: new mongoose.Types.ObjectId(hrUserId),
      });
    }
  } else {
    throw createError('Either userId or email is required.', 400);
  }

  const departmentIds = resolveDepartmentIds(input) ?? [];

  let departmentName: string | undefined;
  if (departmentIds.length) {
    const depts = await Department.find({ _id: { $in: departmentIds } });
    departmentName = depts
      .map((d) => (d.subsidiary ? `${d.name} (${d.subsidiary})` : d.name))
      .join(', ') || undefined;
  }

  const supervisor = await Supervisor.create({
    user: user._id,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    department: departmentIds[0],
    departments: departmentIds,
    createdBy: new mongoose.Types.ObjectId(hrUserId),
  });

  // Send invitation email if email is present
  if (user.email) {
    const rendered = renderSupervisorInviteEmail({
      firstName: input.firstName,
      email: user.email,
      temporaryPassword: rawPassword,
      loginUrl: `${staffPortalUrl()}/login`,
      departmentName,
    });

    void sendEmail({
      to: user.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  return supervisor;
}

// ─── Departments helper ───────────────────────────────────────────────────────
// Accepts either `departments` (several) or the older single `department`.
// Returns the de-duplicated list; the first one is the main department.
function resolveDepartmentIds(input: { department?: string; departments?: string[] }): mongoose.Types.ObjectId[] | undefined {
  const raw = input.departments ?? (input.department !== undefined ? (input.department ? [input.department] : []) : undefined);
  if (raw === undefined) return undefined;
  const unique = [...new Set(raw.filter(Boolean))];
  for (const id of unique) {
    if (!mongoose.isValidObjectId(id)) throw createError('Invalid department ID.', 400);
  }
  return unique.map((id) => new mongoose.Types.ObjectId(id));
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listSupervisors(
  query: ListSupervisorsQuery,
): Promise<PaginatedResponse<ISupervisorDocument>> {
  const { page, limit, department, isActive } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (department && mongoose.isValidObjectId(department)) {
    const deptId = new mongoose.Types.ObjectId(department);
    filter['$or'] = [{ department: deptId }, { departments: deptId }];
  }
  if (isActive !== undefined) filter['isActive'] = isActive;

  const [data, total] = await Promise.all([
    Supervisor.find(filter)
      .sort({ lastName: 1, firstName: 1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'email')
      .populate('department', 'name subsidiary')
      .populate('departments', 'name subsidiary'),
    Supervisor.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getSupervisorById(id: string): Promise<ISupervisorDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid supervisor ID.', 400);

  const supervisor = await Supervisor.findById(id)
    .populate('user', 'email')
    .populate('department', 'name subsidiary')
      .populate('departments', 'name subsidiary');

  if (!supervisor) throw createError('Supervisor not found.', 404);

  return supervisor;
}

// ─── Get by user ID ───────────────────────────────────────────────────────────

export async function getSupervisorByUserId(userId: string): Promise<ISupervisorDocument> {
  if (!mongoose.isValidObjectId(userId)) throw createError('Invalid user ID.', 400);

  const supervisor = await Supervisor.findOne({ user: userId })
    .populate('user', 'email')
    .populate('department', 'name subsidiary')
      .populate('departments', 'name subsidiary');

  if (!supervisor) throw createError('Supervisor profile not found for this account.', 404);

  return supervisor;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateSupervisor(
  id: string,
  input: UpdateSupervisorInput,
): Promise<ISupervisorDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid supervisor ID.', 400);

  const departmentIds = resolveDepartmentIds(input);
  const { department: _d, departments: _ds, ...rest } = input;
  const update: Record<string, unknown> = { ...rest };
  if (departmentIds) {
    update['departments'] = departmentIds;
    if (departmentIds.length) update['department'] = departmentIds[0];
    else update['$unset'] = { department: 1 };
  }

  const supervisor = await Supervisor.findByIdAndUpdate(id, update, { new: true })
    .populate('department', 'name subsidiary')
    .populate('departments', 'name subsidiary');
  if (!supervisor) throw createError('Supervisor not found.', 404);

  // When a supervisor is deactivated, clear their intern assignments so HR
  // can see clearly which interns are now unassigned and need reassignment.
  if (input.isActive === false) {
    await Intern.updateMany(
      { supervisor: new mongoose.Types.ObjectId(id) },
      { $unset: { supervisor: 1 } },
    );
  }

  return supervisor;
}

// ─── Get assigned interns ─────────────────────────────────────────────────────

export async function getSupervisorInterns(
  supervisorId: string,
): Promise<IInternDocument[]> {
  if (!mongoose.isValidObjectId(supervisorId)) {
    throw createError('Invalid supervisor ID.', 400);
  }

  const supervisor = await Supervisor.findById(supervisorId);
  if (!supervisor) throw createError('Supervisor not found.', 404);

  return Intern.find({ supervisor: supervisorId })
    .populate('user', 'email status')
    .populate('department', 'name subsidiary')
      .populate('departments', 'name subsidiary');
}
