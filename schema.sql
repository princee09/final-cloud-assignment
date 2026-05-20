-- ==========================================
-- MULTI-TEAM REPORT PLATFORM SCHEMA
-- ==========================================

-- 1. Employees Table
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(150) UNIQUE
);

-- 2. Teams Table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    team_name VARCHAR(100)
);

-- 3. Junction Table (MANDATORY MANY-TO-MANY)
CREATE TABLE employee_teams (
    employee_id INT REFERENCES employees(id),
    team_id INT REFERENCES teams(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_id, team_id)
);

-- 4. Reports Table
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    team_id INT REFERENCES teams(id),
    uploaded_by INT REFERENCES employees(id),
    file_name VARCHAR(255),
    s3_key VARCHAR(500),
    status VARCHAR(50),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- ==========================================
-- MANDATORY DELIVERABLE QUERIES
-- ==========================================

-- A. JOIN Query: Get all employees in a specific team
SELECT e.name, t.team_name
FROM employees e
JOIN employee_teams et ON e.id = et.employee_id
JOIN teams t ON t.id = et.team_id
WHERE t.id = 1;

-- B. Reverse JOIN Query: Get all teams for a specific employee
SELECT t.team_name, e.name
FROM teams t
JOIN employee_teams et ON t.id = et.team_id
JOIN employees e ON e.id = et.employee_id
WHERE e.id = 1;

-- C. Aggregation Query: Find Number of reports uploaded per team
SELECT t.team_name, COUNT(r.id) as total_reports
FROM teams t
LEFT JOIN reports r ON t.id = r.team_id
GROUP BY t.id, t.team_name;
