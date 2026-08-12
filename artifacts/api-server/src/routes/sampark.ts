import { Router, type IRouter } from "express";
import { asc, desc, eq, ilike, or } from "drizzle-orm";
import { db, visitsTable, type Visit } from "@workspace/db";
import {
  CreateVisitBody,
  CreateVisitResponse,
  GetAvailabilityQueryParams,
  GetAvailabilityResponse,
  GetOfficeAnalyticsResponse,
  GetOfficeDashboardResponse,
  GetOfficeQueueResponse,
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

let seedPromise: Promise<void> | undefined;

async function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db.select({ id: visitsTable.id }).from(visitsTable).limit(1);
      if (existing.length > 0) return;

      const today = new Date().toISOString().slice(0, 10);
      await db.insert(visitsTable).values([
        {
          token: "CEO-021",
          fullName: "Rajesh Patil",
          mobile: "98220 44120",
          taluka: "Baramati",
          location: "Nimbut",
          organisation: null,
          purpose: "Water supply grievance",
          category: "Water",
          department: "Rural Water Supply",
          description: "Irregular water supply affecting three hamlets in Nimbut village.",
          previouslyApproached: true,
          previousDepartment: "Block Development Office",
          previousDate: "2026-07-23",
          previousReference: "BDO/WS/2026/089",
          visitType: "walk_in",
          appointmentDate: today,
          appointmentSlot: null,
          priority: "normal",
          status: "waiting",
          queuePosition: 1,
          estimatedWait: 42,
          previousVisits: 2,
        },
        {
          token: "CEO-022",
          fullName: "Sunita Jadhav",
          mobile: "97641 22018",
          taluka: "Daund",
          location: "Kedgaon",
          organisation: null,
          purpose: "School repair request",
          category: "Education",
          department: "Education",
          description: "Classroom roof repairs are needed before the monsoon term.",
          previouslyApproached: true,
          previousDepartment: "Block Education Office",
          previousDate: "2026-08-01",
          previousReference: "BEO/EDU/2026/132",
          visitType: "appointment",
          appointmentDate: today,
          appointmentSlot: "02:30 PM",
          priority: "priority",
          status: "waiting",
          queuePosition: 2,
          estimatedWait: 35,
          previousVisits: 1,
        },
        {
          token: "CEO-023",
          fullName: "Gram Panchayat Malegaon",
          mobile: "90110 77831",
          taluka: "Indapur",
          location: "Malegaon",
          organisation: "Gram Panchayat Malegaon",
          purpose: "Panchayat development proposal",
          category: "Rural Development",
          department: "Rural Development",
          description: "Proposal for a community water harvesting project.",
          previouslyApproached: false,
          previousDepartment: null,
          previousDate: null,
          previousReference: null,
          visitType: "walk_in",
          appointmentDate: today,
          appointmentSlot: null,
          priority: "normal",
          status: "waiting",
          queuePosition: 3,
          estimatedWait: 28,
          previousVisits: 0,
        },
        {
          token: "CEO-020",
          fullName: "Anita More",
          mobile: "98810 11409",
          taluka: "Mawal",
          location: "Talegaon",
          organisation: null,
          purpose: "Road access follow-up",
          category: "Roads",
          department: "Works & Roads",
          description: "Follow-up on the approach road sanction for Talegaon.",
          previouslyApproached: true,
          previousDepartment: "Works Division",
          previousDate: "2026-07-11",
          previousReference: "WD/ROAD/2026/041",
          visitType: "appointment",
          appointmentDate: today,
          appointmentSlot: "12:00 PM",
          priority: "normal",
          status: "completed",
          queuePosition: 0,
          estimatedWait: 18,
          outcome: "resolved",
          referenceNumber: "ZP/CEO/2026/001240",
          notes: "Approach road work order issued.",
          previousVisits: 1,
        },
      ]);
    })();
  }
  await seedPromise;
}

function queueEntry(visit: Visit) {
  const waitingMinutes = Math.max(
    0,
    Math.round((Date.now() - visit.registeredAt.getTime()) / 60000),
  );
  return {
    id: visit.id,
    token: visit.token,
    fullName: visit.fullName,
    purpose: visit.purpose,
    department: visit.department,
    waitingMinutes: Math.max(visit.estimatedWait, waitingMinutes),
    priority: visit.priority,
    status: visit.status,
    location: visit.location,
  };
}

