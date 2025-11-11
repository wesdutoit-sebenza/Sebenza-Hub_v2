import { Router } from "express";
import { authenticateSession, type AuthRequest } from "./auth-middleware";
import { pool } from "./db-pool";
const router = Router();

// Get ranked shortlist
router.get("/roles/:roleId/shortlist", authenticateSession, async (req, res) => {
  const { roleId } = req.params;
  const { limit = 20 } = req.query;

  try {
    const { rows } = await pool.query(`
      SELECT s.candidate_id, s.score_total, s.score_breakdown, s.reasons, s.flags,
             c.full_name, c.headline, c.city, c.country, c.links
      FROM screenings s
      JOIN candidates c ON c.id = s.candidate_id
      WHERE s.role_id = $1
      ORDER BY s.score_total DESC
      LIMIT $2::int
    `, [roleId, limit]);

    res.json({ role_id: roleId, results: rows });
  } catch (error: any) {
    console.error("Get shortlist error:", error);
    res.status(500).json({ error: "Failed to fetch shortlist" });
  }
});

// Candidate detail (with screening rationale)
router.get("/roles/:roleId/candidates/:candidateId", authenticateSession, async (req, res) => {
  const { roleId, candidateId } = req.params;

  try {
    const { rows } = await pool.query(`
      SELECT s.*, 
             c.full_name, c.headline, c.city, c.country, c.email, c.phone, c.links, c.summary,
             (SELECT json_agg(e) FROM experiences e WHERE e.candidate_id=c.id) AS experience,
             (SELECT json_agg(ed) FROM education ed WHERE ed.candidate_id=c.id) AS education,
             (SELECT json_agg(cert) FROM certifications cert WHERE cert.candidate_id=c.id) AS certifications
      FROM screenings s
      JOIN candidates c ON c.id = s.candidate_id
      WHERE s.role_id=$1 AND s.candidate_id=$2
    `, [roleId, candidateId]);

    if (!rows.length) {
      return res.status(404).json({ error: "Candidate screening not found" });
    }
    
    res.json(rows[0]);
  } catch (error: any) {
    console.error("Get candidate detail error:", error);
    res.status(500).json({ error: "Failed to fetch candidate details" });
  }
});

export default router;
