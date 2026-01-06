const axios = require('axios');

const fs = require('fs');

async function getPrice(item, index) {
    const filePath = path.join(__dirname, '../../../../lib/hosting/', 'resource_options.json');
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    //mult by 100 to be compatable with nets
    return jsonData["prices"][item]["val"][index] * 100;
}

async function getQuantity(item, index) {
    const filePath = path.join(__dirname, '../../../../lib/hosting/', 'resource_options.json');
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return jsonData["values"][item]["val"][index];
}

async function getUnit(item) {
    const filePath = path.join(__dirname, '../../../../lib/hosting/', 'resource_options.json');
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return jsonData["values"][item]["unit"];
}

async function getCurrency(item) {
    const filePath = path.join(__dirname, '../../../../lib/hosting/', 'resource_options.json');
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return jsonData["prices"][item]["currency"];
}


const API_KEY = process.env.PAYMENT_API_KEY;

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
function createPaymentTemplate(icf) {
    const email = icf.email || 'not@provid.ed';

    const ramQuantity = getQuantity("ram", icf.ram);
    const stoQuantity = getQuantity("sto", icf.storage);
    const cpuQuantity = getQuantity("cpu", icf.vcpu);


    const ramTotal = getPrice("ram", icf.ram);
    const stoTotal = getPrice("sto", icf.storage);
    const cpuTotal = getPrice("cpu", icf.vcpu);

    const ramUnitPrice = Math.floor(ramTotal / ramQuantity);
    const stoUnitPrice = Math.floor(stoTotal / stoQuantity);
    const cpuUnitPrice = Math.floor(cpuTotal / cpuQuantity);

    const totalAmount = stoTotal + ramTotal + ramTotal;

    const paymentData = {
        order: {
            items: [
                {
                    reference: 'RA01',
                    name: 'RAM',
                    quantity: ramQuantity,
                    unit: getUnit("ram"),
                    unitPrice: ramUnitPrice,
                    grossTotalAmount: ramTotal,
                    netTotalAmount: ramTotal
                },
                {
                    reference: 'ST01',
                    name: 'STORAGE',
                    quantity: stoQuantity,
                    unit: getUnit("sto"),
                    unitPrice: stoUnitPrice,
                    grossTotalAmount: stoTotal,
                    netTotalAmount: stoTotal
                },
                {
                    reference: 'CR01',
                    name: "VCPU",
                    quantity: cpuQuantity,
                    unit: getUnit("cpu"),
                    unitPrice: cpuUnitPrice,
                    grossTotalAmount: cpuTotal,
                    netTotalAmount: cpuTotal
                }
            ],
            amount: totalAmount,
            currency: getCurrency("ram")
        },
        checkout: {
            url: 'http://localhost:3000/checkout',
            termsUrl: 'http://localhost:3000/terms',
            charge: true,
            consumerType: {
                supportedTypes: ['B2C'],
                default: 'B2C'
            },
            merchantHandlesConsumerData: true,
            consumer: {
                email: email
            }
        }
    };

    return JSON.stringify(paymentData, null, 2);
}

// Export functions
module.exports = {
    verifyPayment,
    createPaymentTemplate,
    getPrice,
    getQuantity,
    getCurrency,
    getUnit
};