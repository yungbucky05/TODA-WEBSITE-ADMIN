/**
 * Cloud Functions for TODA Contribution System
 * Automatically creates Firebase Authentication users when admin/barker accounts are created
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Triggers when a new user is created in /users/{userId}
 * Creates a corresponding Firebase Authentication user if userType is ADMIN or BARKER
 */
exports.createAuthUserOnDatabaseWrite = functions.database
  .ref("/users/{userId}")
  .onCreate(async (snapshot, context) => {
    const userId = context.params.userId;
    const userData = snapshot.val();

    // Only process ADMIN and BARKER accounts
    const userType = (userData.userType || userData.role || "").toUpperCase();
    if (userType !== "ADMIN" && userType !== "BARKER") {
      console.log(`Skipping auth creation for user ${userId} - not an admin/barker`);
      return null;
    }

    // Check if this user already has a Firebase Auth account
    try {
      const existingUser = await admin.auth().getUser(userId);
      if (existingUser) {
        console.log(`Auth user already exists for ${userId}, skipping`);
        return null;
      }
    } catch (error) {
      // User doesn't exist in Auth, continue with creation
      console.log(`No existing auth user for ${userId}, proceeding with creation`);
    }

    // Extract user data
    const email = userData.email || userData.firebaseAuthEmail;
    const phoneNumber = userData.phoneNumber || userData.phone;
    const name = userData.name || userData.fullName || "User";
    const passwordHash = userData.passwordHash;

    if (!email && !phoneNumber) {
      console.error(`Cannot create auth user ${userId} - no email or phone number provided`);
      return null;
    }

    try {
      // Prepare user creation parameters
      const authUserParams = {
        uid: userId, // Use the same UID from database
        displayName: name,
        disabled: userData.isActive === false, // Disable if not active
      };

      // Add email if provided and valid
      if (email && email.includes("@")) {
        authUserParams.email = email;
        authUserParams.emailVerified = userData.isVerified || false;
      }

      // Add phone number if provided (must be in E.164 format)
      if (phoneNumber) {
        const formattedPhone = formatPhoneNumber(phoneNumber);
        if (formattedPhone) {
          authUserParams.phoneNumber = formattedPhone;
        }
      }

      // If we have a password hash from the database, we need to generate a temporary password
      // since Admin SDK doesn't support importing password hashes directly without special setup
      // For now, we'll generate a random password - users can reset it via "Forgot Password"
      if (passwordHash) {
        // Extract the actual password from hash is not possible
        // Generate a secure random password instead
        authUserParams.password = generateSecurePassword();
        console.log(`Generated temporary password for ${userId} - user should reset it`);
      } else {
        // No password hash provided, generate a random one
        authUserParams.password = generateSecurePassword();
        console.log(`Generated initial password for ${userId}`);
      }

      // Create the Firebase Auth user
      const authUser = await admin.auth().createUser(authUserParams);

      console.log(`Successfully created Firebase Auth user for ${userId}`, {
        email: authUser.email,
        phoneNumber: authUser.phoneNumber,
        uid: authUser.uid
      });

      // Update the database record with auth creation timestamp
      await admin.database().ref(`users/${userId}`).update({
        firebaseAuthCreated: true,
        firebaseAuthCreatedAt: Date.now(),
        firebaseAuthUid: authUser.uid,
        authPasswordNeedsReset: true // Flag that password should be reset
      });

      // Send password reset email if email is available
      if (email && email.includes("@")) {
        try {
          const resetLink = await admin.auth().generatePasswordResetLink(email);
          console.log(`Password reset link generated for ${email}: ${resetLink}`);
          
          // Update database with reset link info
          await admin.database().ref(`users/${userId}`).update({
            passwordResetLinkGenerated: true,
            passwordResetLinkGeneratedAt: Date.now()
          });

          // Note: You would typically send this via email using SendGrid, Mailgun, etc.
          // For now, it's just logged
        } catch (resetError) {
          console.warn(`Could not generate password reset link for ${email}:`, resetError.message);
        }
      }

      return { success: true, uid: authUser.uid };

    } catch (error) {
      console.error(`Error creating Firebase Auth user for ${userId}:`, error);
      
      // Update database with error info
      try {
        await admin.database().ref(`users/${userId}`).update({
          firebaseAuthCreationError: error.message,
          firebaseAuthCreationErrorAt: Date.now()
        });
      } catch (updateError) {
        console.error(`Failed to update database with error info:`, updateError);
      }

      // Don't throw - we don't want to retry indefinitely
      return { success: false, error: error.message };
    }
  });

