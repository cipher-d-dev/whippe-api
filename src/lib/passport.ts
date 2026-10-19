import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { env } from '../config/env';
import { User } from '../modules/users/user.model';
import { AccountStatus, AuthMethod, Role } from '../modules/auth/auth.types';

/**
 * Google OAuth strategy.
 *
 * Three cases:
 *  1. Existing Google account   → return the user as-is.
 *  2. Password account with the same email → silently link googleId, return user.
 *  3. Brand new user            → create a PENDING_HR_VERIFICATION account.
 *
 * Google signups go straight to PENDING_HR_VERIFICATION (skipping
 * UNVERIFIED_EMAIL) because Google has already proven email ownership.
 * HR verification is still required before full access.
 *
 * We do not use passport sessions — the callback controller issues JWTs.
 * passport.serializeUser / deserializeUser are therefore noops.
 */

passport.serializeUser((_user, done) => done(null, null));
passport.deserializeUser((_id, done) => done(null, null));

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done,
    ) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value?.toLowerCase();
        const firstName = profile.name?.givenName ?? profile.displayName ?? 'Unknown';
        const lastName = profile.name?.familyName ?? '';

        if (!email) {
          return done(new Error('Google account did not provide an email address.'));
        }

        // 1. User already linked this Google account
        let user = await User.findOne({ googleId });
        if (user) return done(null, user);

        // 2. Password account with the same email → link Google to it
        user = await User.findOne({ email });
        if (user) {
          // Security: only silently link if the password account has already
          // verified their email. An unverified account could be a squatter.
          // For fully new Google sign-ins where a password account already
          // exists but email is UNVERIFIED, we redirect to "link via password first".
          if (user.status === AccountStatus.UNVERIFIED_EMAIL) {
            // Don't link — let the frontend handle this case via the error redirect
            return done(null, false);
          }
          user.googleId = googleId;
          if (user.authMethod === AuthMethod.PASSWORD) {
            user.authMethod = AuthMethod.BOTH;
          }
          await user.save();
          return done(null, user);
        }

        // 3. Brand new user — create a PENDING account
        // Role defaults to INTERN for self-registration via Google.
        // HR can change the role after verification.
        const verificationExpiresAt = new Date();
        verificationExpiresAt.setDate(verificationExpiresAt.getDate() + 30);

        const newUser = await User.create({
          email,
          firstName,
          lastName,
          googleId,
          role: Role.INTERN,
          status: AccountStatus.PENDING_HR_VERIFICATION,
          authMethod: AuthMethod.GOOGLE,
          verificationExpiresAt,
        });

        return done(null, newUser);
      } catch (err) {
        return done(err as Error);
      }
    },
  ),
);

export default passport;
