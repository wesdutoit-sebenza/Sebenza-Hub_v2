import { Router } from "express";
import { screeningQueue } from "./queue.js";
import { pool } from "./db-pool";
const router = Router();

router.post("/roles", async (req, res) => {
  const r = req.body;
  const { rows } = await pool.query(
    `INSERT INTO roles(job_title, job_description, seniority, employment_type,
                       location_city, location_country, work_type,
                       must_have_skills, nice_to_have_skills, salary_min, salary_max, salary_currency,
                       knockouts, weights, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      r.job_title, r.job_description, r.seniority, r.employment_type,
      r.location_city, r.location_country ?? 'South Africa', r.work_type,
      r.must_have_skills ?? [], r.nice_to_have_skills ?? [],
      r.salary_min ?? null, r.salary_max ?? null, r.salary_currency ?? 'ZAR',
      r.knockouts ?? [], r.weights ?? null, r.created_by ?? null
    ]
  );
  const roleId = rows[0].id;

  // Prefilter candidates (semantic or latest 500) -> enqueue
  // (see E) Prefilter) — here we just enqueue a "warmup" job
  if (screeningQueue) {
    await screeningQueue.add("seed-role-screenings", { roleId });
  }

  res.json({ ok: true, role_id: roleId });
});

export default router;
