# Requirements Document

## Introduction

UrbanLens is an AI-powered urban infrastructure intelligence platform that enables citizens to crowdsource road damage reports (photo + GPS) and provides authorities with ranked, AI-verified damage zones, and repair tracking tools. The system combines a Node.js/Express/MongoDB backend, a vanilla HTML + CSS + JavaScript PWA frontend, and a Python FastAPI ML microservice running EfficientNet-B0 (image classification), DBSCAN (spatial clustering), and a custom urgency ranking engine.

---

## Glossary

- **System**: The UrbanLens platform as a whole
- **Citizen**: An authenticated user with role `user` who submits and tracks road damage reports
- **Authority**: An authenticated user with role `admin` or `ward_authority` who manages damage zones and repairs
- **Report**: A single citizen-submitted road damage record containing an image, GPS coordinates, description, and ML-derived metadata
- **Image_Classifier**: The EfficientNet-B0 CNN model hosted on the ML Service that classifies damage type and severity from a report image
- **ML_Service**: The Python FastAPI microservice exposing `/predict`, `/cluster`, and `/weather` endpoints
- **Backend**: The Node.js + Express + MongoDB service that orchestrates all business logic and data persistence
- **Frontend**: The vanilla HTML + CSS + JavaScript PWA that Citizens and Authorities interact with
- **DBSCAN_Clusterer**: The scikit-learn DBSCAN algorithm running on the ML Service that groups spatially proximate Reports into Damage Zones
- **Damage_Zone**: A cluster of one or more Reports within a 75-metre radius, representing a single infrastructure problem area
- **Urgency_Score**: A numeric value in the range 0–10 computed by the Ranking_Engine for each Damage Zone
- **Ranking_Engine**: The Backend component that computes Urgency_Score from severity, traffic weight, road type weight, cluster size, and rainfall factor
- **Heatmap**: A Leaflet.js map layer on the Frontend that visualises Report density and Urgency_Score across the city
- **Ward**: An administrative geographic subdivision of the city used for comparative analytics
- **Repair_Record**: A Backend entity created by an Authority to log a repair action against a Damage Zone
- **Credibility_Score**: A per-Citizen numeric weight (0–1) that modulates the influence of that Citizen's Reports on Urgency_Score computation
- **JWT**: JSON Web Token used for stateless authentication between Frontend and Backend

---

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a Citizen or Authority, I want to register and log in securely, so that I can access role-appropriate features of the platform.

#### Acceptance Criteria

1. WHEN a registration request is received with a unique username and password, THE Backend SHALL create a User record with the specified role (`user`, `admin`, or `ward_authority`) and return a signed JWT.
2. WHEN a registration request is received with a username that already exists, THE Backend SHALL return HTTP 400 with a descriptive error message.
3. WHEN a login request is received with valid credentials, THE Backend SHALL return a signed JWT containing the user ID and role, valid for 30 days.
4. WHEN a login request is received with invalid credentials, THE Backend SHALL return HTTP 401 with a descriptive error message.
5. WHEN an authenticated request is received with a valid JWT, THE Backend SHALL attach the resolved User object to the request context before routing.
6. WHEN an authenticated request is received with an expired or malformed JWT, THE Backend SHALL return HTTP 401.
7. THE Backend SHALL store passwords as bcrypt hashes with a minimum cost factor of 10; plaintext passwords SHALL NOT be persisted.

---

### Requirement 2: Citizen Report Submission

**User Story:** As a Citizen, I want to submit a road damage report with a photo and GPS location, so that the platform can assess and track the damage.

#### Acceptance Criteria

