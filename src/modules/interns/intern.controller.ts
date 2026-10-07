import { Request, Response, NextFunction } from 'express';
import * as internService from './intern.service';
import { IInternDocument } from './intern.model';
import {
  createInternSchema,
  updateInternSchema,
  listInternsSchema,
} from './intern.schema';
import { getAuthUser } from '../../middleware/auth';
import { Role } from '../auth/auth.types';

// ─── Helper ───────────────────────────────────────────────────────────────────
// intern.user may be a populated object or a raw ObjectId depending on the query.
// This extracts the string ID safely in both cases.

function extractUserId(user: IInternDocument['user']): string {
  // After populate(), user is a document with _id. Otherwise it's an ObjectId.
  const asDoc = user as unknown as { _id?: { toString(): string } };
  if (asDoc._id) return asDoc._id.toString();
  return user.toString();
}

// ─── POST /interns ────────────────────────────────────────────────────────────
// HR only.

export async function createInternHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { body } = createInternSchema.parse({ body: req.body });
    const actor = getAuthUser(req);

    const intern = await internService.createIntern(body, actor.id);

    res.status(201).json({
      success: true,
      message: 'Intern record created.',
      data: { intern },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /interns ─────────────────────────────────────────────────────────────
// HR only.

export async function listInternsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { query } = listInternsSchema.parse({ query: req.query });
    const result = await internService.listInterns(query);

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── GET /interns/me ──────────────────────────────────────────────────────────
// Intern gets their own record by their user ID.

export async function getMyInternRecordHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const intern = await internService.getInternByUserId(actor.id);

    res.status(200).json({ success: true, data: { intern } });
  } catch (err) {
    next(err);
  }
}

// ─── GET /interns/:id ─────────────────────────────────────────────────────────
// HR: any intern. Intern: only their own (enforced by checking user reference).

export async function getInternByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const intern = await internService.getInternById(req.params.id);

    // Interns may only view their own record
    if (actor.role === Role.INTERN) {
      if (extractUserId(intern.user) !== actor.id) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to view this record.',
        });
        return;
      }
    }

    res.status(200).json({ success: true, data: { intern } });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /interns/:id ───────────────────────────────────────────────────────
// HR: any field. Intern: phone and address only (enforced in service).

export async function updateInternHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { params, body } = updateInternSchema.parse({
      params: req.params,
      body: req.body,
    });
    const actor = getAuthUser(req);

    // Interns can only update their own record
    if (actor.role === Role.INTERN) {
      const intern = await internService.getInternById(params.id);
      if (extractUserId(intern.user) !== actor.id) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to update this record.',
        });
        return;
      }
    }

    const updated = await internService.updateIntern(params.id, body, actor.role);

    res.status(200).json({
      success: true,
      message: 'Intern record updated.',
      data: { intern: updated },
    });
  } catch (err) {
    next(err);
  }
}
