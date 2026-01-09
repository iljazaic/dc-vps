const axios = require('axios');
const path = require("path");
require('dotenv').config({ path: '../secretes/.env' })

const fs = require('fs');
const { exec } = require('child_process');
const cron = require('node-cron');

async function getPrice(item, index) {
    const filePath = path.join(__dirname, '../../../lib/hosting/', 'resource_options.json');
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    //mult by 100 to be compatable with nets
    return jsonData["prices"][item]["val"][index] * 100;
}

async function getQuantity(item, index) {
    const filePath = path.join(__dirname, '../../../lib/hosting/', 'resource_options.json');
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    //console.log(jsonData["values"][item]["val"][index])
    return jsonData["values"][item]["val"][index];
}

async function getUnit(item) {
    const filePath = path.join(__dirname, '../../../lib/hosting/', 'resource_options.json');
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return jsonData["values"][item]["unit"];
}

async function getCurrency(item) {
    const filePath = path.join(__dirname, '../../../lib/hosting/', 'resource_options.json');
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return jsonData["prices"][item]["currency"];
}

//testing api key, safe for now
const API_KEY = pricess.env.NETS_API_KEY;

// Your NETS API configuration
const NETS_CONFIG = {
    apiKey: API_KEY,
    baseUrl: 'https://test.api.dibspayment.eu', // Use 'https://api.dibspayment.eu' for production
};

// Create axios instance with default config
const netsClient = axios.create({
    baseURL: NETS_CONFIG.baseUrl,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': NETS_CONFIG.apiKey,
    }
});

/**
 * Process a subscription charge - fetches payment details and charges automatically
 * Perfect for daily cronjob - just pass subscriptionId from your database
 * 
 * @param {string} subscriptionId - The NETS subscription ID
 * @param {string} paymentId - The original payment ID (stored in your DB with subscriptionId)
 * @returns {Promise<Object>} Complete charge result
 */
async function processSubscriptionCharge(subscriptionId, paymentId) {
    try {
        console.log(`[${subscriptionId}] Starting subscription charge process...`);

        // Step 1: Fetch payment details to get the amount
        console.log(`[${subscriptionId}] Fetching payment details...`);
        const paymentResponse = await netsClient.get(`/v1/payments/${paymentId}`);
        const payment = paymentResponse.data;

        // Validate subscription exists
        if (!payment.subscription || payment.subscription.id !== subscriptionId) {
            throw new Error('Subscription not found or mismatch');
        }

        const amount = payment.orderDetails?.amount;
        const currency = payment.orderDetails?.currency;

        if (!amount) {
            throw new Error('Payment amount not found');
        }

        console.log(`[${subscriptionId}] Amount to charge: ${amount} ${currency}`);

        // Step 2: Initiate the charge
        console.log(`[${subscriptionId}] Initiating charge...`);
        const chargeResponse = await netsClient.post(`/v1/payments/${paymentId}/charges`, {
            amount: amount,
            subscriptionId: subscriptionId
        });

        console.log(`[${subscriptionId}] Charge initiated successfully. ChargeId: ${chargeResponse.data.chargeId}`);

        // Step 3: Return complete result
        return {
            success: true,
            subscriptionId: subscriptionId,
            paymentId: paymentId,
            chargeId: chargeResponse.data.chargeId,
            amount: amount,
            currency: currency,
            status: 'pending', // Charge is initiated but not yet confirmed
            timestamp: new Date(),
            message: 'Charge initiated successfully. Awaiting webhook confirmation.'
        };

    } catch (error) {
        console.error(`[${subscriptionId}] Error processing subscription charge:`, error.response?.data || error.message);

        return {
            success: false,
            subscriptionId: subscriptionId,
            paymentId: paymentId,
            error: error.response?.data || error.message,
            errorCode: error.response?.data?.code || null,
            statusCode: error.response?.status,
            timestamp: new Date(),
            message: 'Charge failed'
        };
    }
}

/**
 * Verify a subscription charge status (useful for checking pending charges)
 * @param {string} paymentId - The payment ID to check
 * @returns {Promise<Object>} Payment status
 */