1. WHEN a Citizen submits a report with a valid image file and GPS coordinates, THE Backend SHALL persist a Report record and forward the image and coordinates to the ML Service `/predict` endpoint.
2. WHEN the ML Service `/predict` response is received, THE Backend SHALL update the Report with `damageType`, `severity` (1–5), and set `status` to `Verified`.
3. IF the ML Service `/predict` endpoint is unreachable, THEN THE Backend SHALL persist the Report with `status` set to `Pending` and `damageType` set to `Evaluating`, without failing the citizen-facing request.
4. WHEN a report submission request is received without an image or without GPS coordinates, THE Backend SHALL return HTTP 400 with a descriptive error message.
5. THE Image_Classifier SHALL accept JPEG and PNG images up to 10 MB and return `damageType` (one of: `Pothole`, `Crack`, `Waterlogging`) and `severity` (integer 1–5).
6. WHEN the Image_Classifier determines that an uploaded image does not contain road infrastructure, THE Image_Classifier SHALL return `damageType: "None"` and `severity: 0`, and THE Backend SHALL reject the Report with HTTP 422 and a descriptive error message.
7. THE Backend SHALL store uploaded images either on the local filesystem under `/uploads` or on Cloudinary, and persist the resulting URL in the Report's `imageUrl` field.
8. WHEN a Citizen submits a report, THE Backend SHALL associate the Report with the authenticated Citizen's user ID.

---

### Requirement 3: Spatial Clustering into Damage Zones

**User Story:** As an Authority, I want nearby reports to be automatically grouped into damage zones, so that I can assess the true extent of an infrastructure problem rather than individual complaints.

#### Acceptance Criteria

1. WHEN the Backend triggers clustering, THE ML_Service SHALL execute DBSCAN with `eps = 75` metres and `min_samples = 1` over all `Verified` Reports and return a list of Damage Zone objects, each containing a zone ID, member Report IDs, centroid coordinates, and cluster size.
2. WHEN clustering produces a Damage Zone, THE Backend SHALL persist or update a DamageZone document in MongoDB with the centroid, member Report IDs, cluster size, and a computed Urgency_Score.
3. WHEN a Report is classified as DBSCAN noise (no cluster), THE Backend SHALL retain the Report as a standalone Damage Zone with cluster size 1.
4. THE Backend SHALL trigger clustering automatically after every 10 new `Verified` Reports are accumulated since the last clustering run.
5. THE Backend SHALL expose a `POST /api/zones/cluster` endpoint that Authorities with role `admin` can call to trigger clustering on demand.
6. WHEN clustering completes, THE Backend SHALL update the `damageZoneId` field on each member Report to reference the corresponding Damage Zone.

---

### Requirement 4: Urgency Score Computation

**User Story:** As an Authority, I want each damage zone to have a computed urgency score, so that I can prioritise repairs objectively.

#### Acceptance Criteria

1. WHEN a Damage Zone is created or updated, THE Ranking_Engine SHALL compute an Urgency_Score using the formula: `score = clamp((avg_severity × 0.35 + traffic_weight × 0.25 + road_type_weight × 0.20 + log(cluster_size + 1) × 0.10 + rainfall_factor × 0.10) × 10 / max_possible, 0, 10)`, where `clamp` constrains the result to [0, 10].
2. THE Ranking_Engine SHALL assign `traffic_weight` values: `arterial = 1.0`, `collector = 0.7`, `residential = 0.4`, `unknown = 0.5`.
3. THE Ranking_Engine SHALL assign `road_type_weight` values: `highway = 1.0`, `main_road = 0.8`, `lane = 0.5`, `unknown = 0.6`.
4. WHEN rainfall data is unavailable from the Open-Meteo API, THE Ranking_Engine SHALL use `rainfall_factor = 0.5` as a default.
5. THE Ranking_Engine SHALL fetch 7-day cumulative rainfall for the Damage Zone centroid coordinates from the Open-Meteo API and derive `rainfall_factor` as `min(cumulative_mm / 100, 1.0)`.
6. WHEN a Damage Zone's Urgency_Score is computed, THE Backend SHALL persist the score and the timestamp of computation in the DamageZone document.
7. WHERE Citizen Credibility_Score is enabled, THE Ranking_Engine SHALL weight each Report's severity contribution by the submitting Citizen's Credibility_Score before averaging.

