const express = require("express");
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const path = require("path");
const app = express();
app.use(express.static(path.join(__dirname.replace('server', ''), "public")));
app.use(express.json());

//from upstream directory?
const paymentService = require("./services/payment_service");
const emailService = require("./services/email_service");
const registrationService = require("./services/registration_service");
const vpsService = require("./services/vps_service");

const reservation_jobs = {};//to store the compute reserved by payments
const pendingPayments = {}//to store reservations until they are processed
const deployment_jobs = {}//to store the spinups


//api
app.post("/validate-email", async (req, res) => {
    try {
        const email = req.body.email;
        console.log(email);
        if (email === undefined || email === null || email === '') {
            res.status(412).send("No email provided");
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(email)) {
                //generate and send otp to be validated
                const otp = await registrationService.generateAndStoreOTP()
                emailService.sendVerificationEmail(email, otp);
                res.status(200).json({ message: "OTP sent to email" });
            } else {
                res.status(400).send("Not a valid email");
            }
        }
    } catch (err) {
        res.status(500).json({ error: "Failed to send email" })
    }
});

app.get('/domain-available', async (req, res) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);//assume its under 10s??
        const isAv = await registrationService.subdomainAvailiable(req.query.subd);
        clearTimeout(timeoutId);
        res.json({ available: isAv });
    } catch (error) {
        console.error("Lookup failed:", error);
        res.status(500).json({ error: "Check timed out or failed" });
    }
});


app.post('/create-reservation', async (req, res) => {
    //pull body
    const reservationBody = req.body;

    //handle issues
    if (reservationBody === null || reservationBody === undefined) {
        res.status(400).send("No Reservation Body Provided")
        return;
    }
    const email = reservationBody.email;
    if (email === undefined || email === null) {
        res.status(400).send("Malformed Query")
        return;
    }
    const otp = reservationBody.otp;
    if (otp === undefined || otp === null) {
        res.status(400).send("No Code Provided - Please check your email")
        return;
    }

    //email validation
    try {
        const otp_matches = registrationService.verifyOTP(email, otp)
    } catch (err) {
        if (err.includes("Invalid")) {
            res.status(400).send(err);
            return
        }
        else {
            res.status(500).send("Error Verifying OTP - Try Again Later");
            return;
        }
    }
    if (otp_matches) {
        //init payment
        const paymentId = await paymentService.createPayment(reservationBody);
        if (paymentId.includes("error")) {
            res.status(500).send("Payment Processing Error - Please Try Again");
            console.log(paymentId)
            return;
        }
        //init reservation
        const jobId = uuidv4();
        reservation_jobs[jobId] = { status: "processing" };
        createReservation(reservationBody, paymentId).then(response => {
            reservation_jobs[jobId] = { status: "completed", succes: response.success, paymentId: paymentId, message: response.message };
        })
        //send tracker id
        res.status(200).json({ jobId: jobId });
    }
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
    } else {
        res.status(402).send("Awaiting Payment");
    }
})

app.get("/completed", (req, res) => {
    const paymentId = req.params.paymenId;

    if (paymentId == undefined || paymentId == null) {
        res.status(400);
        return;
    }
    else {
        res.sendFile(__dirname.replace('server', 'html') + '/pages/completed.html');
    }
})


app.get("/checkout", (req, res) => {
    const paymentId = req.query.paymentId;
    if (paymentId == undefined || paymentId == null) {
        res.status(400)
        res.send();
        return;
    }
    else {
        res.sendFile(__dirname.replace('server', 'html') + '/pages/checkout.html');
    }
})


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

const crontime = "55 23 * * *"
//recurring daily verification of subscriptions
cron.schedule(crontime, async () => {
    exec(bashpath, async (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            return;
        }
        const result = stdout.trim().split('\n');
        for (let i = 0; i < result.length(); i++) {
            await paymentService.dailySubscriptionCharges();
        }
    });
});