async function verifySubscriptionCharge(paymentId) {
    try {
        const response = await netsClient.get(`/v1/payments/${paymentId}`);
        const payment = response.data;

        return {
            success: true,
            paymentId: payment.paymentId,
            subscriptionId: payment.subscription?.id || null,
            summary: {
                reservedAmount: payment.summary?.reservedAmount || 0,
                chargedAmount: payment.summary?.chargedAmount || 0,
                refundedAmount: payment.summary?.refundedAmount || 0,
                cancelledAmount: payment.summary?.cancelledAmount || 0
            },
            charges: payment.charges?.map(charge => ({
                chargeId: charge.chargeId,
                amount: charge.amount,
                created: charge.created
            })) || [],
            lastCharge: payment.charges?.[payment.charges.length - 1] || null
        };

    } catch (error) {
        console.error('Error verifying subscription charge:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message,
            statusCode: error.response?.status
        };
    }
}


async function dailySubscriptionCharges(pathToBash) {
    console.log('=== Starting daily subscription charge job ===');
    console.log(`Time: ${new Date().toISOString()}`);

    try {
        // Fetch all active subscriptions due for charging
        const dueSubscriptions = await db.query(`
            SELECT 
                id,
                subscription_id,
                payment_id,
                user_id,
                next_charge_date
            FROM subscriptions 
            WHERE status = 'active' 
            AND next_charge_date <= NOW()
        `);

        console.log(`Found ${dueSubscriptions.length} subscriptions due for charging`);

        const results = {
            total: dueSubscriptions.length,
            successful: 0,
            failed: 0,
            errors: []
        };

        // Process each subscription
        for (const subscription of dueSubscriptions) {
            console.log(`\nProcessing subscription ${subscription.subscription_id} for user ${subscription.user_id}`);

            // Charge the subscription (this does everything!)
            const result = await processSubscriptionCharge(
                subscription.subscription_id,
                subscription.payment_id
            );

            if (result.success) {
                results.successful++;

                // Update database: mark charge as pending
                await db.query(`
                    INSERT INTO charges (
                        subscription_id,
                        charge_id,
                        amount,
                        currency,
                        status,
                        attempted_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                    subscription.id,
                    result.chargeId,
                    result.amount,
                    result.currency,
                    'pending'
                ]);

                console.log(`Charge initiated: ${result.chargeId}`);

            } else {
                results.failed++;
                results.errors.push({
                    subscription_id: subscription.subscription_id,
                    user_id: subscription.user_id,
                    error: result.error
                });

                // Update subscription status to failed
                await db.query(`
                    UPDATE subscriptions 
                    SET status = 'failed', 
                        last_error = ?,
                        updated_at = NOW()
                    WHERE id = ?
                `, [result.error, subscription.id]);

                console.log(`Charge failed: ${result.error}`);
                // await sendPaymentFailedEmail(subscription.user_id);
             }

             await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('\n=== Charge job completed ===');
        console.log(`Successful: ${results.successful}`);
        console.log(`Failed: ${results.failed}`);

        if (results.errors.length > 0) {
            console.log('\nErrors:');
            results.errors.forEach(err => {
                console.log(`- User ${err.user_id}: ${err.error}`);
            });
        }

        return results;

    } catch (error) {
        console.error('Fatal error in subscription charge job:', error);
        throw error;
    }
}




/**
 * Verifies a payment by checking if it has been charged
 * @param {string} paymentId - The payment ID to verify
 * @returns {Promise<boolean>} - True if payment is charged, false otherwise
 */
async function verifyPayment(paymentId) {
    if (!paymentId || paymentId.trim() === '') {
        return false;
    }
    try {
        const url = `https://test.api.dibspayment.eu/v1/payments/${paymentId}`;
        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_KEY
            }
        });

        if (response.status >= 200 && response.status < 300) {
            const data = response.data;
            const charged = findValue(data, 'charged');
            return charged !== null && charged > 0;
        }
    } catch (error) {
        console.log('Error in parsing, issues detected, idk');
    }

    return false;
}

/**
 * Helper function to recursively find a value in a nested object
 * @param {Object} obj - The object to search
 * @param {string} key - The key to find
 * @returns {*} - The value if found, null otherwise
 */