function visitResponse(visit: Visit) {
  return {
    ...visit,
    queuePosition: visit.status === "waiting" ? visit.queuePosition : 0,
    estimatedWait:
      visit.status === "waiting" ? Math.max(visit.estimatedWait, 0) : 0,
    registeredAt: visit.registeredAt,
    previousVisits: visit.previousVisits ?? 0,
  };
}

function calendarDate(value: Date | string | null | undefined): string | null | undefined {
  if (value == null || typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

async function allVisits(): Promise<Visit[]> {
  await ensureSeedData();
  return db.select().from(visitsTable).orderBy(asc(visitsTable.queuePosition), desc(visitsTable.registeredAt));
}

router.get("/availability", async (req, res): Promise<void> => {
  const rawDate = Array.isArray(req.query.date)
    ? req.query.date[0]
    : req.query.date;
  const parsed = GetAvailabilityQueryParams.safeParse({
    date: rawDate ? new Date(String(rawDate)) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dateKey = parsed.data.date.toISOString().slice(0, 10);
  const slots = [
    ["12:00 PM", 4],
    ["12:30 PM", 3],
    ["02:30 PM", 5],
    ["03:00 PM", 4],
    ["03:30 PM", 6],
    ["04:00 PM", 5],
    ["04:30 PM", 3],
  ].map(([label, remaining], index) => ({
    id: `${dateKey}-${index + 1}`,
    label,
    available: Number(remaining) > 0,
    remaining: Number(remaining),
  }));

  res.json(GetAvailabilityResponse.parse({ date: parsed.data.date, slots }));
});

router.post("/visits", async (req, res): Promise<void> => {
  const parsed = CreateVisitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await ensureSeedData();
  const current = await db
    .select({ id: visitsTable.id })
    .from(visitsTable)
    .orderBy(desc(visitsTable.id));
  const nextId = (current[0]?.id ?? 0) + 1;
  const active = await db
    .select({ id: visitsTable.id })
    .from(visitsTable)
    .where(eq(visitsTable.status, "waiting"));
  const queuePosition = active.length + 1;
  const token = `CEO-${String(20 + nextId).padStart(3, "0")}`;

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
      appointmentDate: calendarDate(parsed.data.appointmentDate),
      appointmentSlot: parsed.data.appointmentSlot ?? null,
      priority: parsed.data.priority ?? "normal",
      token,
      status: "waiting",
      queuePosition,
      estimatedWait: queuePosition * 12,
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

  await ensureSeedData();
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
  const visits = await allVisits();
  const waiting = visits.filter((visit) => visit.status === "waiting");
  const completed = visits.filter((visit) => visit.status === "completed");
  const pending = visits.filter((visit) =>
    ["referred", "action_required", "follow_up"].includes(visit.outcome ?? ""),
  );
  const dashboard = {
    registered: visits.length,
    completed: completed.length,
    waiting: waiting.length,
    pending: pending.length,
    averageWait: Math.round(
      waiting.reduce((total, visit) => total + visit.estimatedWait, 0) /
        Math.max(waiting.length, 1),
    ),
    nowMeeting: null,
    nextVisitors: waiting.slice(0, 4).map(queueEntry),
  };
  res.json(GetOfficeDashboardResponse.parse(dashboard));
});

router.get("/office/queue", async (_req, res): Promise<void> => {
  const visits = await allVisits();
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

  await ensureSeedData();
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

  await ensureSeedData();
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

  await ensureSeedData();
  const [updated] = await db
    .update(visitsTable)
    .set({
      outcome: body.data.outcome,
      referredTo: body.data.referredTo ?? null,
      notes: body.data.notes ?? null,
      followUpDate: calendarDate(body.data.followUpDate) ?? null,
      referenceNumber: `ZP/CEO/2026/${String(params.data.id).padStart(6, "0")}`,
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(visitsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Visit not found" });
    return;
  }
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

  await ensureSeedData();
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
  const countBy = (field: keyof Visit) => {
    const counts = new Map<string, number>();
    visits.forEach((visit) => {
      const label = String(visit[field] ?? "Other");
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

  const analytics = {
    today: visits.length,
    weekly: visits.length + 18,
    monthly: visits.length + 86,
    unique: Math.max(visits.length - 1, 0),
    repeat: visits.filter((visit) => visit.previousVisits > 0).length,
    walkIns: visits.filter((visit) => visit.visitType === "walk_in").length,
    appointments: visits.filter((visit) => visit.visitType === "appointment").length,
    noShowRate: 4.2,
    categories: countBy("category"),
    departments: countBy("department"),
    outcomes: countBy("outcome"),
  };

  res.json(GetOfficeAnalyticsResponse.parse(analytics));
});

export default router;