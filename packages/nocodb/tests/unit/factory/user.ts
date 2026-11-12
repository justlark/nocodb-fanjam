import { promisify } from 'util';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { OrgUserRoles } from 'nocodb-sdk';
import { User } from '../../../src/models';
import { randomTokenString } from '../../../src/helpers/stringHelpers';
import { BasesService } from '~/services/bases.service';
import Noco from '~/Noco';

const defaultUserArgs = {
  email: 'test@example.com',
  password: 'A1234abh2@dsad',
};

// Public signup is permanently disabled (invite-only), so test users are
// inserted directly and then signed in. This mirrors what signup used to do:
// the first user is a super admin and gets the default "Getting Started" base
// (several tests count on it); everyone else is an org-level viewer.
// Extra args such as `roles` / `display_name` were ignored by signup, so they
// are ignored here too.
const createUser = async (context, userArgs = {}) => {
  const args = { ...defaultUserArgs, ...userArgs };
  const email = args.email.toLowerCase();

  if (!(await User.getByEmail(email))) {
    const salt = await promisify(bcrypt.genSalt)(10);
    const password = await promisify(bcrypt.hash)(args.password, salt);

    const isFirstUser = await User.isFirst();
    const roles = isFirstUser
      ? `${OrgUserRoles.CREATOR},${OrgUserRoles.SUPER_ADMIN}`
      : OrgUserRoles.VIEWER;

    const user = await User.insert({
      email,
      salt,
      password,
      roles,
      token_version: randomTokenString(),
    });

    if (isFirstUser) {
      await Noco.nestApp
        .get(BasesService)
        .createDefaultBase({ user, req: { user, headers: {} } as any });
    }
  }

  const response = await request(context.app)
    .post('/api/v1/auth/user/signin')
    .send({ email, password: args.password });
  const user = await User.getByEmail(email);
  return { token: response.body.token, user };
};

export { createUser, defaultUserArgs };