function findValue(obj, key) {
    if (obj === null || obj === undefined) {
        return null;
    }

    if (obj.hasOwnProperty(key)) {
        return obj[key];
    }

    for (const k in obj) {
        if (typeof obj[k] === 'object') {
            const result = findValue(obj[k], key);
            if (result !== null) {
                return result;
            }
        }
    }

    return null;
}

/**
 * Creates a payment template JSON for an instance creation form
 * @param {Object} icf - Instance creation form object
 * @param {number} icf.ram - RAM tier index (0-5)
 * @param {number} icf.storage - Storage tier index (0-5)
 * @param {string} [icf.email] - Customer email
 * @returns {string} - JSON string for payment template
 */
async function createPaymentTemplate(icf) {
    const email = icf.email || 'not@provid.ed';



    const ramQuantity = await getQuantity("ram", icf.ram);
    const stoQuantity = await getQuantity("sto", icf.storage);
    const cpuQuantity = await getQuantity("cpu", icf.vcpu);
    //console.log(ramQuantity);

    const ramTotal = await getPrice("ram", icf.ram);
    const stoTotal = await getPrice("sto", icf.storage);
    const cpuTotal = await getPrice("cpu", icf.vcpu);

    const ramUnitPrice = Math.floor(ramTotal / ramQuantity);
    const stoUnitPrice = Math.floor(stoTotal / stoQuantity);
    const cpuUnitPrice = Math.floor(cpuTotal / cpuQuantity);

    console.log(ramTotal, ramQuantity, ramUnitPrice)

    const totalAmount = stoTotal + ramTotal + ramTotal;

    const paymentData = {

        "checkout": {
            "url": "http://localhost:3000/checkout",
            "termsUrl": "http://localhost:3000/terms",
            "reutrnUrl": "http://localhost:3000/completed",
            "charge": true,
            "consumerType": {
                "supportedTypes": [
                    "B2C"
                ],
                "default": "B2C"
            },
            "merchantHandlesConsumerData": true,
            "consumer": {
                "email": "test@domain.com"
            }
        },
        "subscription": {
            "interval": 30,
            "endDate": null
        },
        "notifications": {
            "webhooks": [
                {
                    "eventName": "payment.charge.created.v2",
                    "url": "https://your-domain.com/webhook/charge-success",
                    "authorization": "your-secret-key-here"
                },
                {
                    "eventName": "payment.reservation.failed",
                    "url": "https://your-domain.com/webhook/charge-failed",
                    "authorization": "your-secret-key-here"
                }
            ]
        },
        "order": {
            "items": [
                {
                    "reference": "RAM01",
                    "name": "RAM",
                    "quantity": ramQuantity,
                    "unit": await getUnit("ram"),
                    "unitPrice": ramUnitPrice,
                    "grossTotalAmount": ramTotal,
                    "netTotalAmount": ramTotal
                },
                {
                    "reference": "STO01",
                    "name": "STO",
                    "quantity": stoQuantity,
                    "unit": await getUnit("sto"),
                    "unitPrice": stoUnitPrice,
                    "grossTotalAmount": stoTotal,
                    "netTotalAmount": stoTotal
                },
                {
                    "reference": "CPU01",
                    "name": "CPU",
                    "quantity": cpuQuantity,
                    "unit": await getUnit("cpu"),
                    "unitPrice": cpuUnitPrice,
                    "grossTotalAmount": cpuTotal,
                    "netTotalAmount": cpuTotal
                }
            ],
            "amount": totalAmount,
            "currency": await getCurrency("ram"),
            "reference": "noref"
        }
    }

    return JSON.stringify(paymentData, null, 2);
}


async function cancelSubscription(subscriptionId) {
    const response = await fetch(`https://api.dibspayment.eu/v1/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
            'Authorization': API_KEY,
            'Content-Type': 'application/json'
        }
    });
    return response.json();
}

// Export functions
module.exports = {
    verifyPayment,
    createPaymentTemplate,
    getPrice,
    cancelSubscription,
    getQuantity,
    getCurrency,
    dailySubscriptionCharges,
    getUnit
};