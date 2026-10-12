// Compatibility entry point for the old test command. Tests now use isolated MongoDB
// and authenticated clients rather than mutating an operator's live database.
import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['--test','tests/workflow.test.js'],{cwd:new URL('.',import.meta.url),stdio:'inherit'});
child.on('exit',code=>{process.exitCode=code||0;});
