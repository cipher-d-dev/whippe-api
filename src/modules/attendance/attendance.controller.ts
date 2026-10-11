import { Request, Response, NextFunction } from 'express';
import * as attendanceService from './attendance.service';
import {
  checkInSchema,
  correctAttendanceSchema,
  listAttendanceSchema,
} from './attendance.schema';
import { getAuthUser } from '../../middleware/auth';
import { Role } from '../auth/auth.types';

export async function checkInHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { body } = checkInSchema.parse({ body: req.body });
    const actor = getAuthUser(req);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress
      ?? 'unknown';
    const ua = req.headers['user-agent'] ?? 'unknown';

    const record = await attendanceService.checkIn(actor.id, body, ip, ua);
    res.status(201).json({ success: true, data: { attendance: record } });
  } catch (err) { next(err); }
}

export async function listAttendanceHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { query } = listAttendanceSchema.parse({ query: req.query });
    const actor = getAuthUser(req);

    // Supervisors see only their assigned interns' attendance — scoped in query
    // HR sees all — no restriction
    const result = actor.role === Role.INTERN
      ? await attendanceService.getMyAttendance(actor.id, query)
      : await attendanceService.listAttendance(query);

    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getAttendanceByIdHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const actor = getAuthUser(req);
    const record = await attendanceService.getAttendanceById(req.params.id);

    // Interns may only view their own records
    if (actor.role === Role.INTERN) {
      const internId = (record.intern as unknown as { _id: { toString(): string } })._id.toString();
      const { Intern } = await import('../interns/intern.model');
      const intern = await Intern.findOne({ user: actor.id });
      if (!intern || intern._id.toString() !== internId) {
        res.status(403).json({ success: false, message: 'You do not have permission to view this record.' });
        return;
      }
    }

    res.status(200).json({ success: true, data: { attendance: record } });
  } catch (err) { next(err); }
}

export async function correctAttendanceHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { params, body } = correctAttendanceSchema.parse({ params: req.params, body: req.body });
    const actor = getAuthUser(req);
    const record = await attendanceService.correctAttendance(params.id, body, actor.id);
    res.status(200).json({ success: true, message: 'Attendance corrected.', data: { attendance: record } });
  } catch (err) { next(err); }
}
