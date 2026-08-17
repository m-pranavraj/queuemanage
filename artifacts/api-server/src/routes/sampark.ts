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
  lt,
} from "drizzle-orm";
import {
  appointmentSlotsTable,
  db,
  visitsTable,
  usersTable,
  auditLogsTable,
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
  LoginBody,
  LoginResponse,
  GetOfficeUsersResponse,
  CreateOfficeUserBody,
  CreateOfficeUserResponse,
  DeleteOfficeUserParams,
} from "@workspace/api-zod";
import { verifyPassword, generateToken, hashPassword } from "../lib/auth-utils";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function logAudit(req: any, action: string, details: string) {
  try {
    const user = req.user;
    await db.insert(auditLogsTable).values({
      userId: user ? user.id : null,
      username: user ? user.username : "visitor",
      action,
      details,
    });
    logger.info({ userId: user?.id, username: user?.username, action, details }, "Audit Logged");
  } catch (err) {
    logger.error({ err }, "Failed to write audit log");
  }
}

// Daily Reset: finalizes previous days' active queues
async function performDailyReset(): Promise<void> {
  const todayStr = indiaDate();
  try {
    const affected = await db
      .update(visitsTable)
      .set({
        status: "no_show",
        outcome: "rejected",
        notes: "Auto-expired at end of day (Daily reset)",
        completedAt: new Date(),
      })
      .where(
        and(
          lt(visitsTable.visitDate, todayStr),
          or(
            eq(visitsTable.status, "waiting"),
            eq(visitsTable.status, "called"),
            eq(visitsTable.status, "held")
          )
        )
      )
      .returning();
    if (affected.length > 0) {
      logger.info({ count: affected.length }, "Auto-expired yesterday's active visits");
    }
  } catch (err) {
    logger.error({ err }, "Error running performDailyReset");
  }
}

// Computes availability taking into account multi-slot 5-min appointments
async function getSlotsAvailability(dateKey: string) {
  const slots = await db
    .select()
    .from(appointmentSlotsTable)
    .where(eq(appointmentSlotsTable.active, true))
    .orderBy(asc(appointmentSlotsTable.sortOrder));

  const bookedVisits = await db
    .select({
      id: visitsTable.id,
      appointmentSlot: visitsTable.appointmentSlot,
      appointmentDuration: visitsTable.appointmentDuration,
    })
    .from(visitsTable)
    .where(
      and(
        eq(visitsTable.visitType, "appointment"),
        eq(visitsTable.appointmentDate, dateKey),
        or(
          eq(visitsTable.status, "waiting"),
          eq(visitsTable.status, "called"),
          eq(visitsTable.status, "held"),
          eq(visitsTable.status, "completed")
        )
      )
    );

  const slotMap = new Map(slots.map((s, idx) => [String(s.id), { slot: s, index: idx, used: 0 }]));

  for (const visit of bookedVisits) {
    const startSlotId = visit.appointmentSlot;
    if (!startSlotId) continue;
    const startSlotEntry = slotMap.get(startSlotId);
    if (!startSlotEntry) continue;

    const duration = visit.appointmentDuration ?? 5;
    const numSlotsNeeded = Math.ceil(duration / 5);

    for (let k = 0; k < numSlotsNeeded; k++) {
      const targetIndex = startSlotEntry.index + k;
      if (targetIndex < slots.length) {
        const targetSlot = slots[targetIndex];
        const targetEntry = slotMap.get(String(targetSlot.id));
        if (targetEntry) {
          targetEntry.used += 1;
        }
      }
    }
  }

  return slots.map((slot) => {
    const entry = slotMap.get(String(slot.id))!;
    const remaining = Math.max(slot.capacity - entry.used, 0);
    return {
      id: String(slot.id),
      label: slot.label,
      available: remaining > 0,
      remaining,
    };
  });
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

// ---------------------------------------------------------------------------
// Public Routes
// ---------------------------------------------------------------------------

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, parsed.data.username));

  if (!user || !user.active) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const isPasswordValid = verifyPassword(parsed.data.password, user.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = generateToken({
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
  });

  res.json(
    LoginResponse.parse({
      token,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
    })
  );
});