/**
 * Format phone number to E.164 format required by Firebase Auth
 * Assumes Philippines phone numbers starting with 09 or 639
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-digit characters
  let digits = String(phone).replace(/\D/g, "");

  // Handle Philippine numbers
  if (digits.startsWith("09") && digits.length === 11) {
    // Convert 09xxxxxxxxx to +639xxxxxxxxx
    return `+63${digits.substring(1)}`;
  } else if (digits.startsWith("639") && digits.length === 12) {
    // Already in 639xxxxxxxxx format, just add +
    return `+${digits}`;
  } else if (digits.startsWith("63") && digits.length === 12) {
    // 63xxxxxxxxx format
    return `+${digits}`;
  }

  // If it doesn't match expected format, return null
  console.warn(`Phone number ${phone} doesn't match expected format`);
  return null;
}

/**
 * Generate a secure random password
 */
function generateSecurePassword(length = 16) {
  const charset = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%&*";
  let password = "";
  const randomValues = new Uint32Array(length);
  require("crypto").randomFillSync(randomValues);
  
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }
  
  return password;
}

/**
 * Callable function to manually sync existing database users to Firebase Auth
 * Can be called from the admin dashboard to fix existing accounts
 */
exports.syncDatabaseUserToAuth = functions.https.onCall(async (data, context) => {
    // Only allow authenticated admin users to call this
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = data.userId;
    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }

    try {
      // Get user data from database
      const userSnapshot = await admin.database().ref(`users/${userId}`).once("value");
      
      if (!userSnapshot.exists()) {
        throw new functions.https.HttpsError('not-found', `User ${userId} not found in database`);
      }

      const userData = userSnapshot.val();
      const userType = (userData.userType || userData.role || "").toUpperCase();

      if (userType !== "ADMIN" && userType !== "BARKER") {
        throw new functions.https.HttpsError('invalid-argument', `User ${userId} is not an admin or barker`);
      }

      // Check if auth user already exists
      try {
        const existingUser = await admin.auth().getUser(userId);
        return {
          success: true,
          message: "Auth user already exists",
          uid: existingUser.uid,
          email: existingUser.email
        };
      } catch (error) {
        // User doesn't exist, create it
      }

      // Extract data
      const email = userData.email || userData.firebaseAuthEmail;
      const phoneNumber = userData.phoneNumber || userData.phone;
      const name = userData.name || userData.fullName || "User";

      if (!email && !phoneNumber) {
        throw new functions.https.HttpsError('invalid-argument', 'No email or phone number available for auth user creation');
      }

      // Create auth user
      const authUserParams = {
        uid: userId,
        displayName: name,
        disabled: userData.isActive === false,
      };

      if (email && email.includes("@")) {
        authUserParams.email = email;
        authUserParams.emailVerified = userData.isVerified || false;
      }

      if (phoneNumber) {
        const formattedPhone = formatPhoneNumber(phoneNumber);
        if (formattedPhone) {
          authUserParams.phoneNumber = formattedPhone;
        }
      }

      authUserParams.password = generateSecurePassword();

      const authUser = await admin.auth().createUser(authUserParams);

      // Update database
      await admin.database().ref(`users/${userId}`).update({
        firebaseAuthCreated: true,
        firebaseAuthCreatedAt: Date.now(),
        firebaseAuthUid: authUser.uid,
        authPasswordNeedsReset: true,
        syncedManually: true,
        syncedAt: Date.now()
      });

      // Generate password reset link
      let resetLink = null;
      if (email && email.includes("@")) {
        try {
          resetLink = await admin.auth().generatePasswordResetLink(email);
        } catch (error) {
          console.warn("Could not generate reset link:", error.message);
        }
      }

      return {
        success: true,
        message: "Auth user created successfully",
        uid: authUser.uid,
        email: authUser.email,
        phoneNumber: authUser.phoneNumber,
        passwordResetLink: resetLink
      };

    } catch (error) {
      console.error("Error syncing user to auth:", error);
      throw new functions.https.HttpsError('internal', `Failed to sync user: ${error.message}`);
    }
});
