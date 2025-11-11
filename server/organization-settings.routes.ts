import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { authenticateSession, type AuthRequest } from "./auth-middleware";
import {
  teamMemberValidationSchema,
  teamMemberPatchSchema,
  pipelineStageValidationSchema,
  pipelineStagePatchSchema,
  interviewSettingsValidationSchema,
  complianceSettingsValidationSchema,
  organizationIntegrationsValidationSchema,
  jobTemplateValidationSchema,
  jobTemplatePatchSchema,
  salaryBandValidationSchema,
  salaryBandPatchSchema,
  approvedVendorValidationSchema,
  approvedVendorPatchSchema,
} from "../shared/schema";
import { pool } from "./db-pool";
const router = Router();

// Helper function to validate request body with Zod schema
function validateBody<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> | { error: string } {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const validationError = fromZodError(err);
      return { error: validationError.toString() };
    }
    return { error: "Validation failed" };
  }
}

// Middleware to validate organization membership
// Optionally enforces role requirements for write operations
async function requireOrgMembership(req: any, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;
  const { orgId } = authReq.params;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check if user is a member of the organization
  const { rows } = await pool.query(
    `SELECT role FROM memberships WHERE user_id = $1 AND organization_id = $2`,
    [userId, orgId]
  );

  if (rows.length === 0) {
    return res.status(403).json({ error: "Access denied to this organization" });
  }

  const userRole = rows[0].role;

  // For write operations (POST, PATCH, PUT, DELETE), require admin or higher
  const isWriteOperation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
  const isAdmin = ['admin', 'owner'].includes(userRole);

  if (isWriteOperation && !isAdmin) {
    return res.status(403).json({ 
      error: "Insufficient permissions. Admin or owner role required for this operation." 
    });
  }

  next();
}

// ============================================
// TEAM MEMBERS
// ============================================

router.get("/organizations/:orgId/team-members", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  const { rows } = await pool.query(
    `SELECT * FROM team_members WHERE organization_id = $1 ORDER BY invited_at DESC`,
    [orgId]
  );
  res.json(rows);
});

router.post("/organizations/:orgId/team-members", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  
  // Validate request body
  const validated = validateBody(teamMemberValidationSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { email, role, permissions, status } = validated;
  const { rows } = await pool.query(
    `INSERT INTO team_members(organization_id, email, role, permissions, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [orgId, email, role, permissions, status]
  );
  res.json(rows[0]);
});

router.patch("/organizations/:orgId/team-members/:memberId", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId, memberId } = req.params;
  
  // Validate request body (PATCH-specific schema without defaults)
  const validated = validateBody(teamMemberPatchSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { email, role, permissions, status, acceptedAt } = validated;
  
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  if (email !== undefined) {
    updates.push(`email = $${paramCount++}`);
    values.push(email);
  }
  if (role !== undefined) {
    updates.push(`role = $${paramCount++}`);
    values.push(role);
  }
  if (permissions !== undefined) {
    updates.push(`permissions = $${paramCount++}`);
    values.push(permissions);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramCount++}`);
    values.push(status);
  }
  if (acceptedAt !== undefined) {
    updates.push(`accepted_at = $${paramCount++}`);
    values.push(acceptedAt);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  
  values.push(memberId, orgId);
  const { rows } = await pool.query(
    `UPDATE team_members SET ${updates.join(', ')}
     WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
     RETURNING *`,
    values
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: "Team member not found" });
  }
  
  res.json(rows[0]);
});

router.delete("/organizations/:orgId/team-members/:memberId", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId, memberId } = req.params;
  const { rows } = await pool.query(
    `DELETE FROM team_members WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [memberId, orgId]
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: "Team member not found" });
  }
  
  res.json({ ok: true });
});

// ============================================
// PIPELINE STAGES
// ============================================

router.get("/organizations/:orgId/pipeline-stages", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  const { rows } = await pool.query(
    `SELECT * FROM pipeline_stages WHERE organization_id = $1 ORDER BY "order"`,
    [orgId]
  );
  res.json(rows);
});

router.post("/organizations/:orgId/pipeline-stages", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  
  // Validate request body
  const validated = validateBody(pipelineStageValidationSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { name, order, isDefault } = validated;
  const { rows } = await pool.query(
    `INSERT INTO pipeline_stages(organization_id, name, "order", is_default)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [orgId, name, order, isDefault]
  );
  res.json(rows[0]);
});