router.get("/availability", async (req, res): Promise<void> => {
  const parsed = GetAvailabilityQueryParams.safeParse({
    date: parseQueryDate(req.query.date),
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dateKey = parsed.data.date.toISOString().slice(0, 10);
  const availability = await getSlotsAvailability(dateKey);

  res.json(
    GetAvailabilityResponse.parse({
      date: parsed.data.date,
      slots: availability,
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

  // VVIP Priority Detection (Auto-upgrade based on keywords)
  const nameLower = parsed.data.fullName.toLowerCase();
  const orgLower = (parsed.data.organisation ?? "").toLowerCase();
  const purposeLower = parsed.data.purpose.toLowerCase();
  const descLower = parsed.data.description.toLowerCase();
  
  const vvipKeywords = ["vvip", "vip", "mla", "mp", "minister", "collector", "commissioner", "secretary", "ias", "ips", "mayor", "president"];
  const isVVIPKeyword = vvipKeywords.some(keyword => 
    nameLower.includes(keyword) || 
    orgLower.includes(keyword) || 
    purposeLower.includes(keyword) || 
    descLower.includes(keyword)
  );

  const isVVIP = parsed.data.priority === "vvip" || isVVIPKeyword;
  const finalPriority = isVVIP ? "vvip" : (parsed.data.priority ?? "normal");

  // Validate multi-slot capacity if booking an appointment
  if (parsed.data.visitType === "appointment" && parsed.data.appointmentSlot) {
    const duration = parsed.data.appointmentDuration ?? 5;
    const numSlotsNeeded = Math.ceil(duration / 5);
    const availability = await getSlotsAvailability(visitDate);
    const slotMap = new Map(availability.map(s => [s.id, s]));

    const activeSlots = await db
      .select()
      .from(appointmentSlotsTable)
      .where(eq(appointmentSlotsTable.active, true))
      .orderBy(asc(appointmentSlotsTable.sortOrder));

    const startIndex = activeSlots.findIndex(s => String(s.id) === parsed.data.appointmentSlot);
    if (startIndex === -1) {
      res.status(400).json({ error: "Selected slot is not active or does not exist." });
      return;
    }

    for (let k = 0; k < numSlotsNeeded; k++) {
      const targetIndex = startIndex + k;
      if (targetIndex >= activeSlots.length) {
        res.status(400).json({ error: "The appointment duration exceeds the office hours." });
        return;
      }
      const targetSlot = activeSlots[targetIndex];
      const availEntry = slotMap.get(String(targetSlot.id));
      if (!availEntry || availEntry.remaining <= 0) {
        res.status(400).json({ error: `Slot at ${targetSlot.label} is fully booked.` });
        return;
      }
    }
  }

  // Daily Resetting Token Numbers: count today's registrations and add 1
  const dateVisits = await db
    .select({ token: visitsTable.token })
    .from(visitsTable)
    .where(eq(visitsTable.visitDate, visitDate));

  let maxTokenNum = 0;
  for (const v of dateVisits) {
    const parts = v.token.split("-");
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num) && num > maxTokenNum) {
      maxTokenNum = num;
    }
  }

  const nextTokenNum = maxTokenNum + 1;
  const tokenPrefix = isVVIP ? "VVIP" : "CEO";
  const token = `${tokenPrefix}-${String(nextTokenNum).padStart(3, "0")}`;

  const queuePosition =
    visitDate === indiaDate() ? (await currentQueueCount()) + 1 : 0;

  // Retrieve previous visits count for this mobile number
  const prevVisits = await db
    .select({ total: count() })
    .from(visitsTable)
    .where(eq(visitsTable.mobile, parsed.data.mobile));
  const previousVisitsCount = Number(prevVisits[0]?.total ?? 0);

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
      appointmentDuration: parsed.data.appointmentDuration ?? 5,
      priority: finalPriority,
      token,
      status: "waiting",
      queuePosition,
      estimatedWait: 0,
      previousVisits: previousVisitsCount,
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

// ---------------------------------------------------------------------------
// Protected Office Routes
// ---------------------------------------------------------------------------

router.get("/office/dashboard", requireAuth(["admin", "ceo", "reception", "officer"]), async (req, res): Promise<void> => {
  await performDailyReset();

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

router.get("/office/queue", requireAuth(["admin", "ceo", "reception", "officer"]), async (req, res): Promise<void> => {
  await performDailyReset();

  const visits = await allVisits(true);
  const queue = visits
    .filter((visit) => ["waiting", "called", "held"].includes(visit.status))
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .map(queueEntry);
  res.json(GetOfficeQueueResponse.parse(queue));
});

router.get("/office/visits/:id", requireAuth(["admin", "ceo", "reception", "officer"]), async (req, res): Promise<void> => {
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

  // Audit record viewing
  await logAudit(req, "view_visitor_brief", `Viewed visitor brief for ${visit.fullName} (${visit.token})`);

  res.json(GetOfficeVisitResponse.parse(visitResponse(visit)));
});

router.patch("/office/queue/:id/action", requireAuth(["admin", "ceo", "reception", "officer"]), async (req, res): Promise<void> => {
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

  // Audit status changes
  await logAudit(req, "update_queue_status", `Changed status of ${current.fullName} (${current.token}) to ${status} via action ${body.data.action}`);

  res.json(UpdateQueueActionResponse.parse(queueEntry(updated)));
});

router.patch("/office/queue/:id/promote", requireAuth(["admin", "ceo", "reception", "officer"]), async (req, res): Promise<void> => {
  const visitId = parseInt(String(req.params.id), 10);
  if (isNaN(visitId)) {
    res.status(400).json({ error: "Invalid visit ID" });
    return;
  }

  const [current] = await db
    .select()
    .from(visitsTable)
    .where(eq(visitsTable.id, visitId));

  if (!current) {
    res.status(404).json({ error: "Visit not found" });
    return;
  }

  const [updated] = await db
    .update(visitsTable)
    .set({ priority: "priority" })
    .where(eq(visitsTable.id, visitId))
    .returning();

  await logAudit(req, "promote_visitor", `Promoted visitor ${current.fullName} (${current.token}) to priority queue`);

  res.json(visitResponse(updated));
});

router.post("/office/visits/:id/outcome", requireAuth(["admin", "ceo", "reception", "officer"]), async (req, res): Promise<void> => {
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

  const [current] = await db
    .select()
    .from(visitsTable)
    .where(eq(visitsTable.id, params.data.id));
  if (!current) {
    res.status(404).json({ error: "Visit not found" });
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

  await reindexTodayQueue();

  // Audit outcomes
  await logAudit(
    req,
    "save_visit_outcome",
    `Recorded outcome for ${current.fullName} (${current.token}) as ${body.data.outcome}. Notes: ${body.data.notes ?? "None"}`
  );

  res.json(SaveVisitOutcomeResponse.parse(visitResponse(updated)));
});

router.get("/office/search", requireAuth(["admin", "ceo", "reception", "officer"]), async (req, res): Promise<void> => {
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

  await logAudit(req, "search_records", `Searched visitor records with query: "${parsed.data.query}"`);

  res.json(SearchOfficeVisitsResponse.parse(visits.map(visitResponse)));
});

router.get("/office/analytics", requireAuth(["admin", "ceo"]), async (_req, res): Promise<void> => {
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

router.get("/office/appointments", requireAuth(["admin", "ceo", "reception", "officer"]), async (req, res): Promise<void> => {
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

router.get("/office/settings/slots", requireAuth(["admin"]), async (_req, res): Promise<void> => {
  const slots = await db
    .select()
    .from(appointmentSlotsTable)
    .orderBy(asc(appointmentSlotsTable.sortOrder), asc(appointmentSlotsTable.id));
  res.json(GetOfficeSlotsResponse.parse(slots));
});

router.post("/office/settings/slots", requireAuth(["admin"]), async (req, res): Promise<void> => {
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

  await logAudit(req, "create_slot", `Created appointment slot: ${parsed.data.label} (capacity ${parsed.data.capacity})`);

  res.status(201).json(CreateOfficeSlotResponse.parse(slot));
});

router.delete("/office/settings/slots/:id", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const params = DeleteOfficeSlotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(appointmentSlotsTable)
    .where(eq(appointmentSlotsTable.id, params.data.id));

  await logAudit(req, "delete_slot", `Deleted appointment slot ID: ${params.data.id}`);

  res.sendStatus(204);
});

router.patch("/office/settings/slots/:id/toggle", requireAuth(["admin", "reception", "officer"]), async (req, res): Promise<void> => {
  const slotId = parseInt(String(req.params.id), 10);
  if (isNaN(slotId)) {
    res.status(400).json({ error: "Invalid slot ID" });
    return;
  }

  const [currentSlot] = await db
    .select()
    .from(appointmentSlotsTable)
    .where(eq(appointmentSlotsTable.id, slotId));

  if (!currentSlot) {
    res.status(404).json({ error: "Slot not found" });
    return;
  }

  const [updatedSlot] = await db
    .update(appointmentSlotsTable)
    .set({ active: !currentSlot.active })
    .where(eq(appointmentSlotsTable.id, slotId))
    .returning();

  await logAudit(req, "toggle_slot", `Toggled slot ${currentSlot.label} active state to ${updatedSlot.active}`);

  res.json(updatedSlot);
});

router.get("/office/settings/users", requireAuth(["admin"]), async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      fullName: usersTable.fullName,
      department: usersTable.department,
      active: usersTable.active,
    })
    .from(usersTable)
    .orderBy(asc(usersTable.id));
  res.json(GetOfficeUsersResponse.parse(users));
});

router.post("/office/settings/users", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const parsed = CreateOfficeUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, parsed.data.username));
  if (existing) {
    res.status(400).json({ error: "Username already exists" });
    return;
  }

  const [newUser] = await db
    .insert(usersTable)
    .values({
      username: parsed.data.username,
      passwordHash: hashPassword(parsed.data.password),
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      department: parsed.data.department ?? null,
      active: true,
    })
    .returning();

  await logAudit(req, "create_user", `Created user account: ${parsed.data.username} (${parsed.data.role})`);

  res.status(201).json(
    CreateOfficeUserResponse.parse({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      fullName: newUser.fullName,
      department: newUser.department,
      active: newUser.active,
    })
  );
});

router.delete("/office/settings/users/:id", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const params = DeleteOfficeUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const currentUserId = (req as any).user?.id;
  if (currentUserId === params.data.id) {
    res.status(400).json({ error: "You cannot delete your own admin account" });
    return;
  }

  await db
    .delete(usersTable)
    .where(eq(usersTable.id, params.data.id));

  await logAudit(req, "delete_user", `Deleted user account ID: ${params.data.id}`);

  res.sendStatus(204);
});

export default router;