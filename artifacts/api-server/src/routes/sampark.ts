import { Router, type IRouter } from "express";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
} from "drizzle-orm";
import {
  appointmentSlotsTable,
  db,
  visitsTable,
  type Visit,
} from "@workspace/db";
import {
  CreateOfficeSlotBody,
  CreateOfficeSlotResponse,
  CreateVisitBody,
  CreateVisitResponse,
  DeleteOfficeSlotParams,
  GetAvailabilityQueryParams,
  GetAvailabilityResponse,
  GetOfficeAnalyticsResponse,
  GetOfficeAppointmentsQueryParams,
  GetOfficeAppointmentsResponse,
  GetOfficeDashboardResponse,
  GetOfficeQueueResponse,
  GetOfficeSlotsResponse,
  GetOfficeVisitParams,
  GetOfficeVisitResponse,
  GetVisitStatusParams,
  GetVisitStatusResponse,
  SaveVisitOutcomeBody,
  SaveVisitOutcomeParams,
  SaveVisitOutcomeResponse,
  SearchOfficeVisitsQueryParams,
  SearchOfficeVisitsResponse,
  UpdateQueueActionBody,
  UpdateQueueActionParams,
  UpdateQueueActionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const indiaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function indiaDate(): string {
  return indiaDateFormatter.format(new Date());
}

function dateBounds(dateKey: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateKey}T00:00:00+05:30`),
    end: new Date(`${dateKey}T23:59:59.999+05:30`),
  };
}

function calendarDate(
  value: Date | string | null | undefined,
): string | null | undefined {
  if (value == null || typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

function parseQueryDate(value: unknown): Date | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function queueEntry(visit: Visit) {
  return {
    id: visit.id,
    token: visit.token,
    fullName: visit.fullName,
    purpose: visit.purpose,
    department: visit.department,
    waitingMinutes: Math.max(
      0,
      Math.round((Date.now() - visit.registeredAt.getTime()) / 60000),
    ),
    priority: visit.priority,
    status: visit.status,
    location: visit.location,
  };
}

function visitResponse(visit: Visit) {
  return {
    ...visit,
    queuePosition: ["waiting", "called", "held"].includes(visit.status)
      ? visit.queuePosition
      : 0,
    estimatedWait: 0,
    previousVisits: visit.previousVisits ?? 0,
  };
}

async function allVisits(todayOnly = false): Promise<Visit[]> {
  const query = db.select().from(visitsTable);
  if (todayOnly) {
    return query
      .where(eq(visitsTable.visitDate, indiaDate()))
      .orderBy(asc(visitsTable.queuePosition), desc(visitsTable.registeredAt));
  }
  return query.orderBy(desc(visitsTable.registeredAt));
}

async function currentQueueCount(): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(visitsTable)
    .where(
      and(
        eq(visitsTable.visitDate, indiaDate()),
        or(
          eq(visitsTable.status, "waiting"),
          eq(visitsTable.status, "called"),
          eq(visitsTable.status, "held"),
        ),
      ),
    );
  return Number(result?.total ?? 0);
}

async function reindexTodayQueue(): Promise<void> {
  const queue = await db
    .select({ id: visitsTable.id })
    .from(visitsTable)
    .where(
      and(
        eq(visitsTable.visitDate, indiaDate()),
        eq(visitsTable.status, "waiting"),
      ),
    )
    .orderBy(asc(visitsTable.registeredAt));
  await Promise.all(
    queue.map((entry, index) =>
      db
        .update(visitsTable)
        .set({ queuePosition: index + 1 })
        .where(eq(visitsTable.id, entry.id)),
    ),
  );
}

router.get("/availability", async (req, res): Promise<void> => {
  const parsed = GetAvailabilityQueryParams.safeParse({
    date: parseQueryDate(req.query.date),
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dateKey = parsed.data.date.toISOString().slice(0, 10);
  const slots = await db
    .select()
    .from(appointmentSlotsTable)
    .where(eq(appointmentSlotsTable.active, true))
    .orderBy(asc(appointmentSlotsTable.sortOrder));
  const booked = await db
    .select({
      appointmentSlot: visitsTable.appointmentSlot,
      total: count(),
    })
    .from(visitsTable)
    .where(
      and(
        eq(visitsTable.visitType, "appointment"),
        eq(visitsTable.appointmentDate, dateKey),
      ),
    )
    .groupBy(visitsTable.appointmentSlot);
  const bookedBySlot = new Map(
    booked.map((entry) => [entry.appointmentSlot ?? "", Number(entry.total)]),
  );

  res.json(
    GetAvailabilityResponse.parse({
      date: parsed.data.date,
      slots: slots.map((slot) => {
        const used = bookedBySlot.get(String(slot.id)) ?? 0;
        const remaining = Math.max(slot.capacity - used, 0);
        return {
          id: String(slot.id),
          label: slot.label,
          available: remaining > 0,
          remaining,
        };
      }),
    }),
  );
});

router.post("/visits", async (req, res): Promise<void> => {
  const parsed = CreateVisitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const appointmentDate = calendarDate(parsed.data.appointmentDate);
  const visitDate = appointmentDate ?? indiaDate();
  const queuePosition =
    visitDate === indiaDate() ? (await currentQueueCount()) + 1 : 0;
  const current = await db
    .select({ id: visitsTable.id })
    .from(visitsTable)
    .orderBy(desc(visitsTable.id));
  const token = `CEO-${String((current[0]?.id ?? 0) + 1).padStart(4, "0")}`;

  const [visit] = await db
    .insert(visitsTable)
    .values({
      fullName: parsed.data.fullName,
      mobile: parsed.data.mobile,
      taluka: parsed.data.taluka,
      location: parsed.data.location,
      organisation: parsed.data.organisation ?? null,
      purpose: parsed.data.purpose,
      category: parsed.data.category,
      department: parsed.data.department,
      description: parsed.data.description,
      previouslyApproached: parsed.data.previouslyApproached,
      previousDepartment: parsed.data.previousDepartment ?? null,
      previousDate: calendarDate(parsed.data.previousDate),
      previousReference: parsed.data.previousReference ?? null,
      visitType: parsed.data.visitType,
      visitDate,
      appointmentDate,
      appointmentSlot: parsed.data.appointmentSlot ?? null,
      priority: parsed.data.priority ?? "normal",
      token,
      status: "waiting",
      queuePosition,
      estimatedWait: 0,
    })
    .returning();

  res.status(201).json(CreateVisitResponse.parse(visitResponse(visit)));
});

router.get("/visits/:token", async (req, res): Promise<void> => {
  const params = GetVisitStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [visit] = await db
    .select()
    .from(visitsTable)
    .where(eq(visitsTable.token, params.data.token));
  if (!visit) {
    res.status(404).json({ error: "Visit token not found" });
    return;
  }
  res.json(GetVisitStatusResponse.parse(visitResponse(visit)));
});

router.get("/office/dashboard", async (_req, res): Promise<void> => {
  const visits = await allVisits(true);
  const waiting = visits.filter((visit) =>
    ["waiting", "held"].includes(visit.status),
  );
  const completed = visits.filter((visit) => visit.status === "completed");
  const pending = visits.filter((visit) =>
    ["referred", "action_required", "follow_up"].includes(visit.outcome ?? ""),
  );
  const called = visits.find((visit) => visit.status === "called");
  const dashboard = {
    registered: visits.length,
    completed: completed.length,
    waiting: waiting.length,
    pending: pending.length,
    averageWait: waiting.length
      ? Math.round(
          waiting.reduce(
            (total, visit) =>
              total +
              Math.max(
                0,
                Math.round((Date.now() - visit.registeredAt.getTime()) / 60000),
              ),
            0,
          ) / waiting.length,
        )
      : 0,
    nowMeeting: called ? queueEntry(called) : null,
    nextVisitors: waiting.slice(0, 4).map(queueEntry),
  };
  res.json(GetOfficeDashboardResponse.parse(dashboard));
});

router.get("/office/queue", async (_req, res): Promise<void> => {
  const visits = await allVisits(true);
  const queue = visits
    .filter((visit) => ["waiting", "called", "held"].includes(visit.status))
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .map(queueEntry);
  res.json(GetOfficeQueueResponse.parse(queue));
});

router.get("/office/visits/:id", async (req, res): Promise<void> => {
  const params = GetOfficeVisitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [visit] = await db
    .select()
    .from(visitsTable)
    .where(eq(visitsTable.id, params.data.id));
  if (!visit) {
    res.status(404).json({ error: "Visit not found" });
    return;
  }
  res.json(GetOfficeVisitResponse.parse(visitResponse(visit)));
});

router.patch("/office/queue/:id/action", async (req, res): Promise<void> => {
  const params = UpdateQueueActionParams.safeParse(req.params);
  const body = UpdateQueueActionBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [current] = await db
    .select()
    .from(visitsTable)
    .where(eq(visitsTable.id, params.data.id));
  if (!current) {
    res.status(404).json({ error: "Visit not found" });
    return;
  }
  const statusByAction: Record<string, string> = {
    call: "called",
    call_next: "called",
    hold: "held",
    skip: "skipped",
    check_in: "waiting",
    no_show: "no_show",
    complete: "completed",
  };
  const status = statusByAction[body.data.action] ?? current.status;
  const [updated] = await db
    .update(visitsTable)
    .set({
      status,
      meetingStartedAt: status === "called" ? new Date() : current.meetingStartedAt,
      completedAt: status === "completed" ? new Date() : current.completedAt,
    })
    .where(eq(visitsTable.id, params.data.id))
    .returning();
  await reindexTodayQueue();
  res.json(UpdateQueueActionResponse.parse(queueEntry(updated)));
});

router.post("/office/visits/:id/outcome", async (req, res): Promise<void> => {
  const params = SaveVisitOutcomeParams.safeParse(req.params);
  const body = SaveVisitOutcomeBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [updated] = await db
    .update(visitsTable)
    .set({
      outcome: body.data.outcome,
      referredTo: body.data.referredTo ?? null,
      notes: body.data.notes ?? null,
      followUpDate: calendarDate(body.data.followUpDate) ?? null,
      referenceNumber: `ZP/CEO/${indiaDate().slice(0, 4)}/${String(params.data.id).padStart(6, "0")}`,
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(visitsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Visit not found" });
    return;
  }
  await reindexTodayQueue();
  res.json(SaveVisitOutcomeResponse.parse(visitResponse(updated)));
});

router.get("/office/search", async (req, res): Promise<void> => {
  const parsed = SearchOfficeVisitsQueryParams.safeParse({
    query: req.query.query,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const query = `%${parsed.data.query}%`;
  const visits = await db
    .select()
    .from(visitsTable)
    .where(
      or(
        ilike(visitsTable.fullName, query),
        ilike(visitsTable.mobile, query),
        ilike(visitsTable.token, query),
        ilike(visitsTable.location, query),
        ilike(visitsTable.taluka, query),
        ilike(visitsTable.department, query),
        ilike(visitsTable.referenceNumber, query),
      ),
    )
    .orderBy(desc(visitsTable.registeredAt));
  res.json(SearchOfficeVisitsResponse.parse(visits.map(visitResponse)));
});

router.get("/office/analytics", async (_req, res): Promise<void> => {
  const visits = await allVisits();
  const today = indiaDate();
  const todayBounds = dateBounds(today);
  const weekStart = new Date(todayBounds.start);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayBounds.start);
  monthStart.setDate(1);
  const countBy = (field: keyof Visit) => {
    const counts = new Map<string, number>();
    visits.forEach((visit) => {
      const label = String(visit[field] ?? "Not recorded");
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, value]) => ({
        label,
        value,
        share: Math.round((value / Math.max(visits.length, 1)) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  };
  const todayVisits = visits.filter((visit) => visit.visitDate === today);
  const weeklyVisits = visits.filter((visit) => visit.registeredAt >= weekStart);
  const monthlyVisits = visits.filter((visit) => visit.registeredAt >= monthStart);
  const noShows = visits.filter((visit) => visit.status === "no_show").length;
  const analytics = {
    today: todayVisits.length,
    weekly: weeklyVisits.length,
    monthly: monthlyVisits.length,
    unique: new Set(visits.map((visit) => visit.mobile)).size,
    repeat: visits.filter((visit) => visit.previousVisits > 0).length,
    walkIns: visits.filter((visit) => visit.visitType === "walk_in").length,
    appointments: visits.filter((visit) => visit.visitType === "appointment").length,
    noShowRate: visits.length ? Math.round((noShows / visits.length) * 1000) / 10 : 0,
    categories: countBy("category"),
    departments: countBy("department"),
    outcomes: countBy("outcome"),
  };
  res.json(GetOfficeAnalyticsResponse.parse(analytics));
});

router.get("/office/appointments", async (req, res): Promise<void> => {
  const parsed = GetOfficeAppointmentsQueryParams.safeParse({
    date: parseQueryDate(req.query.date),
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const dateKey = parsed.data.date.toISOString().slice(0, 10);
  const appointments = await db
    .select()
    .from(visitsTable)
    .where(
      and(
        eq(visitsTable.visitType, "appointment"),
        eq(visitsTable.appointmentDate, dateKey),
      ),
    )
    .orderBy(asc(visitsTable.appointmentSlot), asc(visitsTable.registeredAt));
  res.json(GetOfficeAppointmentsResponse.parse(appointments.map(visitResponse)));
});

router.get("/office/settings/slots", async (_req, res): Promise<void> => {
  const slots = await db
    .select()
    .from(appointmentSlotsTable)
    .orderBy(asc(appointmentSlotsTable.sortOrder), asc(appointmentSlotsTable.id));
  res.json(GetOfficeSlotsResponse.parse(slots));
});

router.post("/office/settings/slots", async (req, res): Promise<void> => {
  const parsed = CreateOfficeSlotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [slot] = await db
    .insert(appointmentSlotsTable)
    .values({
      label: parsed.data.label,
      capacity: parsed.data.capacity,
      active: parsed.data.active ?? true,
      sortOrder: parsed.data.sortOrder,
    })
    .returning();
  res.status(201).json(CreateOfficeSlotResponse.parse(slot));
});

router.delete("/office/settings/slots/:id", async (req, res): Promise<void> => {
  const params = DeleteOfficeSlotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(appointmentSlotsTable)
    .where(eq(appointmentSlotsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;