# Security Specification for KALUNEVA2024

## Data Invariants
1. A user can only access their own profile if they are a 'cliente' or 'productor'.
2. Staff (admin, dueno, supervisor, cajero) can access inventory and sales.
3. Inventory can only be modified by authorized staff.
4. Sales records are immutable once created.

## Dirty Dozen Payloads (Rejection Targets)
1. **The ID Ghost**: Modifying another user's profile with a guessed ID.
2. **The Zero Cost**: Creating a sale with a manual total of 0 despite the items.
3. **The Role Escalation**: A 'cliente' attempting to update their role to 'admin'.
4. **The Shadow Stock**: Setting negative stock in inventory.
5. **The Time Machine**: Setting a custom past date for a sale.
6. **The Negative Debt**: A client setting their balance to a negative value.
7. **The Price Whisperer**: Updating a product's cost_usd as a cajero.
8. **The Anonymous Write**: Attempting to create a sale without authentication.
9. **The Large Payload**: Trying to store a 5MB base64 string in a text field.
10. **The Field Injection**: Adding 'isAdmin: true' to a user profile object.
11. **The Batch Overflow**: Attempting to delete 500 records at once.
12. **The ID Poisoning**: Using a 2KB string as a document ID.
