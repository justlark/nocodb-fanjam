import dns from 'node:dns';
import { promisify } from 'util';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import Noco from '~/Noco';
import { User } from '~/models';
import { randomTokenString } from '~/helpers/stringHelpers';
// In test mode we never want the backend to crash — workers should get
// proper HTTP error responses rather than ECONNREFUSED. Log all errors but
// don't exit (production entry points use handleUncaughtErrors instead).
process.on('uncaughtException', (err) => {
  console.error('[testDocker uncaughtException]', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[testDocker unhandledRejection]', err);
});
process.env.NC_VERSION = '0009044';

// ref: https://github.com/nodejs/node/issues/40702#issuecomment-1103623246
dns.setDefaultResultOrder('ipv4first');

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(
  cors({
    exposedHeaders: 'xc-db-response',
  }),
);

server.set('view engine', 'ejs');

process.env[`DEBUG`] = 'xc*';
process.env[`NC_ALLOW_LOCAL_HOOKS`] = 'true';

// Public signup is permanently disabled (invite-only), so the super admin is
// created from the environment and the extra test users are inserted directly.
const TEST_ADMIN_EMAIL = 'user@nocodb.com';
const TEST_PASSWORD = 'Password123.';
process.env.NC_ADMIN_EMAIL ??= TEST_ADMIN_EMAIL;
process.env.NC_ADMIN_PASSWORD ??= TEST_PASSWORD;

// Wrap the async init logic so that any unhandled rejection inside the
// listen callback causes an explicit exit rather than being silently swallowed
// or (in Node.js 15+) crashing the process with a cryptic error.
function startServer() {
  if (process.env.NC_WORKER_CONTAINER === 'true') {
    const httpServer = server.listen(process.env.PORT || 8080, () => {
      (async () => {
        server.use(await Noco.init({}, httpServer, server));
      })().catch((e) => {
        console.error('Fatal error during worker server initialization:', e);
        process.exit(1);
      });
    });
  } else {
    const httpServer = server.listen(process.env.PORT || 8080, () => {
      (async () => {
        // Noco.init() failure is truly fatal — exit so the health check never passes.
        server.use(await Noco.init({}, httpServer, server));
      })()
        .then(async () => {
          // User creation runs after Noco.init() and server.use() so that
          // /api/v1/health is already responding. Failures here are non-fatal:
          // the backend stays up and tests will see sign-in errors rather than
          // ECONNREFUSED.
          try {
            // The admin itself is created by initAdminFromEnv during Noco.init().
            const admin_response = await axios.post(
              `http://localhost:${
                process.env.PORT || 8080
              }/api/v1/auth/user/signin`,
              {
                email: TEST_ADMIN_EMAIL,
                password: TEST_PASSWORD,
              },
            );
            console.log(admin_response.data);

            for (let i = 0; i < 4; i++) {
              const email = `user-${i}@nocodb.com`;
              if (!(await User.getByEmail(email))) {
                const salt = await promisify(bcrypt.genSalt)(10);
                const password = await promisify(bcrypt.hash)(
                  TEST_PASSWORD,
                  salt,
                );
                const user = await User.insert({
                  email,
                  salt,
                  password,
                  roles: 'org-level-creator',
                  token_version: randomTokenString(),
                });
                console.log(`Created test user ${user.email}`);
              }
            }
          } catch (e) {
            console.error('Error during test user creation (non-fatal):', e);
          }
        })
        .catch((e) => {
          console.error('Fatal error during server initialization:', e);
          process.exit(1);
        });
    });
  }
}

startServer();
