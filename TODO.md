# siesta feature roadmap

- [x] Replace bearer-token access with a single-user, HttpOnly cookie session.
- [x] Bootstrap the initial account from `AUTH_USERNAME` and `AUTH_PASSWORD`, defaulting to `admin` / `password`.
- [x] Allow the signed-in user to change their password without replacing it from environment configuration.
- [x] Persist collections and named environments, including environment values, in SQLite.
- [x] Execute HTTP requests from the server and resolve `{{VARIABLE}}` placeholders from a selected environment.
- [x] Provide a browser UI for sign-in, composing a request, selecting an environment, and inspecting a response.
- [x] Add a collection and saved-request editor UI, with per-collection browser/backend execution selection.
- [x] Add environment editor UI with masked secret-value editing.
- [x] Support Basic and Bearer authentication helpers, multipart/form-data, and file uploads.
- [x] Import Postman collection JSON exports and individual Bruno `.bru` requests.
- [x] Add collection folders, Postman export, and saved request history.
- [x] Add request history, response search, and collection/environment backups.
- [ ] Add browser tests.
- [x] Add automated backend API tests.

## Desktop workspace redesign

- [x] Create UnoCSS design tokens for the dark-first/light theme, typography, HTTP method colours, status colours, borders, and focus states.
- [x] Add a typed frontend API service in frontend/src/logic that separates Hono communication from Vue components.
- [x] Add reusable UnoCSS UI primitives for buttons, icon buttons, tabs, menus, dialogs, toasts, tooltips, and loading/empty/error states.
- [x] Persist UI preferences and transient workspace state with localStorage/sessionStorage, including theme, panel sizes, active environment, selected collection, open request tabs, and drafts.
- [x] Build an IDE-style app shell with a top bar, collapsible/resizable navigation sidebar, workspace selector, global search, active environment selector, status, settings, and profile controls.
- [x] Replace the collection card with a hierarchical sidebar tree supporting nested folders, expand/collapse, method badges, descriptions, contextual actions, request duplication, and drag-and-drop organisation.
- [ ] Add collection overview editing for descriptions, variables, authentication, and scripts.
- [ ] Build a multi-tab request workspace with new-request controls, dirty indicators, close controls, draft recovery, and unsaved-change confirmation.
- [ ] Redesign the request builder with a method/URL action bar and Params, Authorization, Headers, Body, Pre-request Script, Tests, and Settings tabs.
- [ ] Add editable parameter and header tables with enablement, descriptions, variable interpolation, URL synchronisation, and common-header suggestions.
- [ ] Add API Key and OAuth 2.0 authentication helpers with masked sensitive fields.
- [ ] Add structured request body modes, URL-encoded fields, binary bodies, and CodeMirror or Monaco editing with JSON formatting and validation.
- [ ] Add pre-request scripts, response test scripts, and test-result reporting.
- [ ] Redesign the response inspector with metadata, no-response/loading/error states, and Pretty, Raw, Preview, Headers, Cookies, and Test Results tabs.
- [ ] Extend request execution responses with timing, size, timestamp, and safe preview/cookie metadata where available.
- [ ] Build dedicated environment management with active selection, rename/delete, import/export, secret masking, and unresolved-variable indication.
- [ ] Build a searchable/filterable history view with reopen, save-to-collection, and clear actions.
- [ ] Add Ctrl/Cmd+K command palette, keyboard shortcuts, global search, confirmation dialogs, and toast notifications.
- [ ] Make desktop panels responsive with mobile drawers and stacked workspace/response views.
- [ ] Add OpenAPI import, endpoint documentation browsing, schema inspection, and request creation from documented endpoints.
- [ ] Add API workspace support for mock servers and monitors.
