# Authentication & Profile API Documentation

## 1. Authentication Flow

### 1.1 Client Authentication (Firebase)

The user logs in using Firebase Auth with:

-   Email and password\
-   Google account\
-   Microsoft account

After authentication, the frontend obtains the Firebase **idToken**.

------------------------------------------------------------------------

### 1.2 Call to Auth API

The frontend sends the idToken to the authentication API:

-   `POST https://hw-cloud-authenticator-1cd72b9a454a.herokuapp.com/auth/login`
-   `POST /auth/microsoft`

#### Payload:

``` json
{
  "idToken": "<firebaseIdToken>"
}
```

------------------------------------------------------------------------

### 1.3 API Response

The API:

1.  Validates the idToken\
2.  Resolves the tenant and collaborator context\
3.  Returns:
    -   Application access token\
    -   User data (tenantId, collabId, etc.)

------------------------------------------------------------------------

### 1.4 Client Persistence

The frontend:

-   Stores the token and IDs in cookies\
-   Uses localStorage as fallback\
-   Sends the token in all requests to the Core API

------------------------------------------------------------------------

## 2. Profile Section -- Core API Consumption

### 2.1 Base URL

    NEXT_PUBLIC_API_CORE_URL_PROD = https://api-core.hywork.cloud

------------------------------------------------------------------------

### 2.2 Required Headers

All requests must include:

    Authorization: Bearer <token>
    x-tenant-id: <tenantId>

When applicable:

    x-collab-id: <collabId>
    x-user-id: <userId>

------------------------------------------------------------------------

## 3. Profile Endpoints

### 3.1 Fetch Profile by Slug

**Route**

    GET /collabs/slug/:slug

**Example**

    GET {CORE_API_URL}/collabs/slug/joao-silva

**Response includes fields such as:** - id\
- name\
- email\
- thumbnail\
- access_level\
- organizational_structures\
- occupations

------------------------------------------------------------------------

### 3.2 Fetch Profile by ID (UUID)

    GET /collabs/:id

------------------------------------------------------------------------

### 3.3 Fetch Profile by Firebase UID

    GET /collabs/auth/:id_ref_auth

------------------------------------------------------------------------

### 3.4 Update Profile

    PATCH /collabs/:id

#### Body (UpdateCollaboratorInput)

``` json
{
  "name": "string",
  "description": "string",
  "email": "string",
  "thumb": "string",
  "phone": "string",
  "active": true,
  "birthday": "1990-05-15",
  "hire_date": "2020-01-10",
  "id_access_level": "string"
}
```

All fields are optional.

------------------------------------------------------------------------

## 4. Profile-Related API Routes (/collabs)

### 4.1 Basic Profile Data

  Method   Route                        Description
  -------- ---------------------------- -------------------------
  GET      /collabs/slug/:slug          Profile by slug
  GET      /collabs/:id                 Profile by ID
  GET      /collabs/auth/:id_ref_auth   Profile by Firebase UID
  PATCH    /collabs/:id                 Update collaborator
  PATCH    /collabs/:id/password        Change password

------------------------------------------------------------------------

### 4.2 Occupations

  Method   Route
  -------- ------------------------------------
  GET      /collabs/:id/occupations
  GET      /collabs/:id/occupations/current
  POST     /collabs/:id/occupations
  GET      /collabs/occupations/:occupationId
  PATCH    /collabs/occupations/:occupationId
  DELETE   /collabs/occupations/:occupationId

------------------------------------------------------------------------

### 4.3 Testimonials

  Method   Route
  -------- ------------------------------------
  GET      /collabs/:id/testimonials/stats
  GET      /collabs/:id/testimonials/received
  GET      /collabs/:id/testimonials/sent
  POST     /collabs/testimonials
  GET      /collabs/testimonials
  GET      /collabs/testimonials/:id
  PATCH    /collabs/testimonials/:id
  PATCH    /collabs/testimonials/:id/read
  DELETE   /collabs/testimonials/:id

------------------------------------------------------------------------

### 4.4 Additional Routes

  Method   Route
  -------- --------------------------
  GET      /collabs
  GET      /collabs/all/paginated
  GET      /collabs/birthdays/today
  GET      /collabs/birthdays/week
  GET      /collabs/birthdays/month
  GET      /collabs/company-time
  GET      /collabs/new-hires

------------------------------------------------------------------------

## 5. Practical Examples

### Fetch Profile (Mobile App)

    GET https://api-core.hywork.cloud/collabs/slug/joao-silva

Headers:

    Authorization: Bearer <token>
    x-tenant-id: <tenantId>

------------------------------------------------------------------------

### Update Profile

    PATCH https://api-core.hywork.cloud/collabs/{id}

Body according to UpdateCollaboratorInput.

------------------------------------------------------------------------

## Executive Summary

-   Profile page route: `/user/[slug]`
-   Main endpoints:
    -   GET /collabs/slug/:slug
    -   GET /collabs/:id
    -   GET /collabs/auth/:id_ref_auth
-   Covers:
    -   Profile updates
    -   Occupation management
    -   Testimonial management
    -   Auxiliary listings
-   All requests require valid token and tenant header.
