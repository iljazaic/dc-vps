const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
app.use(express.static(path.join(__dirname.replace('server', ''), "public")));

app.get('/', (req, res) => {
    res.sendFile(__dirname.replace('server', 'html') + '/pages/index.html');
})
app.get('/domain-available', (req, res) => {
    res.send(`{"available":true}`);
})

app.listen(3000, () => {
    console.log("user connected");
})