---

### Requirement 5: City Heatmap and Public Map View

**User Story:** As a Citizen, I want to view a live heatmap of road damage across the city, so that I can understand infrastructure conditions in my area.

#### Acceptance Criteria

1. THE Frontend SHALL render a Leaflet.js map centred on the city with a heatmap layer derived from Report coordinates and Urgency_Score values.
2. WHEN a Citizen taps a map marker, THE Frontend SHALL display a popup showing damage type, severity, status, and submission date for that Report.
3. THE Frontend SHALL update the heatmap layer without a full page reload when new Reports are loaded.
4. THE Backend SHALL expose a `GET /api/reports/map` endpoint that returns all `Verified` and `In Progress` Reports with coordinates, severity, damageType, and status, without requiring authentication.
5. WHEN the map data request returns more than 500 Reports, THE Backend SHALL return a spatially sampled subset of 500 representative points to maintain Frontend rendering performance.

---

### Requirement 6: Authority Dashboard — Damage Zone Management

**User Story:** As an Authority, I want a dashboard showing ranked damage zones with urgency scores, so that I can make informed repair prioritisation decisions.

#### Acceptance Criteria

1. THE Backend SHALL expose a `GET /api/zones` endpoint, accessible only to users with role `admin` or `ward_authority`, that returns all Damage Zones sorted by Urgency_Score descending.
2. WHEN an Authority requests the damage zone list, THE Backend SHALL include for each zone: zone ID, centroid coordinates, cluster size, top damage type, average severity, Urgency_Score, status, and last updated timestamp.
3. THE Frontend SHALL render the damage zone list as a sortable, filterable table with columns for rank, location, damage type, severity, urgency score, cluster size, and status.
4. WHEN an Authority selects a Damage Zone on the dashboard, THE Frontend SHALL display a detail panel showing all member Reports, a zone-level map, urgency score breakdown, and available actions.
5. THE Frontend SHALL allow Authorities to filter damage zones by status (`Open`, `In Progress`, `Resolved`), damage type, and Ward.
6. WHEN an Authority updates a Damage Zone's status, THE Backend SHALL persist the new status and broadcast the change to connected Frontend clients via Server-Sent Events.

---

### Requirement 7: Repair Tracking and Status Updates

**User Story:** As an Authority, I want to log repair actions and update damage zone status, so that I can track repair progress and demonstrate accountability.

#### Acceptance Criteria

1. WHEN an Authority submits a repair action for a Damage Zone, THE Backend SHALL create a Repair_Record containing: zone ID, authority user ID, action description, scheduled date, and `status` set to `Scheduled`.
2. WHEN an Authority marks a Repair_Record as `Completed`, THE Backend SHALL update the associated Damage Zone's status to `Resolved` and record the completion timestamp.
3. THE Backend SHALL expose `POST /api/zones/:id/repairs` and `PATCH /api/zones/:id/repairs/:repairId` endpoints, accessible only to `admin` and `ward_authority` roles.
4. WHEN a Damage Zone's status changes to `In Progress` or `Resolved`, THE Backend SHALL update the `status` field on all member Reports to match.
5. WHEN a Citizen queries the status of their submitted Report, THE Backend SHALL return the current `status`, the associated Damage Zone ID (if any), and the latest Repair_Record description (if any).
6. THE Frontend SHALL display a status timeline for each Report on the Citizen's "My Reports" page, showing transitions from `Pending` → `Verified` → `In Progress` → `Resolved` with timestamps.

---

### Requirement 9: Ward-Level Comparative Analytics

**User Story:** As a Citizen or Authority, I want to compare infrastructure conditions across wards, so that I can identify which areas are most neglected.

#### Acceptance Criteria

