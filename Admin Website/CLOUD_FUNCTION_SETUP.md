# Cloud Function Setup for Firebase Authentication Sync

## Problem
The Role Management module creates user records in Realtime Database, but these accounts don't automatically appear in Firebase Authentication. This is because client-side SDKs cannot create Firebase Auth users on behalf of others.

## Solution
A Cloud Function that automatically creates Firebase Authentication users when admin/barker accounts are added to the database.

## Setup Instructions

### 1. Install Firebase CLI (if not already installed)
```powershell
npm install -g firebase-tools
```

### 2. Login to Firebase
```powershell
firebase login
```

### 3. Initialize Cloud Functions in your project
Navigate to your project directory:
```powershell
cd "c:\Users\Ron\VisualStudioCodeProjects\Admin Website"
firebase init functions
```

When prompted:
- **Select project**: Choose `toda-contribution-system`
- **Language**: JavaScript
- **ESLint**: No (or Yes if you prefer)
- **Install dependencies**: Yes

### 4. Replace the functions code
The `functions/` folder has already been created with:
- `package.json` - Dependencies
- `index.js` - Cloud Function code
- `.gitignore` - Git ignore rules

### 5. Install dependencies
```powershell
cd functions
npm install
```

### 6. Deploy the Cloud Function
```powershell
firebase deploy --only functions
```

This will deploy:
- `createAuthUserOnDatabaseWrite` - Automatically creates Firebase Auth users when database records are created
- `syncDatabaseUserToAuth` - Callable function to manually sync existing users

## How It Works

### Automatic Sync (New Users)
When you create a new admin/barker account through Role Management:

1. Record is written to `/users/{userId}` in Realtime Database
2. Cloud Function `createAuthUserOnDatabaseWrite` triggers
3. Function creates a Firebase Authentication user with:
   - Same UID as database record
   - Email (if provided)
   - Phone number (formatted to E.164: +639xxxxxxxxx)
   - Secure random password
4. Database record is updated with:
   - `firebaseAuthCreated: true`
   - `firebaseAuthCreatedAt: timestamp`
   - `authPasswordNeedsReset: true`
5. Password reset link is generated (if email exists)

### Manual Sync (Existing Users)
For the "Marites" account that already exists in the database:

#### Option A: Call the sync function from Firebase Console
1. Go to Firebase Console → Functions
2. Find `syncDatabaseUserToAuth`
3. Test with data: `{ "userId": "-Od921e_okpW8AIYdoyI" }`

#### Option B: Add a sync button to Role Management UI
I can add a "Sync to Auth" button next to each account that hasn't been synced yet.

#### Option C: Run sync script
Create a simple script that calls the function for all existing admin/barker accounts.

## Important Notes

### Password Handling
- **Current limitation**: Firebase Admin SDK cannot import custom password hashes without special configuration
- **Workaround**: The function generates a secure random password
- **Solution**: Users should use "Forgot Password" to reset their password
- **Future improvement**: Configure Firebase Auth to import custom password hashes (requires Firebase Auth hash parameters)

### Phone Number Format
- Firebase Authentication requires E.164 format: `+639xxxxxxxxx`
- Function automatically converts Philippine numbers:
  - `09123456789` → `+639123456789`
  - `639123456789` → `+639123456789`

### Database Region
The function is configured for `asia-southeast1` to match your database. If your database is in a different region, update the `region` parameter in `index.js`.

## Testing

After deployment, create a new admin/barker account through Role Management and verify:

1. ✅ Account appears in Firebase Authentication → Users
2. ✅ Email and phone number are correctly set
3. ✅ Database record has `firebaseAuthCreated: true`
4. ✅ User can reset password via "Forgot Password"

## Syncing Existing "Marites" Account

To sync the existing Marites account to Firebase Auth, you can:

### Quick Fix - Manual Creation
1. Go to Firebase Console → Authentication → Users
2. Click "Add User"
3. Enter:
   - **Email**: `marikari@gmail.com`
   - **Phone**: `+639876876876`
   - **Password**: (set a temporary password)
   - **User UID**: `-Od921e_okpW8AIYdoyI` (copy from database)

### Automated Fix - Call Cloud Function
After deploying the functions, I can create a simple utility page in your dashboard to sync existing accounts.

## Troubleshooting

### Function not triggering
- Check Firebase Console → Functions → Logs
- Verify function is deployed: `firebase functions:list`
- Check database rules allow the function to read/write

### Phone number errors
- Ensure phone numbers are in correct format
- Check Firebase Console → Authentication → Sign-in method → Phone is enabled

### Permission errors
- Firebase Admin SDK needs proper permissions
- Check Cloud Functions service account has "Firebase Admin" role

## Next Steps

Would you like me to:
1. ✅ Create a "Sync to Auth" button in the Role Management UI for existing accounts?
2. ✅ Add email notification when accounts are created (with password reset link)?
3. ✅ Configure password hash import so users keep their original passwords?
