//manages personal information like emails, accounts, subdomains, etcetc

const { exec } = require('child_process');
const crypto = require('crypto');
const db = require('../db/connection');

async function generateAndStoreOTP(email) {
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Invalid email address');
    }

    const otp = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);//10m

    await db.query(
        `INSERT INTO otp_codes (email, otp_hash, expires_at) 
         VALUES ($1, $2, $3)`,
        [email, hash, expiresAt]
    );

    return otp;
}


async function verifyOTP(email, otp) {

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Invalid email address');
    }

    if (!otp || typeof otp !== 'string' || !/^[A-Z0-9]{6}$/.test(otp)) {
        throw new Error('Invalid OTP format');
    }

    const hash = crypto.createHash('sha256').update(otp).digest('hex');

    const result = await db.query(
        `DELETE FROM otp_codes 
         WHERE email = $1 
         AND otp_hash = $2 
         AND expires_at > NOW()
         RETURNING id;`,
        [email, hash]
    );

    return result.rowCount > 0;
}


async function cleanupOTP() {
    const crontime = "55 23 * * *"
    //recurring daily cleanup of expired OTP
    cron.schedule(crontime, async () => {
        const result = await db.query(
            `DELETE FROM otp_codes WHERE expires_at > NOW();`
        );
    });
}

async function subdomainAvailiable(subdomain) {
    try {
        const { stdout, stderr } = await exec(`bash ${pathForBash + 'subdomain_service/verify_subdomain'}.sh ${subdomain}`);
        return stdout.trim() == "true";
    } catch (err) {
        //console.error('Error:', err);
        throw err;
    }
}

module.exports = {
    verifyOTP,
    generateAndStoreOTP,
    cleanupOTP,
    subdomainAvailiable
};