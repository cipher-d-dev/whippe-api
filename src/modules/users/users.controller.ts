import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import {
  approveUserSchema,
  rejectUserSchema,
  listUsersSchema,
} from './users.schema';
import { getAuthUser } from '../../middleware/auth';

// ─── GET /users/verification-queue ───────────────────────────────────────────
// HR only — list of PENDING_HR_VERIFICATION accounts, oldest first.

export async function getVerificationQueueHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { query } = listUsersSchema.parse({ query: req.query });
    const result = await usersService.getVerificationQueue(query);

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── GET /users ───────────────────────────────────────────────────────────────
// HR only — list all users with optional status/role filters.

export async function listUsersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { query } = listUsersSchema.parse({ query: req.query });
    const result = await usersService.listUsers(query);

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── GET /users/:userId ───────────────────────────────────────────────────────
// HR: any user. Intern/Supervisor: own profile only (enforced below).

export async function getUserByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { userId } = req.params;
    const actor = getAuthUser(req);

    // Non-HR users can only view their own record
    const targetId =
      actor.role === 'HR' ? userId : actor.id;

    const user = await usersService.getUserById(targetId);

    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /users/:userId/approve ─────────────────────────────────────────────
// HR only.

export async function approveUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { params } = approveUserSchema.parse({ params: req.params });
    const actor = getAuthUser(req);

    usersService.assertNotSelf(actor.id, params.userId);

    const user = await usersService.getUserById(params.userId);
    usersService.assertCanActOnRole(user.role);

    const updated = await usersService.approveUser(params.userId, actor.id);

    res.status(200).json({
      success: true,
      message: 'Account approved successfully.',
      data: { user: updated },
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /users/:userId/reject ──────────────────────────────────────────────
// HR only.

export async function rejectUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { params, body } = rejectUserSchema.parse({
      params: req.params,
      body: req.body,
    });
    const actor = getAuthUser(req);

    usersService.assertNotSelf(actor.id, params.userId);

    const user = await usersService.getUserById(params.userId);
    usersService.assertCanActOnRole(user.role);

    const updated = await usersService.rejectUser(
      params.userId,
      actor.id,
      body.reason,
    );

    res.status(200).json({
      success: true,
      message: 'Account rejected.',
      data: { user: updated },
    });
  } catch (err) {
    next(err);
  }
}