router.patch("/organizations/:orgId/pipeline-stages/:stageId", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId, stageId } = req.params;
  
  // Validate request body (PATCH-specific schema without defaults)
  const validated = validateBody(pipelineStagePatchSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { name, order, isDefault } = validated;
  
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }
  if (order !== undefined) {
    updates.push(`"order" = $${paramCount++}`);
    values.push(order);
  }
  if (isDefault !== undefined) {
    updates.push(`is_default = $${paramCount++}`);
    values.push(isDefault);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  
  values.push(stageId, orgId);
  const { rows} = await pool.query(
    `UPDATE pipeline_stages SET ${updates.join(', ')}
     WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
     RETURNING *`,
    values
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: "Pipeline stage not found" });
  }
  
  res.json(rows[0]);
});

router.delete("/organizations/:orgId/pipeline-stages/:stageId", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId, stageId } = req.params;
  const { rows } = await pool.query(
    `DELETE FROM pipeline_stages WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [stageId, orgId]
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: "Pipeline stage not found" });
  }
  
  res.json({ ok: true });
});

// ============================================
// INTERVIEW SETTINGS
// ============================================

router.get("/organizations/:orgId/interview-settings", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  const { rows } = await pool.query(
    `SELECT * FROM interview_settings WHERE organization_id = $1`,
    [orgId]
  );
  
  if (rows.length === 0) {
    const { rows: newRows } = await pool.query(
      `INSERT INTO interview_settings(organization_id, calendar_provider, video_provider)
       VALUES ($1, 'none', 'none')
       RETURNING *`,
      [orgId]
    );
    return res.json(newRows[0]);
  }
  
  res.json(rows[0]);
});

router.put("/organizations/:orgId/interview-settings", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  
  // Validate request body
  const validated = validateBody(interviewSettingsValidationSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { calendarProvider, videoProvider, panelTemplates, feedbackFormTemplate } = validated;
  
  const { rows: existing } = await pool.query(
    `SELECT id FROM interview_settings WHERE organization_id = $1`,
    [orgId]
  );
  
  if (existing.length === 0) {
    const { rows } = await pool.query(
      `INSERT INTO interview_settings(organization_id, calendar_provider, video_provider, panel_templates, feedback_form_template)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orgId, calendarProvider, videoProvider, panelTemplates, feedbackFormTemplate]
    );
    return res.json(rows[0]);
  }
  
  const { rows } = await pool.query(
    `UPDATE interview_settings 
     SET calendar_provider = $1, video_provider = $2, panel_templates = $3, 
         feedback_form_template = $4, updated_at = NOW()
     WHERE organization_id = $5
     RETURNING *`,
    [calendarProvider, videoProvider, panelTemplates, feedbackFormTemplate, orgId]
  );
  
  res.json(rows[0]);
});

// ============================================
// COMPLIANCE SETTINGS
// ============================================

router.get("/organizations/:orgId/compliance-settings", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  const { rows } = await pool.query(
    `SELECT * FROM compliance_settings WHERE organization_id = $1`,
    [orgId]
  );
  
  if (rows.length === 0) {
    const { rows: newRows } = await pool.query(
      `INSERT INTO compliance_settings(organization_id)
       VALUES ($1)
       RETURNING *`,
      [orgId]
    );
    return res.json(newRows[0]);
  }
  
  res.json(rows[0]);
});

