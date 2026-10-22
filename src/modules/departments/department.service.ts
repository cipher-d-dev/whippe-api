import mongoose from 'mongoose';
import { Department, IDepartmentDocument } from './department.model';
import { createError } from '../../middleware/error-handler';
import {
  CreateDepartmentInput,
  UpdateDepartmentInput,
  ListDepartmentsQuery,
} from './department.schema';
import { PaginatedResponse } from '../users/user.types';

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createDepartment(
  input: CreateDepartmentInput,
  hrUserId: string,
): Promise<IDepartmentDocument> {
  const existing = await Department.findOne({
    name: { $regex: new RegExp(`^${input.name}$`, 'i') },
  });
  if (existing) {
    throw createError(`A department named "${input.name}" already exists.`, 409);
  }

  return Department.create({
    ...input,
    createdBy: new mongoose.Types.ObjectId(hrUserId),
  });
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listDepartments(
  query: ListDepartmentsQuery,
): Promise<PaginatedResponse<IDepartmentDocument>> {
  const { page, limit, subsidiary, isActive } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (subsidiary) filter['subsidiary'] = { $regex: new RegExp(subsidiary, 'i') };
  if (isActive !== undefined) filter['isActive'] = isActive;

  const [data, total] = await Promise.all([
    Department.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Department.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getDepartmentById(id: string): Promise<IDepartmentDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid department ID.', 400);

  const dept = await Department.findById(id);
  if (!dept) throw createError('Department not found.', 404);

  return dept;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateDepartment(
  id: string,
  input: UpdateDepartmentInput,
): Promise<IDepartmentDocument> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid department ID.', 400);

  // Check name uniqueness if name is being changed
  if (input.name) {
    const conflict = await Department.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${input.name}$`, 'i') },
    });
    if (conflict) {
      throw createError(`A department named "${input.name}" already exists.`, 409);
    }
  }

  const dept = await Department.findByIdAndUpdate(id, input, { new: true });
  if (!dept) throw createError('Department not found.', 404);

  return dept;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteDepartment(id: string): Promise<void> {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid department ID.', 400);

  const dept = await Department.findById(id);
  if (!dept) throw createError('Department not found.', 404);

  await Department.findByIdAndDelete(id);
}
