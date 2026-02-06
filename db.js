import { Pool } from 'pg';
import 'dotenv/config';

const conn = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export default conn;