router.put("/organizations/:orgId/compliance-settings", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  
  // Validate request body
  const validated = validateBody(complianceSettingsValidationSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { eeDataCapture, consentText, dataRetentionDays, popiaOfficer, dataDeletionContact } = validated;
  
  const { rows: existing } = await pool.query(
    `SELECT id FROM compliance_settings WHERE organization_id = $1`,
    [orgId]
  );
  
  if (existing.length === 0) {
    const { rows } = await pool.query(
      `INSERT INTO compliance_settings(organization_id, ee_data_capture, consent_text, 
                                        data_retention_days, popia_officer, data_deletion_contact)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgId, eeDataCapture, consentText, dataRetentionDays, popiaOfficer, dataDeletionContact]
    );
    return res.json(rows[0]);
  }
  
  const { rows } = await pool.query(
    `UPDATE compliance_settings 
     SET ee_data_capture = $1, consent_text = $2, data_retention_days = $3,
         popia_officer = $4, data_deletion_contact = $5, updated_at = NOW()
     WHERE organization_id = $6
     RETURNING *`,
    [eeDataCapture, consentText, dataRetentionDays, popiaOfficer, dataDeletionContact, orgId]
  );
  
  res.json(rows[0]);
});

// ============================================
// ORGANIZATION INTEGRATIONS
// ============================================

router.get("/organizations/:orgId/integrations", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  const { rows } = await pool.query(
    `SELECT * FROM organization_integrations WHERE organization_id = $1`,
    [orgId]
  );
  
  if (rows.length === 0) {
    const { rows: newRows } = await pool.query(
      `INSERT INTO organization_integrations(organization_id)
       VALUES ($1)
       RETURNING *`,
      [orgId]
    );
    return res.json(newRows[0]);
  }
  
  res.json(rows[0]);
});

router.put("/organizations/:orgId/integrations", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  
  // Validate request body
  const validated = validateBody(organizationIntegrationsValidationSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { slackWebhook, msTeamsWebhook, atsProvider, atsApiKey, sourcingChannels } = validated;
  
  const { rows: existing } = await pool.query(
    `SELECT id FROM organization_integrations WHERE organization_id = $1`,
    [orgId]
  );
  
  if (existing.length === 0) {
    const { rows } = await pool.query(
      `INSERT INTO organization_integrations(organization_id, slack_webhook, ms_teams_webhook,
                                              ats_provider, ats_api_key, sourcing_channels)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgId, slackWebhook, msTeamsWebhook, atsProvider, atsApiKey, sourcingChannels]
    );
    return res.json(rows[0]);
  }
  
  const { rows } = await pool.query(
    `UPDATE organization_integrations 
     SET slack_webhook = $1, ms_teams_webhook = $2, ats_provider = $3,
         ats_api_key = $4, sourcing_channels = $5, updated_at = NOW()
     WHERE organization_id = $6
     RETURNING *`,
    [slackWebhook, msTeamsWebhook, atsProvider, atsApiKey, sourcingChannels || [], orgId]
  );
  
  res.json(rows[0]);
});

// ============================================
// JOB TEMPLATES
// ============================================

router.get("/organizations/:orgId/job-templates", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  const { rows } = await pool.query(
    `SELECT * FROM job_templates WHERE organization_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
  res.json(rows);
});

router.post("/organizations/:orgId/job-templates", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  
  // Validate request body
  const validated = validateBody(jobTemplateValidationSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { name, jobTitle, jobDescription, requirements, interviewStructure, approvalChain } = validated;
  const { rows } = await pool.query(
    `INSERT INTO job_templates(organization_id, name, job_title, job_description, 
                                requirements, interview_structure, approval_chain)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [orgId, name, jobTitle, jobDescription, requirements, interviewStructure, approvalChain]
  );
  res.json(rows[0]);
});

router.patch("/organizations/:orgId/job-templates/:templateId", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId, templateId } = req.params;
  
  // Validate request body (PATCH-specific schema without defaults)
  const validated = validateBody(jobTemplatePatchSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { name, jobTitle, jobDescription, requirements, interviewStructure, approvalChain } = validated;
  
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }
  if (jobTitle !== undefined) {
    updates.push(`job_title = $${paramCount++}`);
    values.push(jobTitle);
  }
  if (jobDescription !== undefined) {
    updates.push(`job_description = $${paramCount++}`);
    values.push(jobDescription);
  }
  if (requirements !== undefined) {
    updates.push(`requirements = $${paramCount++}`);
    values.push(requirements);
  }
  if (interviewStructure !== undefined) {
    updates.push(`interview_structure = $${paramCount++}`);
    values.push(interviewStructure);
  }
  if (approvalChain !== undefined) {
    updates.push(`approval_chain = $${paramCount++}`);
    values.push(approvalChain);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  
  updates.push(`updated_at = NOW()`);
  values.push(templateId, orgId);
  const { rows } = await pool.query(
    `UPDATE job_templates SET ${updates.join(', ')}
     WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
     RETURNING *`,
    values
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: "Job template not found" });
  }
  
  res.json(rows[0]);
});

