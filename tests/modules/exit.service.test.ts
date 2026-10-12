import mongoose from 'mongoose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/modules/interns/intern.model', () => ({
  Intern: { findById: jest.fn() },
}));

jest.mock('../../src/modules/tasks/task.model', () => ({
  Task: { find: jest.fn() },
}));

jest.mock('../../src/modules/documents/document.model', () => ({
  DocumentRecord: { find: jest.fn() },
}));

jest.mock('../../src/modules/evaluations/evaluation.model', () => ({
  Evaluation: { find: jest.fn() },
}));

jest.mock('../../src/modules/timeline/audit-log.service', () => ({
  logAction: jest.fn().mockResolvedValue({}),
}));

import { Intern } from '../../src/modules/interns/intern.model';
import { Task } from '../../src/modules/tasks/task.model';
import { DocumentRecord } from '../../src/modules/documents/document.model';
import { Evaluation } from '../../src/modules/evaluations/evaluation.model';
import { getExitChecklist, completeInternship } from '../../src/modules/interns/exit.service';
import { InternshipStatus } from '../../src/modules/interns/intern.types';
import { TaskStatus } from '../../src/modules/tasks/task.types';
import { DocumentStatus } from '../../src/modules/documents/document.types';

const internId = new mongoose.Types.ObjectId().toString();
const hrUserId = new mongoose.Types.ObjectId().toString();

function makeMockIntern(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new mongoose.Types.ObjectId(internId),
    firstName: 'Test',
    lastName: 'Intern',
    status: InternshipStatus.ACTIVE,
    completedAt: undefined as Date | undefined,
    completionNote: undefined as string | undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── getExitChecklist ─────────────────────────────────────────────────────────

describe('getExitChecklist', () => {
  it('returns canComplete=true when all items pass', async () => {
    (Intern.findById as jest.Mock).mockResolvedValue(makeMockIntern());
    (Task.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (DocumentRecord.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (Evaluation.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]) });

    const result = await getExitChecklist(internId);

    expect(result.canComplete).toBe(true);
    expect(result.items.every((i) => i.passed)).toBe(true);
  });

  it('returns canComplete=false when tasks are outstanding', async () => {
    (Intern.findById as jest.Mock).mockResolvedValue(makeMockIntern());
    (Task.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { status: TaskStatus.IN_PROGRESS },
      { status: TaskStatus.TODO },
    ]) });
    (DocumentRecord.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (Evaluation.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]) });

    const result = await getExitChecklist(internId);

    expect(result.canComplete).toBe(false);
    const tasksItem = result.items.find((i) => i.label === 'All tasks resolved');
    expect(tasksItem?.passed).toBe(false);
  });

  it('returns canComplete=false when required documents are pending', async () => {
    (Intern.findById as jest.Mock).mockResolvedValue(makeMockIntern());
    (Task.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([{ status: TaskStatus.COMPLETED }]) });
    (DocumentRecord.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { status: DocumentStatus.PENDING },
    ]) });
    (Evaluation.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]) });

    const result = await getExitChecklist(internId);

    expect(result.canComplete).toBe(false);
    const docsItem = result.items.find((i) => i.label.includes('documents'));
    expect(docsItem?.passed).toBe(false);
  });

  it('returns canComplete=false when no evaluations submitted', async () => {
    (Intern.findById as jest.Mock).mockResolvedValue(makeMockIntern());
    (Task.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (DocumentRecord.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (Evaluation.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const result = await getExitChecklist(internId);

    expect(result.canComplete).toBe(false);
    const evalItem = result.items.find((i) => i.label.includes('evaluation'));
    expect(evalItem?.passed).toBe(false);
  });

  it('throws 409 when internship is already completed', async () => {
    (Intern.findById as jest.Mock).mockResolvedValue(
      makeMockIntern({ status: InternshipStatus.COMPLETED }),
    );

    await expect(getExitChecklist(internId)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 404 when intern not found', async () => {
    (Intern.findById as jest.Mock).mockResolvedValue(null);

    await expect(getExitChecklist(internId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 for an invalid internId', async () => {
    await expect(getExitChecklist('not-an-id')).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─── completeInternship ───────────────────────────────────────────────────────

describe('completeInternship', () => {
  it('sets status to COMPLETED and records completedAt', async () => {
    const mockIntern = makeMockIntern();
    (Intern.findById as jest.Mock).mockResolvedValue(mockIntern);
    (Task.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (DocumentRecord.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (Evaluation.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]) });

    const result = await completeInternship(internId, hrUserId);

    expect(mockIntern.status).toBe(InternshipStatus.COMPLETED);
    expect(mockIntern.completedAt).toBeInstanceOf(Date);
    expect(mockIntern.save).toHaveBeenCalled();
    expect(result.status).toBe(InternshipStatus.COMPLETED);
  });

  it('records an optional completionNote', async () => {
    const mockIntern = makeMockIntern();
    (Intern.findById as jest.Mock).mockResolvedValue(mockIntern);
    (Task.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (DocumentRecord.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (Evaluation.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]) });

    await completeInternship(internId, hrUserId, 'Excellent performance');

    expect(mockIntern.completionNote).toBe('Excellent performance');
  });

  it('throws 422 when checklist has outstanding items', async () => {
    (Intern.findById as jest.Mock).mockResolvedValue(makeMockIntern());
    (Task.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([{ status: TaskStatus.IN_PROGRESS }]) });
    (DocumentRecord.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (Evaluation.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]) });

    await expect(completeInternship(internId, hrUserId)).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('throws 409 when internship is already completed', async () => {
    (Intern.findById as jest.Mock).mockResolvedValue(
      makeMockIntern({ status: InternshipStatus.COMPLETED }),
    );

    await expect(completeInternship(internId, hrUserId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
