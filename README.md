# Campus Service Request & Issue Management System (Backend)

CS3542 – Full Stack Development-II Lab. Built with Node.js, Express, MongoDB (Mongoose), JWT and bcrypt.

## How to run
```bash
npm install
# make sure MongoDB is running, and check the values in .env
npm run seed:admin     # creates admin@campus.com/admin123 and staff@campus.com/staff123
npm start              # server on http://localhost:5000
```

## Folder structure
```
server.js                 -> app setup, DB connection, routes
models/User.js            -> User schema
models/ServiceRequest.js  -> Request schema + status workflow rules
middleware/auth.js        -> protect (JWT check) and allowRoles (role check)
routes/auth.js            -> register, login
routes/requests.js        -> CRUD + status + assign
routes/admin.js           -> dashboard statistics (aggregation)
seedAdmin.js              -> creates admin users
```

## API endpoints
For protected routes, send this header: `Authorization: Bearer <token>`

| Method | Endpoint | Access | Example body |
|---|---|---|---|
| POST | /api/auth/register | Public | `{"name":"Ravi","email":"ravi@test.com","password":"pass123","department":"CSE"}` |
| POST | /api/auth/login | Public | `{"email":"ravi@test.com","password":"pass123"}` |
| POST | /api/requests | Student | `{"title":"WiFi down","description":"No internet in lab 3","category":"Internet"}` |
| GET | /api/requests | Student / Admin | query: `?status=Pending&priority=High&category=Internet&search=wifi` |
| GET | /api/requests/:id | Owner / Admin | – |
| PUT | /api/requests/:id | Owner (only while Pending) | `{"title":"...","description":"...","category":"..."}` |
| DELETE | /api/requests/:id | Owner (only while Pending) / Admin | – |
| PUT | /api/requests/:id/status | Admin | `{"status":"Under Review","priority":"High","adminResponse":"Checking"}` |
| PUT | /api/requests/:id/assign | Admin | `{"assignedTo":"<staff user id>"}` |
| GET | /api/admin/dashboard | Admin | – |

Categories: Computer, Classroom Equipment, Internet, Hostel, Electrical, Library, Other
Priorities: Low, Medium, High

## Status workflow
```
Pending -> Under Review -> Assigned -> In Progress -> Resolved -> Closed
Pending / Under Review -> Rejected
```
The `ALLOWED_NEXT` object in `models/ServiceRequest.js` lists which status can come next. The status route checks it, so an invalid jump such as Pending -> Closed is rejected with error 400. Moving to "Assigned" is done through the `/assign` route, because a staff member has to be chosen.

## How it works (for the viva)
- **Password security**: passwords are hashed with `bcrypt.hash()` before saving. At login, `bcrypt.compare()` checks the password.
- **JWT**: login returns a token that holds the user id and role. The `protect` middleware verifies the token and loads the user into `req.user`. A missing or invalid token gives 401.
- **Roles**: `allowRoles("admin")` blocks the wrong role with 403. Ownership is checked by comparing `request.createdBy` with `req.user._id`. A non-owner gets 403.
- **Relationships**: `createdBy` and `assignedTo` are ObjectId references to the User collection. `.populate()` fills in the user details.
- **Student vs admin list**: for a student, the filter adds `createdBy = own id`. An admin sees all requests and can filter by status, priority and category, or search by title or description.
- **Dashboard**: one `aggregate()` with `$facet` counts the total, the count for each status, high priority requests and the count for each category.
- **Register** creates only students, so nobody can make themselves an admin. Admins are created by `seedAdmin.js`.
- **Error codes**: 400 for invalid input, 401 for unauthorized, 403 for forbidden, 404 for not found, 500 for server errors.