router.delete("/organizations/:orgId/job-templates/:templateId", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId, templateId } = req.params;
  const { rows } = await pool.query(
    `DELETE FROM job_templates WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [templateId, orgId]
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: "Job template not found" });
  }
  
  res.json({ ok: true });
});

// ============================================
// SALARY BANDS
// ============================================

router.get("/organizations/:orgId/salary-bands", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  const { rows } = await pool.query(
    `SELECT * FROM salary_bands WHERE organization_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
  res.json(rows);
});

router.post("/organizations/:orgId/salary-bands", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  
  // Validate request body (enforces min <= max constraint)
  const validated = validateBody(salaryBandValidationSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { title, minSalary, maxSalary, currency } = validated;
  const { rows } = await pool.query(
    `INSERT INTO salary_bands(organization_id, title, min_salary, max_salary, currency)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [orgId, title, minSalary, maxSalary, currency]
  );
  res.json(rows[0]);
});

router.patch("/organizations/:orgId/salary-bands/:bandId", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId, bandId } = req.params;
  
  // Validate request body (PATCH-specific schema without defaults, enforces min <= max if both present)
  const validated = validateBody(salaryBandPatchSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { title, minSalary, maxSalary, currency } = validated;
  
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  if (title !== undefined) {
    updates.push(`title = $${paramCount++}`);
    values.push(title);
  }
  if (minSalary !== undefined) {
    updates.push(`min_salary = $${paramCount++}`);
    values.push(minSalary);
  }
  if (maxSalary !== undefined) {
    updates.push(`max_salary = $${paramCount++}`);
    values.push(maxSalary);
  }
  if (currency !== undefined) {
    updates.push(`currency = $${paramCount++}`);
    values.push(currency);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  
  values.push(bandId, orgId);
  const { rows } = await pool.query(
    `UPDATE salary_bands SET ${updates.join(', ')}
     WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
     RETURNING *`,
    values
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: "Salary band not found" });
  }
  
  res.json(rows[0]);
});

router.delete("/organizations/:orgId/salary-bands/:bandId", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId, bandId } = req.params;
  const { rows } = await pool.query(
    `DELETE FROM salary_bands WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [bandId, orgId]
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: "Salary band not found" });
  }
  
  res.json({ ok: true });
});

// ============================================
// APPROVED VENDORS
// ============================================

router.get("/organizations/:orgId/vendors", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  const { rows } = await pool.query(
    `SELECT * FROM approved_vendors WHERE organization_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
  res.json(rows);
});

router.post("/organizations/:orgId/vendors", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId } = req.params;
  
  // Validate request body
  const validated = validateBody(approvedVendorValidationSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { name, contactEmail, rate, ndaSigned, status } = validated;
  const { rows } = await pool.query(
    `INSERT INTO approved_vendors(organization_id, name, contact_email, rate, nda_signed, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [orgId, name, contactEmail, rate, ndaSigned, status]
  );
  res.json(rows[0]);
});

router.patch("/organizations/:orgId/vendors/:vendorId", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId, vendorId } = req.params;
  
  // Validate request body (PATCH-specific schema without defaults)
  const validated = validateBody(approvedVendorPatchSchema, { ...req.body, organizationId: orgId });
  if ('error' in validated) {
    return res.status(400).json({ error: validated.error });
  }
  
  const { name, contactEmail, rate, ndaSigned, status } = validated;
  
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }
  if (contactEmail !== undefined) {
    updates.push(`contact_email = $${paramCount++}`);
    values.push(contactEmail);
  }
  if (rate !== undefined) {
    updates.push(`rate = $${paramCount++}`);
    values.push(rate);
  }
  if (ndaSigned !== undefined) {
    updates.push(`nda_signed = $${paramCount++}`);
    values.push(ndaSigned);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramCount++}`);
    values.push(status);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  
  values.push(vendorId, orgId);
  const { rows } = await pool.query(
    `UPDATE approved_vendors SET ${updates.join(', ')}
     WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
     RETURNING *`,
    values
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: "Vendor not found" });
  }
  
  res.json(rows[0]);
});

router.delete("/organizations/:orgId/vendors/:vendorId", authenticateSession, requireOrgMembership, async (req, res) => {
  const { orgId, vendorId } = req.params;
  const { rows } = await pool.query(
    `DELETE FROM approved_vendors WHERE id = $1 AND organization_id = $2 RETURNING id`,
    [vendorId, orgId]
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: "Vendor not found" });
  }
  
  res.json({ ok: true });
});

export default router;
