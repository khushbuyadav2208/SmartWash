// Resolve configuration beside this module, regardless of the startup directory.
import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
dotenv.config({path:fileURLToPath(new URL('./.env',import.meta.url)),quiet:true});
