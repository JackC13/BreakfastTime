import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import extractRouter from './routes/extract.route';

const app  = express();
const PORT = process.env['PORT'] ?? 3001;

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

app.use('/api/extract', extractRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
