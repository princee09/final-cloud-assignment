const { Pool } = require('pg');
const { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: 'us-east-1' });

// Connect to AWS RDS Database
const pool = new Pool({
    host: 'team-reports-db.ckr4ck4qqsc4.us-east-1.rds.amazonaws.com',
    user: 'postgres',
    password: 'KPrince*123',
    database: 'postgres',
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
    console.log("Lambda Triggered by EventBridge: Checking for pending reports...");
    
    try {
        // 1. Fetch 'pending' reports from the database
        const { rows: pendingReports } = await pool.query("SELECT * FROM reports WHERE status = 'pending'");
        
        if (pendingReports.length === 0) {
            console.log("No pending reports found.");
            return { statusCode: 200, body: 'No pending reports' };
        }

        for (const report of pendingReports) {
            console.log(`Processing file: ${report.file_name}`);
            
            const bucket = 'klaus-assignment-bucket-123'; 
            const oldKey = report.s3_key;
            
            // 2. Read the file from S3 to count the lines
            const getReq = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: oldKey }));
            const fileContent = await getReq.Body.transformToString();
            const rowCount = fileContent.split('\n').length;
            console.log(`Success: ${report.file_name} has ${rowCount} rows.`);

            // 3. Move the file from '/pending/' to '/processed/' in S3
            const newKey = oldKey.replace('/pending/', '/processed/');
            
            await s3.send(new CopyObjectCommand({
                Bucket: bucket,
                CopySource: `${bucket}/${oldKey}`,
                Key: newKey
            }));
            
            await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));

            // 4. Update the Database record
            await pool.query(
                "UPDATE reports SET status = 'processed', processed_at = CURRENT_TIMESTAMP, s3_key = $1 WHERE id = $2",
                [newKey, report.id]
            );
            
            console.log(`Report completely processed!`);
        }

        return { statusCode: 200, body: 'All reports processed!' };
    } catch (err) {
        console.error("Error processing reports:", err);
        throw err;
    }
};
