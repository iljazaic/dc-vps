const express = require("express");
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const { v4: uuidv4 } = require('uuid');

const path = require("path");
const app = express();
app.use(express.static(path.join(__dirname.replace('server', ''), "public")));
app.use(express.json());

const jobs = {};//to store the spinups


//todo change to nonrelative
const pathForBash = "../bash/";

async function subdomainAvailiable(subdomain) {
    try {
        const { stdout, stderr } = await exec(`bash ${pathForBash + 'subdomain_service/verify_subdomain'}.sh ${subdomain}`);
        return stdout === "true";
    } catch (err) {
        //console.error('Error:', err);
        throw err;
    }
}

async function createReservation(reservationString) {
    try {
        const { stdout, stderr } = await exec(`bash ${pathForBash + "deployment_and_reservation/create_reservation"}.sh ${subdomain}`);

        if (stdout === "NO MACHINE CAN HOST") {
            return { success: false, bill: null, message: "No Machine Available to host, try again later." };
        } else {
            return { succes: true, bill: null, message: "Reservation successfully created, redirecting to checkout." }
        }
    } catch (err) {
        return { succes: false, bill: null, message: "Internal Server Error while creating reservation. Try again or contact support." }
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
    jobs[jobId] = { status: "processing" };

    createReservation(reservationBody).then(response => {
        jobs[jobId] = { status: "completed", succes: response.success, bill: response.bill, message: response.message };
    });

    res.json({ jobId });
});


app.get("/check-reservation-status/:jobId", (req, res) => {
    const job = jobs[req.params.jobId];
    res.json(job || { status: "not_found" });
});






app.listen(3000, () => {
    console.log("user connected");
})
