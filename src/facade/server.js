const express = require("express");
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const { v4: uuidv4 } = require('uuid');

const path = require("path");
const { createPrivateKey } = require("crypto");
const app = express();
app.use(express.static(path.join(__dirname.replace('server', ''), "public")));
app.use(express.json());

//from upstream directory?
const { paymentService } = require("../facade/payment_service/payment_service");
const { create } = require("domain");


const reservation_jobs = {};//to store the compute reserved by payments
const pendingPayments = {}//to store reservations until they are processed
const deployment_jobs = {}//to store the spinups

//todo change to nonrelative
const pathForBash = "../bash/";

async function subdomainAvailiable(subdomain) {
    try {
        const { stdout, stderr } = await exec(`bash ${pathForBash + 'subdomain_service/verify_subdomain'}.sh ${subdomain}`);
        return stdout.trim() == "true";
    } catch (err) {
        //console.error('Error:', err);
        throw err;
    }
}

async function createPayment(reservationJson) {
    const payload = paymentService.createPaymentTemplate(reservationJson);
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': process.env.API_KEY || apiKey
        };
        const url = 'https://test.api.dibspayment.eu/v1/payments';
        const response = await axios.post(url, payload, { headers });

        const paymentId = response.data.paymentId;

        return paymentId;

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);

        if (error.message.includes('payload') || error.code === 'ENOENT') {
            return "error loading payload"
        } else {
            return "error craeting payment"
        }
    }
}

async function createReservation(reservationBody, paymentId) {
    try {
        const { stdout, stderr } =
            await exec`bash ${pathForBash + "deployment_and_reservation/create_reservation"}.sh ${reservationBody.ram} ${reservationBody.sto} ${reservationBody.cpu} ${reservationBody.os} ${paymentId}`;

        //should be the ip of the host machine
        const trimmedOutput = stdout.trim();

        if (trimmedOutput === "NO MACHINE CAN HOST") {
            return { success: false, paymentId: paymentId, message: "No Machine Available to host, try again later." };
        } else {
            //save on gateway to remember the ip
            await exec`bash ${pathForBash + "deployment_and_reservation/save_reservation_on_gateway"}.sh ${paymentId} ${trimmedOutput}`;
            return { success: true, paymentId: null, message: "Reservation successfully created, redirecting to checkout." };
        }
    } catch (err) {
        return { success: false, paymentId: null, message: "Internal Server Error while creating reservation. Try again or contact support." };
    }
}


async function initiateDeployment(reservationId) {
    try {

        const { stdout, stderr } =
            await exec`bash ${pathForBash + "deployment_and_reservation/get_reservation_ip_with_id"}.sh ${reservationId}`;
        const trimmedOutput = stdout.trim();

        if (trimmedOutput.includes("ERROR")) {
            return { success: false, vm_id: null, ssh_key: null };
        }
        //output should be the ip

        const vm_ip = trimmedOutput;
        try {
            const { stdout1, stderr1 } =
                await exec`bash ${pathForBash + "deployment_and_reservation/initiate deployment"}.sh ${paymenId} ${ip}`;
            

        }

    } catch (err) {
        return { success: false, vm_id: null, ssh_key: null };
    }



}

//api
app.get('/domain-available', async (req, res) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);//assume its under 10s??
        const isAv = await subdomainAvailiable(req.query.subd);
        clearTimeout(timeoutId);
        res.json({ available: isAv });
    } catch (error) {
        console.error("Lookup failed:", error);
        res.status(500).json({ error: "Check timed out or failed" });
    }
});


app.post('/create-reservation', async (req, res) => {
    const reservationBody = req.body;
    const jobId = uuidv4();
    reservation_jobs[jobId] = { status: "processing" };

    const paymentId = createPayment(reservationBody);

    if (paymentId.includes("error")) {
        res.status(500).body(paymentId);
        return;
    }

    createReservation(reservationBody, paymentId).then(response => {
        reservation_jobs[jobId] = { status: "completed", succes: response.success, paymentId: response.paymentId, message: response.message };
    });

    res.status(200).json({ jobId: jobId, paymenId: paymentId });
});


app.get("/check-reservation-status/:jobId", (req, res) => {
    const job = reservation_jobs[req.params.jobId]; //client side has to redirect to the payment id url
    res.json(job || { status: "not_found" });
});


app.get("/check-deployment-status/:jobId", (req, res) => {
    const job = deployment_jobs[req.params.jobId]; //client side has to redirect to the payment id url
    res.json(job || { status: "not_found" });

})

app.get("/verify-payment", async (req, res) => {
    const paymentId = req.params.paymenId;
    const isCharged = paymentService.verifyPayment(paymentId);
    if (isCharged) {

        //this begins deployment
        const jobId = uuidv4();
        deployment_jobs[jobId] = { status: "processing" };

        initiateDeployment(req.params.paymenId).then(response => {
            deployment_jobs[req.payments.paymentId] = { status: "completed", vm_id: response.vm_id, ssh_key: response.ssh_key }
        });

        res.status(200).json({ jobId: jobId, paymentVerified: true });

        //begin VM deployment from correct reservation

        //fetch reservation

        //redirect user to /completed
    } else {
        res.status(402).body("Awaiting Payment");
    }
})

app.get("/completed", (req, res) => {
    const paymentId = req.params.paymenId;

    if (paymentId == undefined || paymentId == null) {
        res.status(400).body("no payment id provided; contact support")
        return;
    }
    else {
        res.sendFile(__dirname.replace('server', 'html') + '/pages/completed.html');
    }


})

async function initiateDeployment(reservationId) {
    try {
        const { stdout, stderr } = await exec(`bash ${pathForBash + 'subdomain_service/verify_subdomain'}.sh ${subdomain}`);
        return stdout.trim() == "true";
    } catch (err) {
        //console.error('Error:', err);
        throw err;
    }
}


//pages
app.get('/', (req, res) => {
    res.sendFile(__dirname.replace('server', 'html') + '/pages/index.html');
})

//should include
//checkout terms completed
app.get('/:pageName', (req, res) => {
    const page = req.params.pageName;
    const filePath = path.join(__dirname, '../html/pages', `${page}.html`);

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(err);
            res.status(404).send("Page not found");
        }
    });
})


app.listen(3000, () => {
    console.log("user connected");
})