1. THE Backend SHALL expose a `GET /api/analytics/wards` endpoint that returns per-Ward aggregates: total Reports, open Damage Zones, average Urgency_Score, and resolution rate (percentage of Resolved zones).
2. THE Frontend SHALL render ward comparison data as a bar chart (Recharts) showing average Urgency_Score per Ward.
3. WHEN a Citizen views the ward comparison page, THE Frontend SHALL highlight the Ward with the highest average Urgency_Score.
4. THE Backend SHALL recompute ward aggregates at most once every 30 minutes and cache the result; subsequent requests within the window SHALL receive the cached response.

---

### Requirement 10: Automated Report Generation

**User Story:** As an Authority, I want to generate and download infrastructure status reports, so that I can share findings with stakeholders and government bodies.

#### Acceptance Criteria

1. WHEN an Authority requests a report for a date range and optional Ward filter, THE Backend SHALL generate a PDF containing: summary statistics, top 10 Damage Zones by Urgency_Score, repair completion rate, and ward comparison chart.
2. THE Backend SHALL expose a `GET /api/reports/export` endpoint, accessible only to `admin` and `ward_authority` roles, that streams the generated PDF to the client.
3. WHEN report generation takes longer than 10 seconds, THE Backend SHALL return HTTP 202 with a job ID and expose a `GET /api/reports/export/:jobId` polling endpoint.

---

### Requirement 11: Progressive Web App (PWA) and Offline Support

**User Story:** As a Citizen, I want to use UrbanLens on my mobile browser with offline capability, so that I can submit reports even in areas with poor connectivity.

#### Acceptance Criteria

1. THE Frontend SHALL be configured as a PWA with a Web App Manifest and a Service Worker that caches the application shell and static assets.
2. WHEN a Citizen submits a report while offline, THE Frontend SHALL queue the report in IndexedDB and display a confirmation that the report will be submitted when connectivity is restored.
3. WHEN network connectivity is restored, THE Frontend SHALL automatically submit all queued reports from IndexedDB to the Backend and clear the queue.
4. THE Frontend SHALL display a visible offline indicator in the navigation bar when the device has no network connectivity.

---

### Requirement 12: Citizen Credibility Scoring

**User Story:** As the system, I want to weight report contributions by citizen credibility, so that verified and accurate reporters have more influence on urgency scores.

#### Acceptance Criteria

1. THE Backend SHALL maintain a `credibilityScore` field (float, 0–1, default 0.5) on each User document.
2. WHEN a Citizen's Report is confirmed accurate (status transitions to `Verified`), THE Backend SHALL increment that Citizen's `credibilityScore` by `0.05`, capped at `1.0`.
3. WHEN a Citizen's Report is rejected as a fake image (Image_Classifier returns `damageType: "None"`), THE Backend SHALL decrement that Citizen's `credibilityScore` by `0.1`, floored at `0.0`.
4. WHERE Credibility_Score weighting is enabled in system configuration, THE Ranking_Engine SHALL multiply each Report's severity by the submitting Citizen's `credibilityScore` before computing the zone average severity.

---

### Requirement 13: Image Parsing and Round-Trip Integrity

**User Story:** As the system, I want image metadata to be reliably serialised and deserialised, so that report data is never corrupted during storage or retrieval.

#### Acceptance Criteria

1. WHEN the Backend serialises a Report to JSON for API responses, THE Backend SHALL include all fields: `_id`, `citizen`, `imageUrl`, `location`, `description`, `damageType`, `severity`, `urgencyScore`, `status`, `damageZoneId`, `createdAt`, `updatedAt`.
2. WHEN the Backend deserialises a Report from a client request body, THE Backend SHALL validate that `latitude` and `longitude` are finite IEEE 754 doubles within the ranges [-90, 90] and [-180, 180] respectively.
3. FOR ALL valid Report objects serialised to JSON and then deserialised, THE Backend SHALL produce an object equivalent to the original (round-trip property).
4. WHEN a Report JSON payload contains a `coordinates` array with non-numeric values, THE Backend SHALL return HTTP 400 with a descriptive validation error.
