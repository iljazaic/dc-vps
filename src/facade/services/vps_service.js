//contains scripts to launch/reserve compute space on actual host machines
//tldr runs bash code


const exec = util.promisify(require('child_process').exec);

const pathForBash = "../bash/";

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
        } catch (err) {
            return { success: false, vm_id: null, ssh_key: null };
        }

    } catch (er) {
        console.log("ERROR: no ip found bound to the paymentId: " + reservationId)
    }

}

module.exports = {
    initiateDeployment,
    createReservation
};