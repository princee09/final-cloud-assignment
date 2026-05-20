const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(cors());

// ==========================================
// CONFIGURATIONS
// ==========================================

// Connect to AWS RDS Database
const pool = new Pool({
    host: 'team-reports-db.ckr4ck4qqsc4.us-east-1.rds.amazonaws.com', 
    user: 'postgres',
    password: 'KPrince*123', 
    database: 'postgres', 
    port: 5432,
    ssl: { rejectUnauthorized: false } 
});

// Connect to AWS S3
const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = 'team-report-storage-klaus'; 

// Setup Multer to catch uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// EMPLOYEE APIs
// ==========================================

app.post('/employees', async (req, res) => {
    const { name, email } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO employees (name, email) VALUES ($1, $2) RETURNING *',
            [name, email]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/employees', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM employees');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// TEAM APIs
// ==========================================

app.post('/teams', async (req, res) => {
    const { team_name } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO teams (team_name) VALUES ($1) RETURNING *',
            [team_name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/teams', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM teams');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// JUNCTION TABLE APIs (MANY-TO-MANY)
// ==========================================

app.post('/teams/:teamId/employees/:employeeId', async (req, res) => {
    const { teamId, employeeId } = req.params;
    try {
        await pool.query(
            'INSERT INTO employee_teams (employee_id, team_id) VALUES ($1, $2)',
            [employeeId, teamId]
        );
        res.status(201).json({ message: 'Employee mapped to team successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/teams/:teamId/employees', async (req, res) => {
    const { teamId } = req.params;
    try {
        const queryText = `
            SELECT e.id, e.name, e.email, t.team_name
            FROM employees e
            JOIN employee_teams et ON e.id = et.employee_id
            JOIN teams t ON t.id = et.team_id
            WHERE t.id = $1
        `;
        const result = await pool.query(queryText, [teamId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/employees/:employeeId/teams', async (req, res) => {
    const { employeeId } = req.params;
    try {
        const queryText = `
            SELECT t.id, t.team_name
            FROM teams t
            JOIN employee_teams et ON t.id = et.team_id
            JOIN employees e ON e.id = et.employee_id
            WHERE e.id = $1
        `;
        const result = await pool.query(queryText, [employeeId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// REPORT & S3 APIs (PHASE 5)
// ==========================================

app.post('/upload-report', upload.single('report_file'), async (req, res) => {
    const { team_id, uploaded_by } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const file = req.file;
    const fileName = file.originalname;
    const s3Key = `team-${team_id}/pending/${Date.now()}_${fileName}`;

    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: file.buffer,
            ContentType: file.mimetype
        }));

        const result = await pool.query(
            'INSERT INTO reports (team_id, uploaded_by, file_name, s3_key, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [team_id, uploaded_by, fileName, s3Key, 'pending']
        );

        res.status(201).json({ message: 'Report uploaded securely to S3.', report: result.rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/reports', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reports');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/teams/:teamId/reports', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reports WHERE team_id = $1', [req.params.teamId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running beautifully on port ${PORT}`);
});
