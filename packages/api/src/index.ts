import express from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers/configManagerSingleton.js';

const app = express();
const port = process.env.PORT || 3001;

app.get('/api/quotes', async (req, res) => {
    const quotes = await getConfigManager().quoteManager.getAllQuotes();
    res.json(quotes);
});

// Add more endpoints as needed

app.listen(port, () => {
    console.log(`API server running on port ${port}`);
});