# Testing Customer Flags - Manual Test Data

## 🎯 Quick Test Setup

### Step 1: Add Test Customers to Firebase

Add these test users under `users/` in Firebase:

```json
{
  "testCustomer1": {
    "name": "Maria Santos",
    "email": "maria.test@example.com",
    "phoneNumber": "+639123456789",
    "userType": "PASSENGER",
    "flagScore": 0,
    "flagStatus": "good"
  },
  "testCustomer2": {
    "name": "Juan Dela Cruz",
    "email": "juan.test@example.com",
    "phoneNumber": "+639987654321",
    "userType": "PASSENGER",
    "flagScore": 0,
    "flagStatus": "good"
  },
  "testCustomer3": {
    "name": "Pedro Reyes",
    "email": "pedro.test@example.com",
    "phoneNumber": "+639111222333",
    "userType": "PASSENGER",
    "flagScore": 0,
    "flagStatus": "good"
  }
}
```

### Step 2: Add Test Bookings

Add these bookings under `bookings/` to trigger flags:

#### Test No-Show Pattern (Maria - 40% no-show rate)
```json
{
  "booking1": {
    "customerId": "testCustomer1",
    "driverId": "driver1",
    "status": "completed",
    "timestamp": 1730000000
  },
  "booking2": {
    "customerId": "testCustomer1",
    "driverId": "driver1",
    "status": "no-show",
    "customerNoShow": true,
    "timestamp": 1730100000
  },
  "booking3": {
    "customerId": "testCustomer1",
    "driverId": "driver1",
    "status": "completed",
    "timestamp": 1730200000
  },
  "booking4": {
    "customerId": "testCustomer1",
    "driverId": "driver1",
    "status": "no-show",
    "customerNoShow": true,
    "timestamp": 1730300000
  },
  "booking5": {
    "customerId": "testCustomer1",
    "driverId": "driver1",
    "status": "completed",
    "timestamp": 1730400000
  }
}
```
**Expected Result:** 🚩 Maria Santos - No-Show Pattern (40% = 2/5 bookings)

#### Test Excessive Cancellations (Juan - 30% cancellation)
```json
{
  "booking6": {
    "customerId": "testCustomer2",
    "driverId": "driver1",
    "status": "completed",
    "timestamp": 1730000000
  },
  "booking7": {
    "customerId": "testCustomer2",
    "driverId": "driver1",
    "status": "cancelled",
    "cancelledBy": "customer",
    "timestamp": 1730100000
  },
  "booking8": {
    "customerId": "testCustomer2",
    "driverId": "driver1",
    "status": "completed",
    "timestamp": 1730200000
  },
  "booking9": {
    "customerId": "testCustomer2",
    "driverId": "driver1",
    "status": "cancelled",
    "cancelledBy": "customer",
    "timestamp": 1730300000
  },
  "booking10": {
    "customerId": "testCustomer2",
    "driverId": "driver1",
    "status": "cancelled",
    "cancelledBy": "customer",
    "timestamp": 1730400000
  },
  "booking11": {
    "customerId": "testCustomer2",
    "driverId": "driver1",
    "status": "completed",
    "timestamp": 1730500000
  },
  "booking12": {
    "customerId": "testCustomer2",
    "driverId": "driver1",
    "status": "completed",
    "timestamp": 1730600000
  },
  "booking13": {
    "customerId": "testCustomer2",
    "driverId": "driver1",
    "status": "completed",
    "timestamp": 1730700000
  },
  "booking14": {
    "customerId": "testCustomer2",
    "driverId": "driver1",
    "status": "completed",
    "timestamp": 1730800000
  },
  "booking15": {
    "customerId": "testCustomer2",
    "driverId": "driver1",
    "status": "completed",
    "timestamp": 1730900000
  }
}
```
**Expected Result:** 🚩 Juan Dela Cruz - Excessive Cancellations (30% = 3/10 bookings)

#### Test Non-Payment (Pedro)
```json
{
  "booking16": {
    "customerId": "testCustomer3",
    "driverId": "driver1",
    "status": "completed",
    "nonPayment": true,
    "paymentStatus": "unpaid",
    "timestamp": 1730000000
  }
}
```
**Expected Result:** 🚩 Pedro Reyes - Non-Payment (1 incident)

#### Test Abusive Behavior (Pedro)
```json
{
  "booking17": {
    "customerId": "testCustomer3",
    "driverId": "driver1",
    "status": "completed",
    "abusiveCustomer": true,
    "driverReportedAbuse": true,
    "timestamp": 1730100000
  }
}
```
**Expected Result:** 🚩 Pedro Reyes - Abusive Behavior (1 report)

#### Test Wrong PIN (Maria)
```json
{
  "booking18": {
    "customerId": "testCustomer1",
    "driverId": "driver1",
    "status": "completed",
    "wrongPin": true,
    "incorrectLocation": true,
    "timestamp": 1730500000
  },
  "booking19": {
    "customerId": "testCustomer1",
    "driverId": "driver1",
    "status": "completed",
    "wrongPin": true,
    "timestamp": 1730600000
  }
}
```
**Expected Result:** 🚩 Maria Santos - Wrong Location PIN (40% = 2/5 additional bookings)

---

## 🔧 Step 3: Run Auto-Detection

1. Open the Flagged Accounts page
2. Click **"🔍 Run Auto-Detection"** button
3. Watch the progress modal (will show 9 steps)
4. Check the results for your test customers

---

## 📊 Expected Results Summary

| Customer | Flags Expected |
|----------|---------------|
| Maria Santos | No-Show Pattern (100 pts) + Wrong PIN (50 pts) = 150 pts (Restricted) |
| Juan Dela Cruz | Excessive Cancellations (75 pts) = 75 pts (Monitored) |
| Pedro Reyes | Non-Payment (100 pts) + Abusive Behavior (100 pts) = 200 pts (Restricted) |

---

## 🧹 Cleanup After Testing

To remove test data:
1. Delete test customers from `users/` node
2. Delete test bookings from `bookings/` node
3. Delete any flags from `userFlags/` node

