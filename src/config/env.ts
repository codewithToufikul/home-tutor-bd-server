// ⚠️ This file MUST be the very first import in server.ts
// ES Modules execute all imports before any code runs, so dotenv.config()
// must be loaded here to ensure process.env is populated before other modules read it.
import dotenv from 'dotenv';
dotenv.config();
