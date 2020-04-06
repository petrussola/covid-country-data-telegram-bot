const express = require('express');
require('dotenv').config();

const app = express();

const port = process.env.PORT || 5000;

app.use(express.json());

app.get('/', (req, res) => {
	res.status(200).json({ message: 'Hello from the Bot API.' });
});

app.listen(port, () => {
	console.log(`\n\nServer running on port ${port}.\n\n`);
});

module.exports = app;
